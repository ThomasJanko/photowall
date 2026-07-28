#!/bin/sh
# Production : lance Next.js (front) et Express/Socket.io (API photos) dans
# le même conteneur. Un script shell suffit (pas besoin de concurrently en prod).

set -e

PORT="${PORT:-3000}"
SERVER_PORT="${SERVER_PORT:-4000}"
export SERVER_PORT

echo "[start-prod] Next.js → 0.0.0.0:${PORT} | Express → 0.0.0.0:${SERVER_PORT}"

# Serveur Express + Socket.io
npx tsx server/index.ts &
SERVER_PID=$!

# Next.js (build déjà fait)
npx next start -H 0.0.0.0 -p "$PORT" &
NEXT_PID=$!

trap 'kill "$SERVER_PID" "$NEXT_PID" 2>/dev/null; exit' TERM INT

wait "$SERVER_PID" "$NEXT_PID"
