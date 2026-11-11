@echo off
REM Vision 6D for Windows. Double-click to open the app window.
REM Needs Node.js 18+ on PATH (https://nodejs.org). Extracted files go to %USERPROFILE%\Vision6D.
title Vision 6D
node "%~dp0tools\desktop.js" %*
if errorlevel 1 pause
