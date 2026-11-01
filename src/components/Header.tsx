import React from 'react';
import { ShieldAlert, MapPin, Search, PlusCircle, LayoutDashboard, ShieldCheck, Database, Sparkles } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
  verificationCount: number;
  hasGeminiKey?: boolean;
  isDbConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  isAdmin,
  setIsAdmin,
  verificationCount,
  hasGeminiKey = false,
  isDbConnected = false,
}) => {
  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('home')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  CIVIC TRIAGE AI
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Intelligent Civic Grievance & SLA Escalation Platform</p>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            {!isAdmin ? (
              <>
                <button
                  onClick={() => setCurrentTab('report')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    currentTab === 'report'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Report Issue</span>
                </button>

                <button
                  onClick={() => setCurrentTab('track')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    currentTab === 'track'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>Track Ticket</span>
                </button>

                <button
                  onClick={() => setCurrentTab('map')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    currentTab === 'map'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>Live Map</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCurrentTab('admin-board')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    currentTab === 'admin-board'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Issues Board</span>
                </button>

                <button
                  onClick={() => setCurrentTab('admin-verify')}
                  className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    currentTab === 'admin-verify'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verification Queue</span>
                  {verificationCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                      {verificationCount}
                    </span>
                  )}
                </button>
              </>
            )}

            {/* Admin / Citizen Switcher Pill */}
            <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

            <button
              onClick={() => {
                const next = !isAdmin;
                setIsAdmin(next);
                setCurrentTab(next ? 'admin-board' : 'report');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                isAdmin
                  ? 'bg-indigo-950/70 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/50'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isAdmin ? '🛡️ Admin Mode' : '👤 Citizen View'}
            </button>

            {/* Connected Indicators: Database & AI */}
            <div className="flex items-center space-x-1.5 pl-1">
              {/* Database Status Badge */}
              <div
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                  isDbConnected
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/60 border-red-500/40 text-red-300'
                }`}
                title={isDbConnected ? 'Supabase Database: Connected & Synchronized' : 'Supabase Database: Disconnected'}
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span className={`w-1.5 h-1.5 rounded-full ${isDbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="hidden md:inline font-mono text-[11px]">{isDbConnected ? 'DB: Connected' : 'DB: Offline'}</span>
              </div>

              {/* AI Status Badge (Display only - keys configured securely via .env) */}
              <div
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border select-none ${
                  hasGeminiKey
                    ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                    : 'bg-amber-950/50 border-amber-500/40 text-amber-300'
                }`}
                title={hasGeminiKey ? 'Gemini 3.6 Flash Vision Engine: Active via .env' : 'Gemini AI Vision Engine: Offline'}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className={`w-1.5 h-1.5 rounded-full ${hasGeminiKey ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="hidden md:inline font-mono text-[11px]">{hasGeminiKey ? 'AI: Connected' : 'AI: Offline'}</span>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
};
