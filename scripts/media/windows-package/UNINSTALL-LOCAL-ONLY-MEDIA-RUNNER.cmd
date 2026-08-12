@echo off
set /p "CONFIRM=Type REMOVE-LOCAL-RUNNER to remove only the installed runner: "
if not "%CONFIRM%"=="REMOVE-LOCAL-RUNNER" (
  echo Confirmation did not match. Nothing was removed.
  pause
  exit /b 2
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall-Local-Only-Media-Runner.ps1" -ConfirmRemove "%CONFIRM%"
pause
