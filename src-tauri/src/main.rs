// src/main.rs
// Main entry point for the Tauri application

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ping;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{PhysicalPosition, PhysicalSize};

// Define a struct for server information
#[derive(Serialize, Deserialize, Clone)]
struct ServerInfo {
    region: String,
    country: String,
    country_code: String,
    name: String,
    ip: String,
    flag: String,
}

// Command to get the ping for a server
#[tauri::command]
async fn get_ping(server: String) -> Result<String, String> {
    ping::get_ping(&server)
}

// Command to get the list of Steam servers
#[tauri::command]
fn get_servers() -> HashMap<String, ServerInfo> {
    let servers = ping::get_steam_servers();
    let mut server_map = HashMap::new();
    
    // Country code to country name mapping
    let country_names: HashMap<&str, &str> = [
        ("US", "United States"),
        ("NL", "Netherlands"),
        ("DE", "Germany"),
        ("FI", "Finland"),
        ("GB", "United Kingdom"),
        ("ES", "Spain"),
        ("FR", "France"),
        ("SE", "Sweden"),
        ("AT", "Austria"),
        ("PL", "Poland"),
        ("RU", "Russia"),
        ("BR", "Brazil"),
        ("CL", "Chile"),
        ("PE", "Peru"),
        ("AR", "Argentina"),
        ("HK", "Hong Kong"),
        ("KR", "South Korea"),
        ("SG", "Singapore"),
        ("JP", "Japan"),
        ("AU", "Australia"),
        ("ZA", "South Africa"),
        ("AE", "United Arab Emirates"),
    ].iter().cloned().collect();
    
    // Country code to flag emoji mapping
    let country_flags: HashMap<&str, &str> = [
        ("US", "🇺🇸"),
        ("NL", "🇳🇱"),
        ("DE", "🇩🇪"),
        ("FI", "🇫🇮"),
        ("GB", "🇬🇧"),
        ("ES", "🇪🇸"),
        ("FR", "🇫🇷"),
        ("SE", "🇸🇪"),
        ("AT", "🇦🇹"),
        ("PL", "🇵🇱"),
        ("RU", "🇷🇺"),
        ("BR", "🇧🇷"),
        ("CL", "🇨🇱"),
        ("PE", "🇵🇪"),
        ("AR", "🇦🇷"),
        ("HK", "🇭🇰"),
        ("KR", "🇰🇷"),
        ("SG", "🇸🇬"),
        ("JP", "🇯🇵"),
        ("AU", "🇦🇺"),
        ("ZA", "🇿🇦"),
        ("AE", "🇦🇪"),
    ].iter().cloned().collect();
    
    for (i, (region, country_code, name, ip)) in servers.into_iter().enumerate() {
        let country = country_names.get(country_code.as_str()).unwrap_or(&"Unknown").to_string();
        let flag = country_flags.get(country_code.as_str()).unwrap_or(&"🌐").to_string();
        
        server_map.insert(
            format!("server_{}", i),
            ServerInfo {
                region,
                country,
                country_code,
                name,
                ip,
                flag,
            },
        );
    }
    
    server_map
}

// Command to refresh the server list
#[tauri::command]
fn refresh_servers() -> HashMap<String, ServerInfo> {
    // This will force a refresh by calling get_servers
    get_servers()
}

#[tauri::command]
async fn set_window_size(window: tauri::Window, width: f64, height: f64, resizable: bool) -> Result<(), String> {
    if let Err(e) = window.set_size(PhysicalSize::new(width, height)) {
        return Err(format!("Failed to set window size: {}", e));
    }
    
    if let Err(e) = window.set_resizable(resizable) {
        return Err(format!("Failed to set resizable: {}", e));
    }
    
    Ok(())
}

#[tauri::command]
async fn center_window(window: tauri::Window) -> Result<(), String> {
    if let Some(monitor) = window.current_monitor().unwrap_or(None) {
        let screen_size = monitor.size();
        let window_size = window.outer_size().unwrap_or(PhysicalSize::new(1000, 800));
        
        let x = (screen_size.width as f64 - window_size.width as f64) / 2.0;
        let y = (screen_size.height as f64 - window_size.height as f64) / 2.0;
        
        if let Err(e) = window.set_position(PhysicalPosition::new(x, y)) {
            return Err(format!("Failed to center window: {}", e));
        }
    }
    
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_servers,
            refresh_servers,
            get_ping,
            set_window_size,
            center_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
} 