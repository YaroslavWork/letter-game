@echo off
REM Script to run Django server with ASGI support for WebSockets

REM Check if Daphne is installed
python -c "import daphne" 2>nul
if errorlevel 1 (
    echo Daphne is not installed. Installing...
    pip install daphne==4.1.0
)

REM Run server with Daphne (ASGI)
echo Starting Django server with ASGI (Daphne) support...
daphne -b 0.0.0.0 -p 8000 backend.asgi:application
