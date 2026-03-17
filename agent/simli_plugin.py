import asyncio, base64, json, logging, time
from typing import Callable, Optional
import aiohttp, websockets

logger = logging.getLogger(__name__)

class SimliAvatarSession:
    SIMLI_API_BASE = "https://api.simli.ai"

    def __init__(self, api_key, face_id, on_first_frame=None, sample_rate=16000):
        self.api_key = api_key
        self.face_id = face_id
        self.on_first_frame = on_first_frame
        self.sample_rate = sample_rate
        self.session_token = None
        self.room_name = None
        self.ws = None
        self._audio_queue = asyncio.Queue()
        self._running = False
        self._first_frame_received = False

    async def start(self) -> dict:
        async with aiohttp.ClientSession() as http:
            resp = await http.post(
                f"{self.SIMLI_API_BASE}/compose/token",
                json={
                    "faceId": self.face_id,
                    "apiVersion": "v2",
                    "handleSilence": True,
                    "audioInputFormat": "pcm16",
                },
                headers={"x-simli-api-key": self.api_key},
            )
            resp.raise_for_status()
            data = await resp.json()

        self.session_token = data.get("session_token") or data.get("sessionToken")
        self.room_name = data.get("roomName") or data.get("room_name")

        ws_url = f"wss://api.simli.ai/StartAudioToVideoSession?session_token={self.session_token}"
        self.ws = await websockets.connect(ws_url, ping_interval=20)
        self._running = True

        asyncio.create_task(self._audio_sender_loop())
        asyncio.create_task(self._response_listener())

        return {"session_token": self.session_token, "room_name": self.room_name, "face_id": self.face_id}

    async def send_audio(self, pcm16_bytes: bytes):
        if self._running:
            await self._audio_queue.put(pcm16_bytes)

    async def _audio_sender_loop(self):
        while self._running:
            try:
                chunk = await asyncio.wait_for(self._audio_queue.get(), timeout=0.5)
                if self.ws and not self.ws.closed:
                    await self.ws.send(json.dumps({
                        "audio": base64.b64encode(chunk).decode(),
                        "sampleRate": self.sample_rate,
                    }))
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error("[Simli] Send error: %s", e)

    async def _response_listener(self):
        try:
            async for message in self.ws:
                try:
                    data = json.loads(message)
                    if not self._first_frame_received and (
                        data.get("type") == "videoFrameStarted" or
                        data.get("status") == "streaming"
                    ):
                        self._first_frame_received = True
                        if self.on_first_frame:
                            self.on_first_frame()
                except json.JSONDecodeError:
                    pass
        except websockets.ConnectionClosed:
            pass

    async def stop(self):
        self._running = False
        if self.ws and not self.ws.closed:
            await self.ws.close()