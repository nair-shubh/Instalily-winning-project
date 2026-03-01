const wsStatusEl = document.getElementById("wsStatus");
const stateEl = document.getElementById("state");
const observedEl = document.getElementById("observed");
const baselineEl = document.getElementById("baseline");
const diffEl = document.getElementById("diff");
const detectionsEl = document.getElementById("detections");
const lastUpdateEl = document.getElementById("lastUpdate");
const snapshotEl = document.getElementById("snapshot");
const alertsEl = document.getElementById("alerts");
const timelineEl = document.getElementById("timeline");

let dashboardWs = null;

function wsUrl(path) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}${path}`;
}

function setWsStatus(connected) {
  wsStatusEl.textContent = connected ? "Live" : "Disconnected";
  wsStatusEl.className = `pill ${connected ? "good" : "bad"}`;
}

function tsLabel(ts) {
  return new Date(ts).toLocaleTimeString();
}

function pushFeed(container, text) {
  const li = document.createElement("li");
  li.textContent = text;
  container.prepend(li);
  while (container.children.length > 20) {
    container.removeChild(container.lastChild);
  }
}

function updateActivity(msg) {
  stateEl.textContent = msg.state ?? "-";
  observedEl.textContent = msg.observed_count ?? "-";
  baselineEl.textContent = msg.baseline_count ?? "-";
  diffEl.textContent = msg.diff ?? 0;
  detectionsEl.textContent = msg.detections_count ?? 0;
  lastUpdateEl.textContent = tsLabel(msg.timestamp_ms ?? Date.now());
  snapshotEl.textContent = JSON.stringify(msg, null, 2);
}

function connectDashboard() {
  if (dashboardWs && (dashboardWs.readyState === WebSocket.OPEN || dashboardWs.readyState === WebSocket.CONNECTING)) {
    return;
  }
  dashboardWs = new WebSocket(wsUrl("/ws/dashboard"));
  dashboardWs.onopen = () => {
    setWsStatus(true);
  };
  dashboardWs.onclose = () => {
    setWsStatus(false);
    setTimeout(connectDashboard, 1200);
  };
  dashboardWs.onerror = () => {
    setWsStatus(false);
  };
  dashboardWs.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.type === "activity") {
      updateActivity(msg);
    } else if (msg.type === "alert") {
      const label = `${tsLabel(msg.timestamp_ms)} ALERT: ${msg.message} (diff ${msg.diff})`;
      pushFeed(alertsEl, label);
      pushFeed(timelineEl, label);
    } else if (msg.type === "event") {
      const label = `${tsLabel(msg.timestamp_ms)} EVENT: ${msg.event}`;
      pushFeed(timelineEl, label);
    }
  };
}

async function bootstrapFromApis() {
  const [healthRes, eventsRes] = await Promise.all([
    fetch("/api/health"),
    fetch("/api/events?limit=10"),
  ]);
  const health = await healthRes.json();
  const events = await eventsRes.json();
  updateActivity({
    type: "activity",
    timestamp_ms: Date.now(),
    state: health.state,
    observed_count: health.last_observed,
    baseline_count: health.baseline,
    diff: (health.last_observed ?? 0) - (health.baseline ?? 0),
    detections_count: 0,
  });
  (events.events || []).forEach((ev) => {
    const label = `${new Date(ev.ts_utc).toLocaleTimeString()} ${ev.event_type}`;
    pushFeed(timelineEl, label);
    if (ev.event_type === "alert") {
      pushFeed(alertsEl, `${new Date(ev.ts_utc).toLocaleTimeString()} ${ev.payload.message}`);
    }
  });
}

bootstrapFromApis().catch(() => {});
connectDashboard();
