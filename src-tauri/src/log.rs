use std::{
    sync::OnceLock,
    time::{SystemTime, UNIX_EPOCH},
};

use chrono::Local;
use regex::Regex;

use crate::{
    models::{ErrorAnalysis, ErrorMatch, ErrorSeverity, LogType},
    state::AppState,
};

const MAX_SESSION_LOG_LINES: usize = 800;

#[derive(Debug, Clone)]
pub struct SessionLogLine {
    pub kind: String,
    pub line: String,
}

struct ErrorPattern {
    name: &'static str,
    patterns: Vec<Regex>,
    suggestion: &'static str,
    severity: ErrorSeverity,
}

fn timestamp_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn error_patterns() -> &'static [ErrorPattern] {
    static PATTERNS: OnceLock<Vec<ErrorPattern>> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        let create = |name, patterns: &[&str], suggestion, severity| ErrorPattern {
            name,
            patterns: patterns
                .iter()
                .map(|value| Regex::new(value).expect("内置错误匹配规则无效"))
                .collect(),
            suggestion,
            severity,
        };
        vec![
            create(
                "端口占用",
                &["EADDRINUSE", "already in use", "(?i)port.*occupied"],
                "端口被占用，请检查是否有其他进程使用了相同端口，或修改项目端口配置",
                ErrorSeverity::Critical,
            ),
            create(
                "依赖缺失",
                &[
                    "Cannot find module",
                    "MODULE_NOT_FOUND",
                    "Error: Cannot find",
                ],
                "缺少依赖模块，请尝试运行 npm install 安装依赖",
                ErrorSeverity::Critical,
            ),
            create(
                "编译错误",
                &[
                    "SyntaxError",
                    "TypeError",
                    "(?i)compilation failed",
                    "(?i)build failed",
                ],
                "代码存在语法或类型错误，请检查报错位置对应的源文件",
                ErrorSeverity::Critical,
            ),
            create(
                "内存溢出",
                &[
                    "FATAL ERROR: CALL_AND_RETRY_LAST",
                    "heap out of memory",
                    "ENOMEM",
                ],
                "Node.js 内存不足，可尝试增大内存限制：node --max-old-space-size=4096",
                ErrorSeverity::Critical,
            ),
            create(
                "权限错误",
                &["EACCES", "Permission denied", "operation not permitted"],
                "权限不足，请检查文件/目录权限，或尝试以管理员身份运行",
                ErrorSeverity::Warning,
            ),
            create(
                "网络错误",
                &[
                    "ETIMEDOUT",
                    "ECONNREFUSED",
                    "ECONNRESET",
                    "(?i)network error",
                    "(?i)fetch failed",
                ],
                "网络连接失败，请检查网络状态或 npm 源配置",
                ErrorSeverity::Warning,
            ),
            create(
                "TypeScript 错误",
                &[r"TS\d{4}:", "error TS", "Type '.*' is not assignable"],
                "TypeScript 类型错误，请检查对应的 .ts 文件",
                ErrorSeverity::Warning,
            ),
            create(
                "Webpack/Vite 构建错误",
                &[
                    "Module build failed",
                    "(?i)webpack.*error",
                    "(?i)vite.*error",
                    "(?i)vite.*failed",
                ],
                "构建工具报错，请检查构建配置和源文件",
                ErrorSeverity::Warning,
            ),
        ]
    })
}

pub fn start_log_session(state: &AppState, project_id: &str) {
    if let Ok(mut logs) = state.logs.lock() {
        logs.insert(project_id.to_string(), Vec::new());
    }
    record_log_line(
        state,
        project_id,
        &LogType::Info,
        &format!(
            "=== 启动于 {} ===",
            Local::now().format("%Y-%m-%d %H:%M:%S")
        ),
    );
}

pub fn record_log_line(state: &AppState, project_id: &str, kind: &LogType, data: &str) {
    if data.trim().is_empty() {
        return;
    }
    let Ok(mut logs) = state.logs.lock() else {
        return;
    };
    let current = logs.entry(project_id.to_string()).or_default();
    for line in data.replace("\r\n", "\n").replace('\r', "\n").lines() {
        let line = line.trim();
        if !line.is_empty() {
            current.push(SessionLogLine {
                kind: kind.as_str().to_string(),
                line: line.to_string(),
            });
        }
    }
    if current.len() > MAX_SESSION_LOG_LINES {
        current.drain(0..current.len() - MAX_SESSION_LOG_LINES);
    }
}

pub fn finish_log_session(state: &AppState, project_id: &str, exit_code: Option<i32>) {
    record_log_line(
        state,
        project_id,
        &LogType::Info,
        &format!(
            "=== 退出于 {} 代码: {} ===",
            Local::now().format("%Y-%m-%d %H:%M:%S"),
            exit_code
                .map(|code| code.to_string())
                .unwrap_or_else(|| "N/A".to_string())
        ),
    );
}

pub fn analyze_errors(state: &AppState, project_id: &str, exit_code: i32) -> Option<ErrorAnalysis> {
    let logs = state.logs.lock().ok()?;
    let lines: Vec<String> = logs
        .get(project_id)?
        .iter()
        .map(|item| format!("[{}] {}", item.kind, item.line))
        .collect();
    drop(logs);

    let mut matches = Vec::new();
    for pattern in error_patterns() {
        let matched_lines: Vec<String> = lines
            .iter()
            .filter(|line| pattern.patterns.iter().any(|regex| regex.is_match(line)))
            .take(3)
            .map(|line| line.trim().to_string())
            .collect();
        if !matched_lines.is_empty() {
            matches.push(ErrorMatch {
                name: pattern.name.to_string(),
                severity: pattern.severity.clone(),
                lines: matched_lines,
                suggestion: pattern.suggestion.to_string(),
            });
        }
    }

    let summary = match matches.len() {
        0 => format!("进程异常退出（代码: {exit_code}），未匹配到已知错误模式"),
        1 => format!(
            "进程异常退出（代码: {exit_code}），可能原因: {}",
            matches[0].name
        ),
        count => format!(
            "进程异常退出（代码: {exit_code}），发现 {count} 个问题: {}",
            matches
                .iter()
                .map(|item| item.name.as_str())
                .collect::<Vec<_>>()
                .join("、")
        ),
    };

    Some(ErrorAnalysis {
        project_id: project_id.to_string(),
        exit_code,
        timestamp: timestamp_millis(),
        matches,
        summary,
    })
}
