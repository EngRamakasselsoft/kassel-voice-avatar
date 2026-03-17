import asyncio, glob, json, logging, os, time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv
from livekit.api import AccessToken, VideoGrants, LiveKitAPI
from livekit.api.agent_dispatch_service import CreateAgentDispatchRequest

load_dotenv()
LIVEKIT_API_KEY    = os.getenv("LIVEKIT_API_KEY", "devkey")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "secret")
LIVEKIT_URL        = os.getenv("LIVEKIT_URL", "wss://ielets-dajbgqlm.livekit.cloud")
AGENT_NAME         = "kassel-examiner"
LOGS_DIR           = os.getenv("BENCHMARK_LOG_DIR", "./logs")
OPENAI_API_KEY     = os.getenv("OPENAI_API_KEY", "")
OPENAI_EVAL_URL    = "https://api.openai.com/v1/chat/completions"
OPENAI_EVAL_MODEL  = "gpt-4o-mini"   # ~$0.0005 per evaluation

logging.basicConfig(level=logging.INFO, format="%(asctime)s [TokenServer] %(message)s")
logger = logging.getLogger("token_server")


async def dispatch_agent(room, metadata):
    try:
        api = LiveKitAPI(
            url=LIVEKIT_URL,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
        )
        await api.agent_dispatch.create_dispatch(
            CreateAgentDispatchRequest(
                agent_name=AGENT_NAME,
                room=room,
                metadata=json.dumps(metadata),
            )
        )
        await api.aclose()
        logger.info("Dispatched | %s | %s | %s", room, metadata.get("model"), metadata.get("student_name"))
    except Exception as e:
        logger.error("Dispatch failed: %s", e)


def load_sessions():
    summaries = []
    for path in sorted(glob.glob(os.path.join(LOGS_DIR, "summary_*.json")), reverse=True):
        try:
            with open(path) as f:
                data = json.load(f)
                if data.get("type") == "summary":
                    summaries.append(data)
        except Exception:
            pass
    return summaries


def handle_evaluate(handler):
    """POST /evaluate — calls OpenAI gpt-4o-mini, returns JSON evaluation."""
    import urllib.request, urllib.error

    try:
        length  = int(handler.headers.get("Content-Length", 0))
        body    = handler.rfile.read(length) if length > 0 else b"{}"
        payload = json.loads(body)

        # Extract prompt — supports { "prompt": "..." } or { "messages": [...] }
        prompt = payload.get("prompt", "")
        if not prompt:
            for msg in payload.get("messages", []):
                if msg.get("role") == "user":
                    prompt = msg.get("content", "")
                    break

        if not prompt:
            handler._respond(400, {"error": "No prompt provided"})
            return

        if not OPENAI_API_KEY:
            handler._respond(500, {"error": "OPENAI_API_KEY not set in .env"})
            return

        logger.info("[Evaluate] Calling OpenAI %s (%d chars)", OPENAI_EVAL_MODEL, len(prompt))

        openai_body = json.dumps({
            "model": OPENAI_EVAL_MODEL,
            "temperature": 0.3,
            "max_tokens": 1200,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert IELTS examiner. Always respond with valid JSON only — no markdown, no explanation.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        }).encode()

        # Retry up to 3 times on 429
        openai_data = None
        last_error  = None

        for attempt in range(1, 4):
            try:
                req = urllib.request.Request(
                    OPENAI_EVAL_URL,
                    data=openai_body,
                    headers={
                        "Content-Type":  "application/json",
                        "Authorization": f"Bearer {OPENAI_API_KEY}",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    openai_data = json.loads(resp.read())
                break

            except urllib.error.HTTPError as e:
                last_error = e
                if e.code == 429:
                    wait = attempt * 10
                    logger.warning("[Evaluate] OpenAI 429 (attempt %d/3) — waiting %ds", attempt, wait)
                    time.sleep(wait)
                    continue
                raise

        if openai_data is None:
            try:
                err_body = last_error.read().decode()[:300]
            except Exception:
                err_body = str(last_error)
            logger.error("[Evaluate] OpenAI failed after 3 attempts: %s", err_body)
            handler._respond(429, {"error": "OpenAI rate limit exceeded. Wait a moment and try again."})
            return

        text  = openai_data["choices"][0]["message"]["content"]
        clean = text.replace("```json", "").replace("```", "").strip()

        usage = openai_data.get("usage", {})
        cost  = (
            usage.get("prompt_tokens",     0) / 1_000_000 * 0.15 +
            usage.get("completion_tokens", 0) / 1_000_000 * 0.60
        )
        logger.info(
            "[Evaluate] Done — %d chars | %d in / %d out tokens | $%.6f",
            len(clean),
            usage.get("prompt_tokens", 0),
            usage.get("completion_tokens", 0),
            cost,
        )

        handler.send_response(200)
        handler._cors()
        handler.send_header("Content-Type", "application/json")
        handler.end_headers()
        handler.wfile.write(json.dumps({
            "content": [{"type": "text", "text": clean}],
            "usage": usage,
            "eval_model": OPENAI_EVAL_MODEL,
            "eval_cost_usd": round(cost, 6),
        }).encode())

    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode()[:300]
        except Exception:
            err_body = str(e)
        logger.error("[Evaluate] OpenAI HTTP error %d: %s", e.code, err_body)
        handler._respond(e.code, {"error": err_body})

    except urllib.error.URLError as e:
        logger.error("[Evaluate] Network error: %s", e)
        handler._respond(503, {"error": f"Network error: {e}"})

    except KeyError as e:
        logger.error("[Evaluate] Unexpected OpenAI response — missing key: %s", e)
        handler._respond(500, {"error": "Unexpected OpenAI response format"})

    except Exception as e:
        logger.error("[Evaluate] Unexpected error: %s", e)
        handler._respond(500, {"error": str(e)})


class TokenHandler(BaseHTTPRequestHandler):

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/sessions":
            self._respond(200, load_sessions())
            return

        if parsed.path != "/token":
            self._respond(404, {"error": "not found"})
            return

        params = parse_qs(parsed.query)
        def p(k, d=""): return params.get(k, [d])[0]

        identity = p("identity", f"student-{int(time.time())}")
        room     = f"kassel-{int(time.time())}-{identity[-4:]}"
        metadata = {
            "student_name": p("student_name"),
            "level":        p("level"),
            "target_band":  p("target_band"),
            "topic":        p("topic"),
            "questions":    p("questions", "5"),
            "model":        p("model", "gpt-4o-realtime-mini"),
            "avatar":       p("avatar", "simli"),
            "identity":     identity,
        }

        token = (
            AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(identity)
            .with_name(identity)
            .with_grants(VideoGrants(
                room_join=True, room=room,
                can_publish=True, can_subscribe=True, can_publish_data=True,
            ))
            .with_metadata(json.dumps(metadata))
            .to_jwt()
        )

        asyncio.run(dispatch_agent(room, metadata))
        self._respond(200, {"token": token, "room": room, "identity": identity})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/evaluate":
            handle_evaluate(self)
            return
        self._respond(404, {"error": "not found"})

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def _respond(self, status, body):
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, *_):
        pass


if __name__ == "__main__":
    os.makedirs(LOGS_DIR, exist_ok=True)
    server = HTTPServer(("0.0.0.0", 8080), TokenHandler)
    logger.info("Token server → http://0.0.0.0:8080")
    logger.info("  GET  /token     — LiveKit token")
    logger.info("  GET  /sessions  — list sessions")
    logger.info("  POST /evaluate  — OpenAI %s IELTS evaluation", OPENAI_EVAL_MODEL)
    logger.info("  OPENAI_API_KEY: %s", "SET" if OPENAI_API_KEY else "MISSING — evaluation will fail")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        logger.info("Token server stopped.")