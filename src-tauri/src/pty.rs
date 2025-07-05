use anyhow::Result;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::Deserialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Runtime};

#[derive(Clone)]
pub struct PtyState {
    pub ptys: Arc<Mutex<HashMap<String, Box<dyn portable_pty::MasterPty + Send>>>>,
}

impl PtyState {
    pub fn new() -> Self {
        Self {
            ptys: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(Deserialize)]
pub struct PtyResize {
    rows: u16,
    cols: u16,
}

#[tauri::command]
pub fn pty_spawn<R: Runtime>(
    id: String,
    app: AppHandle<R>,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let cmd = CommandBuilder::new(default_shell());
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let master = pair.master;
    let mut reader = master.try_clone_reader().map_err(|e| e.to_string())?;

    let event_name = format!("pty_data_{}", id);

    thread::spawn(move || {
        let mut buffer = [0u8; 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(count) => {
                    if count > 0 {
                        let data = &buffer[..count];
                        app.emit(&event_name, String::from_utf8_lossy(data).to_string())
                            .unwrap();
                    } else {
                        app.emit(&event_name, "\r\n[Process exited]\r\n".to_string()).unwrap();
                        break;
                    }
                }
                Err(_) => {
                    break;
                }
            }
        }
    });

    thread::spawn(move || {
        let _ = child.wait();
    });

    state.ptys.lock().unwrap().insert(id, master);

    Ok(())
}

#[tauri::command]
pub fn pty_write(id: String, data: String, state: tauri::State<'_, PtyState>) -> Result<(), String> {
    if let Some(master) = state.ptys.lock().unwrap().get_mut(&id) {
        master.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_resize(id: String, size: PtyResize, state: tauri::State<'_, PtyState>) -> Result<(), String> {
    if let Some(master) = state.ptys.lock().unwrap().get_mut(&id) {
        master
            .resize(PtySize {
                rows: size.rows,
                cols: size.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_kill(id: String, state: tauri::State<'_, PtyState>) -> Result<(), String> {
    state.ptys.lock().unwrap().remove(&id);
    Ok(())
}

fn default_shell() -> String {
    if cfg!(windows) {
        "powershell.exe".to_string()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}
