from __future__ import annotations

import base64
import json
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .agent import AlertAgent
from .agent_gemma import GemmaAgent
from .db import EventDB
from .settings import settings
from .state import InventoryStateMachine
from .vision import ChairCounter


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Offline Staging Inventory Copilot V1")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

chair_counter = ChairCounter(
    model_name=settings.yolo_model,
    chair_class_name=settings.chair_class_name,
    conf_threshold=settings.conf_threshold,
)
agent = AlertAgent(
    ollama_base_url=settings.ollama_base_url,
    ollama_model=settings.ollama_model,
    timeout_sec=settings.ollama_timeout_sec,
)
db = EventDB(settings.sqlite_path)
state_machine = InventoryStateMachine(
    debounce_k=settings.debounce_k,
    cooldown_sec=settings.cooldown_sec,
)

# Fine-tuned Gemma agent (loads in background, falls back gracefully if unavailable)
gemma_agent = GemmaAgent(
    base_model_id=settings.gemma_base_model,
    adapter_path=settings.gemma_adapter_path,
    hf_token=settings.gemma_hf_token,
)
if settings.gemma_enabled:
    gemma_agent.load_async()

# Sample every Nth frame for observation logging to avoid DB bloat
_OBS_SAMPLE_EVERY = 3
_frame_counter: int = 0
_history: list[int] = []  # rolling window of item counts for Gemma context


@app.get("/")
def phone_app() -> FileResponse:
    return FileResponse(STATIC_DIR / "phone.html")


@app.get("/dashboard")
def dashboard() -> FileResponse:
    return FileResponse(STATIC_DIR / "dashboard.html")


@app.get("/api/health")
def health() -> JSONResponse:
    return JSONResponse(
        {
            "ok": True,
            "state": state_machine.state,
            "baseline": state_machine.baseline_count,
            "last_observed": state_machine.last_observed_count,
        }
    )


@app.get("/api/events")
def events(limit: int = 50) -> JSONResponse:
    return JSONResponse({"events": db.recent_events(limit=min(limit, 200))})


@app.get("/api/observations")
def observations(limit: int = 100) -> JSONResponse:
    return JSONResponse({"observations": db.recent_observations(limit=min(limit, 500))})


@app.get("/api/config")
def config() -> JSONResponse:
    return JSONResponse(
        {
            "tracked_class": settings.chair_class_name,
            "conf_threshold": settings.conf_threshold,
            "debounce_k": settings.debounce_k,
            "cooldown_sec": settings.cooldown_sec,
        }
    )


def _decode_b64_jpeg(jpeg_b64: str) -> np.ndarray:
    raw = base64.b64decode(jpeg_b64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Invalid JPEG payload")
    return frame


def _resize_for_model(frame: np.ndarray) -> np.ndarray:
    h, w = frame.shape[:2]
    max_w = settings.max_frame_width
    max_h = settings.max_frame_height
    if w <= max_w and h <= max_h:
        return frame
    scale = min(max_w / w, max_h / h)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    return cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)


async def _send_status(ws: WebSocket, *, average_conf: float, timestamp_ms: int) -> None:
    diff = 0
    if state_machine.baseline_count is not None and state_machine.last_observed_count is not None:
        diff = state_machine.last_observed_count - state_machine.baseline_count

    cooldown_remaining = max(0.0, state_machine.cooldown_until_monotonic - time.monotonic())
    await ws.send_json(
        {
            "type": "status",
            "timestamp_ms": timestamp_ms,
            "state": state_machine.state,
            "item_count": state_machine.last_observed_count,
            "chair_count": state_machine.last_observed_count,  # backwards compat
            "baseline_count": state_machine.baseline_count,
            "diff": diff,
            "discrepancy_streak": state_machine.discrepancy_streak,
            "cooldown_remaining_sec": round(cooldown_remaining, 2),
            "average_conf": round(average_conf, 3),
            "k": settings.debounce_k,
            "t_sec": settings.cooldown_sec,
        }
    )


async def _handle_command(ws: WebSocket, data: dict[str, Any]) -> None:
    cmd = data.get("command")
    if cmd == "set_baseline":
        if state_machine.last_observed_count is None:
            await ws.send_json({"type": "error", "message": "No observation available yet."})
            return
        state_machine.set_baseline(state_machine.last_observed_count)
        db.log_event(
            "baseline_set",
            {
                "baseline_count": state_machine.baseline_count,
                "observed_count": state_machine.last_observed_count,
            },
        )
        await ws.send_json({"type": "ack", "command": cmd, "ok": True})
    elif cmd == "arm":
        state_machine.arm()
        await ws.send_json({"type": "ack", "command": cmd, "ok": True})
    elif cmd == "disarm":
        state_machine.disarm()
        await ws.send_json({"type": "ack", "command": cmd, "ok": True})
    elif cmd == "reset":
        state_machine.reset()
        db.log_event("reset", {})
        await ws.send_json({"type": "ack", "command": cmd, "ok": True})
    elif cmd == "ping":
        await ws.send_json({"type": "pong", "timestamp_ms": int(time.time() * 1000)})
    else:
        await ws.send_json({"type": "error", "message": f"Unknown command: {cmd}"})


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    global _frame_counter, _history
    await ws.accept()

    # Send config immediately so phone knows what object is being tracked
    await ws.send_json({
        "type": "config",
        "tracked_class": settings.chair_class_name,
        "gemma_ready": gemma_agent.is_ready,
    })

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "frame":
                timestamp_ms = int(data.get("timestamp_ms") or int(time.time() * 1000))
                jpeg_b64 = data.get("jpeg_b64")
                if not jpeg_b64:
                    await ws.send_json({"type": "error", "message": "Missing jpeg_b64"})
                    continue

                try:
                    frame = _decode_b64_jpeg(jpeg_b64)
                    frame = _resize_for_model(frame)
                except Exception as ex:
                    await ws.send_json({"type": "error", "message": f"Bad frame payload: {ex}"})
                    continue

                state_machine.on_stream_started()
                vision = chair_counter.count_chairs(frame)
                evaluation = state_machine.evaluate(vision.chair_count)

                # Maintain rolling history for Gemma context
                _history.append(vision.chair_count)
                if len(_history) > 20:
                    _history = _history[-20:]

                await _send_status(ws, average_conf=vision.average_conf, timestamp_ms=timestamp_ms)

                # Gemma reasoning every N frames (async, non-blocking)
                _frame_counter += 1
                if (
                    settings.gemma_enabled
                    and gemma_agent.is_ready
                    and evaluation.baseline_count is not None
                    and evaluation.discrepancy_streak > 0
                    and _frame_counter % settings.gemma_every_n_frames == 0
                ):
                    def _on_gemma_decision(decision, ws=ws, evaluation=evaluation):
                        import asyncio
                        payload = {
                            "type": "gemma_decision",
                            "action": decision.action,
                            "raw_output": decision.raw_output,
                        }
                        if decision.action == "trigger_alert":
                            payload["severity"] = decision.severity
                            payload["message"] = decision.message
                            db.log_event("gemma_alert", {
                                "action": decision.action,
                                "severity": decision.severity,
                                "message": decision.message,
                                "raw_output": decision.raw_output,
                                "streak": evaluation.discrepancy_streak,
                            })
                        elif decision.action == "rebaseline":
                            payload["new_count"] = decision.new_count
                            db.log_event("gemma_rebaseline", {
                                "new_count": decision.new_count,
                                "raw_output": decision.raw_output,
                            })
                        elif decision.action == "ignore_event":
                            payload["reason"] = decision.reason
                            db.log_event("gemma_ignore", {
                                "reason": decision.reason,
                                "raw_output": decision.raw_output,
                            })
                        try:
                            loop = asyncio.get_event_loop()
                            loop.call_soon_threadsafe(
                                lambda: asyncio.ensure_future(ws.send_json(payload))
                            )
                        except Exception:
                            pass

                    gemma_agent.decide_async(
                        item_count=vision.chair_count,
                        baseline_count=evaluation.baseline_count,
                        streak=evaluation.discrepancy_streak,
                        avg_conf=vision.average_conf,
                        history=list(_history),
                        callback=_on_gemma_decision,
                    )

                # Log observation sampled every N frames
                if _frame_counter % _OBS_SAMPLE_EVERY == 0:
                    db.log_observation(
                        state=str(evaluation.state),
                        item_count=vision.chair_count,
                        baseline_count=evaluation.baseline_count,
                        diff=evaluation.diff,
                        avg_conf=vision.average_conf,
                        streak=evaluation.discrepancy_streak,
                    )

                if evaluation.should_alert and evaluation.baseline_count is not None:
                    alert_text = agent.generate_alert_text(
                        baseline_count=evaluation.baseline_count,
                        observed_count=evaluation.observed_count or 0,
                        diff=evaluation.diff,
                    )
                    event_payload = {
                        "baseline_count": evaluation.baseline_count,
                        "observed_count": evaluation.observed_count,
                        "diff": evaluation.diff,
                        "message": alert_text,
                    }
                    db.log_event("alert", event_payload)
                    await ws.send_json({"type": "alert", **event_payload})

            elif msg_type == "command":
                await _handle_command(ws, data)
            else:
                await ws.send_json({"type": "error", "message": f"Unknown type: {msg_type}"})

    except WebSocketDisconnect:
        return
