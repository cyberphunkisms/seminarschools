@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo Build Meaninglib AI Access Pack
echo ==========================================
call npm install
if errorlevel 1 goto fail
call npm run export:meaninglib-dataset
if errorlevel 1 goto fail
call npm run verify:meaninglib-dataset
if errorlevel 1 goto fail
call npm run scan:private-data
if errorlevel 1 goto fail
call npm run build:meaninglib-search
if errorlevel 1 goto fail
call npm run verify:meaninglib-search
if errorlevel 1 goto fail
call npm run build:ai-access-pack
if errorlevel 1 goto fail
call npm run verify:ai-access-pack
if errorlevel 1 goto fail
echo ==========================================
echo PASSED: AI Access Pack built and verified
echo ==========================================
pause
exit /b 0
:fail
echo ==========================================
echo FAILED: AI Access Pack build stopped safely
echo ==========================================
pause
exit /b 1
