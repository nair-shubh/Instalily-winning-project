# Instalily-winning-project — Staging Inventory V1 (Offline, LAN-Only)

V1 demo target:
- Baseline with 5 chairs in frame.
- Remove 1 chair.
- System detects 4 and sends alert text to phone.
- Phone speaks: "Mr. Richard, one chair was removed."

## Requirements

- Python 3.10+
- macOS (tested on Apple Silicon)
- Phone and laptop on the same network (phone hotspot recommended)

## Quickstart

```bash
git clone https://github.com/nair-shubh/Instalily-winning-project.git
cd Instalily-winning-project
bash scripts/run_server.sh
```

The script handles everything automatically:
- Creates a Python virtual environment
- Installs all dependencies
- Downloads the YOLOv8n model
- Generates a self-signed TLS certificate (once, reused on future runs)
- Prints the URL to open on your phone
- Starts the HTTPS server on port 8000

## Connecting your phone

> ✅ **Verified working setup:** laptop connected to phone's Personal Hotspot.
> Public WiFi and corporate networks often block device-to-device traffic — use the hotspot.

**Step-by-step:**

1. On your phone → Settings → Personal Hotspot → **turn ON**
2. On your laptop → WiFi → select **your phone's hotspot name** → connect
3. Run `bash scripts/run_server.sh` — it prints the exact URL, e.g.:
   ```
   https://10.x.x.x:8000
   ```
4. Open that URL in **Chrome** on your phone
5. Chrome shows a security warning → tap **Advanced → Proceed to ... (unsafe)** (one-time only, self-signed cert)
6. Tap **Connect** → allow camera when prompted
7. You're in

**Important:** the laptop's IP can change if you disconnect and reconnect to the hotspot. If the URL stops working, just re-run `scripts/run_server.sh` — it always prints the current correct URL.

## Phone workflow

1. Tap **Connect** — allow camera permission when prompted
2. Tap **Start Stream** — camera activates, chair count appears
3. Point at the scene, wait for count to stabilize
4. Tap **Set Baseline** — locks in current count as reference
5. Tap **Arm** — system is now watching
6. Remove or add a chair — after 5 consecutive discrepant frames, the phone speaks the alert

## What this build includes

- FastAPI server + WebSocket endpoint at `/ws`
- YOLO chair counting via `ultralytics` (COCO `chair`, `conf >= 0.35`)
- State machine: `IDLE → STREAMING → BASELINED → ARMED → COOLDOWN`
- Debounce: K consecutive discrepant frames before alert (default `K=5`)
- Cooldown: suppress repeat alerts for T seconds (default `T=10`)
- Agent text generation via local Ollama (falls back to deterministic templates if unavailable)
- SQLite event logging (`inventory_events.db`)
- Phone web app with Web Speech API TTS, visual banner fallback, vibration fallback
- HTTPS with auto-generated self-signed cert (camera requires HTTPS on mobile browsers)

## Project structure

```
Instalily-winning-project/
  README.md
  requirements.txt
  server/
    main.py        # FastAPI app, WebSocket handler
    vision.py      # YOLO chair detection
    agent.py       # Alert text generation (Ollama + fallback)
    state.py       # State machine
    db.py          # SQLite event logging
    settings.py    # Config via env vars
    static/
      phone.html / phone.js / phone.css      # Mobile UI
      dashboard.html / dashboard.js / dashboard.css  # Desktop dashboard
  scripts/
    run_server.sh  # One-command setup and start
  models/
    yolov8n.pt     # Downloaded automatically on first run
  certs/           # Auto-generated, gitignored
```

## Optional: Ollama for richer alert messages

Without Ollama the system uses deterministic fallback templates (fully functional).
To enable AI-generated messages:

```bash
# Install Ollama from https://ollama.com
ollama pull gemma2:2b
```

The server auto-detects Ollama on `http://localhost:11434` and falls back gracefully if unavailable.

## Config (environment variables)

| Variable | Default | Description |
|---|---|---|
| `YOLO_MODEL` | `./models/yolov8n.pt` | Path to YOLO weights |
| `CONF_THRESHOLD` | `0.35` | Detection confidence threshold |
| `DEBOUNCE_K` | `5` | Frames before alert fires |
| `COOLDOWN_SEC` | `10` | Seconds between alerts |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `gemma2:2b` | Ollama model name |
| `SQLITE_PATH` | `./inventory_events.db` | Event log path |

Override any setting by passing it before the script:

```bash
CONF_THRESHOLD=0.2 DEBOUNCE_K=3 bash scripts/run_server.sh
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Camera black / unavailable | Must use HTTPS — script handles this automatically |
| Phone can't reach server | Make sure laptop is on phone hotspot, not public WiFi |
| IP changed after reconnect | Re-run `scripts/run_server.sh` — it prints the current URL |
| Low chair detection accuracy | Lower `CONF_THRESHOLD` to `0.2`, ensure good lighting |
| Cert warning on phone | Tap Advanced → Proceed (one-time, self-signed cert) |
