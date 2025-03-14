# CS2 Server Ping Checker

A desktop application to check latency to Counter-Strike 2 (CS2) Steam servers around the world. Built with Tauri and vanilla JavaScript.

## Features

- Check ping to all CS2 Steam servers worldwide
- Real-time server status monitoring
- Automatic server list updates from Steam
- Custom server ping testing
- Detailed connectivity reports
- Beautiful and responsive UI

## Installation

### Option 1: Standard Installation
1. Download the latest installer from the releases page
2. Run the installer (CS2.Server.Ping.Checker_1.0.0_x64_en-US.msi)
3. Launch "CS2 Server Ping Checker" from your Start menu

### Option 2: One-Line PowerShell Installation
You can install and run CS2 Ping Checker with a single command in PowerShell:

```powershell
irm https://raw.githubusercontent.com/oibayraktar/CS2-Ping-Checker/main/web-install.ps1 | iex
```

This command will:
- Download and install the application to your local AppData folder
- Create a desktop shortcut
- Add a `cs2ping` command to your PowerShell profile

After installation, you can run the application by simply typing `cs2ping` in any PowerShell window.

## Usage

1. Launch the application
2. The server list will automatically populate with CS2 servers
3. Click on any server to check its ping
4. Use "Check All Servers" to test connectivity to all servers
5. Generate a connectivity report to see detailed statistics
6. Use the custom IP checker to test specific servers

## Building from Source

### Prerequisites
- [Node.js](https://nodejs.org/) 16 or higher
- [Rust](https://www.rust-lang.org/tools/install)

### Steps
1. Clone the repository
```bash
git clone https://github.com/oibayraktar/CS2-Ping-Checker.git
cd CS2-Ping-Checker
```

2. Install dependencies
```bash
npm install
```

3. Run in development mode
```bash
npm run tauri dev
```

4. Build for production
```bash
npm run tauri build
```

The installer will be available in `src-tauri/target/release/bundle/msi/`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to Valve for providing the Steam server list API
- Flag icons provided by [flagcdn.com](https://flagcdn.com)

## Author

- [@oibayraktar](https://github.com/oibayraktar)