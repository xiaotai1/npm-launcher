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

#[derive(Default)]
struct OutputDecoder {
    pending: Vec<u8>,
}

impl OutputDecoder {
    fn decode(&mut self, bytes: &[u8], finish: bool) -> String {
        self.pending.extend_from_slice(bytes);
        if self.pending.is_empty() {
            return String::new();
        }
        if finish {
            return decode_output(&std::mem::take(&mut self.pending));
        }

        match std::str::from_utf8(&self.pending) {
            Ok(_) => decode_output(&std::mem::take(&mut self.pending)),
            Err(error) if error.error_len().is_none() => {
                let valid_bytes = self
                    .pending
                    .drain(..error.valid_up_to())
                    .collect::<Vec<_>>();
                decode_output(&valid_bytes)
            }
            Err(_)
                if cfg!(windows)
                    && self
                        .pending
                        .last()
                        .is_some_and(|byte| (0x81..=0xfe).contains(byte)) =>
            {
                let trailing = self.pending.pop();
                let value = decode_output(&std::mem::take(&mut self.pending));
                self.pending.extend(trailing);
                value
            }
            Err(_) => decode_output(&std::mem::take(&mut self.pending)),
        }
    }
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

fn flush_process_logs(
    app: &AppHandle,
    project_id: &str,
    generation: u64,
    pending: &mut Vec<(LogType, Vec<u8>)>,
    stdout_decoder: &mut OutputDecoder,
    stderr_decoder: &mut OutputDecoder,
    finish: bool,
) {
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

    let state = app.state::<AppState>();
    let Ok(processes) = state.processes.lock() else {
        return;
    };
    if !processes
        .get(project_id)
        .is_some_and(|handle| handle.generation == generation)
    {
        return;
    }
    drop(processes);
    for (kind, bytes) in grouped {
        let value = match kind {
            LogType::Stdout => stdout_decoder.decode(&bytes, false),
            LogType::Stderr => stderr_decoder.decode(&bytes, false),
            _ => decode_output(&bytes),
        };
        emit_log(app, project_id, kind, &value);
    }
    if finish {
        emit_log(
            app,
            project_id,
            LogType::Stdout,
            &stdout_decoder.decode(&[], true),
        );
        emit_log(
            app,
            project_id,
            LogType::Stderr,
            &stderr_decoder.decode(&[], true),
        );
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
        let mut stdout_decoder = OutputDecoder::default();
        let mut stderr_decoder = OutputDecoder::default();
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
                    flush_process_logs(
                        &app,
                        &project_id,
                        generation,
                        &mut pending,
                        &mut stdout_decoder,
                        &mut stderr_decoder,
                        false,
                    );
                    flush_deadline = None;
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
            if pending.len() >= LOG_MAX_BUFFER_SIZE {
                flush_process_logs(
                    &app,
                    &project_id,
                    generation,
                    &mut pending,
                    &mut stdout_decoder,
                    &mut stderr_decoder,
                    false,
                );
                flush_deadline = None;
            }
            if closed_streams >= 2 && exit_code.is_some() {
                flush_process_logs(
                    &app,
                    &project_id,
                    generation,
                    &mut pending,
                    &mut stdout_decoder,
                    &mut stderr_decoder,
                    true,
                );
                break;
            }
        }

        let code = exit_code.unwrap_or(-1);
        let state = app.state::<AppState>();
        let Ok(mut processes) = state.processes.lock() else {
            return;
        };
        if !processes
            .get(&project_id)
            .is_some_and(|handle| handle.generation == generation)
        {
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
        processes.remove(&project_id);
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

fn terminate_process_tree(pid: u32, wait_for_exit: bool) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = wait_for_exit;
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
        let force_kill = move || {
            for _ in 0..10 {
                thread::sleep(Duration::from_millis(100));
                if killpg(group, None).is_err() {
                    return;
                }
            }
            let _ = killpg(group, Signal::SIGKILL);
        };
        if wait_for_exit {
            force_kill();
        } else {
            thread::spawn(force_kill);
        }
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
    terminate_process_tree(handle.pid, false);
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

pub fn stop_all_processes_for_exit(app: &AppHandle) {
    let state = app.state::<AppState>();
    let handles = state
        .processes
        .lock()
        .map(|mut processes| {
            std::mem::take(&mut *processes)
                .into_values()
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    for handle in handles {
        terminate_process_tree(handle.pid, true);
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

#[cfg(test)]
mod tests {
    use super::OutputDecoder;

    #[test]
    fn utf8_中文跨读取块时不会产生替换字符() {
        let bytes = "启动成功".as_bytes();
        let mut decoder = OutputDecoder::default();
        let first = decoder.decode(&bytes[..2], false);
        let second = decoder.decode(&bytes[2..], true);

        assert_eq!(first, "");
        assert_eq!(format!("{first}{second}"), "启动成功");
        assert!(!second.contains('\u{fffd}'));
    }
}
