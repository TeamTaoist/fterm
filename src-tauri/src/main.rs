// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]


mod pty;

use image::GenericImageView;
use tauri::{
    image::Image,
    menu::{
        AboutMetadata, MenuBuilder, MenuId, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
    },
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_opener::OpenerExt;

fn main() {
    tauri::Builder::default()
        .manage(pty::PtyState::new())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();

            let app_name = handle.package_info().name.clone();
            let version = handle.package_info().version.to_string();

            let icon_path = handle
                .path()
                .resolve("icons/icon.png", tauri::path::BaseDirectory::Resource)?;
            let image_decoder =
                image::open(&icon_path).map_err(|e| tauri::Error::AssetNotFound(e.to_string()))?;
            let (width, height) = image_decoder.dimensions();
            let rgba = image_decoder.to_rgba8().into_raw();
            let icon = Image::new(&rgba, width, height);

            let about_metadata = AboutMetadata {
                name: Some(app_name),
                version: Some(version),
                copyright: Some("© 2024 FTerm Developers. All rights reserved.".to_string()),
                icon: Some(icon),
                ..Default::default()
            };

            let app_menu = SubmenuBuilder::new(handle, "FTerm")
                .items(&[
                    &PredefinedMenuItem::about(handle, None, Some(about_metadata))?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::services(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::hide(handle, None)?,
                    &PredefinedMenuItem::hide_others(handle, None)?,
                    &PredefinedMenuItem::show_all(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::quit(handle, None)?,
                ])
                .build()?;

            let file_menu = SubmenuBuilder::new(handle, "File")
                .items(&[
                    &MenuItemBuilder::with_id(MenuId::new("new_window"), "New Window")
                        .accelerator("CmdOrCtrl+N")
                        .build(handle)?,
                    &MenuItemBuilder::with_id(MenuId::new("new_tab"), "New Tab")
                        .accelerator("CmdOrCtrl+T")
                        .build(handle)?,
                ])
                .build()?;

            let help_menu = SubmenuBuilder::new(handle, "Help")
                .items(&[
                    &MenuItemBuilder::with_id(MenuId::new("learn_more"), "Learn More")
                        .build(handle)?,
                ])
                .build()?;

            let menu = MenuBuilder::new(handle)
                .items(&[&app_menu, &file_menu, &help_menu])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| match event.id().as_ref() {
                "new_window" => {
                    let _ = WebviewWindowBuilder::new(
                        app_handle,
                        "main-new",
                        WebviewUrl::App("index.html".into()),
                    )
                    .title("FTerm")
                    .build();
                }
                "new_tab" => {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.emit("new_tab", ());
                    }
                }
                "learn_more" => {
                    let _ = app_handle
                        .opener()
                        .open_url("https://teamtaoist.github.io/fterm/", None::<String>);
                }
                _ => {}
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
