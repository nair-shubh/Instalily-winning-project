const video = document.getElementById("video");
const canvas = document.getElementById("captureCanvas");
const ctx = canvas.getContext("2d");
const alertBanner = document.getElementById("alertBanner");

const stateEl = document.getElementById("state");
const chairCountEl = document.getElementById("chairCount");
const baselineCountEl = document.getElementById("baselineCount");
const diffEl = document.getElementById("diff");

const connectBtn = document.getElementById("connectBtn");
const startBtn = document.getElementById("startBtn");
const baselineBtn = document.getElementById("baselineBtn");
const resetBtn = document.getElementById("resetBtn");

let ws = null;
let stream = null;
let frameTimer = null;
const fps = 3;

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

function setNetwork(text, ok) {
  // Network indicator was intentionally removed from the compact V1 UI.
  void text;
  void ok;
}

function showBanner(msg) {
  alertBanner.textContent = msg;
  alertBanner.classList.remove("hidden");
}

function speakOrFallback(msg) {
  showBanner(msg);
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
}

async function initCamera() {
  if (stream) return;
  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "environment" },
    audio: false,
  });
  video.srcObject = stream;
}

function connectWS() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  ws = new WebSocket(wsUrl());

  ws.onopen = () => setNetwork("Connected", true);
  ws.onclose = () => setNetwork("Disconnected", false);
  ws.onerror = () => setNetwork("Error", false);
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "status") {
      stateEl.textContent = msg.state;
      chairCountEl.textContent = msg.chair_count ?? "-";
      baselineCountEl.textContent = msg.baseline_count ?? "-";
      diffEl.textContent = msg.diff;
    } else if (msg.type === "alert") {
      speakOrFallback(msg.message);
    } else if (msg.type === "error") {
      showBanner(`Error: ${msg.message}`);
    }
  };
}

function sendCommand(command) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "command", command }));
}

function sendFrame() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!video.videoWidth || !video.videoHeight) return;

  const targetW = 640;
  const targetH = 360;
  canvas.width = targetW;
  canvas.height = targetH;
  ctx.drawImage(video, 0, 0, targetW, targetH);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
  const jpegB64 = dataUrl.split(",")[1];
  ws.send(
    JSON.stringify({
      type: "frame",
      timestamp_ms: Date.now(),
      jpeg_b64: jpegB64,
      meta: { w: targetW, h: targetH },
    })
  );
}

function startStreaming() {
  if (frameTimer) return;
  frameTimer = setInterval(sendFrame, 1000 / fps);
  startBtn.textContent = "Stop Stream";
}

function stopStreaming() {
  if (!frameTimer) return;
  clearInterval(frameTimer);
  frameTimer = null;
  startBtn.textContent = "Start Stream";
}

connectBtn.addEventListener("click", async () => {
  connectWS();
  try {
    await initCamera();
  } catch (err) {
    showBanner(`Camera unavailable: ${err.message}. Connect still attempted.`);
  }
});
startBtn.addEventListener("click", () => {
  if (frameTimer) {
    stopStreaming();
    sendCommand("reset");
    return;
  }
  startStreaming();
});
baselineBtn.addEventListener("click", () => {
  sendCommand("set_baseline");
  sendCommand("arm");
});
resetBtn.addEventListener("click", () => {
  stopStreaming();
  sendCommand("reset");
});
