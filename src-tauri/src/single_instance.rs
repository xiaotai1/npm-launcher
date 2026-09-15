//! 单实例守卫：确保同一时刻只允许运行一个应用实例（跨平台统一）。
//!
//! - Windows：命名互斥体。
//! - Unix (macOS / Linux)：`flock` 文件锁。
//!
//! 判定存在已有实例后，本实例通过「唤醒标记文件」通知首个实例把主窗口唤起，
//! 然后本实例自行退出。首个实例在后台线程轮询唤醒标记，一旦被触发就显示并
//! 聚焦主窗口（适用于窗口被最小化到托盘或藏起时）。

use tauri::{AppHandle, Manager};

/// 用于 Unix 平台 flock 的锁文件路径（仅 Unix 使用）。
#[cfg(all(unix, not(target_os = "windows")))]
fn lock_path(app: &AppHandle) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("npm-launcher-{}.lock", app.config().identifier))
}

/// 用于唤起已有实例的「唤醒标记文件」路径。
fn wake_path(app: &AppHandle) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("npm-launcher-{}.wake", app.config().identifier))
}

/// 首个实例：spawn 一个后台线程持续轮询唤醒标记，命中时唤起主窗口。
/// 检测到被唤回后会删除唤醒文件，避免重复触发。
fn spawn_wake_monitor(app: AppHandle) {
    #[allow(clippy::let_and_return)]
    let wake = wake_path(&app);
    std::thread::spawn(move || loop {
        if wake.exists() {
            let _ = std::fs::remove_file(&wake);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    });
}

// ---------------------------------------------------------------------------
// Windows：命名互斥体
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
mod win {
    use tauri::{AppHandle, Manager};
    use windows_sys::Win32::{
        Foundation::{CloseHandle, GetLastError, HANDLE},
        System::Threading::CreateMutexW,
    };
    use std::os::windows::ffi::OsStrExt;

    /// `ERROR_ALREADY_EXISTS`（183）：命名互斥体已存在时会返回。
    const ERROR_ALREADY_EXISTS: u32 = 183;

    pub struct SingleInstanceState {
        handle: HANDLE,
    }

    unsafe impl Send for SingleInstanceState {}
    unsafe impl Sync for SingleInstanceState {}

    impl Drop for SingleInstanceState {
        fn drop(&mut self) {
            unsafe { CloseHandle(self.handle) };
        }
    }

    fn wide(s: &str) -> Vec<u16> {
        std::ffi::OsStr::new(s)
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>()
    }

    pub fn ensure(app: &AppHandle) -> bool {
        let id = app.config().identifier.clone();
        let name = format!("Local\\NPM_LAUNCHER_{id}");
        let nw = wide(&name);

        // SAFETY: 创建命名互斥体；同名已存在时返回 ERROR_ALREADY_EXISTS
        let handle = unsafe {
            CreateMutexW(std::ptr::null(), 0, nw.as_ptr())
        };
        let existed = unsafe { GetLastError() } == ERROR_ALREADY_EXISTS;
        if existed {
            // 已有实例：touch 唤醒文件并关闭临时句柄，随后退出
            unsafe { CloseHandle(handle) };
            let _ = std::fs::write(super::wake_path(app), b"");
            return false;
        }
        app.manage(SingleInstanceState { handle });
        true
    }
}

#[cfg(target_os = "windows")]
pub fn ensure(app: &AppHandle) -> bool {
    spawn_wake_monitor(app.clone());
    win::ensure(app)
}

// ---------------------------------------------------------------------------
// Unix（macOS / Linux）：flock 文件锁
// ---------------------------------------------------------------------------

#[cfg(all(unix, not(target_os = "windows")))]
mod unix_impl {
    use tauri::{AppHandle, Manager};
    use nix::fcntl::{Flock, FlockArg};

    /// 托管在 App 内的文件锁守卫：持有 `Flock<File>` 即持续占用独占锁。
    /// `Flock<File>` 内部是 `std::fs::File`（`Send + Sync`），因此该结构可安全共享。
    pub struct FileLockState {
        flock: Flock<std::fs::File>,
    }

    pub fn ensure(app: &AppHandle) -> bool {
        let path = super::lock_path(app);
        let file = match std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .open(&path)
        {
            Ok(f) => f,
            Err(_) => return true, // 保守放行
        };

        // 申请非阻塞独占锁；拿不到说明已有实例占用
        match Flock::lock(file, FlockArg::LockExclusiveNonblock) {
            Ok(flock) => {
                app.manage(FileLockState { flock });
                true
            }
            Err((_file, _errno)) => {
                // 已有实例：touch 唤醒标记并退出
                let _ = std::fs::write(super::wake_path(app), b"");
                false
            }
        }
    }
}

#[cfg(all(unix, not(target_os = "windows")))]
pub fn ensure(app: &AppHandle) -> bool {
    spawn_wake_monitor(app.clone());
    unix_impl::ensure(app)
}

#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
pub fn ensure(_app: &AppHandle) -> bool {
    true
}