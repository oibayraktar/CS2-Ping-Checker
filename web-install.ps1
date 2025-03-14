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
$repoOwner = "oibayraktar" # Your actual GitHub username
$repoName = "CS2-Ping-Checker"
$releaseTag = "v$appVersion"
# Update the asset name to match what you'll upload to GitHub releases
$assetName = "CS2.Server.Ping.Checker_${appVersion}_x64_en-US.msi"
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
$msiPath = "$tempDir\cs2pingchecker.msi"

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $msiPath -UseBasicParsing
    Write-Host "Download complete!" -ForegroundColor Green
}
catch {
    Write-Host "Error downloading the application: $_" -ForegroundColor Red
    Write-Host "Please check your internet connection and try again." -ForegroundColor Yellow
    exit 1
}

# Install the application
Write-Host "Installing $appName..." -ForegroundColor Yellow
try {
    # Run the MSI installer with logging
    $logPath = "$tempDir\install.log"
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$msiPath`" /qn /L*v `"$logPath`"" -Wait
    Write-Host "Installation complete!" -ForegroundColor Green
    
    # Display installation log if debug is needed
    # Get-Content -Path $logPath | Select-Object -Last 20
}
catch {
    Write-Host "Error installing the application: $_" -ForegroundColor Red
    exit 1
}

# Wait a moment for installation to finalize
Start-Sleep -Seconds 2

# Find the installed executable - expanded search
$executablePath = $null

# Common installation paths to check
$searchPaths = @(
    "${env:ProgramFiles}\CS2 Server Ping Checker",
    "${env:ProgramFiles(x86)}\CS2 Server Ping Checker",
    "${env:LOCALAPPDATA}\Programs\CS2 Server Ping Checker",
    "${env:APPDATA}\CS2 Server Ping Checker",
    "${env:LOCALAPPDATA}\CS2 Server Ping Checker",
    "$env:ProgramFiles",
    "$env:ProgramFiles(x86)",
    "$env:LOCALAPPDATA\Programs"
)

Write-Host "Searching for the executable..." -ForegroundColor Yellow

# First try exact paths
foreach ($path in $searchPaths) {
    $testPath = Join-Path -Path $path -ChildPath $exeName
    if (Test-Path -Path $testPath) {
        $executablePath = $testPath
        Write-Host "Found executable at: $executablePath" -ForegroundColor Green
        break
    }
}

# If not found, try a recursive search in common locations
if (-not $executablePath) {
    Write-Host "Performing deeper search..." -ForegroundColor Yellow
    
    # Try to find any .exe files with "CS2" or "Ping" in the name
    $possibleExes = @()
    
    foreach ($basePath in @("$env:ProgramFiles", "$env:ProgramFiles(x86)", "$env:LOCALAPPDATA\Programs")) {
        if (Test-Path -Path $basePath) {
            $possibleExes += Get-ChildItem -Path $basePath -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue | 
                Where-Object { $_.Name -like "*CS2*" -or $_.Name -like "*Ping*" -or $_.Name -like "*Server*" }
        }
    }
    
    if ($possibleExes.Count -gt 0) {
        $executablePath = $possibleExes[0].FullName
        Write-Host "Found potential executable at: $executablePath" -ForegroundColor Green
        
        # Show all found executables for debugging
        Write-Host "All potential executables found:" -ForegroundColor Yellow
        foreach ($exe in $possibleExes) {
            Write-Host "  - $($exe.FullName)" -ForegroundColor Gray
        }
    }
}

# Create a shortcut on the desktop if executable was found
if ($executablePath) {
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = "$desktopPath\CS2 Ping Checker.lnk"
    
    Write-Host "Creating desktop shortcut..." -ForegroundColor Yellow
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $executablePath
    $shortcut.WorkingDirectory = (Split-Path -Parent $executablePath)
    $shortcut.Description = "CS2 Server Ping Checker"
    $shortcut.Save()
    Write-Host "Shortcut created!" -ForegroundColor Green
    
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
}
else {
    Write-Host "Warning: Could not find the executable after installation." -ForegroundColor Yellow
    Write-Host "The application may still be installed correctly, but the script couldn't locate the executable." -ForegroundColor Yellow
    Write-Host "You can still run the application from the Start menu." -ForegroundColor Yellow
    
    # Try to find the Start menu shortcut as a fallback
    $startMenuPaths = @(
        "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
        "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
    )
    
    $startMenuShortcut = $null
    foreach ($path in $startMenuPaths) {
        $shortcuts = Get-ChildItem -Path $path -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue | 
            Where-Object { $_.Name -like "*CS2*" -or $_.Name -like "*Ping*" -or $_.Name -like "*Server*" }
        
        if ($shortcuts.Count -gt 0) {
            $startMenuShortcut = $shortcuts[0].FullName
            Write-Host "Found Start menu shortcut at: $startMenuShortcut" -ForegroundColor Green
            
            # Try to extract the target path from the shortcut
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut($startMenuShortcut)
            $executablePath = $shortcut.TargetPath
            
            if (Test-Path -Path $executablePath) {
                Write-Host "Found executable from shortcut: $executablePath" -ForegroundColor Green
                
                # Create desktop shortcut
                $desktopPath = [Environment]::GetFolderPath("Desktop")
                $shortcutPath = "$desktopPath\CS2 Ping Checker.lnk"
                $newShortcut = $shell.CreateShortcut($shortcutPath)
                $newShortcut.TargetPath = $executablePath
                $newShortcut.WorkingDirectory = (Split-Path -Parent $executablePath)
                $newShortcut.Description = "CS2 Server Ping Checker"
                $newShortcut.Save()
                Write-Host "Desktop shortcut created!" -ForegroundColor Green
                
                # Add PowerShell function
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
                
                break
            }
        }
    }
}

# Clean up temporary files
Write-Host "Cleaning up temporary files..." -ForegroundColor Yellow
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Cleanup complete!" -ForegroundColor Green

# Final message
Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""

if ($executablePath) {
    Write-Host "You can now run CS2 Ping Checker by:" -ForegroundColor Cyan
    Write-Host "  1. Typing 'cs2ping' in any new PowerShell window" -ForegroundColor White
    Write-Host "  2. Double-clicking the shortcut on your desktop" -ForegroundColor White
    Write-Host "  3. Finding it in your Start menu" -ForegroundColor White
    
    # Ask if the user wants to run the application now
    $runNow = Read-Host "Do you want to run CS2 Ping Checker now? (Y/N)"
    if ($runNow -eq "Y" -or $runNow -eq "y") {
        Write-Host "Starting $appName..." -ForegroundColor Green
        Start-Process -FilePath $executablePath
    }
} else {
    Write-Host "The application should be installed, but the script couldn't locate the executable." -ForegroundColor Yellow
    Write-Host "You can run CS2 Ping Checker by finding it in your Start menu." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Note: You may need to restart your PowerShell session for the 'cs2ping' command to work." -ForegroundColor Yellow
Write-Host ""
Write-Host "Thank you for installing CS2 Ping Checker!" -ForegroundColor Cyan 