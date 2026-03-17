#!/bin/bash
# ============================================================
# start_agent.sh — Start the LiveKit Agent worker
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
AGENT_DIR="$ROOT_DIR/agent"

echo "=================================================="
echo " Kassel Academy — LiveKit Agent"
echo " Test #1: gpt-4o-realtime-mini + Simli"
echo "=================================================="

# Load .env
if [ -f "$ROOT_DIR/.env" ]; then
  export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
  echo "[Agent] Loaded .env"
else
  echo "[Agent] ⚠️  No .env file found. Copy .env.example to .env first."
  exit 1
fi

# Validate required keys
if [ -z "$OPENAI_API_KEY" ]; then
  echo "[Agent] ❌ OPENAI_API_KEY is not set in .env"
  exit 1
fi
if [ -z "$SIMLI_API_KEY" ]; then
  echo "[Agent] ⚠️  SIMLI_API_KEY not set — avatar will be disabled"
fi

echo "[Agent] LIVEKIT_URL: $LIVEKIT_URL"
echo "[Agent] SIMLI_FACE_ID: $SIMLI_FACE_ID"
echo ""

# Install dependencies if needed
cd "$AGENT_DIR"
if [ ! -d ".venv" ]; then
  echo "[Agent] Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate
echo "[Agent] Installing dependencies..."
pip install -q -r requirements.txt

# Create logs dir
mkdir -p "$ROOT_DIR/logs"

# Start token server in background
echo "[Agent] Starting token server on :8080..."
python token_server.py &
TOKEN_PID=$!
echo "[Agent] Token server PID: $TOKEN_PID"

sleep 1

# Start main agent
echo "[Agent] Starting LiveKit Agent worker..."
echo "[Agent] Waiting for rooms to join..."
echo ""
python agent.py start

# Cleanup on exit
trap "kill $TOKEN_PID 2>/dev/null; echo '[Agent] Stopped'" EXIT
