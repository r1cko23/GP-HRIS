@echo off
:: Elevate and run the PowerShell installer (hosts + local CA).
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo Requesting Administrator privileges...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-office-client.ps1"
if errorlevel 1 pause
