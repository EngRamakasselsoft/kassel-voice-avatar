import json, time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

@dataclass
class SessionMetrics:
    session_id: str
    turn: int = 0
    ts_user_speech_start: Optional[float] = None
    ts_user_speech_end: Optional[float] = None
    ts_openai_request_sent: Optional[float] = None
    ts_openai_first_token: Optional[float] = None
    ts_simli_audio_sent: Optional[float] = None
    ts_simli_first_frame: Optional[float] = None
    ts_agent_speech_start: Optional[float] = None
    vad_duration_ms: Optional[float] = None
    openai_ttft_ms: Optional[float] = None
    simli_video_latency_ms: Optional[float] = None
    glass_to_glass_ms: Optional[float] = None
    model: str = "gpt-4o-realtime-mini"
    avatar: str = "simli"
    error: Optional[str] = None

class BenchmarkLogger:
    def __init__(self, session_id, log_dir="./logs"):
        self.session_id = session_id
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.session_start = time.perf_counter()
        self.current_metrics: Optional[SessionMetrics] = None
        self.all_metrics = []
        self.turn_count = 0
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file = self.log_dir / f"benchmark_{ts}_{session_id[:8]}.jsonl"

    def _now_ms(self): return (time.perf_counter() - self.session_start) * 1000

    def start_turn(self):
        self.turn_count += 1
        self.current_metrics = SessionMetrics(session_id=self.session_id, turn=self.turn_count,
                                               ts_user_speech_start=self._now_ms())

    def mark_user_speech_end(self):
        if self.current_metrics:
            self.current_metrics.ts_user_speech_end = self._now_ms()
            if self.current_metrics.ts_user_speech_start:
                self.current_metrics.vad_duration_ms = (
                    self.current_metrics.ts_user_speech_end - self.current_metrics.ts_user_speech_start)

    def mark_openai_request_sent(self):
        if self.current_metrics: self.current_metrics.ts_openai_request_sent = self._now_ms()

    def mark_openai_first_token(self):
        if self.current_metrics:
            self.current_metrics.ts_openai_first_token = self._now_ms()
            if self.current_metrics.ts_openai_request_sent:
                self.current_metrics.openai_ttft_ms = (
                    self.current_metrics.ts_openai_first_token - self.current_metrics.ts_openai_request_sent)

    def mark_simli_audio_sent(self):
        if self.current_metrics: self.current_metrics.ts_simli_audio_sent = self._now_ms()

    def mark_simli_first_frame(self):
        if self.current_metrics:
            self.current_metrics.ts_simli_first_frame = self._now_ms()
            if self.current_metrics.ts_simli_audio_sent:
                self.current_metrics.simli_video_latency_ms = (
                    self.current_metrics.ts_simli_first_frame - self.current_metrics.ts_simli_audio_sent)

    def mark_agent_speech_start(self):
        if self.current_metrics:
            self.current_metrics.ts_agent_speech_start = self._now_ms()
            if self.current_metrics.ts_user_speech_start:
                self.current_metrics.glass_to_glass_ms = (
                    self.current_metrics.ts_agent_speech_start - self.current_metrics.ts_user_speech_start)

    def end_turn(self):
        if not self.current_metrics: return
        self.all_metrics.append(self.current_metrics)
        with open(self.log_file, "a") as f:
            f.write(json.dumps(asdict(self.current_metrics)) + "\n")
        print(f"[Bench] Turn {self.current_metrics.turn} | TTFT: {self.current_metrics.openai_ttft_ms or 0:.0f}ms | G2G: {self.current_metrics.glass_to_glass_ms or 0:.0f}ms")
        self.current_metrics = None

    def get_session_summary(self):
        ttfts = [m.openai_ttft_ms for m in self.all_metrics if m.openai_ttft_ms]
        g2gs  = [m.glass_to_glass_ms for m in self.all_metrics if m.glass_to_glass_ms]
        return {
            "session_id": self.session_id, "total_turns": self.turn_count,
            "model": "gpt-4o-realtime-mini", "avatar": "simli",
            "openai_ttft_avg_ms": sum(ttfts)/len(ttfts) if ttfts else None,
            "openai_ttft_min_ms": min(ttfts) if ttfts else None,
            "openai_ttft_max_ms": max(ttfts) if ttfts else None,
            "glass_to_glass_avg_ms": sum(g2gs)/len(g2gs) if g2gs else None,
            "glass_to_glass_min_ms": min(g2gs) if g2gs else None,
            "glass_to_glass_max_ms": max(g2gs) if g2gs else None,
        }