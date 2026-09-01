use std::{
    io::{Read, Write},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter, Manager};

use crate::{
    environment::get_project_env,
    models::{PtyDataEvent, PtyExitEvent, PtySpawnRequest},
    state::AppState,
};

type SharedPtyChild = Arc<Mutex<Box<dyn Child + Send + Sync>>>;
type SharedPtyMaster = Arc<Mutex<Box<dyn MasterPty + Send>>>;
type SharedPtyWriter = Arc<Mutex<Box<dyn Write + Send>>>;

#[derive(Clone)]
pub struct PtySession {
    generation: u64,
    master: SharedPtyMaster,
    writer: SharedPtyWriter,
    child: SharedPtyChild,
}

fn terminal_is_current(state: &AppState, id: &str, generation: u64) -> bool {
    state
        .terminals
        .lock()
        .map(|terminals| {
            terminals
                .get(id)
                .is_some_and(|session| session.generation == generation)
        })
        .unwrap_or(false)
}

fn emit_error(app: &AppHandle, id: &str, message: &str) {
    let _ = app.emit(
        "pty-data",
        PtyDataEvent {
            id: id.to_string(),
            data: format!("\r\n\x1b[31m[终端启动失败: {message}]\x1b[0m\r\n"),
        },
    );
    let _ = app.emit(
        "pty-exit",
        PtyExitEvent {
            id: id.to_string(),
            exit_code: 1,
        },
    );
}

fn monitor_child(app: AppHandle, id: String, generation: u64, child: SharedPtyChild) {
    thread::spawn(move || loop {
        let exit_code = {
            let Ok(mut process) = child.lock() else {
                return;
            };
            match process.try_wait() {
                Ok(Some(status)) => Some(status.exit_code() as i32),
                Ok(None) => None,
                Err(_) => Some(1),
            }
        };
        if let Some(exit_code) = exit_code {
            let state = app.state::<AppState>();
            let is_current = state
                .terminals
                .lock()
                .ok()
                .and_then(|mut terminals| {
                    let matches = terminals
                        .get(&id)
                        .is_some_and(|session| session.generation == generation);
                    matches.then(|| terminals.remove(&id)).flatten()
                })
                .is_some();
            if is_current {
                let _ = app.emit(
                    "pty-exit",
                    PtyExitEvent {
                        id: id.clone(),
                        exit_code,
                    },
                );
            }
            return;
        }
        thread::sleep(Duration::from_millis(100));
    });
}

fn read_terminal(app: AppHandle, id: String, generation: u64, mut reader: Box<dyn Read + Send>) {
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        while let Ok(size) = reader.read(&mut buffer) {
            if size == 0 {
                return;
            }
            let state = app.state::<AppState>();
            if !terminal_is_current(&state, &id, generation) {
                return;
            }
            let _ = app.emit(
                "pty-data",
                PtyDataEvent {
                    id: id.clone(),
                    data: String::from_utf8_lossy(&buffer[..size]).into_owned(),
                },
            );
        }
    });
}

pub fn spawn_terminal(app: &AppHandle, request: PtySpawnRequest) -> Result<(), String> {
    let state = app.state::<AppState>();
    if state
        .terminals
        .lock()
        .map_err(|_| "终端状态不可用".to_string())?
        .contains_key(&request.id)
    {
        return Ok(());
    }

    let environment = get_project_env(
        &state,
        request.node_version.as_deref(),
        Some(std::path::Path::new(&request.cwd)),
    );
    let shell = if cfg!(windows) {
        environment
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case("COMSPEC"))
            .map(|(_, value)| value.clone())
            .unwrap_or_else(|| "cmd.exe".to_string())
    } else {
        environment
            .get("SHELL")
            .cloned()
            .unwrap_or_else(|| "/bin/zsh".to_string())
    };

    let pair = native_pty_system()
        .openpty(PtySize {
            rows: request.rows,
            cols: request.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("创建终端失败：{error}"))?;
    let mut command = CommandBuilder::new(shell);
    command.cwd(&request.cwd);
    command.env("TERM", "xterm-256color");
    for (key, value) in environment {
        command.env(key, value);
    }

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("启动终端失败：{error}"))?;
    drop(pair.slave);
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| format!("读取终端失败：{error}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| format!("写入终端失败：{error}"))?;
    let generation = state.next_terminal_generation();
    let child = Arc::new(Mutex::new(child));
    let session = PtySession {
        generation,
        master: Arc::new(Mutex::new(pair.master)),
        writer: Arc::new(Mutex::new(writer)),
        child: child.clone(),
    };

    let mut terminals = state
        .terminals
        .lock()
        .map_err(|_| "终端状态不可用".to_string())?;
    if terminals.contains_key(&request.id) {
        drop(terminals);
        if let Ok(mut process) = child.lock() {
            let _ = process.kill();
        }
        return Ok(());
    }
    terminals.insert(request.id.clone(), session);
    drop(terminals);

    read_terminal(app.clone(), request.id.clone(), generation, reader);
    monitor_child(app.clone(), request.id, generation, child);
    Ok(())
}

pub fn spawn_terminal_or_emit(app: &AppHandle, request: PtySpawnRequest) -> bool {
    let id = request.id.clone();
    match spawn_terminal(app, request) {
        Ok(()) => true,
        Err(error) => {
            emit_error(app, &id, &error);
            false
        }
    }
}

pub fn write_terminal(state: &AppState, id: &str, data: &str) -> bool {
    let session = state
        .terminals
        .lock()
        .ok()
        .and_then(|terminals| terminals.get(id).cloned());
    session
        .and_then(|session| {
            session
                .writer
                .lock()
                .ok()
                .map(|mut writer| writer.write_all(data.as_bytes()).is_ok())
        })
        .unwrap_or(false)
}

pub fn resize_terminal(state: &AppState, id: &str, cols: u16, rows: u16) -> bool {
    let session = state
        .terminals
        .lock()
        .ok()
        .and_then(|terminals| terminals.get(id).cloned());
    session
        .and_then(|session| {
            session.master.lock().ok().map(|master| {
                master
                    .resize(PtySize {
                        rows,
                        cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    })
                    .is_ok()
            })
        })
        .unwrap_or(false)
}

pub fn kill_terminal(state: &AppState, id: &str) -> bool {
    let session = state
        .terminals
        .lock()
        .ok()
        .and_then(|mut terminals| terminals.remove(id));
    let Some(session) = session else {
        return false;
    };
    // 杀掉子进程；session 在此之后被丢弃，portable-pty 的 MasterPty 在 drop 时
    // 会关闭底层文件描述符，从而让 read_terminal 线程的 reader.read() 返回 EOF 并退出
    session
        .child
        .lock()
        .map(|mut child| child.kill().is_ok())
        .unwrap_or(false)
}

pub fn kill_all_terminals(state: &AppState) {
    let sessions = state
        .terminals
        .lock()
        .map(|mut terminals| {
            std::mem::take(&mut *terminals)
                .into_values()
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    for session in sessions {
        if let Ok(mut child) = session.child.lock() {
            let _ = child.kill();
        }
    }
}

#[cfg_attr(windows, allow(dead_code))]
pub fn broadcast_to_all_terminals(state: &AppState, command: &str) {
    let sessions = state
        .terminals
        .lock()
        .map(|terminals| terminals.values().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    let payload = format!("{command}\n");
    for session in sessions {
        if let Ok(mut writer) = session.writer.lock() {
            let _ = writer.write_all(payload.as_bytes());
        }
    }
}
