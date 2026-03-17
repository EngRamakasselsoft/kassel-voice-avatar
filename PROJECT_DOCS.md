## Kassel Voice Avatar – Full Project Docs

This document gives a practical, end‑to‑end overview of **everything in this project**: what each part does, how it fits together, and how to run and extend it.

---

## 1. High‑Level Architecture

**Goal**: Benchmark different **speech‑to‑speech (S2S) models** and **avatars** on the same IELTS Speaking flow, with consistent prompts and a rich dashboard.

- **Browser (React frontend)**
  - Intake form to configure a session (student, level, topic, model, avatar).
  - Exam UI that connects to LiveKit, plays audio from the agent, and shows the avatar video.
  - Dashboard visualizing latency, cost, and tokens across models/avatars.
  - Evaluation panel to generate IELTS band scores and feedback from transcripts.

- **LiveKit Cloud**
  - Manages WebRTC rooms: browser ↔ agent audio/video.
  - Runs an **Agent Server** where your Python agent worker registers.

- **Python Agent (`agent/agent.py`)**
  - Joins the same LiveKit room as the browser.
  - Runs an S2S model (OpenAI, Gemini, Phonic, Ultravox, xAI) plus an avatar (Simli, Tavus, Keyframe).
  - Asks a fixed set of IELTS questions, listens to answers, gives feedback and model answers.
  - Logs per‑turn latency, token usage, and cost into `agent/logs`.

- **Token & Session Server (`agent/token_server.py`)**
  - Issues **LiveKit access tokens** and constructs room names.
  - Dispatches the agent to a room with student/model/avatar metadata.
  - Exposes **`/sessions`** (for the dashboard) and **`/evaluate`** (optional Claude evaluation proxy).

---

## 2. Repository Layout

```txt
kassel-voice-avatar/
├─ .env                      # Backend environment (API keys, LiveKit, etc.)
├─ .env.example              # Template with all needed variables
├─ README.md                 # Short project description & quick start
├─ PROJECT_DOCS.md           # This file – full docs
├─ docker-compose.yml        # Optional: run LiveKit + agent + frontend via Docker
├─ config/
│  └─ livekit.yaml           # LiveKit server config (if self‑hosting)
├─ agent/
│  ├─ agent.py               # Main LiveKit agent: models + avatars + logging
│  ├─ questions.json         # Fixed question bank (topic → 5 questions)
│  ├─ token_server.py        # Token + session API server
│  ├─ benchmark.py           # Benchmark logger utilities (legacy / supplemental)
│  ├─ Dockerfile.agent       # Docker image for the agent worker
│  ├─ requirements.txt       # Python dependencies
│  └─ logs/                  # Session + summary JSON/JSONL output
├─ frontend/
│  ├─ .env                   # Frontend env (LiveKit URL, token server URL)
│  ├─ index.html             # Vite entry HTML
│  ├─ vite.config.js         # Vite config
│  ├─ package.json           # Frontend dependencies & scripts
│  ├─ src/
│  │  ├─ App.jsx             # Root app: routing + LiveKitRoom wrapper
│  │  ├─ IntakeForm.jsx      # Session configuration form
│  │  ├─ Dashboard.jsx       # Benchmark dashboard (sessions, comparison)
│  │  ├─ Evaluation.jsx      # IELTS evaluation UI (Claude or model‑self)
│  │  ├─ VideoAvatar.jsx     # Avatar video card (LiveKit track renderer)
│  │  └─ Benchmark.jsx       # Live latency/metrics panel (for exam view)
│  └─ public/
│     └─ index.html          # Static assets (if any)
└─ scripts/
   ├─ start_agent.sh         # Shell helpers (Linux/macOS)
   ├─ start_livekit.sh
   └─ run_test.sh
```

---

## 3. Backend – Agent (`agent/agent.py`)

### 3.1. Fixed Question Bank

- `questions.json` holds **5 fixed questions per topic**, for example:
  - `Technology`, `Education`, `Environment`, etc.
- The agent never invents its own questions – it **must** ask exactly these, in order, to make comparisons fair.

### 3.2. Prompt Construction (`build_prompt`)

```python
def build_prompt(student: dict, questions: list, avatar: str = "simli") -> str:
    ...
```

- Inputs:
  - `student` – from token metadata (`student_name`, `level`, `target_band`, `topic`).
  - `questions` – list of 5 questions for the chosen topic.
  - `avatar` – used to change examiner name/voice (e.g. James vs Sarah).
- Behavior:
  - Introduces the examiner and scenario (IELTS Speaking practice at Kassel Academy).
  - States which model is being benchmarked (`model_label`).
  - Provides **START phrase** the agent should say **verbatim**.
  - Lists **fixed questions** and enforces:
    - Ask them in exact order.
    - Do **not** rephrase or add questions.
    - Ask **one at a time**.
  - After each answer:
    - 1 short improvement tip.
    - 1 model answer sentence at target band level.
  - End of session:
    - Overall feedback (strength + area for improvement).
    - Optionally (if extended) explicit band scores (overall + per criterion).
  - Critical rules:
    - No markdown or bullet points; spoken, concise, conversational.
    - Stick to topic and number of questions.

Because all models call `build_prompt(...)`, they share identical instructions and question flow.

### 3.3. Session Logging (`SessionLogger`)

`SessionLogger` tracks:

- Per‑turn metrics:
  - `turn` index.
  - User start/end timestamps.
  - Agent start/end timestamps.
  - Glass‑to‑glass latency (ms).
  - Text/audio tokens in/out (if reported by provider).
  - Per‑turn cost (USD), using `PRICING` per model.
  - User & agent transcripts.
- Summary metrics:
  - Total session duration.
  - Turns.
  - G2G average/min/max.
  - Total tokens (text+audio).
  - Total session cost and average cost per turn.
  - Full transcript (per turn) with latency and cost annotations.

Output:

- A **JSONL session file**: `logs/session_<timestamp>_<model>_<avatar>_<session>.jsonl`
  - Each line is a `{"type": "turn", ...}` or final `{"type": "summary", ...}`.
- A **summary JSON**: `logs/summary_<timestamp>_<model>_<avatar>_<session>.json`
  - This is what the dashboard reads via `/sessions`.

### 3.4. Avatar Selection (`build_avatar`)

```python
def build_avatar(avatar_key: str):
    if avatar_key == "tavus": ...
    elif avatar_key == "keyframe": ...
    else:  # default Simli
        return _simli_avatar()
```

- **Simli** (default)
  - Uses `SIMLI_API_KEY` and `SIMLI_FACE_ID`.
  - Streams agent audio to a Simli WebRTC session and sends a data message with session info to the frontend.

- **Tavus**
  - Uses `TAVUS_API_KEY`, `TAVUS_REPLICA_ID`, `TAVUS_PERSONA_ID`.
  - Photoreal avatar via Tavus plugin.

- **Keyframe**
  - Uses `KEYFRAME_API_KEY`, `KEYFRAME_PERSONA_ID`.
  - If Keyframe fails, falls back to Simli.

### 3.5. Model Selection (`build_llm`)

```python
def build_llm(model_key: str, prompt: str, avatar_key: str = "simli"):
    ...
```

Supported `model_key` values:

- `gpt-4o-realtime-mini` / `gpt-4o-realtime`
  - Uses `livekit-plugins-openai` realtime models.
  - Voice: `alloy` (or a gendered variant depending on avatar).
  - Prompt passed as `instructions=prompt`.

- `gemini-2.0-flash-live`
  - Uses `livekit-plugins-google` realtime.
  - Voice: `Puck` or `Charon`.
  - Prompt passed as `instructions=prompt`.

- `phonic`
  - Uses `livekit-plugins-phonic`.
  - Native S2S; typically minimal or no textual instructions; mainly audio behavior.

- `ultravox`
  - Uses `livekit-plugins-ultravox` with `ULTRAVOX_API_KEY`.
  - Model: `fixie-ai/ultravox-70B`.
  - Note: returns HTTP 402 “Payment Required” without a valid/paid key.

- `xai-grok`
  - Uses `livekit-plugins-xai` realtime (if installed and configured) with `XAI_API_KEY`.

If a plugin or key is missing, the code falls back to an OpenAI realtime model.

### 3.6. Entry Point (`entrypoint`)

```python
async def entrypoint(ctx: JobContext):
    await ctx.connect()
    # Parse metadata (student, model, avatar) from ctx.job.metadata
    # Load questions and build prompt
    # Build SessionLogger, avatar, and llm
    # Wire event handlers (transcription, state changes, metrics)
    # Start avatar + AgentSession
    # Wait for room/participant disconnect, then save summary
```

Event hooks:

- `user_input_transcribed` → log user text, start a turn.
- `agent_state_changed` → detect speaking/listening and close turns.
- `conversation_item_completed` → capture agent messages into transcript.
- `metrics_collected` → pull token usage details if provided.
- Room events (`participant_disconnected`, `disconnected`) → call `save_summary()` and stop.

---

## 4. Token & Session Server (`agent/token_server.py`)

### 4.1. Environment

Reads from root `.env`:

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `BENCHMARK_LOG_DIR` (defaults to `./logs`)
- `ANTHROPIC_API_KEY` (for `/evaluate`)

### 4.2. Endpoints

#### `GET /token`

- Query parameters:
  - `identity` (optional, defaults to `student-<timestamp>`).
  - `student_name`, `level`, `target_band`, `topic`.
  - `questions` (count, default `"5"`).
  - `model` (`gpt-4o-realtime-mini`, `gemini-2.0-flash-live`, `phonic`, etc.).
  - `avatar` (`simli`, `tavus`, `keyframe`).

- Behavior:
  - Constructs a unique room name: `kassel-<timestamp>-<suffix>`.
  - Builds `metadata` dict with all session configuration.
  - Generates a LiveKit `AccessToken`:
    - Grants: join room, publish, subscribe, publish data.
    - Embeds metadata into the token.
  - Calls `dispatch_agent(room, metadata)`:
    - Uses `LiveKitAPI.agent_dispatch.create_dispatch(...)` to start an agent job.
  - Responds with JSON `{ token, room, identity }`.

#### `GET /sessions`

- Scans `LOGS_DIR` for `summary_*.json`.
- Parses each JSON and returns a list of summary objects, newest first.
- Used by the dashboard to render all historical sessions.

#### `POST /evaluate`

- Proxy endpoint for Anthropic Claude (optional; you can use or ignore it).
- Reads the request body and forwards it to:

  ```text
  POST https://api.anthropic.com/v1/messages
  Headers:
    Content-Type: application/json
    x-api-key: $ANTHROPIC_API_KEY
    anthropic-version: 2023-06-01
  ```

- Returns Claude’s raw response JSON to the frontend.

#### CORS / OPTIONS

- `do_OPTIONS` and `_cors` allow cross‑origin requests from the frontend.

---

## 5. Frontend – Main Components

### 5.1. `src/App.jsx`

- Root component:
  - Sets up routes (`/` for Intake, `/dashboard` for dashboard).
  - Manages state: token, joined status, selected session for evaluation, etc.
  - Wraps the exam UI in `LiveKitRoom`:
    - Passes `token` and `VITE_LIVEKIT_URL`.
    - Renders audio (`RoomAudioRenderer`) and avatar/video UI.

### 5.2. `src/IntakeForm.jsx`

- Collects session configuration from the user.
- Uses internal `validate()` and `handleStart()` to ensure all required fields (name/level/band/topic/model/avatar) are filled.
- On success calls `onStart(form)` with:

```js
{
  name,
  level,
  targetBand,
  topic,
  model: 'gpt-4o-realtime-mini' | ...,
  avatar: 'simli' | 'tavus' | 'keyframe',
}
```

### 5.3. Exam UI (inside `App.jsx` / `VideoAvatar.jsx`)

- Subscribes to LiveKit camera tracks for agent participants.
- Renders the avatar video card:
  - Keeps `<video>` mounted and toggles via `opacity` to avoid flicker.
  - Uses `muted` and `playsInline` for reliable autoplay.
  - Only re‑attaches `srcObject` if the underlying `MediaStreamTrack` actually changes.
  - Shows a “Loading avatar…” overlay that fades instead of unmounting.

### 5.4. `src/Dashboard.jsx`

- Fetches sessions once on mount:

```js
const API = import.meta.env.VITE_TOKEN_SERVER || 'http://localhost:8080'
useEffect(() => {
  fetch(`${API}/sessions`).then(r => r.json()).then(setSessions)
}, [])
```

- Builds:
  - `byModel` aggregation for each model in `ALL_MODELS`.
  - `byAvatar` aggregation for `simli`, `tavus`, `keyframe`.
  - Overview cards, per‑model cards, avatar cards, timeline chart, and per‑session tables.
  - Comparison table with model headers from `MODEL_LABELS`.
  - `SessionPanel` for detailed stats + transcript, including “Export JSON” and “Copy for Notion”.

### 5.5. `src/Evaluation.jsx`

- Reads:
  - `transcript` – from session summary (`summary["transcript"]`).
  - `studentInfo` – summary’s `student` field.
- When user clicks “Generate IELTS Evaluation”:
  - Builds a long, precise prompt for an evaluator LLM (Claude by default).
  - Sends to `/evaluate` or directly to Anthropic.
  - Expects **pure JSON** with band scores and comments.
  - Parses out:
    - `overall_band`
    - `fluency_band`, `lexical_band`, `grammar_band`, `pronunciation_band`
    - Per‑criterion comments
    - `strengths`, `improvement_tip_1/2/3`, `encouragement`
  - Renders:
    - Overall band tile with descriptive label.
    - Criteria cards.
    - Strengths & tips.
    - Encouragement card.
    - Buttons to re‑evaluate or export a plain‑text report.

You can later switch this to “model self‑evaluation” by parsing the agent’s final spoken evaluation from `transcript` instead of calling Claude.

---

## 6. Environment Variables Cheat Sheet

**Backend (.env at project root):**

- `LIVEKIT_URL` – LiveKit Cloud or self‑hosted WebSocket URL.
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` – for LiveKit API client and token generation.
- `OPENAI_API_KEY` – for `gpt-4o-realtime` models.
- `SIMLI_API_KEY`, `SIMLI_FACE_ID` – for Simli avatar.
- `TAVUS_API_KEY`, `TAVUS_REPLICA_ID`, `TAVUS_PERSONA_ID` – for Tavus avatar.
- `KEYFRAME_API_KEY`, `KEYFRAME_PERSONA_ID` – for Keyframe avatar.
- `PHONIC_API_KEY` – for Phonic S2S.
- `ULTRAVOX_API_KEY` – for Ultravox S2S (`fixie-ai/ultravox-70B`).
- `XAI_API_KEY` – for Grok (if `livekit-plugins-xai` is installed).
- `BENCHMARK_LOG_DIR` – optional override for logs directory.
- `ANTHROPIC_API_KEY` – for `/evaluate` endpoint.

**Frontend (`frontend/.env`):**

- `VITE_LIVEKIT_URL` – same as `LIVEKIT_URL` but used in browser.
- `VITE_TOKEN_SERVER` – e.g. `http://localhost:8080`.

---

## 7. Running the System

1. **Fill `.env` and `frontend/.env`** with the correct URLs and API keys.
2. **Start the agent worker**:

```bash
cd agent
pip install -r requirements.txt
python agent.py start
```

3. **Start the token server**:

```bash
cd agent
python token_server.py
```

4. **Start the frontend**:

```bash
cd frontend
npm install
npm run dev
```

5. Open the URL printed by Vite (usually `http://localhost:5173`), configure your session in `IntakeForm`, and start benchmarking.

---

## 8. Extending the Project

- **Add a new model**:
  - Implement a new branch in `build_llm(model_key, prompt, avatar_key)`.
  - Add model metadata to:
    - `MODELS` in `IntakeForm.jsx`.
    - `MODEL_COLORS`, `MODEL_LABELS`, `MODEL_PRICING`, `MODEL_PROVIDERS`, and `ALL_MODELS` in `Dashboard.jsx`.

- **Add a new avatar**:
  - Extend `build_avatar(avatar_key)` with a new plugin call.
  - Add to `AVATARS` in `IntakeForm.jsx` and `AVATAR_*` maps in `Dashboard.jsx`.

- **Change question sets**:
  - Edit `agent/questions.json`.
  - Ensure each topic still has exactly 5 well‑designed questions for fair comparison.

- **Change evaluation style**:
  - Tweak `build_prompt(...)` to change how the examiner speaks and evaluates.
  - Adjust the prompt in `Evaluation.jsx` if you keep using Claude as a separate evaluator, or:
    - Parse self‑evaluation phrases from `transcript` to use the model’s own scores.

This file should give you enough detail to remember how everything is wired, debug issues, and safely add new models or avatars in the future.

