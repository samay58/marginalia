use std::fs;
use std::path::PathBuf;
use serde::Serialize;
use tauri::Manager;

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct CliOptions {
    file_path: Option<String>,
    bundle_dir: Option<String>,
    principles_path: Option<String>,
    out_path: Option<String>,
}

/// Read a file from the filesystem
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write a file to the filesystem
#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Save a bundle to the bundle directory
#[tauri::command]
fn save_bundle(bundle_dir: String, bundle_name: String, files: std::collections::HashMap<String, String>) -> Result<String, String> {
    let bundle_path = PathBuf::from(&bundle_dir).join(&bundle_name);

    // Create bundle directory
    fs::create_dir_all(&bundle_path).map_err(|e| format!("Failed to create bundle directory: {}", e))?;

    // Write each file
    for (filename, content) in files {
        let file_path = bundle_path.join(&filename);
        fs::write(&file_path, content).map_err(|e| format!("Failed to write {}: {}", filename, e))?;
    }

    Ok(bundle_path.to_string_lossy().to_string())
}

/// Get the home directory
#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

/// Close the application window
#[tauri::command]
fn close_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .close()
            .map_err(|e| format!("Failed to close window: {}", e))?;
    }
    app.exit(0);
    Ok(())
}

/// Parse CLI arguments and return the file path if provided
#[tauri::command]
fn get_cli_file_path(app: tauri::AppHandle) -> Option<String> {
    app.state::<CliState>().options.file_path.clone()
}

#[tauri::command]
fn get_cli_options(app: tauri::AppHandle) -> CliOptions {
    app.state::<CliState>().options.clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            save_bundle,
            get_home_dir,
            get_cli_file_path,
            get_cli_options,
            close_window,
        ])
        .setup(|app| {
            // Check for CLI arguments
            let args: Vec<String> = std::env::args().collect();
            let options = parse_cli_options(&args);
            app.manage(CliState { options });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Internal helper to parse CLI args
fn parse_cli_options(args: &[String]) -> CliOptions {
    let mut options = CliOptions::default();
    let mut positionals = Vec::new();
    let mut i = 1;

    while i < args.len() {
        let arg = &args[i];
        if arg == "--bundle-dir" || arg == "--principles" || arg == "--out" {
            if i + 1 < args.len() {
                let value = args[i + 1].clone();
                match arg.as_str() {
                    "--bundle-dir" => options.bundle_dir = Some(value),
                    "--principles" => options.principles_path = Some(value),
                    "--out" => options.out_path = Some(value),
                    _ => {}
                }
                i += 2;
                continue;
            }
        }
        if let Some(value) = arg.strip_prefix("--bundle-dir=") {
            options.bundle_dir = Some(value.to_string());
            i += 1;
            continue;
        }
        if let Some(value) = arg.strip_prefix("--principles=") {
            options.principles_path = Some(value.to_string());
            i += 1;
            continue;
        }
        if let Some(value) = arg.strip_prefix("--out=") {
            options.out_path = Some(value.to_string());
            i += 1;
            continue;
        }
        if arg.starts_with('-') {
            i += 1;
            continue;
        }
        positionals.push(arg.clone());
        i += 1;
    }

    if let Some(open_index) = positionals.iter().position(|arg| arg == "open") {
        if let Some(path) = positionals.get(open_index + 1) {
            options.file_path = Some(path.clone());
        }
    } else if let Some(path) = positionals.get(0) {
        options.file_path = Some(path.clone());
    }

    options
}

// State struct to hold CLI arguments
struct CliState {
    options: CliOptions,
}
