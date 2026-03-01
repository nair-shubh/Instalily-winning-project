import Link from "next/link";

const features = [
  {
    icon: "👁️",
    title: "Computer Vision Detection",
    desc: "YOLOv8 runs entirely on-device at 3 fps, counting inventory items with sub-second latency. No cloud upload, no bandwidth cost.",
  },
  {
    icon: "🤖",
    title: "On-Device AI Decisions",
    desc: "A fine-tuned Gemma 2 model reasons over detection history, confidence scores, and streak data to decide: alert, ignore, or rebaseline.",
  },
  {
    icon: "🔔",
    title: "Instant Voice Alerts",
    desc: "Natural-language alerts are spoken directly on the operator's phone via Web Speech API — no app install, no notifications setup.",
  },
  {
    icon: "📴",
    title: "100% Offline",
    desc: "Runs on a private LAN hotspot. No internet required at runtime. Every component — YOLO, Gemma, SQLite — lives on your hardware.",
  },
  {
    icon: "🛡️",
    title: "Debounced & Reliable",
    desc: "A 5-frame debounce window and 10-second cooldown prevent false positives from transient movement or lighting changes.",
  },
  {
    icon: "📊",
    title: "Full Audit Trail",
    desc: "Every baseline change, alert, and AI decision is logged to SQLite with UTC timestamps and JSON payloads for compliance review.",
  },
];

const steps = [
  {
    n: "01",
    title: "Point & Baseline",
    desc: "Aim the phone camera at your staging area. Tap Set Baseline to lock the expected item count.",
  },
  {
    n: "02",
    title: "Arm the System",
    desc: "Tap Arm. The AI starts monitoring every frame against your baseline.",
  },
  {
    n: "03",
    title: "AI Watches 24/7",
    desc: "Gemma evaluates each detection: real removal, low confidence noise, or a legitimate recount?",
  },
  {
    n: "04",
    title: "Alert Fires Instantly",
    desc: "If a real change is confirmed, your phone speaks the alert by name — hands-free, no screen check needed.",
  },
];

const stats = [
  { value: "< 150ms", label: "inference per frame" },
  { value: "99%", label: "offline availability" },
  { value: "5-frame", label: "debounce precision" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white text-sm font-bold">
              TJ
            </span>
            <span className="text-lg font-bold text-slate-900">TopJourney</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How it works</a>
            <Link
              href="/dashboard"
              className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 transition-colors"
            >
              Live Dashboard →
            </Link>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors md:hidden"
          >
            Dashboard
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-900 px-6 py-24 text-white md:py-36">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Glow */}
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/20 blur-[120px]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse-slow" />
            Fully offline · On-device AI · LAN only
          </div>

          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-balance md:text-7xl">
            Inventory intelligence,{" "}
            <span className="bg-gradient-to-r from-brand-400 to-emerald-300 bg-clip-text text-transparent">
              no cloud required.
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-400 text-balance">
            TopJourney monitors your staging area in real time using computer
            vision and a fine-tuned AI model — entirely on your local network.
            No subscriptions. No data leaving your premises.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard"
              className="w-full rounded-xl bg-brand-600 px-8 py-4 text-base font-semibold text-white hover:bg-brand-500 transition-all hover:scale-105 sm:w-auto"
            >
              Open Dashboard →
            </Link>
            <a
              href="#how-it-works"
              className="w-full rounded-xl border border-slate-700 px-8 py-4 text-base font-semibold text-slate-300 hover:border-slate-500 hover:text-white transition-colors sm:w-auto"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────── */}
      <section className="border-b border-slate-100 bg-white px-6 py-10">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-extrabold text-brand-600">{s.value}</div>
              <div className="mt-1 text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-4xl font-bold text-slate-900">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="text-slate-500">
              Built for facilities that need reliable monitoring without cloud dependency.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:border-brand-200 hover:shadow-md transition-all"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl group-hover:bg-brand-100 transition-colors">
                  {f.icon}
                </div>
                <h3 className="mb-2 font-semibold text-slate-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="how-it-works" className="bg-slate-900 px-6 py-24 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-4xl font-bold">Up and running in minutes</h2>
            <p className="text-slate-400">One command starts the server. The rest is just your phone.</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            {steps.map((s) => (
              <div key={s.n} className="flex gap-5">
                <div className="shrink-0 font-mono text-3xl font-extrabold text-brand-500 opacity-60">
                  {s.n}
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-white">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-slate-700 bg-slate-800 p-6 font-mono text-sm">
            <div className="mb-2 flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="text-slate-400">
              <span className="text-brand-400">$</span>{" "}
              <span className="text-white">./scripts/run_server.sh</span>
            </div>
            <div className="mt-2 text-slate-500">
              ✓ venv ready &nbsp;·&nbsp; ✓ model loaded &nbsp;·&nbsp; ✓ cert generated
            </div>
            <div className="mt-1 text-brand-400">
              → Open https://192.168.1.10:8000 on your phone
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-4xl font-bold text-slate-900">
            Ready to monitor your inventory?
          </h2>
          <p className="mb-8 text-slate-500">
            Open the live dashboard to see real-time detection, AI decisions, and alert history.
          </p>
          <Link
            href="/dashboard"
            className="inline-block rounded-xl bg-brand-600 px-10 py-4 text-base font-semibold text-white hover:bg-brand-500 transition-all hover:scale-105"
          >
            Open Live Dashboard →
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-slate-100 px-6 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-sm text-slate-400">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-brand-600 text-white text-xs font-bold">
              TJ
            </span>
            TopJourney
          </div>
          <div>© {new Date().getFullYear()} TopJourney. Inventory intelligence, offline.</div>
        </div>
      </footer>
    </div>
  );
}
