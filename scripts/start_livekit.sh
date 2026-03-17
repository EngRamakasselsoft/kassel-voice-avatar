#!/bin/bash
# ============================================================
# start_livekit.sh — Start self-hosted LiveKit server
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$ROOT_DIR/config/livekit.yaml"

echo "=================================================="
echo " Kassel Academy — LiveKit Server"
echo "=================================================="

# Check if Docker is available
if command -v docker &>/dev/null; then
  echo "[LiveKit] Starting via Docker..."
  docker run -d \
    --name kassel-livekit \
    -p 7880:7880 \
    -p 7881:7881/tcp \
    -p 50000-50100:50000-50100/udp \
    -v "$CONFIG_FILE:/etc/livekit.yaml" \
    livekit/livekit-server:latest \
    --config /etc/livekit.yaml --dev

  echo "[LiveKit] ✅ Started on ws://localhost:7880"
  echo "[LiveKit] To stop: docker stop kassel-livekit && docker rm kassel-livekit"

# Fallback: try livekit-server binary
elif command -v livekit-server &>/dev/null; then
  echo "[LiveKit] Starting binary..."
  livekit-server --config "$CONFIG_FILE" --dev &
  echo "[LiveKit] ✅ PID $!"

else
  echo "[LiveKit] ❌ Neither Docker nor livekit-server binary found."
  echo ""
  echo "Install options:"
  echo "  Docker:  https://docs.docker.com/get-docker/"
  echo "  Binary:  curl -sSL https://get.livekit.io | bash"
  exit 1
fi

echo ""
echo "LiveKit Dashboard: http://localhost:7880"
echo "WebSocket URL:     ws://localhost:7880"
echo "API Key:           devkey"
echo "API Secret:        secret"
