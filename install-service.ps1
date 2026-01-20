# =====================================================
# Operational Excellence App - Service Installation Script
# Run as Administrator
# =====================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("UAT", "Live")]
    [string]$Environment,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("install", "uninstall", "start", "stop", "restart", "status")]
    [string]$Action = "install"
)

$AppPath = "F:\Operational Excellence Appliaction"
$DaemonPath = "$AppPath\daemon"
$WinSWUrl = "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe"

# Set service name based on environment
if ($Environment -eq "UAT") {
    $ServiceName = "OEApp-UAT"
    $Port = 3010
    $EnvFile = ".env.uat"
} else {
    $ServiceName = "OEApp-Live"
    $Port = 3011
    $EnvFile = ".env.live"
}

$ServiceExe = "$DaemonPath\$ServiceName.exe"
$ServiceXml = "$DaemonPath\$ServiceName.xml"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Operational Excellence App - $Environment" -ForegroundColor Cyan
Write-Host "  Action: $Action" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Please run this script as Administrator!" -ForegroundColor Red
    exit 1
}

# Create logs directory
$LogsPath = "$AppPath\logs"
if (-not (Test-Path $LogsPath)) {
    New-Item -ItemType Directory -Path $LogsPath -Force | Out-Null
    Write-Host "✅ Created logs directory" -ForegroundColor Green
}

# Download WinSW if not present
if (-not (Test-Path $ServiceExe)) {
    Write-Host "Downloading WinSW..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri $WinSWUrl -OutFile $ServiceExe
        Write-Host "✅ Downloaded WinSW as $ServiceName.exe" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: Failed to download WinSW. Please download manually from:" -ForegroundColor Red
        Write-Host "  $WinSWUrl" -ForegroundColor Cyan
        Write-Host "  Save as: $ServiceExe" -ForegroundColor Cyan
        exit 1
    }
}

# Copy environment file
$EnvSource = "$AppPath\$EnvFile"
$EnvDest = "$AppPath\.env"
if (Test-Path $EnvSource) {
    Copy-Item $EnvSource $EnvDest -Force
    Write-Host "✅ Copied $EnvFile to .env" -ForegroundColor Green
} else {
    Write-Host "WARNING: $EnvFile not found. Please create it first." -ForegroundColor Yellow
}

# Install node-windows if not present
$NodeWindowsPath = "$AppPath\node_modules\node-windows"
if (-not (Test-Path $NodeWindowsPath)) {
    Write-Host "Installing node-windows..." -ForegroundColor Yellow
    Push-Location $AppPath
    npm install node-windows --save
    Pop-Location
    Write-Host "✅ Installed node-windows" -ForegroundColor Green
}

# Execute service action
Write-Host ""
Write-Host "Executing: $ServiceName.exe $Action" -ForegroundColor Yellow
Push-Location $DaemonPath

switch ($Action) {
    "install" {
        & $ServiceExe install
        Write-Host ""
        Write-Host "✅ Service installed: $ServiceName" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Configure IIS reverse proxy" -ForegroundColor White
        Write-Host "  2. Start the service: .\install-service.ps1 -Environment $Environment -Action start" -ForegroundColor White
    }
    "uninstall" {
        & $ServiceExe stop 2>$null
        & $ServiceExe uninstall
        Write-Host "✅ Service uninstalled: $ServiceName" -ForegroundColor Green
    }
    "start" {
        & $ServiceExe start
        Write-Host "✅ Service started: $ServiceName (Port: $Port)" -ForegroundColor Green
    }
    "stop" {
        & $ServiceExe stop
        Write-Host "✅ Service stopped: $ServiceName" -ForegroundColor Green
    }
    "restart" {
        & $ServiceExe restart
        Write-Host "✅ Service restarted: $ServiceName" -ForegroundColor Green
    }
    "status" {
        & $ServiceExe status
    }
}

Pop-Location

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Done!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
