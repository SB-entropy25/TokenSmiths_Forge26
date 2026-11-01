import React from 'react';
import { ShieldAlert, MapPin, Search, PlusCircle } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  goHome: () => void;
  hasGeminiKey?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, setCurrentTab, goHome, hasGeminiKey = false }) => {
  const tabClass = (id: string) =>
    `flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${currentTab === id
      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo → back to landing page */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={goHome}>
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

          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button onClick={() => setCurrentTab('report')} className={tabClass('report')}>
              <PlusCircle className="w-4 h-4" />
              <span>Report Issue</span>
            </button>
            <button onClick={() => setCurrentTab('track')} className={tabClass('track')}>
              <Search className="w-4 h-4" />
              <span>Track Ticket</span>
            </button>
            <button onClick={() => setCurrentTab('map')} className={tabClass('map')}>
              <MapPin className="w-4 h-4" />
              <span>Live Map</span>
            </button>

            <div
              title={hasGeminiKey ? 'Gemini vision verification active' : 'Offline heuristic verification'}
              className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${hasGeminiKey
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${hasGeminiKey ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{hasGeminiKey ? 'AI Verification On' : 'Offline Mode'}</span>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
};