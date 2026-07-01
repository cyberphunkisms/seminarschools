@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo Query Meaninglib AI Access Pack
echo Type exit to close.
echo ==========================================
:loop
set /p Q=AI Access Pack query: 
if /I "%Q%"=="exit" goto done
if "%Q%"=="" goto loop
node scripts\build-ai-access-pack.js --query "%Q%"
echo.
echo Wrote hf_export\ai_access_pack\latest_access_pack.md
echo.
goto loop
:done
exit /b 0
