use std::env;
use std::process::Command;
use serde::Serialize;

#[tauri::command]
fn execute_command(command: String) -> Result<String, String> {
    let parts: Vec<&str> = command.trim().split_whitespace().collect();
    if parts.is_empty() {
        return Ok("".to_string());
    }

    let cmd = parts[0];
    let args = &parts[1..];

    if cmd == "cd" {
        let path = args.get(0).unwrap_or(&"~");
        let target;
        if *path == "~" {
            target = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
        } else {
            target = std::path::PathBuf::from(path);
        }

        if env::set_current_dir(&target).is_ok() {
            return Ok("".to_string());
        } else {
            return Err(format!("cd: no such file or directory: {}", path));
        }
    }

    let output = Command::new(cmd)
        .args(args)
        .output()
        .map_err(|_| format!("{}: command not found", cmd))?;

    Ok(
        String::from_utf8_lossy(if output.status.success() {
            &output.stdout
        } else {
            &output.stderr
        })
        .to_string(),
    )
}

#[tauri::command]
fn get_home_dir() -> String {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "".to_string())
}


#[derive(Serialize, Clone)]
struct SystemInfo {
    username: String,
    hostname: String,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        username: whoami::username(),
        hostname: whoami::devicename(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            execute_command,
            get_home_dir,
            get_system_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
