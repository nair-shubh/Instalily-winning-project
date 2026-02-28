const video = document.getElementById("video");
const canvas = document.getElementById("captureCanvas");
const ctx = canvas.getContext("2d");
const alertBanner = document.getElementById("alertBanner");

const stateEl = document.getElementById("state");
const itemCountEl = document.getElementById("itemCount");
const itemLabelEl = document.getElementById("itemLabel");
const baselineCountEl = document.getElementById("baselineCount");
const diffEl = document.getElementById("diff");
const avgConfEl = document.getElementById("avgConf");
const streakEl = document.getElementById("streak");
const cooldownEl = document.getElementById("cooldown");
const networkEl = document.getElementById("network");

const startBtn = document.getElementById("startBtn");
const baselineBtn = document.getElementById("baselineBtn");
const armBtn = document.getElementById("armBtn");
const resetBtn = document.getElementById("resetBtn");
const advancedToggle = document.getElementById("advancedToggle");
const advancedControls = document.getElementById("advancedControls");
const connectBtn = document.getElementById("connectBtn");
const stopBtn = document.getElementById("stopBtn");
const disarmBtn = document.getElementById("disarmBtn");

let ws = null;
let stream = null;
let frameTimer = null;
let wakeLock = null;
let trackedClass = "Items";
const fps = 3;
let frameCount = 0;

// ── Wake Lock ──────────────────────────────────────────────────────────────────
async function requestWakeLock() {
  if ("wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch (_) {}
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && frameTimer) requestWakeLock();
});

// ── Network status ─────────────────────────────────────────────────────────────
function setNetwork(text, ok) {
  networkEl.textContent = text;
  networkEl.className = ok ? "good" : "bad";
}

// ── Alert banner ───────────────────────────────────────────────────────────────
function showBanner(msg, isAlert = false) {
  alertBanner.textContent = msg;
  alertBanner.className = isAlert ? "alert alert-active" : "alert";
  alertBanner.classList.remove("hidden");
}

function hideBanner() {
  alertBanner.classList.add("hidden");
}

function speakOrFallback(msg) {
  showBanner(msg, true);
  const synth = window.speechSynthesis;
  if (synth && typeof SpeechSynthesisUtterance !== "undefined") {
    const utter = new SpeechSynthesisUtterance(msg);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    synth.cancel();
    synth.speak(utter);
  } else if (navigator.vibrate) {
    navigator.vibrate([250, 100, 250]);
  }
  setTimeout(hideBanner, 8000);
}

// ── Camera ─────────────────────────────────────────────────────────────────────
async function initCamera() {
  if (stream) return;
  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "environment" },
    audio: false,
  });
  video.srcObject = stream;
}

// ── WebSocket ──────────────────────────────────────────────────────────────────
function connectWS() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onopen = () => setNetwork("Connected", true);
  ws.onclose = () => {
    setNetwork("Disconnected", false);
    setTimeout(connectWS, 2000);
  };
  ws.onerror = () => setNetwork("Error", false);
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "status") {
      const state = msg.state;
      stateEl.textContent = state;
      stateEl.className = `state-${state.toLowerCase()}`;
      itemCountEl.textContent = msg.item_count ?? msg.chair_count ?? "-";
      baselineCountEl.textContent = msg.baseline_count ?? "-";
      diffEl.textContent = msg.diff ?? 0;
      avgConfEl.textContent = Number(msg.average_conf || 0).toFixed(3);
      streakEl.textContent = `${msg.discrepancy_streak}/${msg.k}`;
      cooldownEl.textContent = `${Number(msg.cooldown_remaining_sec || 0).toFixed(1)}s`;
      if (state === "ARMED") {
        document.body.classList.add("armed");
      } else {
        document.body.classList.remove("armed");
      }
    } else if (msg.type === "alert") {
      speakOrFallback(msg.message);
    } else if (msg.type === "config") {
      trackedClass = msg.tracked_class || "Items";
      if (itemLabelEl) itemLabelEl.textContent = trackedClass;
    } else if (msg.type === "error") {
      showBanner(`Error: ${msg.message}`);
    }
  };
}

// ── Streaming ──────────────────────────────────────────────────────────────────
function sendCommand(command) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "command", command }));
}

function sendFrame() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!video.videoWidth || !video.videoHeight) return;
  canvas.width = 640;
  canvas.height = 360;
  ctx.drawImage(video, 0, 0, 640, 360);
  const jpegB64 = canvas.toDataURL("image/jpeg", 0.65).split(",")[1];
  ws.send(JSON.stringify({
    type: "frame",
    timestamp_ms: Date.now(),
    jpeg_b64: jpegB64,
    meta: { w: 640, h: 360 },
  }));
}

function startStreaming() {
  if (frameTimer) return;
  frameTimer = setInterval(sendFrame, 1000 / fps);
  requestWakeLock();
  startBtn.textContent = "Streaming...";
  startBtn.disabled = true;
}

function stopStreaming() {
  if (!frameTimer) return;
  clearInterval(frameTimer);
  frameTimer = null;
  startBtn.textContent = "Start Stream";
  startBtn.disabled = false;
}

// ── Auto-init on page load ─────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  connectWS();
  try {
    await initCamera();
  } catch (err) {
    showBanner(`Camera: ${err.message} — tap Connect to retry`);
  }
});

// ── Button bindings ────────────────────────────────────────────────────────────
startBtn.addEventListener("click", startStreaming);
baselineBtn.addEventListener("click", () => { sendCommand("set_baseline"); hideBanner(); });
armBtn.addEventListener("click", () => sendCommand("arm"));
resetBtn.addEventListener("click", () => { sendCommand("reset"); stopStreaming(); hideBanner(); });

advancedToggle.addEventListener("click", () => {
  const hidden = advancedControls.classList.toggle("hidden");
  advancedToggle.textContent = hidden ? "Advanced ▾" : "Advanced ▴";
});

connectBtn.addEventListener("click", async () => {
  connectWS();
  try { await initCamera(); } catch (err) { showBanner(`Camera: ${err.message}`); }
});
stopBtn.addEventListener("click", stopStreaming);
disarmBtn.addEventListener("click", () => sendCommand("disarm"));
