use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::models::{AppConfig, Folder, Project};

fn timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

pub fn resolve_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_root = app
        .path()
        .config_dir()
        .map_err(|error| format!("无法获取系统配置目录：{error}"))?;
    Ok(config_root.join("npm-launcher").join("config.json"))
}

pub fn load_config(path: &Path) -> AppConfig {
    if !path.exists() {
        let config = AppConfig::default();
        let _ = save_config(path, &config);
        return config;
    }

    match fs::read_to_string(path)
        .map_err(|error| error.to_string())
        .and_then(|content| {
            serde_json::from_str::<AppConfig>(&content).map_err(|error| error.to_string())
        }) {
        Ok(config) => config,
        Err(error) => {
            eprintln!("读取配置失败：{error}");
            let backup = path.with_file_name(format!("config.json.corrupt-{}", timestamp_millis()));
            if fs::rename(path, backup).is_ok() {
                let config = AppConfig::default();
                let _ = save_config(path, &config);
                config
            } else {
                AppConfig::default()
            }
        }
    }
}

pub fn save_config(path: &Path, config: &AppConfig) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "配置路径无效".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("创建配置目录失败：{error}"))?;

    let temp_path = path.with_file_name(format!(
        "config.json.{}.{}.tmp",
        std::process::id(),
        timestamp_millis()
    ));
    let content =
        serde_json::to_string_pretty(config).map_err(|error| format!("序列化配置失败：{error}"))?;

    if let Err(error) = fs::write(&temp_path, format!("{content}\n")) {
        return Err(format!("写入临时配置失败：{error}"));
    }

    if let Err(error) = replace_file(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("保存配置失败：{error}"));
    }
    Ok(())
}

#[cfg(not(windows))]
fn replace_file(source: &Path, target: &Path) -> std::io::Result<()> {
    fs::rename(source, target)
}

#[cfg(windows)]
fn replace_file(source: &Path, target: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    if !target.exists() {
        return fs::rename(source, target);
    }
    let source: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let target: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

pub fn normalize_imported_config(value: Value) -> Result<AppConfig, String> {
    serde_json::from_value(value).map_err(|_| "配置文件格式不正确".to_string())
}

fn change_config(path: &Path, update: impl FnOnce(&mut AppConfig) -> bool) -> bool {
    let mut config = load_config(path);
    update(&mut config) && save_config(path, &config).is_ok()
}

pub fn add_project(path: &Path, project: Project) -> bool {
    change_config(path, |config| {
        if config.projects.iter().any(|item| item.id == project.id) {
            return false;
        }
        config.projects.push(project);
        true
    })
}

pub fn update_project(path: &Path, project: Project) -> bool {
    change_config(path, |config| {
        let Some(index) = config
            .projects
            .iter()
            .position(|item| item.id == project.id)
        else {
            return false;
        };
        config.projects[index] = project;
        true
    })
}

pub fn delete_project(path: &Path, project_id: &str) -> bool {
    change_config(path, |config| {
        let original_len = config.projects.len();
        config.projects.retain(|project| project.id != project_id);
        config.projects.len() != original_len
    })
}

pub fn reorder_projects(path: &Path, project_ids: &[String]) -> bool {
    change_config(path, |config| {
        if project_ids.len() != config.projects.len() {
            return false;
        }
        let mut reordered = Vec::with_capacity(project_ids.len());
        for id in project_ids {
            let Some(project) = config.projects.iter().find(|item| &item.id == id) else {
                return false;
            };
            if reordered.iter().any(|item: &Project| item.id == *id) {
                return false;
            }
            reordered.push(project.clone());
        }
        config.projects = reordered;
        true
    })
}

pub fn reorder_folders(path: &Path, folder_ids: &[String]) -> bool {
    change_config(path, |config| {
        if folder_ids.len() != config.folders.len() {
            return false;
        }
        let mut reordered = Vec::with_capacity(folder_ids.len());
        for id in folder_ids {
            let Some(folder) = config.folders.iter().find(|item| &item.id == id) else {
                return false;
            };
            if reordered.iter().any(|item: &Folder| item.id == *id) {
                return false;
            }
            reordered.push(folder.clone());
        }
        config.folders = reordered;
        true
    })
}

pub fn add_folder(path: &Path, folder: Folder) -> bool {
    change_config(path, |config| {
        if config.folders.iter().any(|item| item.id == folder.id) {
            return false;
        }
        config.folders.push(folder);
        true
    })
}

pub fn update_folder(path: &Path, folder: Folder) -> bool {
    change_config(path, |config| {
        let Some(index) = config.folders.iter().position(|item| item.id == folder.id) else {
            return false;
        };
        config.folders[index] = folder;
        true
    })
}

pub fn delete_folder(path: &Path, folder_id: &str) -> bool {
    change_config(path, |config| {
        let original_len = config.folders.len();
        config.folders.retain(|folder| folder.id != folder_id);
        if config.folders.len() == original_len {
            return false;
        }
        for project in &mut config.projects {
            if project.folder_id.as_deref() == Some(folder_id) {
                project.folder_id = None;
            }
        }
        true
    })
}

pub fn toggle_favorite(path: &Path, project_id: &str) -> bool {
    change_config(path, |config| {
        let Some(project) = config
            .projects
            .iter_mut()
            .find(|item| item.id == project_id)
        else {
            return false;
        };
        project.favorite = Some(!project.favorite.unwrap_or(false));
        true
    })
}

pub fn move_project_to_folder(path: &Path, project_id: &str, folder_id: Option<String>) -> bool {
    change_config(path, |config| {
        let Some(project) = config
            .projects
            .iter_mut()
            .find(|item| item.id == project_id)
        else {
            return false;
        };
        project.folder_id = folder_id;
        true
    })
}
