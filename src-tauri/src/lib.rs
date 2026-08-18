mod commands;
mod config;
mod environment;
mod log;
mod models;
mod package;
mod process;
mod state;
mod terminal;

use tauri::Manager;

#[cfg(target_os = "macos")]
fn install_macos_menu(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{MenuBuilder, PredefinedMenuItem, SubmenuBuilder};

    let about = PredefinedMenuItem::about(app, Some("关于 NPM Launcher"), None)?;
    let hide = PredefinedMenuItem::hide(app, Some("隐藏"))?;
    let hide_others = PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?;
    let show_all = PredefinedMenuItem::show_all(app, Some("全部显示"))?;
    let quit = PredefinedMenuItem::quit(app, Some("退出"))?;
    let app_separator_one = PredefinedMenuItem::separator(app)?;
    let app_separator_two = PredefinedMenuItem::separator(app)?;
    let app_menu = SubmenuBuilder::new(app, "NPM Launcher")
        .items(&[
            &about,
            &app_separator_one,
            &hide,
            &hide_others,
            &show_all,
            &app_separator_two,
            &quit,
        ])
        .build()?;

    let undo = PredefinedMenuItem::undo(app, Some("撤销"))?;
    let redo = PredefinedMenuItem::redo(app, Some("重做"))?;
    let cut = PredefinedMenuItem::cut(app, Some("剪切"))?;
    let copy = PredefinedMenuItem::copy(app, Some("复制"))?;
    let paste = PredefinedMenuItem::paste(app, Some("粘贴"))?;
    let select_all = PredefinedMenuItem::select_all(app, Some("全选"))?;
    let edit_separator = PredefinedMenuItem::separator(app)?;
    let edit_menu = SubmenuBuilder::new(app, "编辑")
        .items(&[
            &undo,
            &redo,
            &edit_separator,
            &cut,
            &copy,
            &paste,
            &select_all,
        ])
        .build()?;
    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &edit_menu])
        .build()?;
    app.set_menu(menu)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = state::AppState::new(app.handle()).map_err(std::io::Error::other)?;
            app.manage(state);
            #[cfg(target_os = "macos")]
            {
                install_macos_menu(app)?;
                if let Some(window) = app.get_webview_window("main") {
                    let app_handle = app.handle().clone();
                    let window_handle = window.clone();
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            process::stop_all_processes(&app_handle);
                            if let Some(state) = app_handle.try_state::<state::AppState>() {
                                terminal::kill_all_terminals(&state);
                            }
                            let _ = window_handle.hide();
                        }
                    });
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::save_config,
            commands::export_config,
            commands::import_config,
            commands::add_project,
            commands::update_project,
            commands::delete_project,
            commands::reorder_projects,
            commands::reorder_folders,
            commands::add_folder,
            commands::update_folder,
            commands::delete_folder,
            commands::toggle_favorite,
            commands::move_project_to_folder,
            commands::get_node_version,
            commands::get_node_versions,
            commands::switch_node_version,
            commands::select_folder,
            commands::get_package_scripts,
            commands::open_in_file_manager,
            commands::open_in_vscode,
            commands::open_local_url,
            commands::set_native_theme,
            commands::start_project,
            commands::stop_project,
            commands::get_process_status,
            commands::start_all_projects,
            commands::stop_all_projects,
            commands::export_log,
            commands::analyze_errors,
            commands::window_minimize,
            commands::window_maximize,
            commands::window_close,
            commands::window_is_maximized,
            commands::pty_spawn,
            commands::pty_write,
            commands::pty_resize,
            commands::pty_kill,
        ])
        .build(tauri::generate_context!())
        .expect("启动 NPM Launcher 失败");
    app.run(|app, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = event {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        if matches!(event, tauri::RunEvent::Exit) {
            process::stop_all_processes(app);
            if let Some(state) = app.try_state::<state::AppState>() {
                terminal::kill_all_terminals(&state);
            }
        }
    });
}
