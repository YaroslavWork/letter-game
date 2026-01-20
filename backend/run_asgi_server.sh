#!/bin/bash
# Script to run Django server with ASGI support for WebSockets

# Check if Daphne is installed
if ! python -c "import daphne" 2>/dev/null; then
    echo "Daphne is not installed. Installing..."
    pip install daphne==4.1.0
fi

# Run server with Daphne (ASGI)
# Use PORT environment variable if set, otherwise default to 8000
PORT=${PORT:-8000}
echo "Starting Django server with ASGI (Daphne) support on port $PORT..."
daphne -b 0.0.0.0 -p $PORT backend.asgi:application
