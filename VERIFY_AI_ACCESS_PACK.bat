@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo Verify Meaninglib AI Access Pack
echo ==========================================
call npm run verify:ai-access-pack
if errorlevel 1 goto fail
echo ==========================================
echo PASSED: AI Access Pack verification passed
echo ==========================================
pause
exit /b 0
:fail
echo ==========================================
echo FAILED: AI Access Pack verification failed
echo ==========================================
pause
exit /b 1
