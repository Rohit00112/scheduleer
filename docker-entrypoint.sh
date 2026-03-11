#!/bin/sh
set -e

# Update nginx to listen on $PORT (Render provides this)
if [ -n "$PORT" ]; then
    sed -i "s/listen 80;/listen $PORT;/" /etc/nginx/http.d/default.conf
fi

# Start backend on port 3001
cd /app/backend
PORT=3001 node dist/main &

# Start frontend on port 3000
cd /app/frontend
PORT=3000 HOSTNAME=0.0.0.0 node server.js &

# Wait for both to be ready
sleep 2

# Start nginx in foreground
nginx -g 'daemon off;'
