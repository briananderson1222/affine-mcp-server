#!/bin/sh

# Custom start script for AFFiNE MCP with tag support

# Set environment
export PORT=${PORT:-8080}
export AFFINE_BASE_URL=${AFFINE_BASE_URL:-http://127.0.0.1:3010}
export AFFINE_EMAIL=${AFFINE_EMAIL:-brian.anderson1222@gmail.com}
export AFFINE_PASSWORD=${AFFINE_PASSWORD:-MadisonVienna2019!}
export NODE_ENV=production

echo "Starting AFFiNE MCP with tag support..."
echo "AFFiNE URL: $AFFINE_BASE_URL"
echo "Port: $PORT"

# Run the server through mcp-proxy
exec /app/node_modules/.bin/mcp-proxy /app/affine-mcp-server/bin/affine-mcp --port $PORT