import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ReportForm } from './components/ReportForm';
import { TrackTicketView } from './components/TrackTicketView';
import { PublicMapView } from './components/PublicMapView';
import { TicketSuccessModal } from './components/TicketSuccessModal';
import { LandingPage } from './components/LandingPage';
import { AdminLogin } from './components/AdminLogin';
import { AdminPanel } from './components/AdminPanel';
import { SubmissionResponse } from './types';
import { fetchLiveClusters } from './services/api';
import { getSupabaseClient } from './services/supabaseClient';
import { getAppConfig, AppConfig } from './config/env';
import { isAdminAuthenticated, adminLogout } from './config/adminAuth';

type Route = 'landing' | 'app' | 'admin';
const CITIZEN_TABS = ['report', 'track', 'map'];

// Hash routes: #/ (landing) | #/app[/report|track|map] | #/admin
const parseHash = (): { route: Route; tab: string } => {
  const hash = window.location.hash || '';
  if (hash.includes('access_token=') || hash.includes('refresh_token=') || hash.includes('error=')) {
    return { route: 'app', tab: 'report' };
  }
  const [first = '', second = ''] = hash.replace(/^#\/?/, '').split('/');
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
  const [config, setConfig] = useState<AppConfig>(getAppConfig());
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);

  // Sync route on hash change
  useEffect(() => {
    const onHashChange = () => {
      setLocation(parseHash());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Re-validate session whenever entering the admin route
  useEffect(() => {
    if (route === 'admin') {
      setIsAdminAuthed(isAdminAuthenticated());
    }
  }, [route]);

  // Live Supabase DB Connectivity check
  useEffect(() => {
    let isMounted = true;
    const checkDbAndSync = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (isMounted) setIsDbConnected(false);
        return;
      }

      try {
        const { error } = await supabase.from('clusters').select('id').limit(1);
        if (isMounted) {
          setIsDbConnected(!error);
        }
        await fetchLiveClusters();
      } catch (err) {
        if (isMounted) setIsDbConnected(false);
      }
    };

    checkDbAndSync();
    return () => {
      isMounted = false;
    };
  }, [config, refreshKey]);

  // Route 1: Landing Page
  if (route === 'landing') {
    return (
      <LandingPage
        onReport={() => navigate('/app/report')}
        onViewMap={() => navigate('/app/map')}
      />
    );
  }

  // Route 2: Admin / Officer Console
  if (route === 'admin') {
    if (!isAdminAuthed) {
      return <AdminLogin onSuccess={() => setIsAdminAuthed(true)} />;
    }
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

  // Route 3: Citizen App (Report, Track, Live Map)
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
        isDbConnected={isDbConnected}
      />

      <main className="flex-1 pb-16">
        {tab === 'report' && (
          <ReportForm
            key={`report-${refreshKey}-${config.geminiApiKey}`}
            config={config}
            onSuccess={handleReportSuccess}
            onTrackTicket={handleTrackFromSuccess}
          />
        )}
        {tab === 'track' && <TrackTicketView key={`track-${refreshKey}`} initialCode={trackInitialCode} />}
        {tab === 'map' && <PublicMapView key={`map-${refreshKey}`} />}
      </main>

      {/* Ticket Success Modal */}
      {successResponse && (
        <TicketSuccessModal
          response={successResponse}
          onTrack={handleTrackFromSuccess}
          onClose={() => setSuccessResponse(null)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>Civic Triage & Ticketing System • Powered by Supabase, PostGIS & Google Gemini AI</p>
      </footer>
    </div>
  );
};

export default App;
