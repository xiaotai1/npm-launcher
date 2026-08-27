use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

use tauri::{AppHandle, Manager, State, Theme as NativeTheme};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

use crate::{
    config, environment, log,
    models::{
        ActionResult, AppConfig, ConfigTransferResult, ErrorAnalysis, Folder, NodeVersionResult,
        NodeVersionsResult, PackageScriptsResult, PathSelectionResult, ProcessStatus, Project,
        ProjectStartFailure, PtySpawnRequest, StartAllProjectsResult, Theme,
    },
    package, process,
    state::AppState,
    terminal,
};

fn selected_path(path: tauri_plugin_dialog::FilePath) -> Result<PathBuf, String> {
    path.into_path()
        .map_err(|error| format!("无法读取所选路径：{error}"))
}

fn desktop_directory(app: &AppHandle) -> PathBuf {
    app.path()
        .desktop_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn canonical_directory(path: &str) -> Result<PathBuf, String> {
    let canonical = fs::canonicalize(path).map_err(|error| format!("项目目录不可访问：{error}"))?;
    if !canonical.is_dir() {
        return Err("所选路径不是目录".to_string());
    }
    Ok(canonical)
}

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> AppConfig {
    config::load_config(&state.config_path)
}

#[tauri::command]
pub fn save_config(state: State<'_, AppState>, config_value: AppConfig) -> bool {
    config::save_config(&state.config_path, &config_value).is_ok()
}

#[tauri::command]
pub async fn export_config(app: AppHandle) -> ConfigTransferResult {
    let date = chrono::Local::now().format("%Y-%m-%d");
    let filename = format!("npm-launcher-config-{date}.json");
    let mut dialog = app
        .dialog()
        .file()
        .set_title("导出配置")
        .set_directory(desktop_directory(&app))
        .set_file_name(filename)
        .add_filter("配置文件", &["json"]);
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    let selected = dialog.blocking_save_file();
    let Some(selected) = selected else {
        return ConfigTransferResult {
            success: false,
            path: None,
            error: None,
        };
    };
    let path = match selected_path(selected) {
        Ok(path) => path,
        Err(error) => {
            return ConfigTransferResult {
                success: false,
                path: None,
                error: Some(error),
            }
        }
    };
    let state = app.state::<AppState>();
    let result = serde_json::to_string_pretty(&config::load_config(&state.config_path))
        .map_err(|error| format!("序列化配置失败：{error}"))
        .and_then(|content| {
            fs::write(&path, content).map_err(|error| format!("导出配置失败：{error}"))
        });
    match result {
        Ok(()) => ConfigTransferResult {
            success: true,
            path: Some(path.to_string_lossy().into_owned()),
            error: None,
        },
        Err(error) => ConfigTransferResult {
            success: false,
            path: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub async fn import_config(app: AppHandle) -> ConfigTransferResult {
    let mut dialog = app
        .dialog()
        .file()
        .set_title("导入配置")
        .add_filter("配置文件", &["json"]);
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    let selected = dialog.blocking_pick_file();
    let Some(selected) = selected else {
        return ConfigTransferResult {
            success: false,
            path: None,
            error: None,
        };
    };
    let path = match selected_path(selected) {
        Ok(path) => path,
        Err(error) => {
            return ConfigTransferResult {
                success: false,
                path: None,
                error: Some(error),
            }
        }
    };
    let state = app.state::<AppState>();
    let result = fs::read_to_string(&path)
        .map_err(|error| format!("读取配置失败：{error}"))
        .and_then(|content| {
            serde_json::from_str(&content).map_err(|error| format!("解析配置失败：{error}"))
        })
        .and_then(config::normalize_imported_config)
        .and_then(|value| {
            config::backup_config(&state.config_path, "import-backup")?;
            config::save_config(&state.config_path, &value)
        });
    match result {
        Ok(()) => {
            process::stop_all_processes(&app);
            terminal::kill_all_terminals(&state);
            ConfigTransferResult {
                success: true,
                path: Some(path.to_string_lossy().into_owned()),
                error: None,
            }
        }
        Err(error) => ConfigTransferResult {
            success: false,
            path: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub fn add_project(state: State<'_, AppState>, project: Project) -> bool {
    config::add_project(&state.config_path, project)
}

#[tauri::command]
pub fn update_project(state: State<'_, AppState>, project: Project) -> bool {
    config::update_project(&state.config_path, project)
}

#[tauri::command(rename_all = "camelCase")]
pub fn delete_project(app: AppHandle, state: State<'_, AppState>, project_id: String) -> bool {
    if process::is_process_running(&state, &project_id) {
        process::stop_project_process(&app, &project_id);
    }
    config::delete_project(&state.config_path, &project_id)
}

#[tauri::command(rename_all = "camelCase")]
pub fn reorder_projects(state: State<'_, AppState>, project_ids: Vec<String>) -> bool {
    config::reorder_projects(&state.config_path, &project_ids)
}

#[tauri::command(rename_all = "camelCase")]
pub fn reorder_folders(state: State<'_, AppState>, folder_ids: Vec<String>) -> bool {
    config::reorder_folders(&state.config_path, &folder_ids)
}

#[tauri::command]
pub fn add_folder(state: State<'_, AppState>, folder: Folder) -> bool {
    config::add_folder(&state.config_path, folder)
}

#[tauri::command]
pub fn update_folder(state: State<'_, AppState>, folder: Folder) -> bool {
    config::update_folder(&state.config_path, folder)
}

#[tauri::command(rename_all = "camelCase")]
pub fn delete_folder(state: State<'_, AppState>, folder_id: String) -> bool {
    config::delete_folder(&state.config_path, &folder_id)
}

#[tauri::command(rename_all = "camelCase")]
pub fn toggle_favorite(state: State<'_, AppState>, project_id: String) -> bool {
    config::toggle_favorite(&state.config_path, &project_id)
}

#[tauri::command(rename_all = "camelCase")]
pub fn move_project_to_folder(
    state: State<'_, AppState>,
    project_id: String,
    folder_id: Option<String>,
) -> bool {
    config::move_project_to_folder(&state.config_path, &project_id, folder_id)
}

#[tauri::command]
pub async fn get_node_version(app: AppHandle) -> NodeVersionResult {
    match tauri::async_runtime::spawn_blocking(move || {
        environment::get_node_version(&app.state::<AppState>())
    })
    .await
    {
        Ok(result) => result,
        Err(error) => NodeVersionResult {
            version: None,
            error: Some(format!("Node.js 版本探测任务异常：{error}")),
        },
    }
}

#[tauri::command]
pub async fn get_node_versions(app: AppHandle) -> NodeVersionsResult {
    match tauri::async_runtime::spawn_blocking(move || {
        environment::get_node_versions(&app.state::<AppState>())
    })
    .await
    {
        Ok(result) => result,
        Err(error) => NodeVersionsResult {
            versions: Vec::new(),
            current: None,
            error: Some(format!("Node.js 版本列表探测任务异常：{error}")),
        },
    }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn switch_node_version(app: AppHandle, version: String) -> ActionResult {
    match tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        environment::switch_node_version(&state, &version)
    })
    .await
    {
        Ok(result) => result,
        Err(error) => ActionResult::failure(format!("Node.js 版本切换任务异常：{error}")),
    }
}

#[tauri::command]
pub async fn select_folder(app: AppHandle) -> PathSelectionResult {
    let mut dialog = app.dialog().file().set_title("选择项目目录");
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    let selected = dialog.blocking_pick_folder();
    match selected.and_then(|path| selected_path(path).ok()) {
        Some(path) => PathSelectionResult {
            canceled: false,
            path: Some(path.to_string_lossy().into_owned()),
        },
        None => PathSelectionResult {
            canceled: true,
            path: None,
        },
    }
}

#[tauri::command]
pub fn get_package_scripts(dir: String) -> PackageScriptsResult {
    match canonical_directory(&dir) {
        Ok(path) => package::read_package_scripts(&path),
        Err(error) => PackageScriptsResult {
            scripts: Vec::new(),
            error: Some(error),
        },
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn open_in_file_manager(app: AppHandle, folder_path: String) -> ActionResult {
    let path = match canonical_directory(&folder_path) {
        Ok(path) => path,
        Err(error) => return ActionResult::failure(error),
    };
    match app
        .opener()
        .open_path(path.to_string_lossy().into_owned(), None::<&str>)
    {
        Ok(()) => ActionResult::success(),
        Err(error) => ActionResult::failure(error.to_string()),
    }
}

fn spawn_detached(program: &str, args: &[&str]) -> bool {
    let mut command = Command::new(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x00000008 | 0x08000000);
    }
    command.spawn().is_ok()
}

#[tauri::command(rename_all = "camelCase")]
pub fn open_in_vscode(app: AppHandle, folder_path: String) -> ActionResult {
    let folder_path = match canonical_directory(&folder_path) {
        Ok(path) => path,
        Err(error) => return ActionResult::failure(error),
    };
    let folder_value = folder_path.to_string_lossy();
    let mut candidates = if cfg!(windows) {
        vec!["code.cmd".to_string(), "code".to_string()]
    } else {
        vec![
            "/usr/local/bin/code".to_string(),
            "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code".to_string(),
        ]
    };
    if !cfg!(windows) {
        if let Ok(home) = std::env::var("HOME") {
            candidates.insert(1, format!("{home}/.local/bin/code"));
        }
    }
    for candidate in candidates {
        if (!candidate.contains('/') || Path::new(&candidate).exists())
            && spawn_detached(&candidate, &["-n", &folder_value])
        {
            return ActionResult::success();
        }
    }
    let mut target = url::Url::parse("vscode://file/").expect("内置 VS Code 地址无效");
    target.set_path(&folder_value.replace('\\', "/"));
    match app.opener().open_url(target.as_str(), None::<&str>) {
        Ok(()) => ActionResult::success(),
        Err(_) => ActionResult::failure("未找到 VS Code，请确保已安装"),
    }
}

#[tauri::command]
fn is_allowed_local_url(value: &str) -> bool {
    let Ok(parsed) = url::Url::parse(value) else {
        return false;
    };
    if !matches!(parsed.scheme(), "http" | "https") {
        return false;
    }
    match parsed.host() {
        Some(url::Host::Domain(host)) => host.eq_ignore_ascii_case("localhost"),
        Some(url::Host::Ipv4(address)) => address.is_loopback() || address.is_unspecified(),
        Some(url::Host::Ipv6(address)) => address.is_loopback(),
        None => false,
    }
}

#[tauri::command]
pub fn open_local_url(app: AppHandle, url: String) -> ActionResult {
    if !is_allowed_local_url(&url) {
        return ActionResult::failure("仅支持打开本地访问地址");
    }
    let parsed = url::Url::parse(&url).expect("本地地址已通过解析校验");
    match app.opener().open_url(parsed.as_str(), None::<&str>) {
        Ok(()) => ActionResult::success(),
        Err(error) => ActionResult::failure(error.to_string()),
    }
}

#[tauri::command]
pub fn open_external_url(app: AppHandle, url: String) -> ActionResult {
    let Ok(parsed) = url::Url::parse(&url) else {
        return ActionResult::failure("链接无效");
    };
    if !matches!(parsed.scheme(), "http" | "https") {
        return ActionResult::failure("仅支持 http/https 链接");
    }
    match app.opener().open_url(parsed.as_str(), None::<&str>) {
        Ok(()) => ActionResult::success(),
        Err(error) => ActionResult::failure(error.to_string()),
    }
}

#[tauri::command]
pub fn set_native_theme(app: AppHandle, theme: Theme) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "无法获取主窗口".to_string())?;
    let theme = match theme {
        Theme::Light => Some(NativeTheme::Light),
        Theme::Dark => Some(NativeTheme::Dark),
        Theme::System => None,
    };
    window
        .set_theme(theme)
        .map_err(|error| format!("设置系统主题失败：{error}"))
}

fn project_start_error(state: &AppState, project: &Project) -> Option<String> {
    let health = package::inspect_project_health(project, |version| {
        environment::is_node_version_installed(state, version)
    });
    health.issues.first().map(|issue| issue.message.clone())
}

#[tauri::command(rename_all = "camelCase")]
pub fn start_project(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
) -> ActionResult {
    let app_config = config::load_config(&state.config_path);
    let Some(project) = app_config
        .projects
        .iter()
        .find(|project| project.id == project_id)
    else {
        return ActionResult::failure("项目配置不存在");
    };
    if let Some(error) = project_start_error(&state, project) {
        return ActionResult::failure(error);
    }
    match process::start_project_process(
        &app,
        &project.id,
        &project.path,
        &project.command,
        project.custom_command.as_deref(),
        project.node_version.as_deref(),
    ) {
        Ok(()) => ActionResult::success(),
        Err(error) => ActionResult::failure(error),
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn stop_project(app: AppHandle, project_id: String) -> bool {
    process::stop_project_process(&app, &project_id)
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_process_status(state: State<'_, AppState>, project_id: String) -> ProcessStatus {
    process::get_process_status(&state, &project_id)
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_process_statuses(state: State<'_, AppState>, project_ids: Vec<String>) -> Vec<ProcessStatus> {
    process::get_process_statuses(&state, &project_ids)
}

fn start_all_projects_blocking(
    app: &AppHandle,
    project_ids: Vec<String>,
) -> StartAllProjectsResult {
    let state = app.state::<AppState>();
    let app_config = config::load_config(&state.config_path);
    let mut result = StartAllProjectsResult::default();
    for project_id in project_ids {
        if process::is_process_running(&state, &project_id) {
            continue;
        }
        let Some(project) = app_config
            .projects
            .iter()
            .find(|project| project.id == project_id)
        else {
            result.failed += 1;
            result.failures.push(ProjectStartFailure {
                project_id,
                project_name: "未知项目".to_string(),
                message: "项目配置不存在".to_string(),
            });
            continue;
        };
        let start_result = project_start_error(&state, project).map_or_else(
            || {
                process::start_project_process(
                    app,
                    &project.id,
                    &project.path,
                    &project.command,
                    project.custom_command.as_deref(),
                    project.node_version.as_deref(),
                )
                .err()
            },
            Some,
        );
        if let Some(message) = start_result {
            result.failed += 1;
            result.failures.push(ProjectStartFailure {
                project_id: project.id.clone(),
                project_name: project.name.clone(),
                message,
            });
        } else {
            result.success += 1;
        }
    }
    result
}

#[tauri::command(rename_all = "camelCase")]
pub async fn start_all_projects(
    app: AppHandle,
    project_ids: Vec<String>,
) -> StartAllProjectsResult {
    match tauri::async_runtime::spawn_blocking(move || {
        start_all_projects_blocking(&app, project_ids)
    })
    .await
    {
        Ok(result) => result,
        Err(error) => StartAllProjectsResult {
            success: 0,
            failed: 1,
            failures: vec![ProjectStartFailure {
                project_id: String::new(),
                project_name: "批量启动".to_string(),
                message: format!("批量启动任务异常：{error}"),
            }],
        },
    }
}

#[tauri::command]
pub fn stop_all_projects(app: AppHandle) -> bool {
    process::stop_all_processes(&app);
    true
}

fn safe_log_filename(filename: &str) -> String {
    let fallback = format!(
        "npm-launcher-log-{}.log",
        chrono::Local::now().format("%Y-%m-%d")
    );
    let value = if filename.trim().is_empty() {
        fallback
    } else {
        filename.to_string()
    };
    let mut safe: String = value
        .chars()
        .map(|character| {
            if matches!(
                character,
                '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|'
            ) {
                '-'
            } else {
                character
            }
        })
        .collect();
    if !safe.ends_with(".log") {
        safe.push_str(".log");
    }
    safe
}

#[tauri::command]
pub async fn export_log(app: AppHandle, filename: String, content: String) -> ConfigTransferResult {
    if content.trim().is_empty() {
        return ConfigTransferResult {
            success: false,
            path: None,
            error: Some("没有可导出的日志内容".to_string()),
        };
    }
    let filename = safe_log_filename(&filename);
    let mut dialog = app
        .dialog()
        .file()
        .set_title("导出日志")
        .set_directory(desktop_directory(&app))
        .set_file_name(filename)
        .add_filter("日志文件", &["log"]);
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    let selected = dialog.blocking_save_file();
    let Some(selected) = selected else {
        return ConfigTransferResult {
            success: false,
            path: None,
            error: None,
        };
    };
    let path = match selected_path(selected) {
        Ok(path) => path,
        Err(error) => {
            return ConfigTransferResult {
                success: false,
                path: None,
                error: Some(error),
            }
        }
    };
    match fs::write(&path, content) {
        Ok(()) => ConfigTransferResult {
            success: true,
            path: Some(path.to_string_lossy().into_owned()),
            error: None,
        },
        Err(error) => ConfigTransferResult {
            success: false,
            path: None,
            error: Some(format!("导出日志失败：{error}")),
        },
    }
}

/// 页面刷新后回放当前会话日志（仅内存中的当次运行记录）
#[tauri::command(rename_all = "camelCase")]
pub fn get_session_logs(
    state: State<'_, AppState>,
    project_id: String,
) -> Vec<crate::models::SessionLogEntry> {
    log::get_session_log_lines(&state, &project_id)
        .into_iter()
        .map(|line| crate::models::SessionLogEntry {
            project_id: project_id.clone(),
            log_type: line.kind,
            data: line.line,
        })
        .collect()
}

#[tauri::command(rename_all = "camelCase")]
pub fn analyze_errors(
    state: State<'_, AppState>,
    project_id: String,
    exit_code: i32,
) -> Option<ErrorAnalysis> {
    log::analyze_errors(&state, &project_id, exit_code)
}

fn main_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "无法获取主窗口".to_string())
}

#[tauri::command]
pub fn window_minimize(app: AppHandle) -> Result<(), String> {
    main_window(&app)?
        .minimize()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn window_maximize(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())
    } else {
        window.maximize().map_err(|error| error.to_string())
    }
}

#[tauri::command]
pub fn window_close(app: AppHandle) -> Result<(), String> {
    main_window(&app)?
        .close()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn window_is_maximized(app: AppHandle) -> Result<bool, String> {
    main_window(&app)?
        .is_maximized()
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub fn pty_spawn(
    app: AppHandle,
    id: String,
    cols: u16,
    rows: u16,
    cwd: String,
    node_version: Option<String>,
) -> bool {
    terminal::spawn_terminal_or_emit(
        &app,
        PtySpawnRequest {
            id,
            cols,
            rows,
            cwd,
            node_version,
        },
    )
}

#[tauri::command]
pub fn pty_write(state: State<'_, AppState>, id: String, data: String) -> bool {
    terminal::write_terminal(&state, &id, &data)
}

#[tauri::command]
pub fn pty_resize(state: State<'_, AppState>, id: String, cols: u16, rows: u16) -> bool {
    terminal::resize_terminal(&state, &id, cols, rows)
}

#[tauri::command]
pub fn pty_kill(state: State<'_, AppState>, id: String) -> bool {
    terminal::kill_terminal(&state, &id)
}

#[cfg(test)]
mod tests {
    use super::is_allowed_local_url;

    #[test]
    fn 本地地址校验支持_ipv4_和_ipv6_回环() {
        assert!(is_allowed_local_url("http://localhost:5173"));
        assert!(is_allowed_local_url("https://127.0.0.1:8443/path"));
        assert!(is_allowed_local_url("http://[::1]:3000"));
        assert!(!is_allowed_local_url("https://example.com"));
        assert!(!is_allowed_local_url("file:///tmp/index.html"));
    }
}
