const healthEl = document.getElementById("health");
const eventsEl = document.getElementById("events");

async function refresh() {
  const [healthRes, eventsRes] = await Promise.all([
    fetch("/api/health"),
    fetch("/api/events?limit=30"),
  ]);
  const health = await healthRes.json();
  const events = await eventsRes.json();
  healthEl.textContent = JSON.stringify(health, null, 2);
  eventsEl.textContent = JSON.stringify(events, null, 2);
}

setInterval(refresh, 1500);
refresh();
