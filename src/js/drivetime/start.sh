#!/bin/bash

# Check if GOOGLE_MAPS_API_KEY is set
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo "Error: GOOGLE_MAPS_API_KEY environment variable is not set"
    echo "Usage: GOOGLE_MAPS_API_KEY=your_key_here ./start.sh"
    exit 1
fi

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if http-server is installed
if ! command -v http-server &> /dev/null; then
    echo "Error: http-server is not installed"
    echo "Install it with: npm install -g http-server"
    exit 1
fi

# Start http-server in the background
echo "Starting http-server on port 8080..."
http-server "$SCRIPT_DIR" -p 8080 &
HTTP_SERVER_PID=$!

# Wait a moment for the server to start
sleep 2

# Build the URL with the API key
URL="http://localhost:8080/drivetime-analyzer.html?apiKey=$GOOGLE_MAPS_API_KEY"

echo "Opening browser at: http://localhost:8080/drivetime-analyzer.html"
echo "Server PID: $HTTP_SERVER_PID"
echo ""
echo "To stop the server, run: kill $HTTP_SERVER_PID"

# Open the browser (works on macOS, Linux, and Windows)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open "$URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open "$URL" 2>/dev/null || echo "Please open: $URL"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    start "$URL"
else
    echo "Please open: $URL"
fi

# Keep script running and show server output
echo ""
echo "Press Ctrl+C to stop the server"
wait $HTTP_SERVER_PID
