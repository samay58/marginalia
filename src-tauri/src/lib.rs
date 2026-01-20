use std::fs;
use std::path::PathBuf;
use tauri::Manager;

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
    // Exit the application
    app.exit(0);
    Ok(())
}

/// Parse CLI arguments and return the file path if provided
#[tauri::command]
fn get_cli_file_path(app: tauri::AppHandle) -> Option<String> {
    let args: Vec<String> = std::env::args().collect();

    // Look for "open" command followed by a path
    // Usage: marginalia open /path/to/file.md
    for i in 0..args.len() {
        if args[i] == "open" && i + 1 < args.len() {
            return Some(args[i + 1].clone());
        }
    }

    // Also check for direct file path argument (first non-flag arg after binary name)
    if args.len() > 1 && !args[1].starts_with('-') && args[1] != "open" {
        return Some(args[1].clone());
    }

    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            save_bundle,
            get_home_dir,
            get_cli_file_path,
            close_window,
        ])
        .setup(|app| {
            // Check for CLI arguments
            let args: Vec<String> = std::env::args().collect();

            // Store CLI file path in app state for the frontend to access
            if let Some(file_path) = get_cli_file_path_internal(&args) {
                app.manage(CliState { file_path: Some(file_path) });
            } else {
                app.manage(CliState { file_path: None });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Internal helper to parse CLI args
fn get_cli_file_path_internal(args: &[String]) -> Option<String> {
    for i in 0..args.len() {
        if args[i] == "open" && i + 1 < args.len() {
            return Some(args[i + 1].clone());
        }
    }

    if args.len() > 1 && !args[1].starts_with('-') && args[1] != "open" {
        return Some(args[1].clone());
    }

    None
}

// State struct to hold CLI arguments
struct CliState {
    file_path: Option<String>,
}
