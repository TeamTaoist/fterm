use anyhow::Result;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem, Child};
use serde::Deserialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Runtime};

pub struct PtyInstance {
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
}

#[derive(Clone)]
pub struct PtyState {
    pub ptys: Arc<Mutex<HashMap<String, PtyInstance>>>,
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
    size: PtyResize,
    app: AppHandle<R>,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows: size.rows,
            cols: size.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(default_shell());
    cmd.env("TERM", "xterm-256color");
    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let master = pair.master;
    let mut reader = master.try_clone_reader().map_err(|e| e.to_string())?;

    let event_name = format!("pty_data_{}", id);
    let app_clone = app.clone();
    thread::spawn(move || {
        let mut buffer = [0u8; 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(count) => {
                    if count > 0 {
                        let data = &buffer[..count];
                        app_clone
                            .emit(&event_name, String::from_utf8_lossy(data).to_string())
                            .unwrap();
                    } else {
                        app_clone
                            .emit(&event_name, "\r\n[Process exited]\r\n".to_string())
                            .unwrap();
                        break;
                    }
                }
                Err(_) => {
                    break;
                }
            }
        }
    });

    let child = Arc::new(Mutex::new(child));
    let child_clone_for_wait = child.clone();
    let state_clone = state.inner().clone();
    let id_clone = id.clone();
    thread::spawn(move || {
        let _ = child_clone_for_wait.lock().unwrap().wait();
        state_clone.ptys.lock().unwrap().remove(&id_clone);
    });

    let pty_instance = PtyInstance { master, child };
    state.ptys.lock().unwrap().insert(id, pty_instance);

    Ok(())
}

#[tauri::command]
pub fn pty_write(id: String, data: String, state: tauri::State<'_, PtyState>) -> Result<(), String> {
    if let Some(pty) = state.ptys.lock().unwrap().get_mut(&id) {
        pty.master
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    id: String,
    size: PtyResize,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    if let Some(pty) = state.ptys.lock().unwrap().get_mut(&id) {
        pty.master
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
    if let Some(pty) = state.ptys.lock().unwrap().remove(&id) {
        pty.child.lock().unwrap().kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn default_shell() -> String {
    if cfg!(windows) {
        "powershell.exe".to_string()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}
