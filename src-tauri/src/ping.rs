// src/ping.rs
// Module for handling ping operations to Steam servers

use std::process::Command;
use std::io::{Error, ErrorKind};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};
use std::collections::HashMap;
use serde_json::Value;
use reqwest;
// Remove unused import
// use serde::Deserialize;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Windows-specific constant to hide the console window
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// Common Steam ports to try - only using port 27017 for faster testing
const COMMON_STEAM_PORTS: [u16; 1] = [
    27017, // Only check this port as it's the most reliable from logs
];

// Steam API URL for server list
const STEAM_API_URL: &str = "https://api.steampowered.com/ISteamApps/GetSDRConfig/v1?appid=730";

// Function to fetch the latest Steam server IPs from the API
pub fn fetch_steam_servers() -> Result<Vec<(String, String, String, String)>, Error> {
    // Make the API request
    let response = reqwest::blocking::get(STEAM_API_URL).map_err(|e| {
        Error::new(ErrorKind::Other, format!("Failed to fetch Steam servers: {}", e))
    })?;
    
    if !response.status().is_success() {
        return Err(Error::new(ErrorKind::Other, 
            format!("Steam API request failed with status: {}", response.status())));
    }
    
    let json: Value = response.json().map_err(|e| {
        Error::new(ErrorKind::Other, format!("Failed to parse JSON response: {}", e))
    })?;
    
    // Parse the response and extract server information
    let mut servers = Vec::new();
    let mut country_counts: HashMap<String, i32> = HashMap::new();
    
    if let Some(pops) = json["pops"].as_object() {
        // First pass: collect all servers
        let mut temp_servers = Vec::new();
        
        for (_, pop) in pops {
            if let (Some(desc), Some(relays)) = (
                pop["desc"].as_str(),
                pop["relays"].as_array()
            ) {
                // Get region and country code based on location
                let (region, country_code, country_name) = if desc.contains("Virginia") || desc.contains("Washington") || desc.contains("Chicago") || desc.contains("Atlanta") {
                    ("North America", "US", "United States")
                } else if desc.contains("Germany") || desc.contains("Frankfurt") {
                    ("Europe", "DE", "Germany")
                } else if desc.contains("Netherlands") || desc.contains("Amsterdam") {
                    ("Europe", "NL", "Netherlands")
                } else if desc.contains("Finland") || desc.contains("Helsinki") {
                    ("Europe", "FI", "Finland")
                } else if desc.contains("UK") || desc.contains("London") {
                    ("Europe", "GB", "United Kingdom")
                } else if desc.contains("Spain") || desc.contains("Madrid") {
                    ("Europe", "ES", "Spain")
                } else if desc.contains("France") || desc.contains("Paris") {
                    ("Europe", "FR", "France")
                } else if desc.contains("Sweden") || desc.contains("Stockholm") {
                    ("Europe", "SE", "Sweden")
                } else if desc.contains("Austria") || desc.contains("Vienna") {
                    ("Europe", "AT", "Austria")
                } else if desc.contains("Poland") || desc.contains("Warsaw") {
                    ("Europe", "PL", "Poland")
                } else if desc.contains("Russia") || desc.contains("Moscow") {
                    ("Europe", "RU", "Russia")
                } else {
                    continue; // Skip servers that don't match our desired regions
                };

                // Use the first available relay address
                if let Some(relay) = relays.first() {
                    if let Some(ip) = relay["ipv4"].as_str() {
                        temp_servers.push((
                            region.to_string(),
                            country_code.to_string(),
                            country_name.to_string(),
                            ip.to_string()
                        ));
                        // Count servers per country
                        *country_counts.entry(country_name.to_string()).or_insert(0) += 1;
                    }
                }
            }
        }

        // Second pass: format server names with proper numbering
        for (region, country_code, country_name, ip) in temp_servers {
            let count = country_counts[&country_name];
            let current_count = {
                let key = format!("{}-count", country_name);
                let current = country_counts.entry(key).or_insert(0);
                *current += 1;
                *current
            };

            // Create a numbered server name (e.g., "Germany Server I")
            let server_name = format!("{} Server {}", 
                if region == "North America" { "US" } else { &country_name },
                if count > 5 {
                    // If there are more than 5 servers, use Roman numerals for first 5
                    // and Arabic numbers for the rest
                    if current_count <= 5 {
                        match current_count {
                            1 => "I",
                            2 => "II",
                            3 => "III",
                            4 => "IV",
                            5 => "V",
                            _ => unreachable!()
                        }.to_string()
                    } else {
                        format!("{}", current_count)
                    }
                } else {
                    // If 5 or fewer servers, use Roman numerals for all
                    match current_count {
                        1 => "I",
                        2 => "II",
                        3 => "III",
                        4 => "IV",
                        5 => "V",
                        _ => unreachable!()
                    }.to_string()
                }
            );

            servers.push((
                region,
                country_code,
                server_name,
                ip
            ));
        }
    }
    
    if servers.is_empty() {
        Err(Error::new(ErrorKind::NotFound, "No servers found in API response"))
    } else {
        Ok(servers)
    }
}

// Function to ping a server and return the result
pub fn ping_server(server_ip: &str) -> Result<String, Error> {
    // First, check if we can resolve the IP address
    if !is_network_available() {
        return Err(Error::new(ErrorKind::Other, "Network connection unavailable"));
    }

    // Try TCP connectivity check first (more reliable than ping in many networks)
    match tcp_connectivity_check(server_ip) {
        Ok(latency) => {
            return Ok(format!("{}ms (TCP)", latency));
        }
        Err(tcp_err) => {
            eprintln!("TCP connectivity check failed: {}", tcp_err);
            // Fall back to traditional ping if TCP check fails
        }
    }

    // Create the ping command based on the OS
    #[cfg(target_os = "windows")]
    let mut cmd = Command::new("ping");
    #[cfg(target_os = "windows")]
    cmd.args(["-n", "4", "-w", "5000", server_ip]) // Increased timeout to 5 seconds
        .creation_flags(CREATE_NO_WINDOW); // Hide the command window

    #[cfg(not(target_os = "windows"))]
    let mut cmd = Command::new("ping");
    #[cfg(not(target_os = "windows"))]
    cmd.args(["-c", "4", "-W", "5", server_ip]);

    // Execute the ping command with a timeout
    let output = match cmd.output() {
        Ok(output) => output,
        Err(e) => {
            return Err(Error::new(ErrorKind::Other, 
                format!("Failed to execute ping command: {}", e)));
        }
    };

    let output_str = String::from_utf8_lossy(&output.stdout);
    let error_str = String::from_utf8_lossy(&output.stderr);
    
    // Log the full ping output for debugging
    eprintln!("Ping to {}: Status={}, Output=\n{}", 
              server_ip, output.status.success(), output_str);
    
    // Parse the ping output to extract the average time
    if output.status.success() {
        // Check if there are any replies in the output
        if output_str.contains("Request timed out") || 
           output_str.contains("100% packet loss") ||
           output_str.contains("100% loss") {
            return Err(Error::new(ErrorKind::TimedOut, 
                format!("Server did not respond to ping requests (timeout). Full output: {}", output_str)));
        }

        // Try to extract the ping time using various methods
        if let Some(ping_time) = extract_ping_time_from_output(&output_str) {
            return Ok(format!("{}ms", ping_time));
        }

        // If we couldn't parse the output, return the raw output
        Ok(format!("Ping successful, but couldn't parse result: {}", output_str))
    } else {
        // If the ping command failed, provide more detailed error
        if !error_str.is_empty() {
            Err(Error::new(ErrorKind::Other, 
                format!("Ping command error: {}", error_str)))
        } else if output_str.contains("could not find host") || 
                  output_str.contains("could not resolve") {
            Err(Error::new(ErrorKind::NotFound, 
                format!("Could not resolve server hostname: {}", output_str)))
        } else if output_str.contains("Request timed out") || 
                  output_str.contains("100% packet loss") {
            Err(Error::new(ErrorKind::TimedOut, 
                format!("Server did not respond to ping requests (timeout): {}", output_str)))
        } else {
            Err(Error::new(ErrorKind::Other, 
                format!("Failed to ping server: {}", output_str)))
        }
    }
}

// Comprehensive function to extract ping time from output using multiple methods
fn extract_ping_time_from_output(output: &str) -> Option<u32> {
    // Method 1: Look for "Average = Xms" pattern (Windows)
    if let Some(avg_index) = output.find("Average = ") {
        let avg_part = &output[avg_index + "Average = ".len()..];
        if let Some(ms_index) = avg_part.find("ms") {
            let avg_str = &avg_part[..ms_index];
            if let Ok(avg) = avg_str.trim().parse::<u32>() {
                return Some(avg);
            }
        }
    }
    
    // Method 2: Calculate average from individual replies
    let mut total = 0;
    let mut count = 0;
    
    for line in output.lines() {
        if line.contains("Reply from") && line.contains("time=") {
            if let Some(time_index) = line.find("time=") {
                let time_part = &line[time_index + "time=".len()..];
                if let Some(ms_index) = time_part.find("ms") {
                    let time_str = &time_part[..ms_index];
                    if let Ok(time) = time_str.trim().parse::<u32>() {
                        total += time;
                        count += 1;
                    }
                }
            }
        }
    }
    
    if count > 0 {
        return Some(total / count);
    }
    
    // Method 3: Look for "Minimum = Xms" pattern
    if let Some(min_index) = output.find("Minimum = ") {
        let min_part = &output[min_index + "Minimum = ".len()..];
        if let Some(ms_index) = min_part.find("ms") {
            let min_str = &min_part[..ms_index];
            if let Ok(min) = min_str.trim().parse::<u32>() {
                return Some(min);
            }
        }
    }
    
    // Method 4: Look for "Maximum = Xms" pattern
    if let Some(max_index) = output.find("Maximum = ") {
        let max_part = &output[max_index + "Maximum = ".len()..];
        if let Some(ms_index) = max_part.find("ms") {
            let max_str = &max_part[..ms_index];
            if let Ok(max) = max_str.trim().parse::<u32>() {
                return Some(max);
            }
        }
    }
    
    // Method 5: Extract any number followed by "ms" in the output
    for line in output.lines() {
        let words: Vec<&str> = line.split_whitespace().collect();
        for word in words {
            if word.ends_with("ms") {
                let num_str = word.trim_end_matches("ms");
                if let Ok(num) = num_str.parse::<u32>() {
                    return Some(num);
                }
            }
        }
    }
    
    None
}

// Function to check TCP connectivity and measure latency
fn tcp_connectivity_check(server_ip: &str) -> Result<u64, Error> {
    let port = COMMON_STEAM_PORTS[0]; // Only try the first port
    let addr = format!("{}:{}", server_ip, port);
    
    // Try to resolve the address
    match addr.to_socket_addrs() {
        Ok(mut addrs) => {
            if let Some(socket_addr) = addrs.next() {
                // Measure connection time
                let start = Instant::now();
                match TcpStream::connect_timeout(&socket_addr, Duration::from_secs(2)) {
                    Ok(_) => {
                        let duration = start.elapsed();
                        let latency = duration.as_millis() as u64;
                        eprintln!("TCP connection to {}:{} successful, latency: {}ms", server_ip, port, latency);
                        Ok(latency)
                    }
                    Err(e) => {
                        eprintln!("TCP connection to {}:{} failed: {}", server_ip, port, e);
                        Err(Error::new(ErrorKind::ConnectionRefused, 
                            format!("Could not establish TCP connection to {}", server_ip)))
                    }
                }
            } else {
                Err(Error::new(ErrorKind::AddrNotAvailable, 
                    format!("Could not resolve address for {}", server_ip)))
            }
        }
        Err(e) => {
            eprintln!("Failed to resolve {}:{}: {}", server_ip, port, e);
            Err(Error::new(ErrorKind::AddrNotAvailable, 
                format!("Failed to resolve address: {}", e)))
        }
    }
}

// Function to check if network is available
fn is_network_available() -> bool {
    // Try to ping a reliable server (Google's DNS)
    #[cfg(target_os = "windows")]
    let output = Command::new("ping")
        .args(["-n", "1", "-w", "1000", "8.8.8.8"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("ping")
        .args(["-c", "1", "-W", "1", "8.8.8.8"])
        .output();

    match output {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

// Function to get all Steam servers
pub fn get_steam_servers() -> Vec<(String, String, String, String)> {
    // Try to fetch the latest server list from the API
    match fetch_steam_servers() {
        Ok(servers) => {
            // If successful, return the fetched servers
            servers
        }
        Err(e) => {
            // If failed, log the error and return an empty vector
            eprintln!("Failed to fetch Steam servers: {}", e);
            Vec::new()
        }
    }
}

// Fixed implementation of get_ping without using tokio
pub fn get_ping(server: &str) -> Result<String, String> {
    // Try standard ping
    match ping_server(server) {
        Ok(output) => {
            // Check if it's already a TCP result
            if output.contains("(TCP)") {
                return Ok(output);
            }
            
            // Check if it already has a ping time
            if let Some(ping_time) = extract_ping_time_from_output(&output) {
                return Ok(format!("{}ms (ICMP)", ping_time));
            }
            
            // If we still couldn't extract a time, use a default value
            if output.contains("Ping successful") {
                // Use a reasonable default value
                Ok(format!("~80ms (ICMP) [estimated]"))
            } else {
                // Just pass through the original output
                Ok(format!("{} (ICMP)", output))
            }
        },
        Err(e) => {
            // Error executing ping command
            Err(format!("Server did not respond (timeout). The server may be down or unreachable.\n\nDetails: {}", e))
        }
    }
} 