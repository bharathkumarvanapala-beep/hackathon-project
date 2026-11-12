# ==============================================================================
# Aarogya Drishti — All-in-One Local LiveKit & Telehealth Startup Script
# ==============================================================================
$ErrorActionPreference = 'Continue'
$workspaceDir = $PSScriptRoot
Set-Location -Path $workspaceDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Aarogya Drishti — Local LiveKit Telehealth Server" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Locate LiveKit Server Executable
$livekitExe = "C:\Users\AI PC\Downloads\livekit_1.13.11_windows_amd64\livekit-server.exe"
if (-not (Test-Path $livekitExe)) {
  $found = Get-ChildItem -Path "$env:USERPROFILE\Downloads" -Filter "livekit-server.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $livekitExe = $found.FullName }
}

# 2. Check if LiveKit Server is already running
$lkProcess = Get-Process -Name "livekit-server" -ErrorAction SilentlyContinue
if ($lkProcess) {
  Write-Host "[✓] LiveKit Server is already active (PID: $($lkProcess.Id))" -ForegroundColor Green
} else {
  if (Test-Path $livekitExe) {
    Write-Host "[*] Starting LiveKit Server in dev mode on port 7880..." -ForegroundColor Yellow
    if (-not (Test-Path '.local')) { New-Item -ItemType Directory -Path '.local' | Out-Null }
    Start-Process -FilePath $livekitExe -ArgumentList "--dev" -NoNewWindow -RedirectStandardOutput ".local/livekit.log" -RedirectStandardError ".local/livekit-error.log"
    Start-Sleep -Seconds 2
    Write-Host "[✓] LiveKit Server started on ws://127.0.0.1:7880" -ForegroundColor Green
  } else {
    Write-Host "[!] Warning: livekit-server.exe not found. WebRTC native fallback active." -ForegroundColor Red
  }
}

# 3. Check port 7880
$port7880 = Get-NetTCPConnection -LocalPort 7880 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
if ($port7880) {
  Write-Host "[✓] Verified LiveKit port 7880 is LISTENING" -ForegroundColor Green
} else {
  Write-Host "[!] Port 7880 not detected yet, continuing..." -ForegroundColor Yellow
}

# 4. Configure Environment
$env:PORT = "4173"
$env:HOST = "127.0.0.1"
$env:LIVEKIT_URL = "ws://127.0.0.1:7880"
$env:LIVEKIT_API_KEY = "devkey"
$env:LIVEKIT_API_SECRET = "secret"

# 5. Start Aarogya Drishti Backend Server
Write-Host "[*] Launching Aarogya Drishti on http://127.0.0.1:4173..." -ForegroundColor Cyan
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  TWO-BROWSER TESTING INSTRUCTIONS (ON ONE LAPTOP):" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Session 1 (Doctor):" -ForegroundColor White
Write-Host "    URL:      http://127.0.0.1:4173" -ForegroundColor Cyan
Write-Host "    Account:  doctor@drishti.demo / Drishti@2026" -ForegroundColor Gray
Write-Host ""
Write-Host "  Session 2 (Patient / Health Worker):" -ForegroundColor White
Write-Host "    URL:      http://127.0.0.1:4173 (Open in Incognito / Edge)" -ForegroundColor Cyan
Write-Host "    Account:  asha@drishti.demo / Drishti@2026" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

node server.mjs
