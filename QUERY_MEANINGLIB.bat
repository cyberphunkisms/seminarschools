@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo Query Meaninglib local search
echo Type a Meaninglib question or keyword phrase.
echo Type exit to close.
echo ==========================================

if not exist hf_export\search\meaninglib_search_index.json (
  echo Search index not found. Run BUILD_MEANINGLIB_SEARCH.bat first.
  pause
  exit /b 1
)

:again
set "ML_QUERY="
set /p ML_QUERY=Meaninglib query: 
if /I "!ML_QUERY!"=="exit" goto done
if /I "!ML_QUERY!"=="quit" goto done
if "!ML_QUERY!"=="" goto again

node scripts\query-meaninglib.js "!ML_QUERY!"
if errorlevel 1 goto fail

echo ------------------------------------------
echo Query complete. Type another query, or type exit.
echo Saved: hf_export\reports\last_meaninglib_query.md
echo ------------------------------------------
goto again

:done
echo ==========================================
echo DONE: Meaninglib query session closed
echo ==========================================
pause
exit /b 0

:fail
echo ==========================================
echo FAILED: Meaninglib query stopped safely
echo Send the error screenshot.
echo ==========================================
pause
exit /b 1
