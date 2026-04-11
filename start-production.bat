@echo off
chcp 65001 >nul
title BuenzliFight - Production Server

echo ============================================
echo   BuenzliFight - Production Build & Start
echo ============================================
echo.

cd /d "%~dp0"

echo [1/3] Installiere Abhaengigkeiten...
call npm install --production=false
if %ERRORLEVEL% neq 0 (
    echo FEHLER: npm install fehlgeschlagen!
    pause
    exit /b 1
)
echo.

echo [2/3] Erstelle Production Build...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo FEHLER: Build fehlgeschlagen!
    pause
    exit /b 1
)
echo.

echo ============================================
echo [3/3] Starte Production Server auf Port 3000
echo       http://localhost:3000
echo ============================================
echo.
echo Druecke Ctrl+C zum Beenden.
echo.

set NODE_ENV=production
call npm run start
pause
