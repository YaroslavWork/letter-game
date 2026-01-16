#!/bin/bash
# Script to run Django server with ASGI support for WebSockets

# Check if Daphne is installed
if ! python -c "import daphne" 2>/dev/null; then
    echo "Daphne is not installed. Installing..."
    pip install daphne==4.1.0
fi

# Run server with Daphne (ASGI)
echo "Starting Django server with ASGI (Daphne) support..."
daphne -b 0.0.0.0 -p 8000 backend.asgi:application
