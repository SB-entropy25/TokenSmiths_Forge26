import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { ReportForm } from './components/ReportForm';
import { TrackTicketView } from './components/TrackTicketView';
import { PublicMapView } from './components/PublicMapView';
import { TicketSuccessModal } from './components/TicketSuccessModal';
import { LandingPage } from './components/LandingPage';
import { AdminLogin } from './components/AdminLogin';
import { AdminPanel } from './components/AdminPanel';
import { SubmissionResponse } from './types';
import { getAppConfig } from './config/env';
import { isAdminAuthenticated, adminLogout } from './config/adminAuth';

type Route = 'landing' | 'app' | 'admin';
const CITIZEN_TABS = ['report', 'track', 'map'];

// Hash routes: #/ (landing)  #/app[/report|track|map]  #/admin
const parseHash = (): { route: Route; tab: string } => {
  const [first = '', second = ''] = window.location.hash.replace(/^#\/?/, '').split('/');
  if (first === 'admin') return { route: 'admin', tab: 'report' };
  if (first === 'app') return { route: 'app', tab: CITIZEN_TABS.includes(second) ? second : 'report' };
  return { route: 'landing', tab: 'report' };
};

export const navigate = (path: string) => {
  window.location.hash = path;
};

export const App: React.FC = () => {
  const [{ route, tab }, setLocation] = useState(parseHash());
  const [isAdminAuthed, setIsAdminAuthed] = useState<boolean>(isAdminAuthenticated());
  const [successResponse, setSuccessResponse] = useState<SubmissionResponse | null>(null);
  const [trackInitialCode, setTrackInitialCode] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    const onHashChange = () => {
      setLocation(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Re-validate session (expiry) whenever entering the admin route
  useEffect(() => {
    if (route === 'admin') setIsAdminAuthed(isAdminAuthenticated());
  }, [route]);

  if (route === 'landing') {
    return <LandingPage onReport={() => navigate('/app/report')} onViewMap={() => navigate('/app/map')} />;
  }

  if (route === 'admin') {
    if (!isAdminAuthed) return <AdminLogin onSuccess={() => setIsAdminAuthed(true)} />;
    return (
      <AdminPanel
        onLogout={() => {
          adminLogout();
          setIsAdminAuthed(false);
          navigate('/');
        }}
      />
    );
  }

  // ----- Citizen app -----
  const config = getAppConfig();

  const handleReportSuccess = (resp: SubmissionResponse) => {
    setSuccessResponse(resp);
    setRefreshKey((prev) => prev + 1);
  };

  const handleTrackFromSuccess = (ticketCode: string) => {
    setTrackInitialCode(ticketCode);
    navigate('/app/track');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        currentTab={tab}
        setCurrentTab={(t) => navigate(`/app/${t}`)}
        goHome={() => navigate('/')}
        hasGeminiKey={Boolean(config.geminiApiKey?.trim())}
      />

      <main className="flex-1 pb-16">
        {tab === 'report' && (
          <ReportForm key={`report-${refreshKey}-${config.geminiApiKey}`} config={config} onSuccess={handleReportSuccess} />
        )}
        {tab === 'track' && <TrackTicketView key={`track-${refreshKey}`} initialCode={trackInitialCode} />}
        {tab === 'map' && <PublicMapView key={`map-${refreshKey}`} />}
      </main>

      {successResponse && (
        <TicketSuccessModal response={successResponse} onTrack={handleTrackFromSuccess} onClose={() => setSuccessResponse(null)} />
      )}

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>Civic Triage & Ticketing System • Powered by Supabase, PostGIS & Google Gemini AI</p>
      </footer>
    </div>
  );
};

export default App;