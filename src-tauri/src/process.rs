use std::{
    io::Read,
    process::{Command, Stdio},
    sync::{mpsc, OnceLock},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use chrono::Local;
use encoding_rs::GBK;
use regex::Regex;
use tauri::{AppHandle, Emitter, Manager};

use crate::{
    environment::get_project_env,
    log::{analyze_errors, finish_log_session, record_log_line, start_log_session},
    models::{LogEntry, LogType, ProcessState, ProcessStatus},
    package::detect_package_manager,
    state::{AppState, ProcessHandle},
};

enum ProcessMessage {
    Data(LogType, Vec<u8>),
    StreamClosed,
    Exited(i32),
}

const LOG_FLUSH_INTERVAL: Duration = Duration::from_millis(16);
const LOG_MAX_BUFFER_SIZE: usize = 50;

fn timestamp_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn decode_output(bytes: &[u8]) -> String {
    if let Ok(value) = std::str::from_utf8(bytes) {
        return value.to_string();
    }
    if cfg!(windows) {
        let (value, _, _) = GBK.decode(bytes);
        return value.into_owned();
    }
    String::from_utf8_lossy(bytes).into_owned()
}

fn strip_ansi(value: &str) -> String {
    static ANSI_PATTERN: OnceLock<Regex> = OnceLock::new();
    ANSI_PATTERN
        .get_or_init(|| {
            Regex::new(r"\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])").expect("ANSI 清理规则无效")
        })
        .replace_all(value, "")
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .chars()
        .filter(|character| !matches!(*character as u32, 0x00..=0x08 | 0x0b | 0x0c | 0x0e..=0x1f))
        .collect()
}

fn format_log(value: &str, kind: &LogType) -> String {
    let clean = strip_ansi(value);
    let time = Local::now().format("%H:%M:%S%.3f");
    let (prefix, suffix) = match kind {
        LogType::Error => ("\x1b[38;2;224;108;117m", "\x1b[0m"),
        LogType::Stderr => ("\x1b[38;2;209;154;102m", "\x1b[0m"),
        LogType::Info => ("\x1b[38;2;97;175;239m", "\x1b[0m"),
        LogType::Stdout => ("", ""),
    };
    clean
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| format!("\x1b[2m[{time}]\x1b[22m {prefix}{line}{suffix}"))
        .collect::<Vec<_>>()
        .join("\r\n")
}

fn emit_log(app: &AppHandle, project_id: &str, kind: LogType, value: &str) {
    let data = format_log(value, &kind);
    if data.trim().is_empty() {
        return;
    }
    let state = app.state::<AppState>();
    record_log_line(&state, project_id, &kind, &strip_ansi(value));
    let _ = app.emit(
        "log-data",
        LogEntry {
            project_id: project_id.to_string(),
            kind,
            data,
            timestamp: timestamp_millis(),
        },
    );
}

fn emit_status(
    app: &AppHandle,
    project_id: &str,
    status: ProcessState,
    pid: Option<u32>,
    exit_code: Option<i32>,
) {
    let _ = app.emit(
        "process-status",
        ProcessStatus {
            project_id: project_id.to_string(),
            status,
            pid,
            exit_code,
        },
    );
}

fn read_stream(
    mut stream: impl Read + Send + 'static,
    kind: LogType,
    sender: mpsc::Sender<ProcessMessage>,
) {
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match stream.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    if sender
                        .send(ProcessMessage::Data(kind.clone(), buffer[..size].to_vec()))
                        .is_err()
                    {
                        return;
                    }
                }
                Err(_) => break,
            }
        }
        let _ = sender.send(ProcessMessage::StreamClosed);
    });
}

fn flush_process_logs(app: &AppHandle, project_id: &str, pending: &mut Vec<(LogType, Vec<u8>)>) {
    let mut grouped: Vec<(LogType, Vec<u8>)> = Vec::new();
    for (kind, bytes) in pending.drain(..) {
        if let Some((current_kind, current_bytes)) = grouped.last_mut() {
            if *current_kind == kind {
                current_bytes.extend(bytes);
                continue;
            }
        }
        grouped.push((kind, bytes));
    }
    for (kind, bytes) in grouped {
        emit_log(app, project_id, kind, &decode_output(&bytes));
    }
}

fn consume_process_messages(
    app: AppHandle,
    project_id: String,
    generation: u64,
    receiver: mpsc::Receiver<ProcessMessage>,
) {
    thread::spawn(move || {
        let mut closed_streams = 0;
        let mut exit_code = None;
        let mut pending = Vec::new();
        let mut flush_deadline: Option<Instant> = None;
        loop {
            let wait = flush_deadline
                .map(|deadline| deadline.saturating_duration_since(Instant::now()))
                .unwrap_or(Duration::from_secs(3600));
            match receiver.recv_timeout(wait) {
                Ok(ProcessMessage::Data(kind, bytes)) => {
                    if pending.is_empty() {
                        flush_deadline = Some(Instant::now() + LOG_FLUSH_INTERVAL);
                    }
                    pending.push((kind, bytes));
                }
                Ok(ProcessMessage::StreamClosed) => closed_streams += 1,
                Ok(ProcessMessage::Exited(code)) => exit_code = Some(code),
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    flush_process_logs(&app, &project_id, &mut pending);
                    flush_deadline = None;
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
            if pending.len() >= LOG_MAX_BUFFER_SIZE {
                flush_process_logs(&app, &project_id, &mut pending);
                flush_deadline = None;
            }
            if closed_streams >= 2 && exit_code.is_some() {
                flush_process_logs(&app, &project_id, &mut pending);
                break;
            }
        }

        let code = exit_code.unwrap_or(-1);
        let state = app.state::<AppState>();
        let is_current = state
            .processes
            .lock()
            .ok()
            .and_then(|mut processes| {
                let matches = processes
                    .get(&project_id)
                    .is_some_and(|handle| handle.generation == generation);
                matches.then(|| processes.remove(&project_id)).flatten()
            })
            .is_some();
        if !is_current {
            return;
        }

        emit_status(
            &app,
            &project_id,
            if code == 0 {
                ProcessState::Stopped
            } else {
                ProcessState::Error
            },
            None,
            Some(code),
        );
        emit_log(
            &app,
            &project_id,
            LogType::Info,
            &format!("进程退出，代码: {code}"),
        );
        if code != 0 {
            if let Some(analysis) = analyze_errors(&state, &project_id, code) {
                let _ = app.emit("error-analysis", analysis);
            }
        }
        finish_log_session(&state, &project_id, Some(code));
    });
}

pub fn start_project_process(
    app: &AppHandle,
    project_id: &str,
    project_path: &str,
    script: &str,
    node_version: Option<&str>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    if state
        .processes
        .lock()
        .map_err(|_| "进程状态不可用".to_string())?
        .contains_key(project_id)
    {
        return Ok(());
    }

    let package_manager = detect_package_manager(std::path::Path::new(project_path));
    let mut environment = get_project_env(
        &state,
        node_version,
        Some(std::path::Path::new(project_path)),
    );
    environment.insert(
        "FORCE_COLOR".to_string(),
        if cfg!(windows) { "0" } else { "1" }.to_string(),
    );
    if cfg!(windows) {
        environment.insert("NPM_CONFIG_COLOR".to_string(), "never".to_string());
        environment.insert("TERM".to_string(), "dumb".to_string());
    }

    let mut command = Command::new(package_manager.command());
    command
        .args(["run", script])
        .current_dir(project_path)
        .env_clear()
        .envs(environment)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("项目启动失败：{error}"))?;
    let pid = child.id();
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "无法读取标准输出".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "无法读取错误输出".to_string())?;
    let generation = state.next_process_generation();

    state
        .processes
        .lock()
        .map_err(|_| "进程状态不可用".to_string())?
        .insert(project_id.to_string(), ProcessHandle { pid, generation });
    start_log_session(&state, project_id);

    let (sender, receiver) = mpsc::channel();
    read_stream(stdout, LogType::Stdout, sender.clone());
    read_stream(stderr, LogType::Stderr, sender.clone());
    let exit_sender = sender.clone();
    thread::spawn(move || {
        let code = child
            .wait()
            .ok()
            .and_then(|status| status.code())
            .unwrap_or(-1);
        let _ = exit_sender.send(ProcessMessage::Exited(code));
    });
    consume_process_messages(app.clone(), project_id.to_string(), generation, receiver);

    emit_status(app, project_id, ProcessState::Running, Some(pid), None);
    emit_log(
        app,
        project_id,
        LogType::Info,
        &format!("启动: {} run {script}", package_manager.as_str()),
    );
    emit_log(
        app,
        project_id,
        LogType::Info,
        &format!("目录: {project_path}"),
    );
    Ok(())
}

fn terminate_process_tree(pid: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(0x08000000)
            .status();
    }
    #[cfg(unix)]
    {
        use nix::{
            sys::signal::{killpg, Signal},
            unistd::Pid,
        };
        let group = Pid::from_raw(pid as i32);
        let _ = killpg(group, Signal::SIGTERM);
        thread::spawn(move || {
            thread::sleep(Duration::from_secs(1));
            let _ = killpg(group, Signal::SIGKILL);
        });
    }
}

pub fn stop_project_process(app: &AppHandle, project_id: &str) -> bool {
    let state = app.state::<AppState>();
    let handle = state
        .processes
        .lock()
        .ok()
        .and_then(|mut processes| processes.remove(project_id));
    let Some(handle) = handle else {
        return false;
    };

    emit_log(app, project_id, LogType::Info, "已手动停止");
    finish_log_session(&state, project_id, None);
    emit_status(app, project_id, ProcessState::Stopped, None, None);
    terminate_process_tree(handle.pid);
    true
}

pub fn stop_all_processes(app: &AppHandle) {
    let state = app.state::<AppState>();
    let project_ids = state
        .processes
        .lock()
        .map(|processes| processes.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    for project_id in project_ids {
        stop_project_process(app, &project_id);
    }
}

pub fn get_process_status(state: &AppState, project_id: &str) -> ProcessStatus {
    let pid = state
        .processes
        .lock()
        .ok()
        .and_then(|processes| processes.get(project_id).map(|handle| handle.pid));
    ProcessStatus {
        project_id: project_id.to_string(),
        status: if pid.is_some() {
            ProcessState::Running
        } else {
            ProcessState::Stopped
        },
        pid,
        exit_code: None,
    }
}

pub fn is_process_running(state: &AppState, project_id: &str) -> bool {
    state
        .processes
        .lock()
        .map(|processes| processes.contains_key(project_id))
        .unwrap_or(false)
}
