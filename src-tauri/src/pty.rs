use anyhow::Result;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::Deserialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{mpsc::{channel, Sender}, Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Runtime};

pub struct PtyInstance {
    master: Box<dyn portable_pty::MasterPty + Send>,
    killer: Sender<()>,
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

    let shell = default_shell();
    let mut cmd = CommandBuilder::new(&shell);
    cmd.env("TERM", "xterm-256color");
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    // Inject the title-setting command
    let mut writer = pair.master.try_clone_writer().map_err(|e| e.to_string())?;
    let shell_init_cmd = if shell.ends_with("zsh") {
        "precmd() { print -Pn \"\\033]0;%1c\\a\" }\n"
    } else if shell.ends_with("bash") {
        "PROMPT_COMMAND='echo -ne \"\\033]0;\\W\\a\"'\n"
    } else {
        ""
    };

    if !shell_init_cmd.is_empty() {
        writer.write_all(shell_init_cmd.as_bytes()).map_err(|e| e.to_string())?;
    }

    let master = pair.master;
    let mut reader = master.try_clone_reader().map_err(|e| e.to_string())?;

    let (tx, rx) = channel::<()>();

    // Waiter thread
    thread::spawn(move || {
        if rx.recv().is_ok() {
            let _ = child.kill();
        }
        let _ = child.wait();
    });

    let event_name = format!("pty_data_{}", id);
    let app_clone = app.clone();
    let state_clone = state.inner().clone();
    let id_clone = id.clone();

    // Reader thread
    thread::spawn(move || {
        let mut buffer = [0u8; 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(count) => {
                    if count > 0 {
                        app_clone.emit(&event_name, String::from_utf8_lossy(&buffer[..count]).to_string()).unwrap();
                    } else {
                        app_clone.emit(&event_name, "\r\n[Process exited]\r\n".to_string()).unwrap();
                        break;
                    }
                }
                Err(_) => {
                    break;
                }
            }
        }
        // Cleanup
        state_clone.ptys.lock().unwrap().remove(&id_clone);
    });

    let pty_instance = PtyInstance { master, killer: tx };
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
    if let Some(pty) = state.ptys.lock().unwrap().get(&id) {
        let _ = pty.killer.send(());
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
