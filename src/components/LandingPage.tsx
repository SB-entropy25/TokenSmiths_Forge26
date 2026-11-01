import React, { useEffect, useRef, useState } from 'react';
import {
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
                            <ShieldAlert className="w-6 h-6 text-white" />
                        </div>
                        <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                            CIVIC TRIAGE AI
                        </span>
                    </a>
                    <div className="flex items-center space-x-2 sm:space-x-4 text-sm font-semibold">
                        <a href="#/app/map" className="hidden sm:inline text-slate-300 hover:text-white">Live Map</a>
                        <a href="#/app/track" className="hidden sm:inline text-slate-300 hover:text-white">Track Ticket</a>
                        <button
                            onClick={onReport}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all"
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
                            className="group w-full sm:w-auto px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all"
                        >
                            <Camera className="w-5 h-5" />
                            <span>Report a Problem</span>
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </button>
                        <button
                            onClick={onViewMap}
                            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold flex items-center justify-center space-x-2 transition-all"
                        >
                            <MapPin className="w-5 h-5 text-emerald-400" />
                            <span>View Live Map</span>
                        </button>
                    </div>

                    {/* Resolved counter */}
                    <div className="animate-fade-up mt-14 inline-block" style={{ animationDelay: '0.5s' }}>
                        <div className="px-10 py-6 rounded-3xl bg-slate-900/80 border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 backdrop-blur">
                            <div className="flex items-center justify-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Issues resolved so far</span>
                            </div>
                            <div className="text-6xl sm:text-7xl font-black text-white mt-1 tabular-nums">{show(resolved)}</div>
                            <div className="text-xs text-slate-400 mt-1">each one closed with field proof</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ---------- LIVE STATS ---------- */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Citizen reports filed', value: reports, color: 'text-white' },
                        { label: 'Active issues', value: active, color: 'text-amber-300' },
                        { label: 'Critical (6h SLA)', value: critical, color: 'text-red-400' },
                        { label: 'Resolved', value: resolved, color: 'text-emerald-400' },
                    ].map((s) => (
                        <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                            <div className={`text-3xl font-extrabold tabular-nums ${s.color}`}>{show(s.value)}</div>
                            <div className="text-xs text-slate-400 font-semibold mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ---------- POTHOLE SPOTLIGHT ---------- */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
                <div className="grid lg:grid-cols-2 gap-10 items-center">
                    <div>
                        <div className="inline-flex items-center space-x-2 text-amber-300 text-xs font-bold uppercase tracking-widest mb-3">
                            <Construction className="w-4 h-4" />
                            <span>Our obsession</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                            Every pothole is a<br />
                            <span className="text-amber-300">broken promise</span> on wheels.
                        </h2>
                        <p className="mt-4 text-slate-400">
                            Potholes wreck vehicles, cause accidents and swallow monsoon roads whole, yet most complaints vanish into a void. Civic Triage AI makes each one visible, verified and time-bound.
                        </p>
                        <ul className="mt-6 space-y-3 text-sm text-slate-300">
                            {[
                                'Duplicate reports within 50 m merge into one issue, so ten complaints become one louder signal.',
                                'Severity rises near schools and hospitals and when rain is forecast.',
                                'Miss the deadline and the ticket escalates automatically.',
                            ].map((t) => (
                                <li key={t} className="flex items-start space-x-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                    <span>{t}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Road illustration */}
                    <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
                        <svg viewBox="0 0 520 300" className="w-full h-auto" role="img" aria-label="A car approaching a pothole on a road">
                            <defs>
                                <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0" stopColor="#0f172a" />
                                    <stop offset="1" stopColor="#1e293b" />
                                </linearGradient>
                            </defs>
                            <rect width="520" height="300" fill="url(#sky)" />
                            <rect y="150" width="520" height="150" fill="#1f2937" />
                            <rect y="150" width="520" height="4" fill="#334155" />
                            {[20, 120, 220, 320, 420].map((x) => (
                                <rect key={x} x={x} y="222" width="60" height="6" rx="3" fill="#fbbf24" opacity="0.85" />
                            ))}
                            {/* pothole */}
                            <ellipse cx="330" cy="255" rx="58" ry="17" fill="#0b1220" />
                            <ellipse cx="330" cy="251" rx="50" ry="12" fill="#020617" />
                            <ellipse cx="330" cy="255" rx="58" ry="17" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="5 4" />
                            {/* warning marker */}
                            <g transform="translate(330 196)">
                                <polygon points="0,-30 28,18 -28,18" fill="#f59e0b" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
                                <rect x="-2.5" y="-12" width="5" height="17" rx="2" fill="#0f172a" />
                                <circle cx="0" cy="11" r="3" fill="#0f172a" />
                            </g>
                            {/* car */}
                            <g className="animate-drive">
                                <rect x="0" y="198" width="92" height="26" rx="8" fill="#10b981" />
                                <path d="M16 198 L28 178 H62 L76 198 Z" fill="#34d399" />
                                <rect x="31" y="182" width="14" height="13" rx="2" fill="#0f172a" opacity="0.75" />
                                <rect x="49" y="182" width="12" height="13" rx="2" fill="#0f172a" opacity="0.75" />
                                <circle cx="22" cy="226" r="10" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
                                <circle cx="70" cy="226" r="10" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
                            </g>
                        </svg>
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px]">
                            <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 font-bold">Level 4 • High</span>
                            <span className="px-2.5 py-1 rounded-lg bg-slate-950/70 text-slate-300 border border-slate-700 font-semibold">SLA: 24h</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ---------- HOW IT WORKS ---------- */}
            <section className="bg-slate-900/40 border-y border-slate-900">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">From photo to fixed in four steps</h2>
                        <p className="text-slate-400 mt-2 text-sm">No accounts, no paperwork. Just a phone and thirty seconds.</p>
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
                            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-semibold border ${c.accent
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
                            className="px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all"
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

            <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
                <p>Civic Triage AI • Powered by Supabase, PostGIS & Google Gemini</p>
            </footer>
        </div>
    );
};