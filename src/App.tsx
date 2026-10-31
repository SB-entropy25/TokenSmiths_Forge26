import React, { useState } from 'react';
import { Header } from './components/Header';
import { ReportForm } from './components/ReportForm';
import { TrackTicketView } from './components/TrackTicketView';
import { PublicMapView } from './components/PublicMapView';
import { AdminDashboard } from './components/AdminDashboard';
import { TicketSuccessModal } from './components/TicketSuccessModal';
import { ConfigModal } from './components/ConfigModal';
import { SubmissionResponse } from './types';
import { getClusters } from './services/api';
import { getAppConfig, AppConfig } from './config/env';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('report');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [successResponse, setSuccessResponse] = useState<SubmissionResponse | null>(null);
  const [trackInitialCode, setTrackInitialCode] = useState<string>('');
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [config, setConfig] = useState<AppConfig>(getAppConfig());
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const clusters = getClusters();
  const verificationCount = clusters.filter(
    (c) => c.status === 'under_verification' || c.tickets?.some((t) => t.ai_flag)
  ).length;

  const handleReportSuccess = (resp: SubmissionResponse) => {
    setSuccessResponse(resp);
    setRefreshKey((prev) => prev + 1);
  };

  const handleTrackFromSuccess = (ticketCode: string) => {
    setTrackInitialCode(ticketCode);
    setCurrentTab('track');
  };

  const handleConfigSaved = () => {
    const updated = getAppConfig();
    setConfig(updated);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isAdmin={isAdmin}
        setIsAdmin={setIsAdmin}
        openConfigModal={() => setIsConfigOpen(true)}
        verificationCount={verificationCount}
        hasGeminiKey={Boolean(config.geminiApiKey?.trim())}
      />

      <main className="flex-1 pb-16">
        {currentTab === 'report' && (
          <ReportForm
            key={`report-${refreshKey}-${config.geminiApiKey}`}
            config={config}
            onSuccess={handleReportSuccess}
            onOpenConfig={() => setIsConfigOpen(true)}
          />
        )}
        {currentTab === 'track' && <TrackTicketView key={`track-${refreshKey}`} initialCode={trackInitialCode} />}
        {currentTab === 'map' && <PublicMapView key={`map-${refreshKey}`} />}
        {currentTab === 'home' && <PublicMapView key={`home-${refreshKey}`} />}
        {(currentTab === 'admin-board' || currentTab === 'admin-verify') && (
          <AdminDashboard
            key={`admin-${refreshKey}`}
            currentTab={currentTab}
            onRefresh={() => setRefreshKey((k) => k + 1)}
          />
        )}
      </main>

      {/* Success Modal */}
      {successResponse && (
        <TicketSuccessModal
          response={successResponse}
          onTrack={handleTrackFromSuccess}
          onClose={() => setSuccessResponse(null)}
        />
      )}

      {/* Config Drawer / Modal */}
      {isConfigOpen && (
        <ConfigModal
          onClose={() => setIsConfigOpen(false)}
          onSaved={handleConfigSaved}
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
