"use client";

import Link from "next/link";
import { useDashboardWs, SystemState, AlertMsg, EventMsg, GemmaMsg } from "@/lib/useDashboardWs";
import { useEffect, useState } from "react";

// ── State badge colours ───────────────────────────────────────────────────────
const STATE_STYLES: Record<SystemState | string, string> = {
  IDLE:       "bg-slate-100 text-slate-600 ring-slate-200",
  STREAMING:  "bg-blue-100 text-blue-700 ring-blue-200",
  BASELINED:  "bg-violet-100 text-violet-700 ring-violet-200",
  ARMED:      "bg-brand-100 text-brand-700 ring-brand-200",
  COOLDOWN:   "bg-amber-100 text-amber-700 ring-amber-200",
};

const STATE_DOT: Record<SystemState | string, string> = {
  IDLE:       "bg-slate-400",
  STREAMING:  "bg-blue-500",
  BASELINED:  "bg-violet-500",
  ARMED:      "bg-brand-500 animate-pulse",
  COOLDOWN:   "bg-amber-500 animate-pulse",
};

function StateBadge({ state }: { state: string }) {
  const cls = STATE_STYLES[state] ?? STATE_STYLES.IDLE;
  const dot = STATE_DOT[state] ?? STATE_DOT.IDLE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {state}
    </span>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${accent ? "border-brand-200 bg-brand-50" : "border-slate-100 bg-white"}`}>
      <div className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`text-3xl font-extrabold tabular-nums ${accent ? "text-brand-700" : "text-slate-900"}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

// ── Diff chip ─────────────────────────────────────────────────────────────────
function DiffChip({ diff }: { diff: number }) {
  if (diff === 0) return <span className="text-3xl font-extrabold text-slate-400">±0</span>;
  const pos = diff > 0;
  return (
    <span className={`text-3xl font-extrabold tabular-nums ${pos ? "text-amber-600" : "text-red-600"}`}>
      {pos ? "+" : ""}{diff}
    </span>
  );
}

// ── Alert row ─────────────────────────────────────────────────────────────────
function AlertRow({ alert }: { alert: AlertMsg }) {
  const d = diff => diff < 0 ? "removed" : "added";
  const bg = alert.diff < 0 ? "border-red-100 bg-red-50" : "border-amber-100 bg-amber-50";
  const text = alert.diff < 0 ? "text-red-700" : "text-amber-700";
  return (
    <div className={`rounded-xl border px-4 py-3 ${bg}`}>
      <div className={`text-sm font-medium ${text}`}>{alert.message}</div>
      <div className="mt-1 flex gap-3 text-xs text-slate-400">
        <span>{new Date(alert.timestamp_ms).toLocaleTimeString()}</span>
        <span>Diff: {alert.diff > 0 ? "+" : ""}{alert.diff}</span>
        <span>{alert.baseline_count} → {alert.observed_count}</span>
      </div>
    </div>
  );
}

// ── Event row ─────────────────────────────────────────────────────────────────
const EVENT_ICONS: Record<string, string> = {
  baseline_set: "🎯",
  arm:          "🔒",
  disarm:       "🔓",
  reset:        "↩️",
  alert:        "🚨",
  gemma_alert:  "🤖",
  gemma_ignore: "🤫",
  gemma_rebaseline: "📐",
};

function EventRow({ ev }: { ev: EventMsg }) {
  const icon = EVENT_ICONS[ev.event] ?? "•";
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      <span className="shrink-0 text-base">{icon}</span>
      <div>
        <div className="text-sm font-medium text-slate-700 capitalize">{ev.event.replace(/_/g, " ")}</div>
        <div className="text-xs text-slate-400">{new Date(ev.timestamp_ms).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

// ── Gemma decision row ────────────────────────────────────────────────────────
const GEMMA_STYLES = {
  trigger_alert: "border-red-100 bg-red-50 text-red-800",
  ignore_event:  "border-slate-100 bg-slate-50 text-slate-600",
  rebaseline:    "border-violet-100 bg-violet-50 text-violet-800",
};
const GEMMA_LABELS = {
  trigger_alert: "🚨 Alert",
  ignore_event:  "🤫 Ignored",
  rebaseline:    "📐 Rebaseline",
};

function GemmaRow({ d }: { d: GemmaMsg }) {
  const cls = GEMMA_STYLES[d.action] ?? GEMMA_STYLES.ignore_event;
  const label = GEMMA_LABELS[d.action] ?? d.action;
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{label}</span>
        {d.severity && (
          <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-medium text-red-800">
            {d.severity}
          </span>
        )}
      </div>
      {d.message && <div className="mt-1 text-sm">{d.message}</div>}
      {d.reason && <div className="mt-1 text-sm opacity-80">{d.reason}</div>}
      {d.new_count !== undefined && (
        <div className="mt-1 text-sm">New baseline: {d.new_count}</div>
      )}
    </div>
  );
}

// ── Uptime clock ──────────────────────────────────────────────────────────────
function UptimeClock() {
  const [t, setT] = useState<string>("00:00:00");
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      const h = String(Math.floor(s / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const sec = String(s % 60).padStart(2, "0");
      setT(`${h}:${m}:${sec}`);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-xs text-slate-400">{t}</span>;
}

// ── Confidence bar ─────────────────────────────────────────────────────────────
function ConfBar({ conf }: { conf: number }) {
  const pct = Math.round(conf * 100);
  const color = pct > 70 ? "bg-brand-500" : pct > 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2">
        <div className={`h-2 rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right font-mono text-sm text-slate-600">{pct}%</span>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
export default function DashboardClient() {
  const { connected, activity, alerts, events, gemmaDecisions } = useDashboardWs();

  const state      = activity?.state ?? "IDLE";
  const observed   = activity?.observed_count ?? null;
  const baseline   = activity?.baseline_count ?? null;
  const diff       = activity?.diff ?? 0;
  const conf       = activity?.average_conf ?? 0;
  const streak     = activity?.discrepancy_streak ?? 0;
  const k          = 5;
  const cooldown   = activity?.cooldown_remaining_sec ?? 0;
  const alertsToday = alerts.filter(
    (a) => new Date(a.timestamp_ms).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-600 text-white text-xs font-bold">
                TJ
              </span>
              <span className="text-sm font-semibold text-white">TopJourney</span>
            </Link>
            <span className="hidden text-slate-600 sm:block">/</span>
            <span className="hidden text-sm text-slate-400 sm:block">Live Dashboard</span>
          </div>

          <div className="flex items-center gap-4">
            <UptimeClock />
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
              connected
                ? "bg-brand-500/10 text-brand-400 ring-brand-500/30"
                : "bg-red-500/10 text-red-400 ring-red-500/30"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-brand-400 animate-pulse" : "bg-red-400"}`} />
              {connected ? "Live" : "Connecting…"}
            </div>
            <a
              href={`${typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:8000/phone` : "/phone"}`}
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-500 hover:text-white transition-colors sm:block"
            >
              Phone App ↗
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* ── KPI row ── */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-2 text-xs font-medium uppercase tracking-widest text-slate-400">System State</div>
            <div className="mt-1"><StateBadge state={state} /></div>
          </div>
          <KpiCard
            label="Items Detected"
            value={observed ?? "—"}
            sub={`baseline ${baseline ?? "—"}`}
            accent={state === "ARMED"}
          />
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-400">vs Baseline</div>
            <DiffChip diff={diff} />
          </div>
          <KpiCard
            label="Alerts Today"
            value={alertsToday}
            sub={alertsToday === 1 ? "1 event" : `${alertsToday} events`}
          />
        </div>

        {/* ── Middle row ── */}
        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          {/* Detection quality */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-5 font-semibold text-slate-900">Detection Quality</h2>
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                  <span>Avg Confidence</span>
                  <span>{Math.round(conf * 100)}%</span>
                </div>
                <ConfBar conf={conf} />
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                  <span>Discrepancy Streak</span>
                  <span>{streak} / {k}</span>
                </div>
                <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${streak > 0 ? "bg-amber-400" : "bg-brand-400"}`}
                    style={{ width: `${Math.min((streak / k) * 100, 100)}%` }}
                  />
                </div>
              </div>
              {cooldown > 0 && (
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                    <span>Cooldown</span>
                    <span>{cooldown.toFixed(1)}s</span>
                  </div>
                  <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2">
                    <div
                      className="h-2 rounded-full bg-amber-300 transition-all duration-300"
                      style={{ width: `${(cooldown / 10) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-50 pt-5">
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-xl font-bold text-slate-900">{observed ?? "—"}</div>
                <div className="text-xs text-slate-400">Observed</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-xl font-bold text-slate-900">{baseline ?? "—"}</div>
                <div className="text-xs text-slate-400">Baseline</div>
              </div>
            </div>
          </div>

          {/* AI Agent Decisions */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">AI Agent Decisions</h2>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                Gemma 2
              </span>
            </div>
            {gemmaDecisions.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                Waiting for AI decisions…
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {gemmaDecisions.map((d, i) => (
                  <GemmaRow key={i} d={d} />
                ))}
              </div>
            )}
          </div>

          {/* Event timeline */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-5 font-semibold text-slate-900">Event Timeline</h2>
            {events.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                No events yet
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {events.map((ev, i) => (
                  <EventRow key={i} ev={ev} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Alert feed ── */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Alerts</h2>
            {alerts.length > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                {alerts.length}
              </span>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-slate-400">
              No alerts yet — system is monitoring
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {alerts.slice(0, 9).map((a, i) => (
                <AlertRow key={i} alert={a} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-12 border-t border-slate-100 px-6 py-5 text-center text-xs text-slate-400">
        TopJourney · Inventory Intelligence · All data is local
      </footer>
    </div>
  );
}
