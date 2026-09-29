@echo off
title Huhtamaki Vision Inspection System - Live Desktop
cd /d "%~dp0Frontend"
echo ===============================================================================
echo   HUHTAMAKI VISION INSPECTION SYSTEM - Code ^& Label Verification
echo   Launching Desktop App with Instant Hot-Reload (Vite + Tauri + Python)
echo ===============================================================================
echo.
npm run desktop
pause
