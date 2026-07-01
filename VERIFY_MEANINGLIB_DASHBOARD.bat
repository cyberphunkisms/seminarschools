@echo off
setlocal
cd /d "%~dp0"
title Verify Meaninglib Dashboard

echo ==========================================
echo Verify Meaninglib Dashboard files
echo ==========================================

node scripts\verify-meaninglib-dashboard.js
if errorlevel 1 goto fail

echo ==========================================
echo PASSED: Meaninglib dashboard files verified
echo ==========================================
pause
exit /b 0

:fail
echo ==========================================
echo FAILED: Dashboard verification stopped safely
echo ==========================================
pause
exit /b 1
