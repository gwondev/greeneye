@echo off
REM 디스크의 소스만 사용됨. Cursor에서 반드시 "모두 저장" 후 실행.
REM .pio/build 정리 후 전체 재빌드 + 업로드
cd /d "%~dp0"
echo [force-upload] clean...
pio run -t clean
if errorlevel 1 exit /b 1
echo [force-upload] upload...
pio run -t upload %*
if errorlevel 1 exit /b 1
echo [force-upload] OK. 시리얼: pio device monitor -b 115200
