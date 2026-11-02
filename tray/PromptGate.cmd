@echo off
REM PromptGate tray (phase 2). Double-click to run in the background: a tray icon appears,
REM select a prompt anywhere and press Ctrl+Alt+P (change it from the tray menu).
REM Needs Node.js 18+ on PATH (or "tray.node" in %USERPROFILE%\.claude\promptgate\config.json).
wscript.exe "%~dp0Start-Hidden.vbs"
