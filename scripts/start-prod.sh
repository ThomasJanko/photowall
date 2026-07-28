#!/bin/sh
# Production : lance Next.js (front) et Express/Socket.io (API photos) dans
# le même conteneur. Un script shell suffit (pas besoin de concurrently en prod).

set -e

PORT="${PORT:-3000}"
SERVER_PORT="${SERVER_PORT:-4000}"
export SERVER_PORT

echo "[start-prod] Next.js → 0.0.0.0:${PORT} | Express → 0.0.0.0:${SERVER_PORT}"

npx tsx server/index.ts &
SERVER_PID=$!

npx next start -H 0.0.0.0 -p "$PORT" &
NEXT_PID=$!

shutdown() {
  echo "[start-prod] arrêt…"
  kill "$SERVER_PID" "$NEXT_PID" 2>/dev/null || true
  wait "$SERVER_PID" "$NEXT_PID" 2>/dev/null || true
  exit 0
}

trap shutdown TERM INT

# Si l'un des deux process meurt, on arrête le conteneur (évite unhealthy silencieux)
while true; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[start-prod] Express est mort — exit 1"
    kill "$NEXT_PID" 2>/dev/null || true
    exit 1
  fi
  if ! kill -0 "$NEXT_PID" 2>/dev/null; then
    echo "[start-prod] Next.js est mort — exit 1"
    kill "$SERVER_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 2
done
