@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "LOG=%~dp0meaninglib-hf-sync.log"
> "%LOG%" echo Meaninglib to Hugging Face sync started %DATE% %TIME%

echo ==========================================
echo Sync Meaninglib to Hugging Face
echo Working folder: %CD%
echo Log: %LOG%
echo Target default: SeminarSchools/meaninglib
echo ==========================================

if not exist "package.json" (
  >> "%LOG%" echo ERROR: package.json was not found in %CD%
  echo ERROR: package.json was not found beside this BAT file.
  echo Put this BAT in the main website folder, then run it again.
  goto fail
)

where npm >nul 2>nul
if errorlevel 1 (
  >> "%LOG%" echo ERROR: npm was not found on PATH.
  echo ERROR: npm was not found. Install Node.js or reopen Command Prompt after installation.
  goto fail
)

where python >nul 2>nul
if errorlevel 1 (
  >> "%LOG%" echo ERROR: python was not found on PATH.
  echo ERROR: python was not found on PATH.
  goto fail
)

echo Running npm install...
>> "%LOG%" echo.
>> "%LOG%" echo [1/9] npm install
cmd /d /c "npm install" >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo Exporting Meaninglib...
>> "%LOG%" echo.
>> "%LOG%" echo [2/9] export Meaninglib dataset
cmd /d /c "npm run export:meaninglib-dataset" >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo Verifying Meaninglib export...
>> "%LOG%" echo.
>> "%LOG%" echo [3/9] verify Meaninglib dataset
cmd /d /c "npm run verify:meaninglib-dataset" >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo Scanning exported files for private data and secrets...
>> "%LOG%" echo.
>> "%LOG%" echo [4/9] private-data scan
cmd /d /c "npm run scan:private-data" >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo Building Meaninglib search index...
>> "%LOG%" echo.
>> "%LOG%" echo [5/9] build Meaninglib search
cmd /d /c "npm run build:meaninglib-search" >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo Verifying Meaninglib search...
>> "%LOG%" echo.
>> "%LOG%" echo [6/9] verify Meaninglib search
cmd /d /c "npm run verify:meaninglib-search" >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo Building AI Access Pack and Mephistodata activation file...
>> "%LOG%" echo.
>> "%LOG%" echo [7/9] build AI Access Pack
cmd /d /c "npm run build:ai-access-pack" >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo Verifying AI Access Pack...
>> "%LOG%" echo.
>> "%LOG%" echo [8/9] verify AI Access Pack
cmd /d /c "npm run verify:ai-access-pack" >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo Uploading hf_export to Hugging Face...
>> "%LOG%" echo.
>> "%LOG%" echo [9/9] upload hf_export
cmd /d /c "python scripts\sync-meaninglib-hf.py" >> "%LOG%" 2>&1
if errorlevel 1 goto fail

>> "%LOG%" echo.
>> "%LOG%" echo PASSED: Meaninglib synced to Hugging Face
echo ==========================================
echo PASSED: Meaninglib synced to Hugging Face
echo Check: https://huggingface.co/datasets/SeminarSchools/meaninglib
echo Full log: %LOG%
echo ==========================================
start "" notepad.exe "%LOG%"
echo The log has opened in Notepad.
pause
exit /b 0

:fail
>> "%LOG%" echo.
>> "%LOG%" echo FAILED: sync stopped safely at %DATE% %TIME%
echo ==========================================
echo FAILED: sync stopped safely
echo The full error log is opening in Notepad.
echo Check that .env contains HF_TOKEN and HF_REPO_ID.
echo Full log: %LOG%
echo ==========================================
start "" notepad.exe "%LOG%"
pause
exit /b 1
