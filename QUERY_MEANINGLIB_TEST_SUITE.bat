@echo off
setlocal

echo ==========================================
echo Meaninglib broad search test suite
echo ==========================================

if not exist hf_export\search\meaninglib_search_index.json (
  echo Search index not found. Run BUILD_MEANINGLIB_SEARCH.bat first.
  pause
  exit /b 1
)

node scripts\query-meaninglib.js "Meaninglib ontology"
node scripts\query-meaninglib.js "interdependence rule"
node scripts\query-meaninglib.js "stop psychologism"
node scripts\query-meaninglib.js "AI prose tells"
node scripts\query-meaninglib.js "bookwormburrows"
node scripts\query-meaninglib.js "modulecanon"
node scripts\query-meaninglib.js "campaigncodex"
node scripts\query-meaninglib.js "HTML txt mirror"

if errorlevel 1 goto fail

echo ==========================================
echo PASSED: broad search smoke test finished
echo Screenshot this window.
echo ==========================================
pause
exit /b 0

:fail
echo ==========================================
echo FAILED: broad search test stopped safely
echo Send the error screenshot.
echo ==========================================
pause
exit /b 1
