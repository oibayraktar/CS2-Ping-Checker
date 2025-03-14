<#
.SYNOPSIS
    CS2-Ping-Checker web installer
.DESCRIPTION
    This script downloads and installs the CS2 Server Ping Checker application
    when run directly from PowerShell using Invoke-RestMethod.
.NOTES
    Version: 1.0
#>

# Define variables
$appName = "CS2 Server Ping Checker"
$appVersion = "1.0.0"
$tempDir = "$env:TEMP\CS2PingChecker"
$installDir = "$env:LOCALAPPDATA\CS2PingChecker"

# GitHub repository information
$repoOwner = "YourGitHubUsername" # Replace with your actual GitHub username
$repoName = "CS2-Ping-Checker"
$releaseTag = "v$appVersion"
$assetName = "CS2.Server.Ping.Checker_${appVersion}_x64_en-US-portable.zip"
$exeName = "CS2 Server Ping Checker.exe"

# Create a function to show a fancy banner
function Show-Banner {
    Write-Host ""
    Write-Host "  ██████╗███████╗██████╗     ██████╗ ██╗███╗   ██╗ ██████╗      ██████╗██╗  ██╗███████╗ ██████╗██╗  ██╗███████╗██████╗ " -ForegroundColor Cyan
    Write-Host " ██╔════╝██╔════╝╚════██╗    ██╔══██╗██║████╗  ██║██╔════╝     ██╔════╝██║  ██║██╔════╝██╔════╝██║ ██╔╝██╔════╝██╔══██╗" -ForegroundColor Cyan
    Write-Host " ██║     ███████╗ █████╔╝    ██████╔╝██║██╔██╗ ██║██║  ███╗    ██║     ███████║█████╗  ██║     █████╔╝ █████╗  ██████╔╝" -ForegroundColor Cyan
    Write-Host " ██║     ╚════██║██╔═══╝     ██╔═══╝ ██║██║╚██╗██║██║   ██║    ██║     ██╔══██║██╔══╝  ██║     ██╔═██╗ ██╔══╝  ██╔══██╗" -ForegroundColor Cyan
    Write-Host " ╚██████╗███████║███████╗    ██║     ██║██║ ╚████║╚██████╔╝    ╚██████╗██║  ██║███████╗╚██████╗██║  ██╗███████╗██║  ██║" -ForegroundColor Cyan
    Write-Host "  ╚═════╝╚══════╝╚══════╝    ╚═╝     ╚═╝╚═╝  ╚═══╝ ╚═════╝      ╚═════╝╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  CS2 Server Ping Checker Installer" -ForegroundColor Yellow
    Write-Host "  Version $appVersion" -ForegroundColor Yellow
    Write-Host ""
}

# Show the banner
Show-Banner

# Create temporary directory
if (-not (Test-Path -Path $tempDir)) {
    Write-Host "Creating temporary directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

# Create installation directory
if (-not (Test-Path -Path $installDir)) {
    Write-Host "Creating installation directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# Get the download URL from GitHub releases
Write-Host "Fetching release information..." -ForegroundColor Yellow
try {
    # Try to get the release information from GitHub API
    $releaseUrl = "https://api.github.com/repos/$repoOwner/$repoName/releases/tags/$releaseTag"
    $releaseInfo = Invoke-RestMethod -Uri $releaseUrl -ErrorAction Stop
    
    # Find the asset with the matching name
    $asset = $releaseInfo.assets | Where-Object { $_.name -eq $assetName }
    
    if ($asset) {
        $downloadUrl = $asset.browser_download_url
    } else {
        # Fallback to direct URL if asset not found
        $downloadUrl = "https://github.com/$repoOwner/$repoName/releases/download/$releaseTag/$assetName"
    }
} catch {
    # Fallback to direct URL if API call fails
    Write-Host "Could not fetch release info from GitHub API, using direct URL..." -ForegroundColor Yellow
    $downloadUrl = "https://github.com/$repoOwner/$repoName/releases/download/$releaseTag/$assetName"
}

# Download the application
Write-Host "Downloading $appName from $downloadUrl..." -ForegroundColor Yellow
$zipPath = "$tempDir\cs2pingchecker.zip"

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
    Write-Host "Download complete!" -ForegroundColor Green
}
catch {
    Write-Host "Error downloading the application: $_" -ForegroundColor Red
    Write-Host "Please check your internet connection and try again." -ForegroundColor Yellow
    exit 1
}

# Extract the application
Write-Host "Extracting files..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $zipPath -DestinationPath $installDir -Force
    Write-Host "Extraction complete!" -ForegroundColor Green
}
catch {
    Write-Host "Error extracting the application: $_" -ForegroundColor Red
    exit 1
}

# Create a shortcut on the desktop
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktopPath\CS2 Ping Checker.lnk"
$executablePath = "$installDir\$exeName"

if (Test-Path -Path $executablePath) {
    Write-Host "Creating desktop shortcut..." -ForegroundColor Yellow
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $executablePath
    $shortcut.WorkingDirectory = $installDir
    $shortcut.Description = "CS2 Server Ping Checker"
    $shortcut.Save()
    Write-Host "Shortcut created!" -ForegroundColor Green
}
else {
    Write-Host "Warning: Could not find the executable at $executablePath" -ForegroundColor Yellow
    
    # Try to find the executable in the installation directory
    $foundExecutables = Get-ChildItem -Path $installDir -Filter "*.exe" -Recurse
    if ($foundExecutables.Count -gt 0) {
        $executablePath = $foundExecutables[0].FullName
        Write-Host "Found executable at: $executablePath" -ForegroundColor Green
        
        # Create shortcut with the found executable
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $executablePath
        $shortcut.WorkingDirectory = (Split-Path -Parent $executablePath)
        $shortcut.Description = "CS2 Server Ping Checker"
        $shortcut.Save()
        Write-Host "Shortcut created!" -ForegroundColor Green
    } else {
        Write-Host "Error: No executable found in the installation directory." -ForegroundColor Red
    }
}

# Create a PowerShell function to run the application
$profilePath = $PROFILE.CurrentUserAllHosts
$profileDir = Split-Path -Parent $profilePath

if (-not (Test-Path -Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

if (-not (Test-Path -Path $profilePath)) {
    New-Item -ItemType File -Path $profilePath -Force | Out-Null
}

$functionContent = @"

# CS2 Ping Checker function
function cs2ping {
    Start-Process -FilePath "$executablePath"
}
"@

# Check if the function already exists in the profile
$profileContent = Get-Content -Path $profilePath -ErrorAction SilentlyContinue
if ($profileContent -notcontains $functionContent) {
    Write-Host "Adding cs2ping function to PowerShell profile..." -ForegroundColor Yellow
    Add-Content -Path $profilePath -Value $functionContent
    Write-Host "Function added!" -ForegroundColor Green
}

# Clean up temporary files
Write-Host "Cleaning up temporary files..." -ForegroundColor Yellow
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Cleanup complete!" -ForegroundColor Green

# Final message
Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run CS2 Ping Checker by:" -ForegroundColor Cyan
Write-Host "  1. Typing 'cs2ping' in any new PowerShell window" -ForegroundColor White
Write-Host "  2. Double-clicking the shortcut on your desktop" -ForegroundColor White
Write-Host ""
Write-Host "Note: You may need to restart your PowerShell session for the 'cs2ping' command to work." -ForegroundColor Yellow
Write-Host ""

# Ask if the user wants to run the application now
$runNow = Read-Host "Do you want to run CS2 Ping Checker now? (Y/N)"
if ($runNow -eq "Y" -or $runNow -eq "y") {
    Write-Host "Starting $appName..." -ForegroundColor Green
    Start-Process -FilePath $executablePath
}

Write-Host "Thank you for installing CS2 Ping Checker!" -ForegroundColor Cyan 