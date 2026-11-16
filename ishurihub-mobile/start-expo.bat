@echo off
setlocal enabledelayedexpansion

for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress"') do set WIFI_IP=%%i

if "%WIFI_IP%"=="" (
  for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'vEthernet|ProTUN|Loopback' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1).IPAddress"') do set WIFI_IP=%%i
)

echo ========================================================
echo  Starting IshuriHUB Mobile with Wi-Fi IP: %WIFI_IP%
echo ========================================================
set REACT_NATIVE_PACKAGER_HOSTNAME=%WIFI_IP%
npx expo start -c --go
