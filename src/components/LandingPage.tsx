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

// ---------- Hazard scene: data + self-contained CSS (all keyframes prefixed ct-) ----------
// Order matches the `categories` chips below so each chip lights up with its hazard.
// Each cycle is 21s: a scan beam sweeps left to right and every hazard is flagged in turn.
const CYCLE_S = 21;
const FLAG_DELAYS = [1.2, 4.2, 7.2, 10.1, 13.1, 16.0, 19.0];

const HAZARDS = [
    { label: 'Pothole', level: 4, sla: 24, x: 70, Icon: Construction, tone: 'border-orange-500/60 text-orange-300' },
    { label: 'Garbage', level: 2, sla: 48, x: 197, Icon: Trash2, tone: 'border-lime-500/60 text-lime-300' },
    { label: 'Water leak', level: 3, sla: 48, x: 324, Icon: Droplets, tone: 'border-sky-500/60 text-sky-300' },
    { label: 'Open manhole', level: 4, sla: 24, x: 451, Icon: Layers, tone: 'border-orange-500/60 text-orange-300' },
    { label: 'Live wire', level: 5, sla: 6, x: 578, Icon: Zap, tone: 'border-red-500/70 text-red-300' },
    { label: 'Dead streetlight', level: 2, sla: 48, x: 705, Icon: Lightbulb, tone: 'border-amber-500/60 text-amber-300' },
    { label: 'Fallen tree', level: 3, sla: 48, x: 832, Icon: TreePine, tone: 'border-emerald-500/60 text-emerald-300' },
];

// Scale a hazard about its own anchor point so it grows in place
const place = (x: number, y: number, k: number) => `translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})`;

// Scan-frame boxes [x, y, w, h] (scene coordinates, same order as HAZARDS)
const FRAMES: [number, number, number, number][] = [
    [10, 222, 122, 58],
    [150, 76, 96, 148],
    [304, 118, 108, 128],
    [396, 164, 150, 120],
    [532, 14, 96, 206],
    [686, 36, 98, 182],
    [714, 148, 184, 86],
];

const SCENE_CSS = `
@keyframes ct-scan { from { transform: translateX(-40px); } to { transform: translateX(940px); } }
@keyframes ct-flag {
  0% { opacity: 0; transform: translate(-50%, 8px) scale(.92); }
  2.5% { opacity: 1; transform: translate(-50%, 0) scale(1); }
  11% { opacity: 1; transform: translate(-50%, 0) scale(1); }
  13.5% { opacity: 0; transform: translate(-50%, -4px) scale(.98); }
  100% { opacity: 0; transform: translate(-50%, -4px) scale(.98); }
}
@keyframes ct-chip {
  2.5%, 11% {
    border-color: rgb(52 211 153);
    background-color: rgb(16 185 129 / .18);
    color: #fff;
    box-shadow: 0 0 18px rgb(16 185 129 / .35);
    transform: scale(1.07);
  }
}
@keyframes ct-drip { 0% { transform: translateY(0); opacity: 0; } 12% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(40px); opacity: 0; } }
@keyframes ct-ripple { 0% { transform: scale(.3); opacity: .8; } 100% { transform: scale(1.6); opacity: 0; } }
@keyframes ct-flow { to { stroke-dashoffset: -24; } }
@keyframes ct-steam { 0% { transform: translateY(0) scaleX(1); opacity: 0; } 25% { opacity: .55; } 100% { transform: translateY(-48px) scaleX(1.7); opacity: 0; } }
@keyframes ct-spark { 0%, 100% { opacity: 0; } 6% { opacity: 1; } 14% { opacity: 0; } 42% { opacity: 0; } 47% { opacity: 1; } 55% { opacity: 0; } }
@keyframes ct-flicker { 0%, 17%, 23%, 58%, 64%, 100% { opacity: 1; } 20%, 61% { opacity: .08; } 70% { opacity: .6; } 74% { opacity: .1; } 78% { opacity: .9; } }
@keyframes ct-sway { 0%, 100% { transform: rotate(-1.6deg); } 50% { transform: rotate(1.6deg); } }
@keyframes ct-dust { 0% { transform: translate(0, 0) scale(.4); opacity: 0; } 25% { opacity: .5; } 100% { transform: translate(10px, -24px) scale(1.5); opacity: 0; } }
@keyframes ct-leaf { 0% { transform: translate(0, 0) rotate(0deg); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate(-26px, 56px) rotate(160deg); opacity: 0; } }
@keyframes ct-focus {
  0% { opacity: .28; filter: saturate(.35); }
  2.5% { opacity: 1; filter: saturate(1.2) drop-shadow(0 0 9px rgba(52, 211, 153, .85)); }
  11% { opacity: 1; filter: saturate(1.2) drop-shadow(0 0 9px rgba(52, 211, 153, .85)); }
  14% { opacity: .28; filter: saturate(.35); }
  100% { opacity: .28; filter: saturate(.35); }
}
@keyframes ct-frame {
  0% { opacity: 0; }
  2.5% { opacity: 1; }
  11% { opacity: 1; }
  13.5% { opacity: 0; }
  100% { opacity: 0; }
}
@keyframes ct-twinkle { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }

.ct-anim { transform-box: fill-box; transform-origin: center; }
.ct-beam { animation: ct-scan ${CYCLE_S}s linear infinite; }
.ct-flag { opacity: 0; animation: ct-flag ${CYCLE_S}s linear infinite; }
.ct-chip { animation: ct-chip ${CYCLE_S}s linear infinite; }
.ct-drip { animation: ct-drip 1.5s ease-in infinite; }
.ct-ripple { animation: ct-ripple 2.2s ease-out infinite; }
.ct-flow { animation: ct-flow .9s linear infinite; }
.ct-steam { animation: ct-steam 3.2s ease-out infinite; }
.ct-spark { animation: ct-spark 1.7s steps(1, end) infinite; }
.ct-flicker { animation: ct-flicker 5.5s linear infinite; }
.ct-sway { animation: ct-sway 3.8s ease-in-out infinite; transform-origin: 90% 85%; }
.ct-dust { animation: ct-dust 2.6s ease-out infinite; }
.ct-leaf { animation: ct-leaf 4s ease-in infinite; }
.ct-twinkle { animation: ct-twinkle 3s ease-in-out infinite; }
.ct-haz { animation: ct-focus ${CYCLE_S}s linear infinite backwards; }
.ct-frame { opacity: 0; animation: ct-frame ${CYCLE_S}s linear infinite; }

@media (prefers-reduced-motion: reduce) {
  .ct-beam, .ct-chip, .ct-drip, .ct-ripple, .ct-flow, .ct-steam, .ct-spark, .ct-flicker, .ct-sway, .ct-dust, .ct-leaf, .ct-twinkle, .ct-haz { animation: none !important; }
  .ct-frame { display: none; }
  .ct-flag { display: none; }
  .ct-beam { display: none; }
}
`;

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
        <div className="relative min-h-screen bg-slate-950 text-slate-100 font-sans overflow-x-hidden flex flex-col">
            <style>{SCENE_CSS}</style>

            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="animate-blob absolute -top-40 -left-32 w-[32rem] h-[32rem] bg-emerald-500/20 rounded-full blur-3xl" />
                <div className="animate-blob absolute top-24 -right-40 w-[30rem] h-[30rem] bg-cyan-500/15 rounded-full blur-3xl" style={{ animationDelay: '-4s' }} />
                <div className="absolute right-[10%] top-1/2 -translate-y-1/3 w-[50rem] h-[26rem] bg-emerald-500/10 rounded-full blur-3xl" />
            </div>

            {/* Nav */}
            <nav className="relative w-full px-4 sm:px-6 lg:px-10 h-20 flex items-center justify-between border-b border-slate-800/60 bg-slate-950/40 backdrop-blur">
                <a href="#/" className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <Landmark className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                        CIVIC TRIAGE PLATFORM
                    </span>
                </a>
                <div className="flex items-center space-x-3 sm:space-x-6 lg:space-x-10 text-sm lg:text-base font-semibold">
                    <a href="#/app/map" className="hidden sm:inline text-slate-300 hover:text-white">Live Map</a>
                    <a href="#/app/track" className="hidden sm:inline text-slate-300 hover:text-white">Track Ticket</a>
                    <a href="#/admin" className="hidden sm:inline-flex items-center space-x-1 text-indigo-400 hover:text-indigo-300">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Officer Login</span>
                    </a>
                    <button
                        onClick={onReport}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all cursor-pointer font-bold text-xs lg:text-sm"
                    >
                        Report an Issue
                    </button>
                </div>
            </nav>

            {/* ---------- MAIN ---------- */}
            <main className="relative flex-1 min-h-[calc(100vh-5rem)] flex flex-col justify-center w-full px-4 sm:px-6 lg:px-10 py-4 lg:py-5 gap-4 lg:gap-5">
                {/* Headline row: message on the left, actions on the right */}
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 text-center lg:text-left">
                    <div>
                        <h1 className="animate-fade-up text-4xl sm:text-5xl xl:text-6xl font-black tracking-tight leading-[1.12]" style={{ animationDelay: '0.1s' }}>
                            Your street. Your voice.
                            <br />
                            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                                Fixed on a deadline.
                            </span>
                        </h1>
                        <p className="animate-fade-up mt-2 text-base sm:text-lg text-slate-300 font-medium" style={{ animationDelay: '0.2s' }}>
                            Better cities start with citizens who speak up.
                        </p>
                    </div>

                    <div className="animate-fade-up flex flex-col sm:flex-row items-center justify-center gap-3 flex-shrink-0" style={{ animationDelay: '0.3s' }}>
                        <button
                            onClick={onReport}
                            className="group w-full sm:w-auto px-7 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                        >
                            <Camera className="w-5 h-5" />
                            <span>Report a Problem</span>
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </button>
                        <button
                            onClick={onViewMap}
                            className="w-full sm:w-auto px-7 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                        >
                            <MapPin className="w-5 h-5 text-emerald-400" />
                            <span>View Live Map</span>
                        </button>
                    </div>
                </div>

                {/* Body: stats take the left ~28%, the animated scene takes the right ~72% */}
                <div className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] gap-4 lg:gap-5 items-stretch">
                    {/* Left: compact live stats (column is only as wide as the boxes) */}
                    <div className="order-2 lg:order-1 flex flex-row lg:flex-col flex-wrap lg:flex-nowrap lg:justify-between gap-3 lg:gap-4">
                        <div className="rounded-2xl bg-gradient-to-br from-emerald-950/70 to-slate-900 border border-emerald-500/40 px-5 py-3.5 shadow-lg shadow-emerald-500/10">
                            <div className="flex items-center space-x-2 text-emerald-300 text-[11px] font-bold uppercase tracking-widest">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Issues resolved</span>
                            </div>
                            <div className="text-4xl xl:text-5xl font-black text-emerald-400 tabular-nums mt-1 leading-none">{show(resolved)}</div>
                            <div className="text-[11px] text-emerald-100/70 font-medium mt-1.5 whitespace-nowrap">Closed with field photo proof</div>
                        </div>

                        <div className="rounded-2xl bg-gradient-to-br from-red-950/50 to-slate-900 border border-red-500/30 px-5 py-3.5">
                            <div className="flex items-center space-x-2 text-red-300 text-[11px] font-bold uppercase tracking-widest">
                                <Zap className="w-3.5 h-3.5" />
                                <span>Critical issues</span>
                            </div>
                            <div className="text-4xl xl:text-5xl font-black text-red-400 tabular-nums mt-1 leading-none">{show(critical)}</div>
                            <div className="text-[11px] text-red-100/70 font-medium mt-1.5 whitespace-nowrap">Level 5 • 6 hour deadline</div>
                        </div>

                        <div className="rounded-2xl bg-gradient-to-br from-slate-800/70 to-slate-900 border border-slate-700 px-5 py-3.5">
                            <div className="flex items-center space-x-2 text-slate-300 text-[11px] font-bold uppercase tracking-widest">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>Citizen reports</span>
                            </div>
                            <div className="text-4xl xl:text-5xl font-black text-white tabular-nums mt-1 leading-none">{show(reports)}</div>
                            <div className="text-[11px] text-slate-400 font-medium mt-1.5 whitespace-nowrap">Filed by citizens so far</div>
                        </div>
                    </div>

                    {/* Right: the animated scene (centrepiece) */}
                    <div className="order-1 lg:order-2 min-w-0 flex flex-col justify-between gap-3">
                        <div className="relative rounded-3xl overflow-hidden border border-emerald-500/30 bg-slate-900 shadow-[0_0_70px_-12px_rgba(16,185,129,0.35)]">
                            <svg viewBox="0 0 900 380" className="w-full h-auto block" role="img" aria-label="Animated street scene where an AI scan highlights one hazard at a time: a pothole, garbage, a water leak, an open manhole, a live wire, a faulty streetlight and a fallen tree">
                                <defs>
                                    <linearGradient id="ct-sky" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0" stopColor="#0b1325" />
                                        <stop offset="1" stopColor="#1b2a44" />
                                    </linearGradient>
                                    <linearGradient id="ct-beam-g" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0" stopColor="#34d399" stopOpacity="0" />
                                        <stop offset="0.85" stopColor="#34d399" stopOpacity="0.28" />
                                        <stop offset="1" stopColor="#6ee7b7" stopOpacity="0.9" />
                                    </linearGradient>
                                    <linearGradient id="ct-cone" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0" stopColor="#fde68a" stopOpacity="0.5" />
                                        <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
                                    </linearGradient>
                                </defs>

                                <rect width="900" height="380" fill="url(#ct-sky)" />
                                {[[40, 24], [150, 62], [260, 20], [390, 50], [520, 18], [640, 56], [770, 26], [860, 66], [90, 100], [330, 90], [700, 104]].map(([cx, cy], i) => (
                                    <circle key={i} cx={cx} cy={cy} r="1.4" fill="#e2e8f0" className="ct-twinkle ct-anim" style={{ animationDelay: `${i * 0.37}s` }} />
                                ))}

                                {/* everything on the ground is shifted down so the sky has room */}
                                <g transform="translate(0 62)">
                                    {[
                                        [10, 120, 60], [78, 100, 50], [140, 130, 56], [214, 108, 62], [290, 124, 48], [350, 96, 64],
                                        [424, 126, 52], [490, 104, 58], [560, 132, 50], [620, 98, 62], [690, 120, 54], [760, 106, 60], [830, 128, 58],
                                    ].map(([x, y, w], i) => (
                                        <g key={i}>
                                            <rect x={x} y={y} width={w} height={200 - y} fill="#0f1a2e" />
                                            <rect x={x + 8} y={y + 12} width="6" height="8" fill="#fbbf24" opacity={i % 3 === 0 ? 0.55 : 0.12} />
                                            <rect x={x + 22} y={y + 28} width="6" height="8" fill="#fbbf24" opacity={i % 2 === 0 ? 0.4 : 0.1} />
                                        </g>
                                    ))}

                                    {/* ground */}
                                    <rect y="200" width="900" height="18" fill="#243247" />
                                    <rect y="218" width="900" height="140" fill="#1b2433" />
                                    <rect y="217" width="900" height="2" fill="#3b4a63" />
                                    {[10, 110, 210, 310, 410, 510, 610, 710, 810].map((x) => (
                                        <rect key={x} x={x} y="296" width="46" height="4" rx="2" fill="#fbbf24" opacity="0.6" />
                                    ))}

                                    {/* 0 — pothole */}
                                    <g className="ct-haz" style={{ animationDelay: `${FLAG_DELAYS[0]}s` }} transform={place(70, 250, 1.6)}>
                                        <ellipse cx="70" cy="250" rx="36" ry="11" fill="#05080f" />
                                        <ellipse cx="70" cy="250" rx="36" ry="11" fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="5 4" />
                                        {[[58, 240, 0], [72, 238, 0.9], [84, 242, 1.7]].map(([cx, cy, d], i) => (
                                            <circle key={i} cx={cx} cy={cy} r="4" fill="#94a3b8" className="ct-dust ct-anim" style={{ animationDelay: `${d}s` }} />
                                        ))}
                                    </g>

                                    {/* 1 — garbage */}
                                    <g className="ct-haz" style={{ animationDelay: `${FLAG_DELAYS[1]}s` }} transform={place(197, 208, 1.5)}>
                                        <circle cx="190" cy="158" r="9" fill="#475569" />
                                        <circle cx="204" cy="155" r="10" fill="#334155" />
                                        <circle cx="197" cy="148" r="7" fill="#64748b" />
                                        <rect x="181" y="166" width="32" height="42" rx="3" fill="#14532d" stroke="#22c55e" strokeWidth="1.5" />
                                        <rect x="177" y="159" width="40" height="8" rx="2" fill="#15803d" />
                                        <rect x="168" y="204" width="9" height="5" rx="1" fill="#94a3b8" />
                                        <rect x="222" y="205" width="11" height="4" rx="1" fill="#64748b" />
                                        <g>
                                            <circle cx="214" cy="138" r="1.8" fill="#e2e8f0" />
                                            <animateTransform attributeName="transform" type="rotate" from="0 197 138" to="360 197 138" dur="1.6s" repeatCount="indefinite" />
                                        </g>
                                        <g>
                                            <circle cx="181" cy="138" r="1.6" fill="#e2e8f0" />
                                            <animateTransform attributeName="transform" type="rotate" from="360 197 138" to="0 197 138" dur="2.3s" repeatCount="indefinite" />
                                        </g>
                                        {[0, 1.1].map((d, i) => (
                                            <path key={i} d={`M${192 + i * 10} 140 q 4 -6 0 -12`} stroke="#84cc16" strokeWidth="1.6" fill="none" strokeLinecap="round" className="ct-steam ct-anim" style={{ animationDelay: `${d}s` }} />
                                        ))}
                                    </g>

                                    {/* 2 — water leak */}
                                    <g className="ct-haz" style={{ animationDelay: `${FLAG_DELAYS[2]}s` }} transform={place(324, 208, 1.3)}>
                                        <rect x="318" y="152" width="12" height="56" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
                                        <rect x="314" y="148" width="20" height="6" rx="1" fill="#64748b" />
                                        <path d="M330 172 q 16 -14 28 12" stroke="#38bdf8" strokeWidth="2.4" fill="none" strokeDasharray="6 6" strokeLinecap="round" className="ct-flow" />
                                        {[[338, 172, 0], [346, 176, 0.5], [352, 180, 1]].map(([cx, cy, d], i) => (
                                            <ellipse key={i} cx={cx} cy={cy} rx="2.4" ry="3.4" fill="#38bdf8" className="ct-drip ct-anim" style={{ animationDelay: `${d}s` }} />
                                        ))}
                                        <ellipse cx="350" cy="228" rx="34" ry="6" fill="#0ea5e9" opacity="0.3" />
                                        {[0, 1.1].map((d, i) => (
                                            <ellipse key={i} cx="350" cy="228" rx="24" ry="4" fill="none" stroke="#7dd3fc" strokeWidth="1.4" className="ct-ripple ct-anim" style={{ animationDelay: `${d}s` }} />
                                        ))}
                                    </g>

                                    {/* 3 — open manhole */}
                                    <g className="ct-haz" style={{ animationDelay: `${FLAG_DELAYS[3]}s` }} transform={place(451, 250, 1.3)}>
                                        <ellipse cx="451" cy="250" rx="32" ry="10" fill="#020617" stroke="#64748b" strokeWidth="2" />
                                        <ellipse cx="494" cy="262" rx="24" ry="7" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
                                        <polygon points="414,244 423,222 432,244" fill="#f97316" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
                                        <rect x="419" y="232" width="8" height="3" fill="#fff" />
                                        {[[443, 238, 0], [455, 236, 1.0], [449, 240, 2.0]].map(([cx, cy, d], i) => (
                                            <ellipse key={i} cx={cx} cy={cy} rx="7" ry="4" fill="#cbd5e1" className="ct-steam ct-anim" style={{ animationDelay: `${d}s` }} />
                                        ))}
                                    </g>

                                    {/* 4 — live wire */}
                                    <g className="ct-haz" style={{ animationDelay: `${FLAG_DELAYS[4]}s` }} transform={place(578, 208, 1.3)}>
                                        <rect x="574" y="66" width="8" height="144" fill="#7c4a2d" />
                                        <rect x="548" y="76" width="60" height="6" rx="1" fill="#8b5a3a" />
                                        <path d="M548 79 Q 515 98 470 90" stroke="#94a3b8" strokeWidth="1.6" fill="none" />
                                        <path d="M608 79 Q 636 94 665 90" stroke="#94a3b8" strokeWidth="1.6" fill="none" />
                                        <path d="M578 82 C 576 108 560 124 566 152" stroke="#e2e8f0" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                                        <circle cx="566" cy="152" r="15" fill="#fde047" opacity="0.22" className="ct-spark ct-anim" />
                                        {[
                                            ['M566 152 l-7 -6 l5 0 l-4 -8', 0],
                                            ['M566 152 l8 -4 l-4 -2 l7 -6', 0.5],
                                            ['M566 152 l2 9 l-5 -2 l3 8', 1.0],
                                        ].map(([d, delay], i) => (
                                            <path key={i} d={d as string} stroke="#fde047" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="ct-spark ct-anim" style={{ animationDelay: `${delay}s` }} />
                                        ))}
                                    </g>

                                    {/* 5 — faulty streetlight */}
                                    <g className="ct-haz" style={{ animationDelay: `${FLAG_DELAYS[5]}s` }} transform={place(705, 208, 1.25)}>
                                        <rect x="703" y="86" width="5" height="124" fill="#475569" />
                                        <path d="M705 88 Q 705 76 727 76" stroke="#64748b" strokeWidth="4" fill="none" strokeLinecap="round" />
                                        <ellipse cx="729" cy="79" rx="11" ry="4" fill="#cbd5e1" />
                                        <polygon points="719,83 739,83 764,205 694,205" fill="url(#ct-cone)" className="ct-flicker ct-anim" />
                                        <circle cx="729" cy="85" r="5" fill="#fde68a" className="ct-flicker ct-anim" />
                                    </g>

                                    {/* 6 — fallen tree */}
                                    <g className="ct-haz" style={{ animationDelay: `${FLAG_DELAYS[6]}s` }} transform={place(830, 208, 1.2)}>
                                        <g transform="rotate(-5 820 204)">
                                            <rect x="772" y="198" width="112" height="13" rx="5" fill="#78350f" />
                                            <rect x="878" y="199" width="6" height="11" rx="2" fill="#92400e" />
                                            <path d="M800 200 l-8 -14 M826 199 l6 -13 M850 200 l-5 -10" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
                                        </g>
                                        <g className="ct-sway ct-anim">
                                            <circle cx="770" cy="188" r="22" fill="#166534" />
                                            <circle cx="792" cy="181" r="17" fill="#15803d" />
                                            <circle cx="754" cy="199" r="15" fill="#14532d" />
                                            <circle cx="785" cy="199" r="12" fill="#166534" />
                                        </g>
                                        {[[768, 214, 0], [786, 212, 1.3], [752, 216, 2.4]].map(([cx, cy, d], i) => (
                                            <ellipse key={i} cx={cx} cy={cy} rx="3.5" ry="2" fill="#4ade80" className="ct-leaf ct-anim" style={{ animationDelay: `${d}s` }} />
                                        ))}
                                    </g>

                                    {/* scan frames: only the hazard being scanned gets a frame */}
                                    {FRAMES.map(([x, y, w, h], i) => (
                                        <rect
                                            key={i}
                                            x={x}
                                            y={y}
                                            width={w}
                                            height={h}
                                            rx="10"
                                            fill="rgba(52, 211, 153, 0.06)"
                                            stroke="#34d399"
                                            strokeWidth="2"
                                            strokeDasharray="7 5"
                                            className="ct-frame"
                                            style={{ animationDelay: `${FLAG_DELAYS[i]}s` }}
                                        />
                                    ))}
                                </g>

                                {/* AI scan beam */}
                                <g className="ct-beam ct-anim">
                                    <rect x="-40" y="0" width="40" height="380" fill="url(#ct-beam-g)" />
                                </g>
                            </svg>

                            {/* Flags that pop up as the beam passes each hazard */}
                            <div className="absolute inset-0 pointer-events-none">
                                {HAZARDS.map((h, i) => (
                                    <div
                                        key={h.label}
                                        className="ct-flag absolute w-[150px]"
                                        style={{
                                            left: `clamp(75px, ${(h.x / 900) * 100}%, calc(100% - 75px))`,
                                            top: 12,
                                            animationDelay: `${FLAG_DELAYS[i]}s`,
                                        }}
                                    >
                                        <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg bg-slate-950/90 border backdrop-blur shadow-lg ${h.tone}`}>
                                            <h.Icon className="w-5 h-5 flex-shrink-0" />
                                            <div className="leading-tight">
                                                <div className="text-xs font-bold">{h.label}</div>
                                                <div className="text-[10px] font-semibold text-slate-400">Level {h.level} • SLA {h.sla}h</div>
                                            </div>
                                        </div>
                                        <div className="mx-auto w-2 h-2 -mt-1 rotate-45 bg-slate-950 border-r border-b border-slate-700" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Categories (light up in sync with the scene) */}
                        <div className="flex flex-wrap lg:flex-nowrap gap-3">
                            {categories.map((c, i) => (
                                <span
                                    key={c.label}
                                    style={{ animationDelay: `${FLAG_DELAYS[i] ?? 0}s` }}
                                    className={`ct-chip flex flex-1 items-center justify-center space-x-2 px-4 py-2 rounded-full text-[13px] font-semibold border whitespace-nowrap ${c.accent
                                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                                            : 'bg-slate-900 border-slate-800 text-slate-300'
                                        }`}
                                >
                                    <c.icon className="w-4 h-4" />
                                    <span>{c.label}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* ---------- HOW IT WORKS ---------- */}
            <section className="relative bg-slate-900/40 border-y border-slate-900">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">From photo to fixed in four steps</h2>
                        <p className="text-slate-400 mt-2 text-sm">Authenticated with Google, verified by Gemini AI, resolved with photo proof.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {steps.map((st, i) => (
                            <div key={st.title} className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/40 transition-colors">
                                <span className="absolute top-4 right-5 text-4xl font-black text-slate-800">{i + 1}</span>
                                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
                                    <st.icon className="w-5 h-5 text-emerald-400" />
                                </div>
                                <h3 className="font-bold text-white">{st.title}</h3>
                                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{st.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="relative border-t border-slate-900 py-2.5 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between w-full px-4 sm:px-6 lg:px-10 gap-1">
                <p className="font-semibold text-slate-400">Made by TokenSmiths</p>
                <a href="#/admin" className="hover:text-indigo-400 transition-colors font-medium">
                    Municipal Officer Console Login
                </a>
            </footer>
        </div>
    );
};