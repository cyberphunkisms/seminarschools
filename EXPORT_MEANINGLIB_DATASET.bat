@echo off
setlocal

echo ==========================================
echo Export Meaninglib dataset locally
echo ==========================================

echo Running npm install...
call npm install
if errorlevel 1 goto fail

echo Running current project verification...
call npm run verify:all
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

echo ==========================================
echo PASSED: hf_export is ready for review
 echo Open: hf_export\reports\latest_export_report.md
echo ==========================================
pause
exit /b 0

:fail
echo ==========================================
echo FAILED: export stopped safely
 echo Send the error screenshot or the report in hf_export\reports\
echo ==========================================
pause
exit /b 1
