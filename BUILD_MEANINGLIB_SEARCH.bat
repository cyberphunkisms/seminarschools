@echo off
setlocal

echo ==========================================
echo Build Meaninglib local search
 echo This does not upload anything.
echo ==========================================

echo Running npm install...
call npm install
if errorlevel 1 goto fail

echo Exporting fresh Meaninglib dataset...
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

echo ==========================================
echo PASSED: Meaninglib search built and verified
 echo Report: hf_export\reports\meaninglib_search_verify_report.md
 echo Query with: QUERY_MEANINGLIB.bat
echo ==========================================
pause
exit /b 0

:fail
echo ==========================================
echo FAILED: Meaninglib search build stopped safely
 echo Send the error screenshot.
echo ==========================================
pause
exit /b 1
