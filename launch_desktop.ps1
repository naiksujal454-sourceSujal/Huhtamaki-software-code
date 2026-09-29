Set-Location -Path "$PSScriptRoot\Frontend"
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  HUHTAMAKI VISION INSPECTION SYSTEM - Code & Label Verification" -ForegroundColor Green
Write-Host "  Launching Desktop App with Instant Hot-Reload (Vite + Tauri + Python)..." -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Cyan
npm run desktop
