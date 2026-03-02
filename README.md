# EdgeDetect

Every team will eventually want to own their own small intelligence — something that understands their context, their space, their world. EdgeDetect is our attempt at building exactly that.

It's a real-time monitoring system that runs entirely on your local network. Point a camera at a physical space, tell it what "normal" looks like, and it'll let you know the moment something changes. No cloud. No external connections. No data leaving your network.

We built this at the [Google DeepMind × InstaLILY AI SF Hackathon](https://instalily.ai). Inventory tracking was the first use case, but the deeper idea is situational awareness without reliance on central processing — intelligence that lives with you, not somewhere else.

---

## How it works

Your phone acts as both the camera and the speaker. It streams video frames over WebSocket to a server running on your laptop. The server runs YOLOv8 on each frame, counts the objects, and tracks whether the count has drifted from your baseline.

If something changes — say a chair goes missing — the system waits a few frames to make sure it's real, then sends an alert back to your phone. Your phone speaks it out loud.

The whole loop stays on your LAN:

```
Phone (camera + alerts)  ⇄  WebSocket  ⇄  Local server (YOLO + state machine)
```

There's also an optional Ollama integration for generating more natural alert messages, but the system works fine without it using simple templates.

---

## Demo

Our V1 demo at the hackathon:

- 5 chairs in frame, baseline set
- Remove 1 chair
- System detects 4, fires an alert
- Phone speaks: *"Mr. Richard, one chair was removed."*

<!-- Drop a demo GIF here if you have one: -->
<!-- ![EdgeDetect Demo](demo.gif) -->

---

## Quickstart

```bash
git clone https://github.com/nair-shubh/Instalily-winning-project.git
cd Instalily-winning-project
bash scripts/run_server.sh
```

That one script does everything — sets up a virtual environment, installs dependencies, downloads YOLOv8n, generates a self-signed TLS cert, and starts the server on port 8000. It prints the URL you need to open on your phone.

### Requirements

- Python 3.10+
- macOS (tested on Apple Silicon)
- Phone and laptop on the same network (phone hotspot recommended)

---

## Connecting your phone

Use your phone's Personal Hotspot. Public WiFi and corporate networks tend to block device-to-device traffic, so hotspot is the way to go.

1. Turn on Personal Hotspot on your phone
2. Connect your laptop to it
3. Run `bash scripts/run_server.sh` — it prints the URL, something like `https://10.x.x.x:8000`
4. Open that URL in Chrome on your phone
5. You'll get a security warning (self-signed cert) — tap **Advanced → Proceed** once
6. Tap **Connect**, allow camera access, and you're in

If the URL stops working after a reconnect, just re-run the script. The IP can change.

---

## Using it

1. **Connect** — allow camera permission
2. **Start Stream** — camera activates, object count shows up
3. Point at the scene and let the count stabilize
4. **Set Baseline** — locks in the current count
5. **Arm** — the system is now watching
6. Move something — after a few consecutive frames where the count doesn't match, your phone speaks the alert

---

## What's under the hood

| Layer | What it does |
| --- | --- |
| Server | FastAPI with a WebSocket endpoint at `/ws` |
| Vision | YOLOv8n via `ultralytics` — COCO object classes, confidence threshold at 0.35 |
| State machine | `IDLE → STREAMING → BASELINED → ARMED → COOLDOWN` |
| Alerts | Ollama (Gemma 2B) for natural language, with deterministic template fallback |
| Logging | SQLite for event history |
| Phone client | Vanilla HTML/JS/CSS, Web Speech API for TTS, vibration and visual fallbacks |
| Transport | HTTPS with auto-generated self-signed cert (mobile browsers require HTTPS for camera) |

---

## Project structure

```
EdgeDetect/
├── server/
│   ├── main.py          # FastAPI app, WebSocket handler
│   ├── vision.py        # YOLO object detection
│   ├── agent.py         # Alert text generation (Ollama + fallback)
│   ├── state.py         # State machine
│   ├── db.py            # SQLite event logging
│   ├── settings.py      # Config via env vars
│   └── static/
│       ├── phone.html / phone.js / phone.css
│       └── dashboard.html / dashboard.js / dashboard.css
├── scripts/
│   └── run_server.sh    # One-command setup and start
├── models/
│   └── yolov8n.pt       # Downloaded on first run
├── finetune/
├── frontend/
├── certs/               # Auto-generated, gitignored
├── requirements.txt
└── README.md
```

---

## Config

Everything is configurable through environment variables:

| Variable | Default | What it controls |
| --- | --- | --- |
| `YOLO_MODEL` | `./models/yolov8n.pt` | Path to YOLO weights |
| `CONF_THRESHOLD` | `0.35` | Detection confidence |
| `DEBOUNCE_K` | `5` | Frames before an alert fires |
| `COOLDOWN_SEC` | `10` | Seconds between repeat alerts |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `gemma2:2b` | Which Ollama model to use |
| `SQLITE_PATH` | `./inventory_events.db` | Where events get logged |

Override anything inline:

```bash
CONF_THRESHOLD=0.2 DEBOUNCE_K=3 bash scripts/run_server.sh
```

---

## Ollama (optional)

The system works perfectly fine without Ollama — it just uses simple templates for alerts. If you want more natural-sounding messages:

```bash
# Install from https://ollama.com
ollama pull gemma2:2b
```

The server checks for Ollama on startup and falls back gracefully if it's not there.

---

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Camera black / not working | Needs HTTPS — the script handles this, but make sure you're using the generated URL |
| Phone can't reach server | You're probably on public WiFi. Switch to phone hotspot |
| URL stopped working | IP changed — re-run `scripts/run_server.sh` |
| Low detection accuracy | Try lowering `CONF_THRESHOLD` to 0.2 and improve lighting |
| Cert warning on phone | Tap Advanced → Proceed. One-time thing |

---

## Built by

- [Shubham Nair](https://github.com/nair-shubh)
- [Ayebare R](https://github.com/Ayebare-R)

Built at the Google DeepMind × InstaLILY AI SF Hackathon.

---
