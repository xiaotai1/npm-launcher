use tauri::{Manager, tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent}};

/// 托盘图标句柄。持有它以保证图标在整个运行期存活。
#[cfg(target_os = "windows")]
struct TrayHolder {
    #[allow(dead_code)]
    tray: tauri::tray::TrayIcon,
}

/// 创建系统托盘图标（仅 Windows）。
///
/// 左键单击：显示并聚焦主窗口。
/// 右键菜单：提供「显示主窗口」「退出」。
#[cfg(target_os = "windows")]
pub fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};

    let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出 NPM Launcher", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    // 复用应用自身图标作为托盘图标；若无则用 build 生成的默认图标
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "缺少应用图标"))?;

    let tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("NPM Launcher")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_window(app),
            "quit" => {
                // 直接退出：与「退出」按钮语义一致，走 RunEvent::Exit 清理进程
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_window(tray.app_handle());
            }
        })
        .build(app)?;

    // 持有托盘图标引用，避免其提前被 drop 而从系统托盘消失
    app.manage(TrayHolder { tray });
    Ok(())
}

fn show_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(not(target_os = "windows"))]
pub fn setup_tray(_app: &tauri::App) -> tauri::Result<()> {
    Ok(())
}