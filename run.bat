@echo off
title BlinkOS Full-Stack Launcher
echo =======================================================
echo               BLINKOS FULL-STACK LAUNCHER
echo =======================================================
echo.
echo [1/2] Launching Python FastAPI Backend on port 8000...
start "BlinkOS Backend" python -m uvicorn app.main:app --host :: --port 8000 --app-dir backend

timeout /t 2 /nobreak >nul

echo [2/2] Launching Frontend Server on port 5500...
start "BlinkOS Frontend" python serve.py

timeout /t 1 /nobreak >nul

echo.
echo Opening http://localhost:5500 in your browser...
start http://localhost:5500

echo.
echo =======================================================
echo  BLINKOS IS NOW RUNNING!
echo  - Frontend App:   http://localhost:5500
echo  - Backend Docs:   http://localhost:8000/docs
echo  - API Health:     http://localhost:8000/api/health
echo =======================================================
echo.
pause
