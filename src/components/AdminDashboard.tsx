import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  Clock,
  Flag,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Send,
  Camera,
  Layers,
  Sparkles,
  Zap,
  ExternalLink,
  Info,
  RefreshCw,
  Database,
  Check,
  XCircle,
} from 'lucide-react';
import { Cluster, Ticket, IssueCategory } from '../types';
import { getClusters, fetchLiveClusters, updateClusterAdmin, resolveVerificationQueue, getDepartments } from '../services/api';
import { runFullSystemDiagnostics, HealthStatus } from '../services/healthCheck';

interface AdminDashboardProps {
  currentTab: string;
  onRefresh: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentTab, onRefresh }) => {
  const [clusters, setClusters] = useState<Cluster[]>(getClusters());
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [slaDivisor, setSlaDivisor] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  // Health Diagnostics State
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Action Drawer / Modal states
  const [newStatus, setNewStatus] = useState<string>('');
  const [assignDept, setAssignDept] = useState<string>('');
  const [adminNote, setAdminNote] = useState<string>('');
  const [overrideSeverity, setOverrideSeverity] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string>('https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80');

  // Verification Queue action state
  const [rejectReason, setRejectReason] = useState<string>('');

  const departments = getDepartments();

  const loadData = async () => {
    setLoading(true);
    const fresh = await fetchLiveClusters();
    setClusters(fresh);
    setLoading(false);
    if (selectedCluster) {
      setSelectedCluster(fresh.find((c) => c.id === selectedCluster.id) || null);
    }
    onRefresh();
  };

  const runDiagnostics = async () => {
    setCheckingHealth(true);
    const status = await runFullSystemDiagnostics();
    setHealth(status);
    setCheckingHealth(false);
  };

  useEffect(() => {
    loadData();
    runDiagnostics();
  }, []);

  const handleApplyActions = () => {
    if (!selectedCluster) return;

    updateClusterAdmin(selectedCluster.id, {
      status: newStatus || undefined,
      department_name: assignDept || undefined,
      admin_message: adminNote || undefined,
      override_severity: overrideSeverity > 0 ? overrideSeverity : undefined,
      override_reason: overrideReason || undefined,
      proof_photo_url: newStatus === 'closed' ? proofPhotoUrl : undefined,
    });

    setNewStatus('');
    setAdminNote('');
    setOverrideSeverity(0);
    setOverrideReason('');
    loadData();
  };

  const handleVerifyDecision = (ticketId: string, approve: boolean) => {
    resolveVerificationQueue(ticketId, approve, rejectReason || (approve ? 'Verified genuine' : 'Failed authenticity test'));
    setRejectReason('');
    loadData();
  };

  const columns = [5, 4, 3, 2, 1];

  const heldClusters = clusters.filter(
    (c) => c.status === 'under_verification' || c.tickets?.some((t) => t.ai_flag)
  );

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* 1. Live System Connection & Diagnostics Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Backend & AI Connection Status
            </span>
          </div>

          <button
            onClick={runDiagnostics}
            disabled={checkingHealth}
            className="flex items-center space-x-1.5 text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${checkingHealth ? 'animate-spin' : ''}`} />
            <span>{checkingHealth ? 'Pinging Services...' : 'Re-test Connections'}</span>
          </button>
        </div>

        {/* 3 Status Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
          {/* Supabase DB */}
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-300">1. Supabase Database</span>
              {health?.supabaseDb.status === 'connected' ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>CONNECTED</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center space-x-1">
                  <XCircle className="w-3 h-3" />
                  <span>{health?.supabaseDb.status === 'not_configured' ? 'NOT CONFIGURED' : 'ERROR'}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2">
              {health?.supabaseDb.message || 'Checking database schema...'}
            </p>
          </div>

          {/* Supabase Storage */}
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-300">2. Supabase Storage</span>
              {health?.supabaseStorage.status === 'connected' ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>READY ('reports')</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center space-x-1">
                  <XCircle className="w-3 h-3" />
                  <span>CHECK POLICIES</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2">
              {health?.supabaseStorage.message || 'Verifying photo buckets...'}
            </p>
          </div>

          {/* Gemini AI Vision */}
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-300">3. Gemini 3.6 Flash Vision</span>
              {health?.geminiAi.status === 'connected' ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>ACTIVE</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold text-[10px]">
                  OFFLINE HEURISTIC
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2">
              {health?.geminiAi.message || 'Verifying AI API key...'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Top Banner: Command Room & SLA Demo Speedup */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
            <h2 className="text-xl font-extrabold text-white">Municipal Command & Triage Control Room</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Grouping {clusters.reduce((acc, c) => acc + (c.tickets?.length || 0), 0)} citizen tickets into{' '}
            {clusters.length} PostGIS cluster issues with automated SLA escalation.
          </p>
        </div>

        {/* Live Demo SLA Speedup Controller */}
        <div className="bg-slate-800/80 border border-indigo-500/30 p-2.5 rounded-xl flex items-center space-x-3">
          <div className="text-xs">
            <span className="text-indigo-400 font-bold block flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5" />
              <span>Hackathon Demo Timer:</span>
            </span>
            <span className="text-[10px] text-slate-400">
              {slaDivisor === 360 ? '⚡ 360x Speed (6h SLA = 1 min)' : '🕒 1x Real-World Clock'}
            </span>
          </div>

          <button
            onClick={() => {
              const next = slaDivisor === 1 ? 360 : 1;
              setSlaDivisor(next);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              slaDivisor === 360
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/30'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            {slaDivisor === 360 ? '⚡ Active (360x)' : 'Set 360x Demo'}
          </button>
        </div>
      </div>

      {/* 3. Main View Router: Kanban Board vs Verification Queue */}
      {currentTab === 'admin-verify' ? (
        /* Verification Queue Screen */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>AI Photo Authenticity Verification Queue</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tickets with AI synthetic confidence &ge; 0.70 or description mismatches are held here for officer clearance.
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full text-xs font-bold">
              {heldClusters.length} Held Items
            </span>
          </div>

          {heldClusters.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
              <span>All submitted citizen evidence verified authentic. No held submissions.</span>
            </div>
          ) : (
            <div className="space-y-6">
              {heldClusters.map((cluster) => {
                const heldTicket = cluster.tickets?.[0];
                if (!heldTicket) return null;

                return (
                  <div key={cluster.id} className="bg-slate-800/60 border border-amber-500/30 rounded-xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                      <div>
                        <span className="text-xs font-mono text-emerald-400 font-bold">{heldTicket.ticket_code}</span>
                        <h4 className="text-base font-bold text-white mt-0.5">{cluster.address}</h4>
                        <span className="text-xs text-slate-400">Citizen: {heldTicket.name} • Category: {cluster.category}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded-lg text-xs font-bold">
                          AI Synthetic Score: {(heldTicket.ai_generated_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Side-by-side Photo Inspection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block mb-1">Wide-View Photo (Surroundings):</span>
                        <img
                          src={heldTicket.wide_photo_url}
                          alt="Wide"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80';
                          }}
                          className="h-44 w-full object-cover rounded-xl border border-slate-700"
                        />
                        <a
                          href={heldTicket.wide_photo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-emerald-400 hover:underline mt-1 inline-flex items-center space-x-1"
                        >
                          <span>Open Wide Image</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block mb-1">Near-View Photo (Close-up Texture):</span>
                        <img
                          src={heldTicket.near_photo_url}
                          alt="Near"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1548263594-a71ea65a8598?auto=format&fit=crop&w=800&q=80';
                          }}
                          className="h-44 w-full object-cover rounded-xl border border-slate-700"
                        />
                        <a
                          href={heldTicket.near_photo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-emerald-400 hover:underline mt-1 inline-flex items-center space-x-1"
                        >
                          <span>Open Near Image</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="bg-slate-900/60 p-3 rounded-lg text-xs text-slate-300">
                      <strong>AI Inspector Diagnosis:</strong> {heldTicket.ai_summary}
                    </div>

                    {/* Officer Decision Bar */}
                    <div className="pt-3 border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <input
                        type="text"
                        placeholder="Officer review notes (optional for approval, required for rejection)..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                      <div className="flex space-x-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleVerifyDecision(heldTicket.id, false)}
                          className="flex-1 sm:flex-initial px-4 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          Reject as Synthetic / Fake
                        </button>
                        <button
                          onClick={() => handleVerifyDecision(heldTicket.id, true)}
                          className="flex-1 sm:flex-initial px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                        >
                          Approve Genuine & Dispatch
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Kanban Board: Columns for Level 5 to Level 1 */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {columns.map((level) => {
            const levelClusters = clusters.filter(
              (c) => c.severity_current === level && c.status !== 'closed' && c.status !== 'rejected'
            );

            const levelTitle =
              level === 5
                ? 'Level 5 • Critical (6h)'
                : level === 4
                ? 'Level 4 • High (24h)'
                : level === 3
                ? 'Level 3 • Medium (72h)'
                : level === 2
                ? 'Level 2 • Low (5d)'
                : 'Level 1 • Minor (10d)';

            const headerColor =
              level === 5
                ? 'border-red-500/50 text-red-400 bg-red-950/20'
                : level === 4
                ? 'border-orange-500/50 text-orange-400 bg-orange-950/20'
                : level === 3
                ? 'border-amber-500/50 text-amber-400 bg-amber-950/20'
                : 'border-blue-500/50 text-blue-400 bg-blue-950/20';

            return (
              <div key={level} className="flex flex-col bg-slate-900/80 border border-slate-800 rounded-2xl p-3 min-w-[240px]">
                {/* Column Header */}
                <div className={`p-2.5 rounded-xl border mb-3 flex items-center justify-between font-bold text-xs ${headerColor}`}>
                  <span>{levelTitle}</span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded-full text-white">{levelClusters.length}</span>
                </div>

                {/* Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {levelClusters.map((cluster) => (
                    <div
                      key={cluster.id}
                      onClick={() => setSelectedCluster(cluster)}
                      className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl p-3.5 cursor-pointer transition-all shadow-md space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-0.5 bg-slate-900 rounded">
                          {cluster.category.replace('_', ' ')}
                        </span>
                        {cluster.flag_count > 1 && (
                          <span className="text-[10px] font-extrabold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded-md flex items-center space-x-1">
                            <Flag className="w-3 h-3" />
                            <span>{cluster.flag_count} flags</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                        {cluster.address}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/50">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-emerald-400" />
                          <span>ETA {level === 5 ? '6h' : level === 4 ? '24h' : '48h'}</span>
                        </span>
                        <span className="capitalize text-slate-300 font-medium">{cluster.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                  ))}

                  {levelClusters.length === 0 && (
                    <div className="p-4 text-center text-slate-600 text-xs italic">No active issues</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Cluster Detail & Action Drawer Modal */}
      {selectedCluster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs text-emerald-400 font-bold uppercase">
                  Cluster Issue #{selectedCluster.id.slice(0, 8)}
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5">{selectedCluster.address}</h3>
                <span className="text-xs text-slate-400">
                  {selectedCluster.flag_count} Citizen {selectedCluster.flag_count === 1 ? 'Report' : 'Reports'}
                </span>
              </div>
              <button
                onClick={() => setSelectedCluster(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Photos Grid with Fallbacks & Direct Links */}
            {selectedCluster.tickets && selectedCluster.tickets.length > 0 && (
              <div className="space-y-4">
                {selectedCluster.tickets.map((t, idx) => (
                  <div key={t.id || idx} className="bg-slate-800/40 p-3 rounded-xl border border-slate-750 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-emerald-400 font-bold">
                        Report #{idx + 1}: {t.ticket_code} ({t.name})
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {new Date(t.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Wide Environment</span>
                        <img
                          src={t.wide_photo_url}
                          alt="Wide"
                          onError={(e) => {
                            e.currentTarget.src =
                              'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80';
                          }}
                          className="h-36 w-full object-cover rounded-xl border border-slate-700"
                        />
                        <a
                          href={t.wide_photo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-emerald-400 hover:underline mt-1 inline-flex items-center space-x-1"
                        >
                          <span>Full Photo ↗</span>
                        </a>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Close-up Damage</span>
                        <img
                          src={t.near_photo_url}
                          alt="Near"
                          onError={(e) => {
                            e.currentTarget.src =
                              'https://images.unsplash.com/photo-1584463699028-d890cf282bb0?auto=format&fit=crop&w=800&q=80';
                          }}
                          className="h-36 w-full object-cover rounded-xl border border-slate-700"
                        />
                        <a
                          href={t.near_photo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-emerald-400 hover:underline mt-1 inline-flex items-center space-x-1"
                        >
                          <span>Full Photo ↗</span>
                        </a>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 italic pt-1">
                      "{t.description}"
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* AI Diagnosis Details */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>Gemini 3.6 Flash Vision Analysis</span>
              </div>
              <p className="text-slate-300">{selectedCluster.tickets?.[0]?.ai_summary || 'Analyzed and triaged.'}</p>

              {/* Danger Aspects */}
              {selectedCluster.tickets?.[0]?.danger && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(selectedCluster.tickets[0].danger)
                    .filter(([_, v]) => Boolean(v))
                    .map(([k]) => (
                      <span key={k} className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold">
                        ⚠️ {k.replace(/_/g, ' ')}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Admin Action Controls */}
            <div className="bg-slate-800/40 border border-indigo-500/30 p-4 rounded-xl space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <AlertOctagon className="w-4 h-4 text-indigo-400" />
                <span>Execute Municipal Officer Actions</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Update Status:</label>
                  <select
                    value={newStatus || selectedCluster.status}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="received">Received</option>
                    <option value="assigned">Assigned to Crew</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed / Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Assign Department:</label>
                  <select
                    value={assignDept || selectedCluster.department_name}
                    onChange={(e) => setAssignDept(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* If Closing: Proof photo URL */}
              {newStatus === 'closed' && (
                <div className="text-xs">
                  <label className="text-emerald-400 block mb-1 font-semibold flex items-center space-x-1">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Resolution Proof Photo URL (Required to Close):</span>
                  </label>
                  <input
                    type="text"
                    value={proofPhotoUrl}
                    onChange={(e) => setProofPhotoUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              )}

              {/* Send message to citizen */}
              <div className="text-xs">
                <label className="text-slate-400 block mb-1 font-semibold">Public Message to Complainant(s):</label>
                <input
                  type="text"
                  placeholder="e.g. Repair vehicle dispatched. Work expected to complete by 4 PM."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              {/* Manual Severity Override */}
              <div className="text-xs pt-2 border-t border-slate-700/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Override Severity Level:</label>
                  <select
                    value={overrideSeverity}
                    onChange={(e) => setOverrideSeverity(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value={0}>Keep Current (Level {selectedCluster.severity_current})</option>
                    <option value={5}>Level 5 - Critical</option>
                    <option value={4}>Level 4 - High</option>
                    <option value={3}>Level 3 - Medium</option>
                    <option value={2}>Level 2 - Low</option>
                    <option value={1}>Level 1 - Minor</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Override Reason:</label>
                  <input
                    type="text"
                    placeholder="e.g. Field inspection revealed deeper sinkhole"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleApplyActions}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save & Dispatch Changes to Timeline</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
