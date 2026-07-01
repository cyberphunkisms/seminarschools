@echo off
setlocal
cd /d "%~dp0"
title Meaninglib Dashboard

echo ==========================================
echo Start Meaninglib Dashboard
echo ==========================================

where node >nul 2>nul
if errorlevel 1 (
  echo FAILED: Node.js is missing or unavailable.
  echo Install Node.js, then run this again.
  echo ==========================================
  pause
  exit /b 1
)

echo Opening local dashboard in your browser...
start "" "http://127.0.0.1:8765"

echo Starting local server. Keep this window open.
echo Close this window when you are finished using the dashboard.
echo ==========================================
node scripts\meaninglib-dashboard-server.js

echo ==========================================
echo Dashboard stopped.
echo ==========================================
pause
