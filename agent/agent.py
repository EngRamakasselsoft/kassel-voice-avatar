"""
agent.py — Kassel Academy IELTS Voice Avatar
S2S Models: gpt-4o-realtime-mini, gpt-4o-realtime, gemini-2.0-flash-live, ultravox
Avatars:    simli, tavus, keyframe
Fair comparison: fixed question bank, full Q&A logging
"""

import asyncio, json, logging, os, time, uuid
from datetime import datetime
from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.agents.llm import ChatMessage
from livekit.plugins import openai, simli
try:
    from livekit.plugins import keyframe
except ImportError:
    keyframe = None
try:
    from livekit.plugins import tavus
except ImportError:
    tavus = None
try:
    from livekit.plugins import google
except ImportError:
    google = None
try:
    from livekit.plugins import ultravox
except ImportError:
    ultravox = None
try:
    from livekit.plugins import phonic
except ImportError:
    phonic = None
try:
    from livekit.plugins import xai
except ImportError:
    xai = None

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("kassel.agent")

# ── Pricing per model (per 1M tokens) ─────────────────────────
PRICING = {
    "gpt-4o-realtime-mini": {
        "input_text": 0.40, "output_text": 1.60,
        "input_audio": 10.00, "output_audio": 20.00,
    },
    "gpt-4o-realtime": {
        "input_text": 5.00, "output_text": 20.00,
        "input_audio": 40.00, "output_audio": 80.00,
    },
    "gemini-2.0-flash-live": {
        "input_text": 0.10, "output_text": 0.40,
        "input_audio": 0.70, "output_audio": 8.50,
    },
    "ultravox": {
        "input_text": 0.0, "output_text": 0.0,
        "input_audio": 0.0, "output_audio": 0.0,
        "per_minute": 0.05,  # $0.05/min flat rate
    },
    "phonic": {
        "input_text": 0.0, "output_text": 0.0,
        "input_audio": 0.0, "output_audio": 0.0,
        "per_minute": 0.05,
    },
    "xai-grok": {
        "input_text": 0.0, "output_text": 0.0,
        "input_audio": 0.0, "output_audio": 0.0,
        "per_minute": 0.05,
    },
}

MODEL_IDS = {
    "gpt-4o-realtime-mini": "gpt-4o-realtime-preview-2024-12-17",
    "gpt-4o-realtime":      "gpt-4o-realtime-preview-2024-12-17",
    "gemini-2.0-flash-live":"gemini-2.0-flash-live-001",
    "ultravox":             "fixie-ai/ultravox-70B",
    "phonic":               "phonic-s2s",
    "xai-grok":             "grok-4-1-fast-non-reasoning",
}

AVATAR_NAMES = {
    "simli":    "Simli",
    "tavus":    "Tavus",
    "keyframe": "Keyframe",
}

# ── Load fixed question bank ───────────────────────────────────
QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "questions.json")
with open(QUESTIONS_FILE, "r") as f:
    QUESTION_BANK = json.load(f)


def build_prompt(student: dict, questions: list, avatar: str = "simli") -> str:
    name        = student.get("student_name", "the student")
    level       = student.get("level", "B1")
    target_band = student.get("target_band", "6.0")
    topic       = student.get("topic", "General")
    model_label = student.get("model_label", "gpt-4o-realtime-mini")
    q_list = "\n".join([f"  Question {i+1}: {q}" for i, q in enumerate(questions)])

    examiner_name = "James" if avatar == "keyframe" else "Sarah"
    return f"""You are {examiner_name}, a certified IELTS examiner and speaking coach at Kassel Academy.
You are conducting a standardised benchmark test for model: {model_label}

START by saying exactly:
"Hello {name}, welcome to your IELTS Speaking practice session. I'm {examiner_name}, your examiner today. We'll be working through 5 questions on the topic of {topic}. Let's begin."

Then immediately ask Question 1. Do NOT wait.

FIXED QUESTIONS — ask in exact order, one at a time:
{q_list}

RULES:
- Ask each question EXACTLY as written. Do not rephrase.
- After each student answer give:
  1. One short improvement tip (1 sentence, target band {target_band})
  2. One model answer sentence at band {target_band} level
- Move to the next question immediately after feedback.
- After all 5 questions give brief overall feedback: one strength, one area to improve.
- Student level: {level} | Target band: {target_band} | Topic: {topic}

CRITICAL:
- Never use bullet points, headers, or markdown — you are speaking aloud.
- Ask questions EXACTLY as written — this is a standardised test.
- Keep responses concise and conversational."""


class SessionLogger:
    def __init__(self, session_id: str, model_key: str, avatar_key: str, student: dict):
        self.session_id  = session_id
        self.model_key   = model_key
        self.avatar_key  = avatar_key
        self.student     = student
        self.pricing     = PRICING.get(model_key, PRICING["gpt-4o-realtime-mini"])
        self.session_start = time.perf_counter()
        self.turns = []
        self.current_turn = None
        self.turn_count = 0
        self._flush_pending = False
        self._summary_saved = False
        self.last_agent_text = ""
        self.total_input_text_tokens   = 0
        self.total_output_text_tokens  = 0
        self.total_input_audio_tokens  = 0
        self.total_output_audio_tokens = 0
        os.makedirs("./logs", exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file = f"./logs/session_{ts}_{model_key}_{avatar_key}_{session_id[:8]}.jsonl"
        logger.info("[Log] %s", self.log_file)

    def _now_ms(self): return round((time.perf_counter() - self.session_start) * 1000, 1)

    def _calc_cost(self, it, ot, ia, oa):
        p = self.pricing
        if "per_minute" in p:
            # Ultravox flat rate — estimate from session duration
            duration_min = (time.perf_counter() - self.session_start) / 60
            return round(duration_min * p["per_minute"], 6)
        return round(
            (it/1_000_000*p["input_text"]) + (ot/1_000_000*p["output_text"]) +
            (ia/1_000_000*p["input_audio"]) + (oa/1_000_000*p["output_audio"]), 6)

    def start_turn(self):
        if self._flush_pending:
            self._flush_pending = False
            self._flush_turn()
        self.turn_count += 1
        self.current_turn = {
            "turn": self.turn_count,
            "ts_user_start_ms": self._now_ms(),
            "ts_user_end_ms": None,
            "ts_agent_start_ms": None,
            "ts_agent_end_ms": None,
            "glass_to_glass_ms": None,
            "input_text_tokens": 0, "output_text_tokens": 0,
            "input_audio_tokens": 0, "output_audio_tokens": 0,
            "turn_cost_usd": 0.0,
            "user_transcript": "",
            "agent_transcript": "",
        }
        logger.info("[Turn %d] User speaking", self.turn_count)

    def user_stopped(self):
        if self.current_turn: self.current_turn["ts_user_end_ms"] = self._now_ms()

    def agent_started(self):
        if not self.current_turn: self.start_turn()
        self.current_turn["ts_agent_start_ms"] = self._now_ms()
        if self.current_turn["ts_user_start_ms"]:
            self.current_turn["glass_to_glass_ms"] = round(
                self.current_turn["ts_agent_start_ms"] - self.current_turn["ts_user_start_ms"], 1)
        logger.info("[Turn %d] Agent speaking | G2G: %sms", self.turn_count, self.current_turn["glass_to_glass_ms"])

    def agent_stopped(self):
        if self.current_turn:
            self.current_turn["ts_agent_end_ms"] = self._now_ms()
            self._flush_pending = True

    def set_user_transcript(self, text: str):
        if self.current_turn: self.current_turn["user_transcript"] = text

    def set_agent_transcript(self, text: str):
        self.last_agent_text = text
        if self.current_turn:
            self.current_turn["agent_transcript"] = text
            if self._flush_pending:
                self._flush_pending = False
                self._flush_turn()

    def add_tokens(self, input_text=0, output_text=0, input_audio=0, output_audio=0):
        self.total_input_text_tokens   += input_text
        self.total_output_text_tokens  += output_text
        self.total_input_audio_tokens  += input_audio
        self.total_output_audio_tokens += output_audio
        if self.current_turn:
            self.current_turn["input_text_tokens"]   += input_text
            self.current_turn["output_text_tokens"]  += output_text
            self.current_turn["input_audio_tokens"]  += input_audio
            self.current_turn["output_audio_tokens"] += output_audio

    def _flush_turn(self):
        if not self.current_turn: return
        t = self.current_turn
        t["turn_cost_usd"] = self._calc_cost(
            t["input_text_tokens"], t["output_text_tokens"],
            t["input_audio_tokens"], t["output_audio_tokens"])
        self.turns.append(t)
        with open(self.log_file, "a") as f:
            f.write(json.dumps({"type": "turn", **t}) + "\n")
        logger.info("[Turn %d] Done | G2G:%sms | $%.6f", t["turn"],
            t.get("glass_to_glass_ms","?"), t["turn_cost_usd"])
        self.current_turn = None

    def save_summary(self):
        if self._summary_saved:
            return
        self._summary_saved = True
        self._flush_pending = False
        if self.current_turn: self._flush_turn()
        g2g = [t["glass_to_glass_ms"] for t in self.turns if t.get("glass_to_glass_ms")]
        total_cost = self._calc_cost(
            self.total_input_text_tokens, self.total_output_text_tokens,
            self.total_input_audio_tokens, self.total_output_audio_tokens)

        summary = {
            "type": "summary",
            "session_id": self.session_id,
            "model_key": self.model_key,
            "model_id": MODEL_IDS.get(self.model_key, self.model_key),
            "avatar_key": self.avatar_key,
            "avatar": AVATAR_NAMES.get(self.avatar_key, self.avatar_key),
            "student": self.student,
            "timestamp": datetime.now().isoformat(),
            "session_duration_seconds": round(time.perf_counter() - self.session_start, 1),
            "total_turns": self.turn_count,
            "glass_to_glass_avg_ms": round(sum(g2g)/len(g2g),1) if g2g else None,
            "glass_to_glass_min_ms": min(g2g) if g2g else None,
            "glass_to_glass_max_ms": max(g2g) if g2g else None,
            "latency_per_turn": [{"turn": t["turn"], "g2g_ms": t.get("glass_to_glass_ms")} for t in self.turns],
            "total_input_text_tokens":   self.total_input_text_tokens,
            "total_output_text_tokens":  self.total_output_text_tokens,
            "total_input_audio_tokens":  self.total_input_audio_tokens,
            "total_output_audio_tokens": self.total_output_audio_tokens,
            "total_tokens": (self.total_input_text_tokens + self.total_output_text_tokens +
                             self.total_input_audio_tokens + self.total_output_audio_tokens),
            "total_cost_usd": total_cost,
            "cost_per_turn_avg_usd": round(total_cost/self.turn_count, 6) if self.turn_count else 0,
            "pricing_used": self.pricing,
            "transcript": [
                {
                    "turn": t["turn"],
                    "user": t.get("user_transcript", ""),
                    "agent": t.get("agent_transcript", ""),
                    "g2g_ms": t.get("glass_to_glass_ms"),
                    "cost_usd": t.get("turn_cost_usd", 0),
                    "audio_tokens_in": t.get("input_audio_tokens", 0),
                    "audio_tokens_out": t.get("output_audio_tokens", 0),
                }
                for t in self.turns
            ],
        }

        with open(self.log_file, "a") as f:
            f.write(json.dumps(summary) + "\n")
        sf = f"./logs/summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{self.model_key}_{self.avatar_key}_{self.session_id[:8]}.json"
        with open(sf, "w") as f:
            json.dump(summary, f, indent=2)

        logger.info("\n" + "="*60)
        logger.info("  SESSION SUMMARY — %s", self.session_id)
        logger.info("  Model: %-25s Avatar: %s", self.model_key, self.avatar_key)
        logger.info("="*60)
        logger.info("  Student:    %s | %s → Band %s",
            self.student.get("student_name","?"),
            self.student.get("level","?"),
            self.student.get("target_band","?"))
        logger.info("  Topic:      %s", self.student.get("topic","?"))
        logger.info("  Duration:   %.1fs | Turns: %d", summary["session_duration_seconds"], summary["total_turns"])
        logger.info("  G2G:        avg=%s min=%s max=%s ms",
            summary["glass_to_glass_avg_ms"],
            summary["glass_to_glass_min_ms"],
            summary["glass_to_glass_max_ms"])
        logger.info("  Tokens:     audio_in=%d audio_out=%d text_in=%d text_out=%d total=%d",
            summary["total_input_audio_tokens"], summary["total_output_audio_tokens"],
            summary["total_input_text_tokens"], summary["total_output_text_tokens"],
            summary["total_tokens"])
        logger.info("  Cost:       $%.6f USD ($%.6f/turn)", summary["total_cost_usd"], summary["cost_per_turn_avg_usd"])
        logger.info("="*60)
        logger.info("  Summary: %s", sf)


def build_avatar(avatar_key: str):
    """Build the avatar session based on the selected avatar."""
    if avatar_key == "tavus":
        if tavus is None:
            logger.error("[Avatar] livekit-plugins-tavus not installed — falling back to Simli")
            return _simli_avatar()
        return tavus.AvatarSession(
            api_key=os.getenv("TAVUS_API_KEY"),
            replica_id=os.getenv("TAVUS_REPLICA_ID", "r3f427f43c9d"),
            persona_id=os.getenv("TAVUS_PERSONA_ID", "p8e436a12fd3"),
        )
    elif avatar_key == "keyframe":
        try:
            return keyframe.AvatarSession(
                api_key=os.getenv("KEYFRAME_API_KEY"),
                persona_id=os.getenv("KEYFRAME_PERSONA_ID", "d889c3fd-473f-4a80-aca9-7d28b24b1592"),
            )
        except Exception as e:
            logger.warning("[Avatar] Keyframe failed: %s — falling back to Simli", e)
            return _simli_avatar()
    else:
        return _simli_avatar()


def _simli_avatar():
    face_id = os.getenv("SIMLI_FACE_ID", "tmp9i8bbq7c")
    api_key = os.getenv("SIMLI_API_KEY", "")
    logger.info("[Simli] api_key=%s... face_id=%s", api_key[:8] if api_key else "MISSING", face_id)
    return simli.AvatarSession(
        simli_config=simli.SimliConfig(
            api_key=api_key,
            face_id=face_id,
            max_idle_time=60,     # expire 60s after last speech (frees the slot for next session)
            max_session_length=900,
        )
    )


def build_llm(model_key: str, prompt: str, avatar_key: str = "simli"):
    """Build the LLM/RealtimeModel based on selected model."""
    is_male = (avatar_key == "keyframe")
    oai_voice = "echo" if is_male else "shimmer"
    gemini_voice = "Charon" if is_male else "Puck"
    ultravox_voice = "Mark" if is_male else "Jessica"

    if model_key == "gemini-2.0-flash-live":
        if google is None:
            logger.error("[LLM] livekit-plugins-google not installed — falling back to gpt-4o-realtime-mini")
            return _openai_llm("gpt-4o-realtime-preview-2024-12-17", oai_voice)
        return google.beta.realtime.RealtimeModel(
            model="gemini-2.0-flash-live-001",
            voice=gemini_voice,
            instructions=prompt,
        )

    elif model_key == "ultravox":
        if ultravox is None:
            logger.error("[LLM] livekit-plugins-ultravox not installed — falling back to gpt-4o-realtime-mini")
            return _openai_llm("gpt-4o-realtime-preview-2024-12-17", oai_voice)
        return ultravox.RealtimeModel(
            api_key=os.getenv("ULTRAVOX_API_KEY"),
            model="fixie-ai/ultravox-70B",
            voice=ultravox_voice,
        )

    elif model_key == "phonic":
        if phonic is None:
            logger.error("[LLM] livekit-plugins-phonic not installed — falling back to gpt-4o-realtime-mini")
            return _openai_llm("gpt-4o-realtime-preview-2024-12-17", oai_voice)
        return phonic.realtime.RealtimeModel(
            api_key=os.getenv("PHONIC_API_KEY"),
            generate_welcome_message=False,
        )

    elif model_key == "xai-grok":
        if xai is None:
            logger.error("[LLM] livekit-plugins-xai not installed — falling back to gpt-4o-realtime-mini")
            return _openai_llm("gpt-4o-realtime-preview-2024-12-17", oai_voice)
        xai_voice = "Eve" if not is_male else "Leo"
        return xai.realtime.RealtimeModel(
            api_key=os.getenv("XAI_API_KEY"),
            voice=xai_voice,
        )

    elif model_key == "gpt-4o-realtime":
        return _openai_llm("gpt-4o-realtime-preview-2024-12-17", oai_voice)

    else:  # gpt-4o-realtime-mini (default)
        return _openai_llm("gpt-4o-realtime-preview-2024-12-17", oai_voice)


def _openai_llm(model_id: str, voice: str = "shimmer"):
    return openai.realtime.RealtimeModel(
        model=model_id,
        voice=voice,
        temperature=0.7,
    )


async def entrypoint(ctx: JobContext):
    session_id = str(uuid.uuid4())[:8]
    await ctx.connect()

    # ── Parse dispatch metadata ────────────────────────────────
    student = {}
    model_key  = "gpt-4o-realtime-mini"
    avatar_key = "simli"
    try:
        meta_raw = ctx.job.metadata or ""
        if meta_raw:
            student    = json.loads(meta_raw)
            model_key  = student.get("model", "gpt-4o-realtime-mini")
            avatar_key = student.get("avatar", "simli")
    except Exception as e:
        logger.warning("[Agent] Metadata parse error: %s", e)

    logger.info("[Agent] Session:%s | Model:%s | Avatar:%s | Student:%s | Topic:%s",
        session_id, model_key, avatar_key,
        student.get("student_name","?"), student.get("topic","?"))

    # ── Fixed questions for topic ──────────────────────────────
    topic     = student.get("topic", "Technology")
    questions = QUESTION_BANK.get(topic, QUESTION_BANK["Technology"])

    # ── Build prompt ───────────────────────────────────────────
    student["model_label"] = model_key
    prompt = build_prompt(student, questions, avatar_key)

    log    = SessionLogger(session_id, model_key, avatar_key, student)
    avatar = build_avatar(avatar_key)
    llm    = build_llm(model_key, prompt, avatar_key)

    session = AgentSession(llm=llm)

    # ── Event hooks ────────────────────────────────────────────
    @session.on("user_input_transcribed")
    def _(ev):
        if not ev.is_final: return
        text = ev.transcript
        logger.info("[User] %s", text[:100])
        log.start_turn()
        log.set_user_transcript(text)

    @session.on("agent_state_changed")
    def _(ev):
        state = ev.new_state
        if state == "speaking":
            log.agent_started()
        elif state in ("listening", "idle"):
            log.user_stopped()
            log.agent_stopped()

    @session.on("conversation_item_added")
    def _(ev):
        try:
            msg = ev.item
            if not isinstance(msg, ChatMessage): return
            if getattr(msg, 'interrupted', False): return
            text = msg.text_content or ''
            if not text: return
            role = getattr(msg, 'role', '')
            if role == 'assistant':
                log.set_agent_transcript(text[:500])
                logger.info("[Sarah] %s", text[:80])
        except Exception as e:
            logger.debug("[Transcript] %s", e)

    @session.on("metrics_collected")
    def _(ev):
        try:
            from livekit.agents import metrics as agent_metrics
            m = ev.metrics
            if isinstance(m, agent_metrics.RealtimeModelMetrics):
                d_in  = m.input_token_details
                d_out = m.output_token_details
                log.add_tokens(
                    input_text=d_in.text_tokens,
                    output_text=d_out.text_tokens,
                    input_audio=d_in.audio_tokens,
                    output_audio=d_out.audio_tokens,
                )
            elif isinstance(m, agent_metrics.LLMMetrics):
                log.add_tokens(
                    input_text=m.prompt_tokens,
                    output_text=m.completion_tokens,
                )
        except Exception as e:
            logger.debug("[Metrics] %s", e)

    # ── Start session first, then avatar ──────────────────────
    # session.start() initialises session.output; avatar.start() then
    # redirects session.output.audio to Simli via DataStreamAudioOutput
    if avatar_key == "tavus":
        from livekit.agents import RoomOutputOptions
        await session.start(
            agent=Agent(instructions=prompt),
            room=ctx.room,
            room_output_options=RoomOutputOptions(audio_enabled=False),
        )
    else:
        await session.start(agent=Agent(instructions=prompt), room=ctx.room)

    # avatar.start() fails silently (returns None on error) so we detect failure
    # by checking whether session.output.audio was redirected to DataStreamAudioOutput
    from livekit.agents.voice.avatar import DataStreamAudioOutput as _DSA

    async def _start_avatar_with_retry(av, max_attempts=3, delay=5):
        for attempt in range(1, max_attempts + 1):
            await av.start(session, room=ctx.room)
            if isinstance(session.output.audio, _DSA):
                return True  # successfully connected
            if attempt < max_attempts:
                logger.warning("[Avatar] Simli not connected (attempt %d/%d) — waiting %ds before retry",
                               attempt, max_attempts, delay)
                await asyncio.sleep(delay)
        return False

    connected = await _start_avatar_with_retry(avatar)
    if connected:
        logger.info("[Avatar] %s video connected", avatar_key)
    else:
        logger.warning("[Avatar] %s failed after retries — running audio-only", avatar_key)
        if avatar_key != "simli":
            logger.info("[Avatar] trying Simli fallback")
            avatar = _simli_avatar()
            avatar_key = "simli"
            connected = await _start_avatar_with_retry(avatar, max_attempts=2, delay=8)
            if connected:
                logger.info("[Avatar] Simli fallback connected")
            else:
                logger.warning("[Avatar] Simli fallback also failed — audio-only session")

    logger.info("[Agent] Ready — %s + %s is live", model_key, avatar_key)

    student_identity = student.get("identity", "")
    disconnect_event = asyncio.Event()

    @ctx.room.on("participant_disconnected")
    def _(participant):
        pid = getattr(participant, "identity", "")
        is_student = (
            (student_identity and pid == student_identity)
            or (not student_identity and pid
                and not pid.startswith("agent-")
                and "simli" not in pid.lower()
                and "tavus" not in pid.lower()
                and "keyframe" not in pid.lower())
        )
        if not is_student:
            logger.debug("[Room] ignored disconnect from: %s", pid)
            return
        log.save_summary()
        disconnect_event.set()

    @ctx.room.on("disconnected")
    def _():
        log.save_summary()
        disconnect_event.set()

    await disconnect_event.wait()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="kassel-examiner"))