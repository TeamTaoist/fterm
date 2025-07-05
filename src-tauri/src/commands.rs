use dirs;
use serde::Serialize;
use std::env;
use std::process::Command;
use whoami;

#[derive(Serialize, Clone)]
pub struct SystemInfo {
    pub username: String,
    pub hostname: String,
}

#[tauri::command]
pub fn execute_command(command: String) -> Result<String, String> {
    let parts: Vec<&str> = command.trim().split_whitespace().collect();
    if parts.is_empty() {
        return Ok("".to_string());
    }

    let cmd = parts[0];
    let args = &parts[1..];

    if cmd == "cd" {
        let path = args.get(0).unwrap_or(&"~");
        let target = if *path == "~" {
            dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?
        } else {
            std::path::PathBuf::from(path)
        };

        if env::set_current_dir(&target).is_ok() {
            Ok("".to_string())
        } else {
            Err(format!("cd: no such file or directory: {}", path))
        }
    } else {
        let output = Command::new(cmd)
            .args(args)
            .output()
            .map_err(|_| format!("{}: command not found", cmd))?;

        Ok(String::from_utf8_lossy(if output.status.success() {
            &output.stdout
        } else {
            &output.stderr
        })
        .to_string())
    }
}

#[tauri::command]
pub fn get_home_dir() -> String {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "".to_string())
}

#[tauri::command]
pub fn get_current_dir() -> String {
    env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "".to_string())
}

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        username: whoami::username(),
        hostname: whoami::devicename(),
    }
}
