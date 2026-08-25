use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};

use tauri::AppHandle;

use crate::{config::resolve_config_path, log::SessionLogLine, terminal::PtySession};

pub struct ProcessHandle {
    pub pid: u32,
    pub generation: u64,
    pub node_version: Option<String>,
}

pub struct AppState {
    pub config_path: PathBuf,
    pub processes: Mutex<HashMap<String, ProcessHandle>>,
    pub terminals: Mutex<HashMap<String, PtySession>>,
    pub logs: Mutex<HashMap<String, Vec<SessionLogLine>>>,
    pub shell_env: Mutex<Option<HashMap<String, String>>>,
    process_generation: AtomicU64,
    terminal_generation: AtomicU64,
}

impl AppState {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        Ok(Self {
            config_path: resolve_config_path(app)?,
            processes: Mutex::new(HashMap::new()),
            terminals: Mutex::new(HashMap::new()),
            logs: Mutex::new(HashMap::new()),
            shell_env: Mutex::new(None),
            process_generation: AtomicU64::new(1),
            terminal_generation: AtomicU64::new(1),
        })
    }

    pub fn next_process_generation(&self) -> u64 {
        self.process_generation.fetch_add(1, Ordering::Relaxed)
    }

    pub fn next_terminal_generation(&self) -> u64 {
        self.terminal_generation.fetch_add(1, Ordering::Relaxed)
    }
}
