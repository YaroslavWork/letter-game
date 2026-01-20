@echo off
REM Script to run Django server with ASGI support for WebSockets

REM Check if Daphne is installed
python -c "import daphne" 2>nul
if errorlevel 1 (
    echo Daphne is not installed. Installing...
    pip install daphne==4.1.0
)

REM Run server with Daphne (ASGI)
REM Use PORT environment variable if set, otherwise default to 8000
if defined PORT (
    set SERVER_PORT=%PORT%
) else (
    set SERVER_PORT=8000
)
echo Starting Django server with ASGI (Daphne) support on port %SERVER_PORT%...
daphne -b 0.0.0.0 -p %SERVER_PORT% backend.asgi:application
