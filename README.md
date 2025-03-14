# Steam Server Ping Checker

A lightweight desktop application built with Tauri that allows users to check ping times to various Steam servers worldwide. Get real-time latency information with a clean, modern interface.

![Steam Server Ping Checker](screenshot.png)

## Features

- 🌍 Check ping times to Steam servers worldwide
- 🚀 Real-time latency monitoring
- 📊 Visual ping quality indicators
- 🎮 Steam server region selection
- 📱 Responsive and modern UI
- 🔄 Auto-refresh capabilities
- 🎯 Server exclusion options
- 💻 Cross-platform support

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Rust (Tauri)
- **Network**: ICMP/TCP ping implementation
- **UI Framework**: Custom CSS with modern design principles

## Installation

1. Download the latest release for your operating system
2. Run the installer
3. Launch the application

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later)
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/oibayraktar/steam-server-ping-checker.git
   cd steam-server-ping-checker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run tauri dev
   ```

4. Build for production:
   ```bash
   npm run tauri build
   ```

## Usage

1. Launch the application
2. Select a Steam server region from the list
3. View real-time ping results
4. Use the "Check All Servers" feature for a comprehensive test
5. Exclude specific servers if needed
6. View detailed connectivity reports

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Steam for providing server infrastructure
- Tauri for the amazing framework
- The Rust community for excellent networking tools

## Author

- **Onur Ibrahim Bayraktar** - [GitHub](https://github.com/oibayraktar)

## Support

If you find this project helpful, please give it a ⭐️ on GitHub! 