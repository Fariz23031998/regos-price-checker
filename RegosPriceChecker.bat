@echo off
setlocal
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Google Chrome was not found.
  exit /b 1
)
rem A separate profile starts a new Chrome process. Flags such as --kiosk are
rem ignored when the URL is handed to an already running Chrome window.
set "PROFILE=%LocalAppData%\RegosPriceChecker\chrome-kiosk"
start "" "%CHROME%" --kiosk --start-fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --disable-infobars --user-data-dir="%PROFILE%" "http://localhost:3000"
