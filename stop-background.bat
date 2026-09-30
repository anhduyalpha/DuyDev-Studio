@echo off
title DuyDev Studio - Stopping Background Service
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\stop-background.ps1"
echo.
pause
