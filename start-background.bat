@echo off
title DuyDev Studio - Starting Background Service
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\start-background.ps1"
echo.
pause
