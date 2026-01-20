# Create New GMRL App
# Usage: .\create-new-app.ps1 -AppName "MonitoringSheets" -AppFolder "F:\MonitoringSheets"

param(
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    
    [Parameter(Mandatory=$true)]
    [string]$AppFolder
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Creating New GMRL App: $AppName" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Create app folder
if (Test-Path $AppFolder) {
    Write-Host "Folder already exists: $AppFolder" -ForegroundColor Yellow
    $confirm = Read-Host "Overwrite? (y/n)"
    if ($confirm -ne "y") {
        Write-Host "Cancelled." -ForegroundColor Red
        exit 1
    }
}

New-Item -ItemType Directory -Path $AppFolder -Force | Out-Null
Write-Host "✅ Created folder: $AppFolder" -ForegroundColor Green

# Copy template files
Copy-Item -Path "F:\shared-modules\project-template\*" -Destination $AppFolder -Recurse -Force
Write-Host "✅ Copied template files" -ForegroundColor Green

# Copy auth module
Copy-Item -Path "F:\shared-modules\gmrl-auth\*" -Destination "$AppFolder\auth\" -Recurse -Force
Write-Host "✅ Copied auth module" -ForegroundColor Green

# Create additional folders
New-Item -ItemType Directory -Path "$AppFolder\public" -Force | Out-Null
New-Item -ItemType Directory -Path "$AppFolder\views" -Force | Out-Null
New-Item -ItemType Directory -Path "$AppFolder\services" -Force | Out-Null
New-Item -ItemType Directory -Path "$AppFolder\sql" -Force | Out-Null
Write-Host "✅ Created folder structure" -ForegroundColor Green

# Rename .env.example to .env
if (Test-Path "$AppFolder\.env.example") {
    Copy-Item "$AppFolder\.env.example" "$AppFolder\.env"
    Write-Host "✅ Created .env file (edit with your settings)" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  App Created Successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Open folder in VS Code: code $AppFolder" -ForegroundColor White
Write-Host "2. Edit .env with your app settings" -ForegroundColor White
Write-Host "3. Run: npm install" -ForegroundColor White
Write-Host "4. Add redirect URI to Azure AD:" -ForegroundColor White
Write-Host "   https://your-app.gmrlapps.com/auth/callback" -ForegroundColor Cyan
Write-Host "5. Run: node app.js" -ForegroundColor White
Write-Host ""
