## Kassel Voice Avatar — IELTS Speaking Benchmarks

Kassel Voice Avatar is an end‑to‑end system for running **IELTS speaking practice sessions** with a live, video‑based avatar. It combines:

- **Agent backend** (Python, LiveKit Agents, OpenAI/Gemini/other S2S models)
- **Voice/video avatar providers** (Simli by default; optional Tavus, Keyframe, Ultravox, Phonic, xAI Grok)
- **Web frontend** (React + Vite) for students to join a LiveKit room and complete the benchmark

This repo is organised so you can either run everything locally (dev mode) or containerise the agent and frontend separately.

---

## Project structure

- **`agent/`** – Python LiveKit Agent that runs the IELTS logic, connects to LLMs and avatar providers, and logs full Q&A sessions.
  - `agent.py` – main worker entrypoint used by LiveKit Agent Worker (`python agent.py start`).
  - `token_server.py` – issues LiveKit access tokens for the frontend.
  - `Dockerfile.agent` – container image for the agent service.
  - `requirements.txt` – Python dependencies (LiveKit, LLM plugins, etc.).
- **`frontend/`** – React/Vite web app for students.
  - `src/Evaluation.jsx` – main UI and LiveKit room logic for the evaluation flow.
  - `vite.config.js` / `Dockerfile.frontend` – frontend dev/build config and container image.
- **`.env`** – root environment configuration (API keys, LiveKit URL, benchmark flags). **Do not commit real keys.**
- **`logs/` (inside `agent/`)** – JSONL logs and per‑session summaries for each evaluation.

---

## Features

- **Standardised IELTS speaking flow**
  - Fixed question bank per topic, stored in `agent/questions.json`.
  - Agent introduces the session, asks exactly 5 questions, and gives improvement tips + model answers after each.
  - Final overall feedback (strength + area to improve).
- **Multiple S2S models**
  - `gpt-4o-realtime-mini` (default), `gpt-4o-realtime`, `gemini-2.0-flash-live`, `ultravox`, `phonic`, `xai-grok`.
  - Pricing table and cost estimation per turn + per session.
- **Avatar providers**
  - **Simli** (default; always available if configured).
  - Optional **Tavus**, **Keyframe**, **Ultravox**, **Phonic**, **xAI Grok** integrations with graceful fallbacks.
- **Rich logging & benchmarking**
  - Turn‑by‑turn transcripts, latency (glass‑to‑glass), token counts, and USD cost estimates.
  - Summary JSON per session for downstream analysis.

---

## Prerequisites

- **Python** 3.11+ (matches `Dockerfile.agent`).
- **Node.js** 18+ and npm (matches `Dockerfile.frontend`).
- A **LiveKit Cloud** project or self‑hosted LiveKit server.
- Accounts/API keys for:
  - **OpenAI** (or compatible endpoint) – for `gpt-4o-realtime-*`.
  - **Simli** – for the default avatar.
  - Optional: Google (Gemini), Tavus, Keyframe, Ultravox, Phonic, xAI (Grok) depending on which integrations you enable.

---

## Environment configuration

All secrets and runtime configuration live in `.env` at the repo root. Key variables:

- **OpenAI / models**
  - `OPENAI_API_KEY`
  - Optional: additional keys for other model providers (Google, Ultravox, Phonic, xAI, etc.).
- **Simli avatar**
  - `SIMLI_API_KEY`
  - `SIMLI_FACE_ID`
- **LiveKit**
  - `LIVEKIT_URL` – e.g. `wss://<your-project>.livekit.cloud`
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`
  - `AGENT_ROOM_NAME` – default LiveKit room used for sessions (e.g. `kassel-exam-room`).
- **Benchmarking**
  - `BENCHMARK_ENABLED` – `"true"` to record detailed logs.
  - `BENCHMARK_LOG_DIR` – relative or absolute path for log files (default `./logs` in `agent/`).
  - `LIVEKIT_AGENT_NAME` – name registered with LiveKit for the Agent worker.
- **Optional avatar providers**
  - Tavus: `TAVUS_API_KEY`, `TAVUS_REPLICA_ID`, `TAVUS_PERSONA_ID`
  - Keyframe: `KEYFRAME_API_KEY`, `KEYFRAME_PERSONA_ID`
  - Ultravox: `ULTRAVOX_API_KEY`
  - Phonic: `PHONIC_API_KEY`
  - xAI Grok: `XAI_API_KEY`

> **Security:** The sample `.env` in this repo contains placeholder / demo keys. Replace them with your own credentials and **never** commit real secrets.

---

## Running locally (dev)

### 1. Backend agent

From the `agent/` directory:

```bash
cd agent
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt

python agent.py start
```

This starts the LiveKit Agent worker, connecting to the `LIVEKIT_URL` specified in `.env`. It will:

- Join `AGENT_ROOM_NAME`.
- Build the selected avatar and LLM for each dispatched job.
- Log each turn and session to `logs/`.

If you want to use the token server instead of a static LiveKit token, run:

```bash
python token_server.py
```

and point the frontend to the token endpoint (see frontend docs below).

### 2. Frontend (React/Vite)

From the `frontend/` directory:

```bash
cd frontend
npm install
npm run dev -- --host
```

Then open the printed URL in your browser (typically `http://localhost:5173`). The evaluation UI will connect to LiveKit using the configured URL and token mechanism and join the exam room.

---

## Running with Docker

### Agent container

From the `agent/` directory:

```bash
cd agent
docker build -f Dockerfile.agent -t kassel-agent .
docker run --env-file ../.env -p 8000:8000 kassel-agent
```

Notes:

- `Dockerfile.agent` installs system build tools, installs `requirements.txt`, copies the agent code, and runs `python agent.py start`.
- Mount a volume for logs if you want to persist them:

```bash
docker run --env-file ../.env -v $(pwd)/logs:/app/logs kassel-agent
```

### Frontend container

From the `frontend/` directory:

```bash
cd frontend
docker build -f Dockerfile.frontend -t kassel-frontend .
docker run -p 5173:5173 kassel-frontend
```

This starts the Vite dev server in the container, exposed on port `5173`.

---

## How the agent works (high level)

At the core is `agent/agent.py`:

- **Entry point**: `entrypoint(ctx: JobContext)` is registered with `cli.run_app` as the worker entrypoint.
- **Dispatch metadata**: when LiveKit dispatches a job, `ctx.job.metadata` contains a JSON payload describing the student and session:
  - `student_name`, `level`, `target_band`, `topic`
  - `model` – which S2S model key to use.
  - `avatar` – which avatar provider key to use.
- **Prompt building**: `build_prompt(student, questions, avatar)` assembles a detailed examiner persona prompt, fixed questions, and rules.
- **Avatar selection**: `build_avatar(avatar_key)` returns:
  - Tavus / Keyframe avatar sessions if the corresponding plugins and API keys are available.
  - Otherwise, falls back to a **Simli** avatar session.
- **Model selection**: `build_llm(model_key, prompt, avatar_key)` chooses between:
  - OpenAI Realtime, Gemini Live, Ultravox, Phonic, xAI Grok, with price mapping and fallbacks.
- **Session logging**: `SessionLogger` tracks:
  - Per‑turn timestamps, transcripts, token usage, and cost.
  - Writes JSONL log events plus a final summary JSON at the end of the session.

See `agent/README.md` (below) for more in‑depth details if needed.

---

## Frontend overview

The frontend (in `frontend/`) is a React SPA built with Vite:

- Connects to LiveKit using `LIVEKIT_URL` and a token (either from `token_server.py` or pre‑issued).
- Joins the exam room (`AGENT_ROOM_NAME`) and renders:
  - Student microphone controls.
  - Avatar video stream.
  - Basic session state / evaluation UI defined in `src/Evaluation.jsx`.

To customise the UI:

- Edit `src/Evaluation.jsx` to adjust layout, wording, or add new panels.
- Update `vite.config.js` if you need different base path, ports, or proxy settings for the token server.

---

## Extending the project

- **Add new topics / questions**
  - Edit `agent/questions.json` and add a new topic key with a list of 5 questions.
  - Ensure the frontend allows selecting that topic and passes it via `ctx.job.metadata`.
- **Add new model backends**
  - Extend the `PRICING` and `MODEL_IDS` dictionaries in `agent.py`.
  - Extend `build_llm` to construct the appropriate RealtimeModel or LLM client.
- **Add / change avatars**
  - Implement a new provider in `build_avatar` and `_simli_avatar`‑style helpers.
  - Wire in any plugin imports at the top of `agent.py` with graceful `ImportError` handling.

---

## Troubleshooting

- **ImportError for plugins (Tavus, Keyframe, etc.)**
  - The agent treats these as optional. If a plugin is missing, it logs an error and falls back to Simli.
  - Install the required `livekit-plugins-*` packages and restart the agent to enable them.
- **Cannot connect to LiveKit**
  - Double‑check `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in `.env`.
  - Confirm the Agent worker is allowed to connect and that the room name matches the frontend.
- **No logs / empty logs**
  - Ensure `BENCHMARK_ENABLED=true` and that `BENCHMARK_LOG_DIR` is writable.

---

## License & credits

- Internal project for Kassel Academy IELTS voice avatar benchmarking.
- Uses:
  - [LiveKit](https://livekit.io/) for realtime audio/video and Agents.
  - OpenAI / Gemini / other S2S providers for speech‑to‑speech models.
  - Simli, Tavus, Keyframe, Ultravox, Phonic, xAI for avatar/video integrations.

# Kassel Academy — Voice Avatar System
## Test #1: OpenAI gpt-4o-realtime-mini + Simli + Self-hosted LiveKit

---

## Architecture

```
User Browser
    │
    ▼
LiveKit Server (self-hosted)
    │
    ├──► LiveKit Agent (Python)
    │         │
    │         ├──► OpenAI gpt-4o-realtime-mini  (S2S: audio in → audio out)
    │         │
    │         └──► Simli API  (audio → lip-sync video stream)
    │
    └──► Frontend (React)  ◄──► Simli WebRTC video feed
```

---

## Project Structure

```
kassel-voice-avatar/
├── agent/
│   ├── agent.py            # LiveKit Agent — gpt-4o-realtime-mini + Simli
│   ├── simli_plugin.py     # Simli WebRTC video bridge
│   ├── benchmark.py        # Latency benchmarking logger
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React app
│   │   ├── VideoAvatar.jsx # Simli video + LiveKit audio component
│   │   └── Benchmark.jsx   # Live latency dashboard
│   ├── public/index.html
│   └── package.json
├── config/
│   └── livekit.yaml        # LiveKit server config
├── scripts/
│   ├── start_agent.sh      # Start agent worker
│   ├── start_livekit.sh    # Start self-hosted LiveKit
│   └── run_test.sh         # Full test launcher
├── docker-compose.yml      # Full stack (LiveKit + Agent + Frontend)
└── .env.example            # All required API keys
```

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (for LiveKit server)
- API Keys:
  - `OPENAI_API_KEY` — OpenAI (gpt-4o-realtime-mini)
  - `SIMLI_API_KEY` — Simli (https://simli.com)
  - `LIVEKIT_URL` — your LiveKit server WebSocket URL
  - `LIVEKIT_API_KEY` — LiveKit API key
  - `LIVEKIT_API_SECRET` — LiveKit API secret

---

## Quick Start

### Step 1 — Copy and fill in environment variables
```bash
cp .env.example .env
# Edit .env with your API keys
```

### Step 2 — Start self-hosted LiveKit server
```bash
./scripts/start_livekit.sh
# LiveKit will be available at ws://localhost:7880
```

### Step 3 — Start the Agent
```bash
cd agent
pip install -r requirements.txt
./scripts/start_agent.sh
```

### Step 4 — Start the Frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### Or run everything with Docker
```bash
docker-compose up --build
```

---

## Benchmark Metrics Captured

| Metric | Description |
|---|---|
| `speech_start_ms` | Time from user speech start detected |
| `vad_end_ms` | Time VAD detects end of user speech |
| `openai_ttft_ms` | Time to first audio token from OpenAI |
| `simli_first_frame_ms` | Time to first video frame from Simli |
| `glass_to_glass_ms` | Total: user speaks → avatar responds visually |

Logs saved to `logs/benchmark_YYYYMMDD_HHMMSS.jsonl`
