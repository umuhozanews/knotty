@echo off
echo Checking PostgreSQL Database...
if exist "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" (
  "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" status -D "%~dp0pg_data" >nul 2>&1
  if errorlevel 1 (
    echo Starting PostgreSQL 17 database...
    if exist "%~dp0pg_data\postmaster.pid" del /f "%~dp0pg_data\postmaster.pid"
    "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" start -D "%~dp0pg_data" -l "%~dp0postgres_log.txt"
    timeout /t 2 /nobreak >nul
  )
)

echo Starting Ishuri hub Backend...
start "Ishuri hub Backend" cmd /k "cd /d %~dp0knotty-backend && node src/app.js"
timeout /t 3 /nobreak >nul
echo Starting Ishuri hub Frontend...
start "Ishuri hub Frontend" cmd /k "cd /d %~dp0knotty-app && npm run dev"
echo.
echo Both servers starting:
echo   Backend  ^> http://localhost:5000
echo   Frontend ^> http://localhost:3000
echo.
echo Login: admin@knottyschool.rw / Admin@2024
