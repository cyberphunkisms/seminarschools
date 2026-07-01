@echo off
setlocal

echo ==========================================
echo Sync Meaninglib to Hugging Face
 echo Target default: SeminarSchools/meaninglib
echo ==========================================

echo Running npm install...
call npm install
if errorlevel 1 goto fail

echo Exporting Meaninglib...
call npm run export:meaninglib-dataset
if errorlevel 1 goto fail

echo Verifying Meaninglib export...
call npm run verify:meaninglib-dataset
if errorlevel 1 goto fail

echo Scanning exported files for private data/secrets...
call npm run scan:private-data
if errorlevel 1 goto fail

echo Building Meaninglib search index...
call npm run build:meaninglib-search
if errorlevel 1 goto fail

echo Verifying Meaninglib search...
call npm run verify:meaninglib-search
if errorlevel 1 goto fail

echo Uploading hf_export to Hugging Face...
python scripts\sync-meaninglib-hf.py
if errorlevel 1 goto fail

echo ==========================================
echo PASSED: Meaninglib synced to Hugging Face
 echo Check: https://huggingface.co/datasets/SeminarSchools/meaninglib
echo ==========================================
pause
exit /b 0

:fail
echo ==========================================
echo FAILED: sync stopped safely
 echo Check that .env contains HF_TOKEN and HF_REPO_ID
 echo Send the error screenshot.
echo ==========================================
pause
exit /b 1
