use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
    process::{Command, Output, Stdio},
    thread,
    time::{Duration, Instant},
};

#[cfg(windows)]
use std::time::{SystemTime, UNIX_EPOCH};

use regex::Regex;

use crate::{
    models::{ActionResult, NodeVersionResult, NodeVersionsResult},
    state::AppState,
};

const COMMAND_TIMEOUT: Duration = Duration::from_secs(5);
#[cfg(windows)]
const WINDOWS_UAC_TIMEOUT: Duration = Duration::from_secs(60);

fn current_env() -> HashMap<String, String> {
    env::vars().collect()
}

fn run_with_timeout(mut command: Command, timeout: Duration) -> Result<Output, String> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| format!("命令启动失败：{error}"))?;
    let started = Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                return child
                    .wait_with_output()
                    .map_err(|error| format!("读取命令输出失败：{error}"));
            }
            Ok(None) if started.elapsed() < timeout => {
                thread::sleep(Duration::from_millis(20));
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("命令执行超时".to_string());
            }
            Err(error) => return Err(format!("检查命令状态失败：{error}")),
        }
    }
}

fn command_with_env(
    program: &str,
    args: &[&str],
    environment: &HashMap<String, String>,
) -> Command {
    let mut command = Command::new(program);
    command.args(args).env_clear().envs(environment);
    command
}

fn login_shell() -> String {
    if cfg!(windows) {
        env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    } else {
        env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
}

pub fn get_shell_env(state: &AppState) -> HashMap<String, String> {
    if cfg!(windows) {
        return current_env();
    }

    if let Ok(cache) = state.shell_env.lock() {
        if let Some(environment) = cache.as_ref() {
            return environment.clone();
        }
    }

    let shell = login_shell();
    let mut command = Command::new(&shell);
    command.args(["-l", "-c", "env"]);
    let mut environment = match run_with_timeout(command, COMMAND_TIMEOUT) {
        Ok(output) if output.status.success() => {
            let mut values = current_env();
            for line in String::from_utf8_lossy(&output.stdout).lines() {
                if let Some((key, value)) = line.split_once('=') {
                    values.insert(key.to_string(), value.to_string());
                }
            }
            values
        }
        _ => current_env(),
    };

    #[cfg(not(windows))]
    apply_default_node_version(&mut environment);

    if let Ok(mut cache) = state.shell_env.lock() {
        *cache = Some(environment.clone());
    }
    environment
}

pub fn clear_shell_env_cache(state: &AppState) {
    if let Ok(mut cache) = state.shell_env.lock() {
        *cache = None;
    }
}

fn strip_npm_config_overrides(environment: &mut HashMap<String, String>) {
    environment.retain(|key, _| !key.to_ascii_lowercase().starts_with("npm_config_"));
}

fn read_project_registry(project_dir: &Path) -> Option<String> {
    let content = fs::read_to_string(project_dir.join(".npmrc")).ok()?;
    content.lines().find_map(|line| {
        let (key, value) = line.split_once('=')?;
        (key.trim() == "registry").then(|| value.trim().to_string())
    })
}

fn env_value(environment: &HashMap<String, String>, key: &str) -> Option<String> {
    environment
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case(key))
        .map(|(_, value)| value.clone())
}

fn nvm_paths(environment: &HashMap<String, String>) -> (Option<PathBuf>, Option<PathBuf>) {
    if cfg!(windows) {
        let home = env_value(environment, "NVM_HOME").map(PathBuf::from);
        return (home.clone(), home);
    }

    let home = environment.get("NVM_DIR").map(PathBuf::from).or_else(|| {
        environment
            .get("HOME")
            .map(|home| Path::new(home).join(".nvm"))
    });
    let versions = home.as_ref().map(|path| path.join("versions").join("node"));
    (home, versions)
}

fn installed_version_dir(environment: &HashMap<String, String>, version: &str) -> Option<PathBuf> {
    let (_, versions_dir) = nvm_paths(environment);
    let versions_dir = versions_dir?;
    let normalized = version.trim_start_matches('v');
    let candidates = if cfg!(windows) {
        vec![
            versions_dir.join(format!("v{normalized}")),
            versions_dir.join(normalized),
        ]
    } else {
        vec![versions_dir.join(format!("v{normalized}"))]
    };
    candidates.into_iter().find(|path| path.is_dir())
}

fn prepend_node_binary_path(environment: &mut HashMap<String, String>, version: &str) -> bool {
    let Some(version_dir) = installed_version_dir(environment, version) else {
        return false;
    };
    let binary_dir = if cfg!(windows) {
        version_dir
    } else {
        version_dir.join("bin")
    };
    if !binary_dir.is_dir() {
        return false;
    }

    let path_key = environment
        .keys()
        .find(|key| key.eq_ignore_ascii_case("PATH"))
        .cloned()
        .unwrap_or_else(|| "PATH".to_string());
    let current_path = environment.get(&path_key).cloned().unwrap_or_default();
    let mut paths = vec![binary_dir.clone()];
    paths.extend(env::split_paths(&current_path).filter(|path| path != &binary_dir));
    let Ok(next_path) = env::join_paths(paths) else {
        return false;
    };
    environment.insert(path_key, next_path.to_string_lossy().into_owned());
    true
}

#[cfg(not(windows))]
fn apply_default_node_version(environment: &mut HashMap<String, String>) {
    let Some(nvm_dir) = nvm_paths(environment).0 else {
        return;
    };
    let Ok(default_version) = fs::read_to_string(nvm_dir.join("alias").join("default")) else {
        return;
    };
    let default_version = default_version.trim();
    if valid_version(default_version) {
        prepend_node_binary_path(environment, default_version);
    }
}

pub fn is_node_version_installed(state: &AppState, version: &str) -> bool {
    installed_version_dir(&get_shell_env(state), version).is_some()
}

pub fn get_project_env(
    state: &AppState,
    node_version: Option<&str>,
    cwd: Option<&Path>,
) -> HashMap<String, String> {
    let mut environment = get_shell_env(state);
    if let Some(project_dir) = cwd {
        strip_npm_config_overrides(&mut environment);
        if let Some(registry) = read_project_registry(project_dir) {
            environment.insert("npm_config_registry".to_string(), registry);
        }
    }

    if let Some(version) = node_version {
        prepend_node_binary_path(&mut environment, version);
    }
    environment
}

fn parse_version(version: &str) -> Option<(u64, u64, u64)> {
    let mut parts = version.trim_start_matches('v').split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some((major, minor, patch))
}

fn valid_version(version: &str) -> bool {
    static VERSION_PATTERN: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    VERSION_PATTERN
        .get_or_init(|| Regex::new(r"^v?\d+\.\d+\.\d+$").expect("Node.js 版本规则无效"))
        .is_match(version)
}

fn normalize_node_version(version: &str) -> Option<String> {
    valid_version(version).then(|| format!("v{}", version.trim_start_matches('v')))
}

fn versions_match(expected: &str, actual: &str) -> bool {
    normalize_node_version(expected) == normalize_node_version(actual)
}

pub fn get_node_version(state: &AppState) -> NodeVersionResult {
    let environment = get_shell_env(state);
    let command = command_with_env("node", &["--version"], &environment);
    match run_with_timeout(command, COMMAND_TIMEOUT) {
        Ok(output) if output.status.success() => NodeVersionResult {
            version: Some(String::from_utf8_lossy(&output.stdout).trim().to_string()),
            error: None,
        },
        Ok(output) => NodeVersionResult {
            version: None,
            error: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        },
        Err(error) => NodeVersionResult {
            version: None,
            error: Some(error),
        },
    }
}

pub fn get_node_versions(state: &AppState) -> NodeVersionsResult {
    let environment = get_shell_env(state);
    let (_, versions_dir) = nvm_paths(&environment);
    let Some(versions_dir) = versions_dir.filter(|path| path.is_dir()) else {
        return NodeVersionsResult {
            versions: Vec::new(),
            current: None,
            error: Some(if cfg!(windows) {
                "未找到 NVM_HOME 环境变量".to_string()
            } else {
                "未找到 NVM 安装目录".to_string()
            }),
        };
    };

    let mut versions: Vec<String> = fs::read_dir(&versions_dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| valid_version(name))
        .map(|name| {
            if name.starts_with('v') {
                name
            } else {
                format!("v{name}")
            }
        })
        .collect();
    versions.sort_by_key(|version| std::cmp::Reverse(parse_version(version).unwrap_or_default()));

    let current = if cfg!(windows) {
        env_value(&environment, "NVM_SYMLINK")
            .and_then(|path| fs::read_link(path).ok())
            .and_then(|path| {
                path.file_name()
                    .map(|name| name.to_string_lossy().to_string())
            })
            .map(|version| {
                if version.starts_with('v') {
                    version
                } else {
                    format!("v{version}")
                }
            })
    } else {
        get_node_version(state).version
    }
    .or_else(|| versions.first().cloned());

    NodeVersionsResult {
        versions,
        current,
        error: None,
    }
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(windows)]
fn timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

#[cfg(windows)]
fn powershell_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(windows)]
fn update_windows_junction(
    junction: &str,
    target: Option<&Path>,
    rollback_target: Option<&Path>,
) -> Result<String, String> {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let suffix = format!("{}-{}", std::process::id(), timestamp_millis());
    let temp_dir = env::temp_dir();
    let batch_path = temp_dir.join(format!("nvm-switch-{suffix}.bat"));
    let output_path = temp_dir.join(format!("nvm-switch-{suffix}.txt"));
    let script_path = temp_dir.join(format!("nvm-switch-{suffix}.ps1"));
    let batch = "@echo off\r\nsetlocal EnableExtensions DisableDelayedExpansion\r\nif exist \"%NPM_LAUNCHER_LINK%\" rmdir \"%NPM_LAUNCHER_LINK%\"\r\nif errorlevel 1 exit /b 1\r\nif not defined NPM_LAUNCHER_TARGET exit /b 0\r\nmklink /J \"%NPM_LAUNCHER_LINK%\" \"%NPM_LAUNCHER_TARGET%\" > \"%NPM_LAUNCHER_OUTPUT%\" 2>&1\r\nif not errorlevel 1 exit /b 0\r\nset \"NPM_LAUNCHER_SWITCH_ERROR=%errorlevel%\"\r\nif not defined NPM_LAUNCHER_ROLLBACK goto switch_failed\r\nmklink /J \"%NPM_LAUNCHER_LINK%\" \"%NPM_LAUNCHER_ROLLBACK%\" >> \"%NPM_LAUNCHER_OUTPUT%\" 2>&1\r\n:switch_failed\r\nexit /b %NPM_LAUNCHER_SWITCH_ERROR%\r\n";
    fs::write(&batch_path, batch).map_err(|error| format!("创建切换脚本失败：{error}"))?;

    let target = target
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();
    let rollback_target = rollback_target
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();
    let script = format!(
        "$env:NPM_LAUNCHER_LINK = {}\r\n$env:NPM_LAUNCHER_TARGET = {}\r\n$env:NPM_LAUNCHER_ROLLBACK = {}\r\n$env:NPM_LAUNCHER_OUTPUT = {}\r\n$batchPath = {}\r\ntry {{\r\n  $arguments = '/d /c \"' + $batchPath + '\"'\r\n  $process = Start-Process -FilePath cmd.exe -ArgumentList $arguments -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ErrorAction Stop\r\n  exit $process.ExitCode\r\n}} catch {{\r\n  $_ | Out-File -LiteralPath $env:NPM_LAUNCHER_OUTPUT -Encoding utf8\r\n  exit 1\r\n}}\r\n",
        powershell_literal(junction),
        powershell_literal(&target),
        powershell_literal(&rollback_target),
        powershell_literal(&output_path.to_string_lossy()),
        powershell_literal(&batch_path.to_string_lossy())
    );
    if let Err(error) = fs::write(&script_path, script) {
        let _ = fs::remove_file(&batch_path);
        return Err(format!("创建提权脚本失败：{error}"));
    }

    let mut command = Command::new("powershell");
    command
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(&script_path)
        .creation_flags(CREATE_NO_WINDOW);
    let result = run_with_timeout(command, WINDOWS_UAC_TIMEOUT);
    let output = fs::read_to_string(&output_path).unwrap_or_default();
    let _ = fs::remove_file(&batch_path);
    let _ = fs::remove_file(&script_path);
    let _ = fs::remove_file(&output_path);

    let command_output = result?;
    if !command_output.status.success() {
        return Err(if output.trim().is_empty() {
            "管理员授权被取消或 Node.js 版本切换失败".to_string()
        } else {
            output.trim().to_string()
        });
    }
    Ok(output.trim().to_string())
}

#[cfg(windows)]
fn switch_windows_version(
    environment: &HashMap<String, String>,
    version: &str,
) -> Result<(), String> {
    let nvm_home =
        env_value(environment, "NVM_HOME").ok_or_else(|| "未找到 NVM_HOME 环境变量".to_string())?;
    if !Path::new(&nvm_home).is_dir() {
        return Err("NVM_HOME 目录不存在".to_string());
    }
    let nvm_symlink = env_value(environment, "NVM_SYMLINK")
        .ok_or_else(|| "未找到 NVM_SYMLINK 环境变量".to_string())?;
    let target = installed_version_dir(environment, version)
        .ok_or_else(|| format!("版本 {version} 未安装"))?;
    let original_target = fs::canonicalize(&nvm_symlink).ok();

    let unsafe_path = |value: &str| {
        value
            .chars()
            .any(|character| matches!(character, '"' | '\r' | '\n'))
    };
    if unsafe_path(&nvm_symlink)
        || unsafe_path(&target.to_string_lossy())
        || original_target
            .as_ref()
            .is_some_and(|path| unsafe_path(&path.to_string_lossy()))
    {
        return Err("nvm 路径包含不支持的字符".to_string());
    }

    update_windows_junction(&nvm_symlink, Some(&target), original_target.as_deref())?;

    let validation = (|| {
        let actual_target = fs::canonicalize(&nvm_symlink)
            .map_err(|error| format!("校验 NVM_SYMLINK 失败：{error}"))?;
        let expected_target = fs::canonicalize(&target)
            .map_err(|error| format!("校验目标 Node.js 目录失败：{error}"))?;
        if !actual_target
            .to_string_lossy()
            .eq_ignore_ascii_case(&expected_target.to_string_lossy())
        {
            return Err("NVM_SYMLINK 未指向目标 Node.js 版本".to_string());
        }

        let command = command_with_env("node", &["--version"], environment);
        let version_output = run_with_timeout(command, COMMAND_TIMEOUT)?;
        let actual_version = String::from_utf8_lossy(&version_output.stdout)
            .trim()
            .trim_start_matches('v')
            .to_string();
        if !version_output.status.success() || actual_version != version.trim_start_matches('v') {
            return Err(format!("Node.js 版本校验失败，当前为 v{actual_version}"));
        }
        Ok(())
    })();

    if let Err(error) = validation {
        return match update_windows_junction(
            &nvm_symlink,
            original_target.as_deref(),
            Some(&target),
        ) {
            Ok(_) => Err(format!("{error}；已恢复原 Node.js 版本")),
            Err(rollback_error) => Err(format!("{error}；恢复原版本失败：{rollback_error}")),
        };
    }
    Ok(())
}

#[cfg(not(windows))]
fn switch_unix_version(environment: &HashMap<String, String>, version: &str) -> Result<(), String> {
    let (nvm_dir, _) = nvm_paths(environment);
    let nvm_dir = nvm_dir.ok_or_else(|| "未找到 NVM 安装目录".to_string())?;
    let target_dir = installed_version_dir(environment, version)
        .ok_or_else(|| format!("版本 {version} 未安装"))?;
    let normalized =
        normalize_node_version(version).ok_or_else(|| "Node.js 版本格式不正确".to_string())?;

    let mut command = Command::new(target_dir.join("bin").join("node"));
    command.arg("--version").env_clear().envs(environment);
    let output = run_with_timeout(command, COMMAND_TIMEOUT)?;
    let actual = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !output.status.success() || !versions_match(version, &actual) {
        return Err(format!("Node.js 版本校验失败，当前为 {actual}"));
    }

    let alias_dir = nvm_dir.join("alias");
    fs::create_dir_all(&alias_dir).map_err(|error| format!("创建 NVM 别名目录失败：{error}"))?;
    fs::write(alias_dir.join("default"), format!("{normalized}\n"))
        .map_err(|error| format!("更新 NVM 默认版本失败：{error}"))?;
    Ok(())
}

pub fn switch_node_version(state: &AppState, version: &str) -> ActionResult {
    if !valid_version(version) {
        return ActionResult::failure("Node.js 版本格式不正确");
    }
    let environment = get_shell_env(state);

    #[cfg(windows)]
    let result = switch_windows_version(&environment, version);
    #[cfg(not(windows))]
    let result = switch_unix_version(&environment, version);

    match result {
        Ok(()) => {
            clear_shell_env_cache(state);
            #[cfg(not(windows))]
            if let Some(nvm_dir) = nvm_paths(&environment).0 {
                crate::terminal::broadcast_to_all_terminals(
                    state,
                    &format!(
                        "source {}/nvm.sh && nvm use {}",
                        shell_quote(&nvm_dir.to_string_lossy()),
                        shell_quote(version)
                    ),
                );
            }
            ActionResult::success()
        }
        Err(error) => ActionResult::failure(error),
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_node_version, versions_match};

    #[test]
    fn node_版本标准化保留统一_v_前缀() {
        assert_eq!(
            normalize_node_version("20.19.6"),
            Some("v20.19.6".to_string())
        );
        assert_eq!(
            normalize_node_version("v20.19.6"),
            Some("v20.19.6".to_string())
        );
        assert_eq!(normalize_node_version("20"), None);
    }

    #[test]
    fn node_版本比较忽略_v_前缀() {
        assert!(versions_match("20.19.6", "v20.19.6"));
        assert!(!versions_match("20.19.6", "v22.0.0"));
    }
}
