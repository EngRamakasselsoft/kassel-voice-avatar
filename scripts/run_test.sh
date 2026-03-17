#!/bin/bash
# ============================================================
# run_test.sh — Full Test #1 Launcher
# Starts LiveKit + Agent + Token Server + Frontend
# ============================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║     Kassel Academy — Voice Avatar System         ║"
echo "║     Test #1: gpt-4o-realtime-mini + Simli        ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Step 1 — Check .env
if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "❌  .env not found. Run: cp .env.example .env  and fill in your keys."
  exit 1
fi
echo "✅  .env found"

# Step 2 — Start LiveKit
echo ""
echo "▶  Starting LiveKit server (self-hosted)..."
bash "$ROOT_DIR/scripts/start_livekit.sh"
sleep 3
echo "✅  LiveKit running on ws://localhost:7880"

# Step 3 — Start Agent + Token Server
echo ""
echo "▶  Starting LiveKit Agent..."
bash "$ROOT_DIR/scripts/start_agent.sh" &
AGENT_PID=$!
sleep 4
echo "✅  Agent running (PID $AGENT_PID)"

# Step 4 — Start Frontend
echo ""
echo "▶  Starting Frontend..."
cd "$ROOT_DIR/frontend"
npm install --silent
npm run dev &
FRONTEND_PID=$!
sleep 3

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅  ALL SERVICES RUNNING                        ║"
echo "║                                                  ║"
echo "║  Frontend:    http://localhost:5173              ║"
echo "║  Token API:   http://localhost:8080/token        ║"
echo "║  LiveKit:     ws://localhost:7880                ║"
echo "║  Logs:        ./logs/benchmark_*.jsonl           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Open http://localhost:5173 in your browser to start."
echo "Press Ctrl+C to stop all services."
echo ""

# Wait and cleanup
trap "echo ''; echo 'Stopping all services...'; kill $AGENT_PID $FRONTEND_PID 2>/dev/null; docker stop kassel-livekit 2>/dev/null; echo 'Done.'" EXIT
wait
