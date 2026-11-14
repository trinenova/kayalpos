@echo off
rem ------------------------------------------------------------------
rem Nexora POS - opens Chrome in "direct print" mode.
rem With --kiosk-printing, Pay & Print sends the receipt straight to the
rem Windows DEFAULT printer: no print preview, no dialog.
rem
rem Setup (once): set your receipt printer as the Windows default printer.
rem Then always open Nexora using this file.
rem
rem Change APP_URL to the live address when you deploy.
rem ------------------------------------------------------------------
set "APP_URL=http://localhost:5173"
set "PROFILE=%LOCALAPPDATA%\NexoraPOS-Chrome"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Google Chrome was not found. Edit this file and set the CHROME path.
  pause
  exit /b 1
)

rem A separate profile lets this window run even if your normal Chrome is open
rem (the flag only applies to a Chrome instance started with it).
start "" "%CHROME%" --kiosk-printing --user-data-dir="%PROFILE%" --app="%APP_URL%"
