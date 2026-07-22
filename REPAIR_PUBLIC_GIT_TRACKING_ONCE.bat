@echo off
setlocal
cd /d "%~dp0"
echo Repairing generated public folder tracking...
node scripts\repair-repository-hygiene.js
set CODE=%ERRORLEVEL%
echo.
if "%CODE%"=="0" (
  echo PASSED: public is ignored and staged for removal from Git tracking.
  echo Commit and push the staged changes with your normal deploy tool.
) else (
  echo FAILED: read the error above.
)
echo.
pause
exit /b %CODE%
