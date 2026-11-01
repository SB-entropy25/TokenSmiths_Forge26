import React, { useEffect, useState } from 'react';
import { ShieldAlert, LayoutDashboard, ShieldCheck, Sliders, LogOut, ExternalLink } from 'lucide-react';
import { AdminDashboard } from './AdminDashboard';
import { ConfigModal } from './ConfigModal';
import { fetchLiveClusters } from '../services/api';

interface AdminPanelProps {
    onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
    const [tab, setTab] = useState<'admin-board' | 'admin-verify'>('admin-board');
    const [refreshKey, setRefreshKey] = useState(0);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [verificationCount, setVerificationCount] = useState(0);

    useEffect(() => {
        let cancelled = false;
        fetchLiveClusters().then((clusters) => {
            if (cancelled) return;
            setVerificationCount(
                clusters.filter((c) => c.status === 'under_verification' || c.tickets?.some((t) => t.ai_flag)).length
            );
        });
        return () => {
            cancelled = true;
        };
    }, [refreshKey]);

    const tabBtn = (id: 'admin-board' | 'admin-verify', activeColor: string) =>
        `relative flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === id ? `${activeColor} text-white shadow-md` : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <header className="bg-slate-900/90 backdrop-blur-md border-b border-indigo-500/20 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <ShieldAlert className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <span className="font-extrabold text-lg tracking-tight text-white block leading-tight">Officer Console</span>
                            <span className="text-[11px] text-indigo-300">Civic Triage AI • Admin</span>
                        </div>
                    </div>

                    <nav className="flex items-center space-x-1 sm:space-x-2">
                        <button onClick={() => setTab('admin-board')} className={tabBtn('admin-board', 'bg-indigo-600 shadow-indigo-600/30')}>
                            <LayoutDashboard className="w-4 h-4" />
                            <span className="hidden sm:inline">Issues Board</span>
                        </button>
                        <button onClick={() => setTab('admin-verify')} className={tabBtn('admin-verify', 'bg-amber-600 shadow-amber-600/30')}>
                            <ShieldCheck className="w-4 h-4" />
                            <span className="hidden sm:inline">Verification Queue</span>
                            {verificationCount > 0 && (
                                <span className="ml-1 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">{verificationCount}</span>
                            )}
                        </button>

                        <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

                        <button
                            onClick={() => setIsConfigOpen(true)}
                            title="AI & backend configuration"
                            className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                            <Sliders className="w-4 h-4" />
                        </button>
                        <a
                            href="#/app"
                            title="View public site"
                            className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                            onClick={onLogout}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-red-950/50 hover:border-red-500/40 hover:text-red-300 transition-all"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Logout</span>
                        </button>
                    </nav>
                </div>
            </header>

            <main className="flex-1 pb-16">
                <AdminDashboard
                    key={`admin-${refreshKey}`}
                    currentTab={tab}
                    onRefresh={() => setRefreshKey((k) => k + 1)}
                />
            </main>

            {isConfigOpen && (
                <ConfigModal onClose={() => setIsConfigOpen(false)} onSaved={() => setRefreshKey((k) => k + 1)} />
            )}
        </div>
    );
};