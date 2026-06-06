@echo off
echo Starting KNOTTY Backend...
start "KNOTTY Backend" cmd /k "cd /d %~dp0knotty-backend && node src/app.js"
timeout /t 3 /nobreak >nul
echo Starting KNOTTY Frontend...
start "KNOTTY Frontend" cmd /k "cd /d %~dp0knotty-app && npm run dev"
echo.
echo Both servers starting:
echo   Backend  ^> http://localhost:5000
echo   Frontend ^> http://localhost:3000
echo.
echo Login: admin@knottyschool.rw / Admin@2024
