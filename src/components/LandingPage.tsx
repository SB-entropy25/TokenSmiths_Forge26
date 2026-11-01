import React, { useEffect, useRef, useState } from 'react';
import {
  Landmark,
  ShieldAlert,
  Camera,
  Sparkles,
  Timer,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Search,
  Construction,
  Trash2,
  Droplets,
  Zap,
  TreePine,
  Lightbulb,
  Layers,
  Flame,
  ShieldCheck,
} from 'lucide-react';
import { fetchLiveClusters } from '../services/api';

interface LandingPageProps {
  onReport: () => void;
  onViewMap: () => void;
}

// Smoothly counts from 0 to `target` when `target` changes
const useCountUp = (target: number, duration = 1400) => {
  const [value, setValue] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);
  return value;
};

export const LandingPage: React.FC<LandingPageProps> = ({ onReport, onViewMap }) => {
  const [stats, setStats] = useState<{ resolved: number; active: number; reports: number; critical: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLiveClusters()
      .then((clusters) => {
        if (cancelled) return;
        setStats({
          resolved: clusters.filter((c) => c.status === 'closed').length,
          active: clusters.filter((c) => c.status !== 'closed' && c.status !== 'rejected').length,
          reports: clusters.reduce((acc, c) => acc + (c.flag_count || 1), 0),
          critical: clusters.filter((c) => c.severity_current === 5 && c.status !== 'closed' && c.status !== 'rejected').length,
        });
      })
      .catch(() => {
        if (!cancelled) setStats({ resolved: 0, active: 0, reports: 0, critical: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = useCountUp(stats?.resolved ?? 0);
  const active = useCountUp(stats?.active ?? 0);
  const reports = useCountUp(stats?.reports ?? 0);
  const critical = useCountUp(stats?.critical ?? 0);
  const show = (n: number) => (stats ? n.toLocaleString() : '—');

  const steps = [
    { icon: Camera, title: 'Snap it', text: 'Take a wide shot and a close-up of the problem. GPS is captured automatically.' },
    { icon: Sparkles, title: 'AI verifies it', text: 'Gemini vision checks the photos are real, match the category and rates the danger from 1 to 5.' },
    { icon: Timer, title: 'The clock starts', text: 'Duplicates are merged, the right department is assigned and an SLA deadline begins ticking.' },
    { icon: CheckCircle2, title: 'Fixed, with proof', text: 'Track your ticket live. Closed issues come with a field photo, and you can reopen within 5 days.' },
  ];

  const categories = [
    { icon: Construction, label: 'Potholes', accent: true },
    { icon: Trash2, label: 'Garbage' },
    { icon: Droplets, label: 'Water leaks' },
    { icon: Layers, label: 'Sewage & manholes' },
    { icon: Zap, label: 'Electrical hazards' },
    { icon: Lightbulb, label: 'Streetlights' },
    { icon: TreePine, label: 'Fallen trees' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans overflow-x-hidden">
      {/* ---------- HERO ---------- */}
      <section className="relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="animate-blob absolute -top-40 -left-32 w-[32rem] h-[32rem] bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="animate-blob absolute top-20 -right-40 w-[30rem] h-[30rem] bg-cyan-500/15 rounded-full blur-3xl" style={{ animationDelay: '-4s' }} />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgb(2,6,23))]" />
        </div>

        {/* Nav */}
        <nav className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <a href="#/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Landmark className="w-6 h-6 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              CIVIC TRIAGE PLATFORM
            </span>
          </a>
          <div className="flex items-center space-x-2 sm:space-x-4 text-sm font-semibold">
            <a href="#/app/map" className="hidden sm:inline text-slate-300 hover:text-white">Live Map</a>
            <a href="#/app/track" className="hidden sm:inline text-slate-300 hover:text-white">Track Ticket</a>
            <a href="#/admin" className="hidden sm:inline-flex items-center space-x-1 text-indigo-400 hover:text-indigo-300">
              <ShieldCheck className="w-4 h-4" />
              <span>Officer Login</span>
            </a>
            <button
              onClick={onReport}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all cursor-pointer font-bold text-xs"
            >
              Report an Issue
            </button>
          </div>
        </nav>

        {/* Hero copy */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center pt-12 pb-20 sm:pt-20 sm:pb-28">
          <div className="animate-fade-up inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-6">
            <Flame className="w-3.5 h-3.5" />
            <span>AI-verified reports • SLA-enforced fixes • Open to every citizen</span>
          </div>

          <h1 className="animate-fade-up text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]" style={{ animationDelay: '0.1s' }}>
            Your street. Your voice.
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Fixed on a deadline.
            </span>
          </h1>

          <p className="animate-fade-up mt-6 text-lg sm:text-2xl text-slate-300 font-medium" style={{ animationDelay: '0.2s' }}>
            Snap a pothole. AI verifies it. The city is on the clock.
          </p>
          <p className="animate-fade-up mt-3 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto" style={{ animationDelay: '0.3s' }}>
            We turn citizen photos of potholes, leaks, garbage and electrical hazards into verified, prioritised tickets with automatic escalation, so nothing gets lost in a queue.
          </p>

          <div className="animate-fade-up mt-9 flex flex-col sm:flex-row items-center justify-center gap-3" style={{ animationDelay: '0.4s' }}>
            <button
              onClick={onReport}
              className="group w-full sm:w-auto px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Camera className="w-5 h-5" />
              <span>Report a Problem</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={onViewMap}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <MapPin className="w-5 h-5 text-emerald-400" />
              <span>View Live Map</span>
            </button>
          </div>

          {/* Resolved counter */}
          <div className="animate-fade-up mt-14 inline-flex items-center space-x-3 px-5 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-2xl font-black text-white">{show(resolved)}</span>
            <span className="text-xs text-slate-400">civic issues fixed and verified with photo proof</span>
          </div>
        </div>
      </section>

      {/* ---------- LIVE STATS RIBBON ---------- */}
      <section className="border-y border-slate-850 bg-slate-900/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl sm:text-4xl font-black text-white">{show(reports)}</div>
            <div className="text-xs text-slate-400 mt-1">Total citizen flags</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-black text-amber-400">{show(active)}</div>
            <div className="text-xs text-slate-400 mt-1">Active issues under repair</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-black text-red-400">{show(critical)}</div>
            <div className="text-xs text-slate-400 mt-1">Level 5 critical (6h SLA)</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-black text-emerald-400">{show(resolved)}</div>
            <div className="text-xs text-slate-400 mt-1">Resolved with photo proof</div>
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section className="bg-slate-900/40 border-b border-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">From photo to fixed in four steps</h2>
            <p className="text-slate-400 mt-2 text-sm">Authenticated with Google, verified by Gemini AI, resolved with photo proof.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((s, i) => (
              <div key={s.title} className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/40 transition-colors">
                <span className="absolute top-4 right-5 text-4xl font-black text-slate-800">{i + 1}</span>
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-bold text-white">{s.title}</h3>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CATEGORIES ---------- */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">If it is broken in public, we triage it</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {categories.map((c) => (
            <span
              key={c.label}
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-semibold border ${
                c.accent
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <c.icon className="w-4 h-4" />
              <span>{c.label}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 to-slate-900 p-10 sm:p-14 text-center">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl" />
          <h2 className="relative text-3xl sm:text-4xl font-black tracking-tight">See a problem? Start the clock.</h2>
          <p className="relative text-slate-300 mt-3">It takes less time than writing a complaint letter, and it actually gets answered.</p>
          <div className="relative mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onReport}
              className="px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <span>Report an Issue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#/app/track"
              className="px-7 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 font-bold flex items-center space-x-2 transition-all"
            >
              <Search className="w-4 h-4 text-emerald-400" />
              <span>Track a Ticket</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto px-4">
        <p>Civic Triage AI • Powered by Supabase, PostGIS & Google Gemini</p>
        <a href="#/admin" className="text-slate-500 hover:text-indigo-400 transition-colors mt-2 sm:mt-0 font-medium">
          🏛️ Municipal Officer Console Login
        </a>
      </footer>
    </div>
  );
};
