# Instalily-winning-project — Staging Inventory V1 (Offline, LAN-Only)

V1 demo target:
- Baseline with 5 chairs in frame.
- Remove 1 chair.
- System detects 4 and sends alert text to phone.
- Phone speaks: "Mr. Richard, one chair was removed."

## What this build includes
- FastAPI server + WebSocket endpoint at `/ws`
- YOLO chair counting via `ultralytics` (COCO `chair`, `conf >= 0.35`)
- State machine: `IDLE -> STREAMING -> BASELINED -> ARMED -> COOLDOWN`
- Debounce: K consecutive discrepant frames (default `K=5`)
- Cooldown: suppress new alerts for T seconds (default `T=10`)
- Agent text generation:
  - Primary: local Ollama at `http://localhost:11434`
  - Fallback: deterministic templates (exact phrases required)
- SQLite event logging (`inventory_events.db`)
- Phone web app with local Web Speech API TTS, visual banner fallback, optional vibration fallback

## Project structure
```
staging-inventory-v1/
  README.md
  requirements.txt
  server/
    main.py
    vision.py
    agent.py
    state.py
    db.py
    settings.py
    static/
      phone.html
      phone.js
      phone.css
      dashboard.html
      dashboard.js
      dashboard.css
  scripts/
    run_server.sh
```

## Offline/LAN setup
1. Connect phone and laptop to same private Wi-Fi/hotspot (no internet needed).
2. Place a local YOLO weight file at `staging-inventory-v1/models/yolov8n.pt` (or set `YOLO_MODEL` to another local path).
3. On laptop:
```bash
cd staging-inventory-v1
./scripts/run_server.sh
```
4. Open phone browser to:
- `http://<LAPTOP_LAN_IP>:8000/`

## Phone workflow
1. Tap `Connect` (camera permission required).
2. Tap `Start Stream`.
3. Place scene with chairs and wait for stable count.
4. Tap `Set Baseline`.
5. Tap `Arm`.
6. Remove/add chairs; alert triggers after debounce and is spoken on phone.

## WebSocket protocol
### Phone -> Laptop
- `frame`
```json
{
  "type": "frame",
  "timestamp_ms": 1730000000000,
  "jpeg_b64": "<base64 jpeg>",
  "meta": {"w": 640, "h": 360}
}
```
- `command`
```json
{"type":"command","command":"set_baseline|arm|disarm|reset|ping"}
```

### Laptop -> Phone
- `status`
```json
{
  "type": "status",
  "state": "ARMED",
  "chair_count": 4,
  "baseline_count": 5,
  "diff": -1,
  "discrepancy_streak": 5,
  "cooldown_remaining_sec": 9.8,
  "average_conf": 0.74,
  "k": 5,
  "t_sec": 10
}
```
- `alert`
```json
{
  "type": "alert",
  "baseline_count": 5,
  "observed_count": 4,
  "diff": -1,
  "message": "Mr. Richard, one chair was removed."
}
```

## Config (env vars)
- `YOLO_MODEL` (default `./models/yolov8n.pt`, local file path)
- `CONF_THRESHOLD` (default `0.35`)
- `DEBOUNCE_K` (default `5`)
- `COOLDOWN_SEC` (default `10`)
- `OLLAMA_BASE_URL` (default `http://localhost:11434`)
- `OLLAMA_MODEL` (default `gemma2:2b`)
- `SQLITE_PATH` (default `./inventory_events.db`)

## Notes
- No external APIs are used.
- If Ollama/model fails, exact deterministic templates are used.
- If browser TTS is unavailable, large on-screen alert is shown; vibration used when supported.
