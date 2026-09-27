@echo off
echo ===================================================
echo  Student Calendar with Events - C Core Build Script
echo ===================================================

if not exist "c-core\calendar.c" (
    echo [ERROR] c-core\calendar.c not found!
    exit /b 1
)

if not exist "data" (
    mkdir data
)

echo [1/2] Compiling C-Core module using GCC...
gcc -Wall -Wextra -O2 c-core\calendar.c -o c-core\calendar_core.exe

if %ERRORLEVEL% equ 0 (
    echo [2/2] Build Successful: c-core\calendar_core.exe
    echo.
    echo To run the C interactive CLI mode for viva:
    echo   .\c-core\calendar_core.exe --interactive
    echo.
    echo To run the full web application:
    echo   npm start
) else (
    echo [ERROR] Compilation failed. Please check if GCC is installed.
)
