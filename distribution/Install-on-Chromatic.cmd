@echo off
powershell.exe -NoProfile -File "%~dp0Install-on-Chromatic.ps1"
if errorlevel 1 pause
