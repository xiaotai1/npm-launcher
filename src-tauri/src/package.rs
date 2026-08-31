use std::{fs, path::Path, process::{Command, Stdio}};

use serde_json::Value;

use crate::models::{
    PackageScriptsResult, Project, ProjectHealthIssue, ProjectHealthIssueCode, ProjectHealthResult,
};

#[derive(Debug, Clone, Copy)]
pub enum PackageManager {
    Npm,
    Pnpm,
    Yarn,
    Bun,
}

impl PackageManager {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Npm => "npm",
            Self::Pnpm => "pnpm",
            Self::Yarn => "yarn",
            Self::Bun => "bun",
        }
    }

    pub fn command(self) -> String {
        let extension = if cfg!(windows) { ".cmd" } else { "" };
        format!("{}{extension}", self.as_str())
    }
}

/// 检测指定包管理器在当前系统中是否可用
fn is_package_manager_available(mgr: PackageManager) -> bool {
    let program = mgr.command();
    Command::new(&program)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

pub fn detect_package_manager(project_path: &Path) -> PackageManager {
    // 按照锁定文件推断候选管理器，取第一个可用的
    let candidates: &[(fn(&Path) -> bool, PackageManager)] = &[
        (|p| p.join("pnpm-lock.yaml").exists(), PackageManager::Pnpm),
        (|p| p.join("yarn.lock").exists(), PackageManager::Yarn),
        (|p| p.join("bun.lockb").exists() || p.join("bun.lock").exists(), PackageManager::Bun),
    ];
    for (check, mgr) in candidates {
        if check(project_path) && is_package_manager_available(*mgr) {
            return *mgr;
        }
    }
    // 没有任何锁定文件，或对应的包管理器不可用时，npm 作为兜底
    PackageManager::Npm
}

pub fn read_package_scripts(dir: &Path) -> PackageScriptsResult {
    let package_path = dir.join("package.json");
    if !package_path.exists() {
        return PackageScriptsResult {
            scripts: Vec::new(),
            error: Some("该目录下没有 package.json".to_string()),
        };
    }

    let result = fs::read_to_string(package_path)
        .map_err(|error| error.to_string())
        .and_then(|content| {
            serde_json::from_str::<Value>(&content).map_err(|error| error.to_string())
        });

    match result {
        Ok(value) => {
            let scripts = value
                .get("scripts")
                .and_then(Value::as_object)
                .map(|items| items.keys().cloned().collect())
                .unwrap_or_default();
            PackageScriptsResult {
                scripts,
                error: None,
            }
        }
        Err(error) => PackageScriptsResult {
            scripts: Vec::new(),
            error: Some(error),
        },
    }
}

pub fn inspect_project_health(
    project: &Project,
    node_version_installed: impl Fn(&str) -> bool,
) -> ProjectHealthResult {
    let mut issues = Vec::new();
    let project_path = Path::new(&project.path);

    if project.path.is_empty() || !project_path.is_dir() {
        issues.push(ProjectHealthIssue {
            code: ProjectHealthIssueCode::ProjectPath,
            message: format!(
                "项目目录不存在或不可访问：{}",
                if project.path.is_empty() {
                    "未配置"
                } else {
                    &project.path
                }
            ),
        });
        return ProjectHealthResult { ok: false, issues };
    }

    if project
        .custom_command
        .as_deref()
        .is_none_or(|command| command.trim().is_empty())
    {
        let package_scripts = read_package_scripts(project_path);
        if let Some(error) = package_scripts.error {
            issues.push(ProjectHealthIssue {
                code: ProjectHealthIssueCode::PackageJson,
                message: error,
            });
            return ProjectHealthResult { ok: false, issues };
        }

        if !package_scripts.scripts.contains(&project.command) {
            issues.push(ProjectHealthIssue {
                code: ProjectHealthIssueCode::Script,
                message: format!("package.json 中未找到启动命令：{}", project.command),
            });
        }
    }
    if let Some(version) = project.node_version.as_deref() {
        if !node_version_installed(version) {
            issues.push(ProjectHealthIssue {
                code: ProjectHealthIssueCode::NodeVersion,
                message: format!("指定的 Node.js 版本未安装：{version}"),
            });
        }
    }

    ProjectHealthResult {
        ok: issues.is_empty(),
        issues,
    }
}
