@echo off
REM Store python alias 우회: winget으로 설치한 Python 3.12 고정 경로
set "PY=%LocalAppData%\Programs\Python\Python312\python.exe"
if not exist "%PY%" (
  echo [iot] Python not found at: %PY%
  echo       Install Python 3.12 or edit PY= in greeneye_iot\iot.cmd
  exit /b 1
)
"%PY%" -m platformio %*
