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
  ExternalLink,
  Info,
  RefreshCw,
  Database,
  Check,
  XCircle,
  Inbox,
  Flame,
  Zap,
  Calendar,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Cluster, Ticket, IssueCategory } from '../types';
import { getClusters, fetchLiveClusters, updateClusterAdmin, resolveVerificationQueue, getDepartments } from '../services/api';

interface AdminDashboardProps {
  currentTab: string;
  onRefresh: () => void;
}

// Helper: Check if a citizen explicitly requested escalation
const isCitizenEscalated = (c: Cluster): boolean => {
  if (!c || !c.timeline) return false;
  return c.timeline.some(
    (t) =>
      t.type === 'escalated' &&
      (t.actor?.toLowerCase().includes('citizen') || t.message?.toLowerCase().includes('citizen escalation'))
  );
};

const getCitizenEscalationEvent = (c: Cluster) => {
  if (!c || !c.timeline) return null;
  return (
    c.timeline
      .filter(
        (t) =>
          t.type === 'escalated' &&
          (t.actor?.toLowerCase().includes('citizen') || t.message?.toLowerCase().includes('citizen escalation'))
      )
      .slice(-1)[0] || null
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentTab, onRefresh }) => {
  const [clusters, setClusters] = useState<Cluster[]>(getClusters());
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [loading, setLoading] = useState(false);

  // Action Drawer / Modal states
  const [newStatus, setNewStatus] = useState<string>('');
  const [assignDept, setAssignDept] = useState<string>('');
  const [adminNote, setAdminNote] = useState<string>('');
  const [overrideSeverity, setOverrideSeverity] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string>('');
  const [selectedTimelineTicketId, setSelectedTimelineTicketId] = useState<string>('all');

  const openClusterDetail = (cluster: Cluster) => {
    setSelectedCluster(cluster);
    setNewStatus(cluster.status);
    setAssignDept(cluster.department_name || '');
    setAdminNote('');
    setOverrideSeverity(0);
    setOverrideReason('');
    setProofPhotoUrl(cluster.proof_photo_url || '');
    setSelectedTimelineTicketId(
      cluster.tickets && cluster.tickets.length === 1 ? cluster.tickets[0].id : 'all'
    );
  };

  // Verification Queue action state
  const [rejectReason, setRejectReason] = useState<string>('');
  const [heldSeverityMap, setHeldSeverityMap] = useState<Record<string, number>>({});
  const [heldDeptMap, setHeldDeptMap] = useState<Record<string, string>>({});

  const departments = getDepartments();

  const loadData = async () => {
    setLoading(true);
    const fresh = await fetchLiveClusters();
    setClusters(fresh);
    setLoading(false);
    if (selectedCluster) {
      setSelectedCluster(fresh.find((c) => c.id === selectedCluster.id) || null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplyActions = async () => {
    if (!selectedCluster) return;

    await updateClusterAdmin(selectedCluster.id, {
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
    await loadData();
    onRefresh();
  };

  const handleVerifyDecision = async (ticketId: string, approve: boolean) => {
    const assignedSev = heldSeverityMap[ticketId];
    const assignedDept = heldDeptMap[ticketId];
    await resolveVerificationQueue(
      ticketId,
      approve,
      rejectReason || (approve ? 'Verified genuine by municipal officer' : 'Failed authenticity test'),
      assignedSev,
      assignedDept
    );
    setRejectReason('');
    await loadData();
    onRefresh();
  };

  const getClusterAgeDays = (createdAt: string) => {
    if (!createdAt) return 0;
    const ms = Date.now() - new Date(createdAt).getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  };

  const pendingClusters = clusters.filter(
    (c) => c.status !== 'closed' && c.status !== 'rejected' && c.status !== 'under_verification' && !c.tickets?.some((t) => t.ai_flag)
  );

  const under24hCount = pendingClusters.filter((c) => getClusterAgeDays(c.created_at) < 1).length;
  const days1to2Count = pendingClusters.filter((c) => {
    const days = getClusterAgeDays(c.created_at);
    return days >= 1 && days < 3;
  }).length;
  const overdue3DaysClusters = pendingClusters.filter((c) => getClusterAgeDays(c.created_at) >= 3);
  const escalatedClusters = pendingClusters.filter(isCitizenEscalated);

  const handleBumpSeverity = async (cluster: Cluster) => {
    const nextSev = Math.min(5, cluster.severity_current + 1);
    await updateClusterAdmin(cluster.id, {
      override_severity: nextSev,
      override_reason: `Auto-escalated to Level ${nextSev} due to ${getClusterAgeDays(cluster.created_at)} days pending inactivity.`,
    });
    await loadData();
    onRefresh();
  };

  const handleChangeSeverity = async (cluster: Cluster, newLevel: number) => {
    await updateClusterAdmin(cluster.id, {
      override_severity: newLevel,
      override_reason: `Officer adjusted severity to Level ${newLevel} on overdue review.`,
    });
    await loadData();
    onRefresh();
  };

  const columns = [5, 4, 3, 2, 1];

  const heldClusters = clusters.filter(
    (c) => c.status === 'under_verification' || c.tickets?.some((t) => t.ai_flag)
  );

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">

      {/* 2. Top Banner: Command Room */}
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
      </div>

      {/* 2.5 Aging & Inactivity Breakdown Bar */}
      {currentTab !== 'admin-verify' && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">Active Complaints</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-extrabold text-white">{pendingClusters.length}</span>
              <Inbox className="w-5 h-5 text-indigo-400" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">&lt; 24h (Fresh)</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-extrabold text-emerald-400">{under24hCount}</span>
              <Clock className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">1 - 2 Days In Progress</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-extrabold text-blue-400">{days1to2Count}</span>
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
          </div>

          <div
            className={`rounded-xl p-3.5 shadow-md border transition-all ${
              overdue3DaysClusters.length > 0
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span className="text-[11px] font-semibold block uppercase">≥ 3 Days (Action Needed)</span>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-xl font-extrabold ${overdue3DaysClusters.length > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                {overdue3DaysClusters.length}
              </span>
              <AlertTriangle className={`w-5 h-5 ${overdue3DaysClusters.length > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
            </div>
          </div>

          <div
            className={`rounded-xl p-3.5 shadow-md border transition-all ${
              escalatedClusters.length > 0
                ? 'bg-red-950/40 border-red-500/50 text-red-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span className="text-[11px] font-semibold block uppercase">Citizen Escalations</span>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-xl font-extrabold ${escalatedClusters.length > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                {escalatedClusters.length}
              </span>
              <Flame className={`w-5 h-5 ${escalatedClusters.length > 0 ? 'text-red-400 animate-pulse' : 'text-slate-500'}`} />
            </div>
          </div>
        </div>
      )}

      {/* 2.6 Overdue Inactivity Action Alert Panel (for complaints 3+ days pending) */}
      {currentTab !== 'admin-verify' && overdue3DaysClusters.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-900 border-2 border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-amber-500/20 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>Urgent Inactivity Queue: {overdue3DaysClusters.length} Complaints Pending &ge; 3 Days</span>
                </h3>
                <p className="text-xs text-amber-200/70">
                  These complaints have had no closure for 3+ days. Bump severity level or reassign crews to prevent SLA breach.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold self-start sm:self-auto">
              Immediate Action Required
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overdue3DaysClusters.map((cluster) => {
              const ageDays = getClusterAgeDays(cluster.created_at);
              const isEscalated = isCitizenEscalated(cluster);
              return (
                <div
                  key={cluster.id}
                  className="bg-slate-800/90 border border-slate-700 hover:border-amber-500/50 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-0.5 bg-slate-900 rounded">
                        {cluster.category.replace('_', ' ')}
                      </span>
                      <div className="flex items-center space-x-1.5">
                        {isEscalated && (
                          <span className="text-[10px] font-extrabold text-white bg-red-600 px-1.5 py-0.5 rounded flex items-center space-x-1 animate-pulse">
                            <Flame className="w-3 h-3 text-amber-200" />
                            <span>ESCALATED</span>
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          ⚠️ {ageDays} days pending
                        </span>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-white line-clamp-1">{cluster.address}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      Status: <span className="capitalize text-slate-200">{cluster.status.replace('_', ' ')}</span> • Assigned: {cluster.department_name || 'Unassigned'}
                    </p>
                  </div>

                  {/* Action Controls: Severity Bump & Drawer Opener */}
                  <div className="pt-2.5 border-t border-slate-700/60 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center space-x-1.5 text-xs">
                      <span className="text-[11px] text-slate-400">Severity:</span>
                      <select
                        value={cluster.severity_current}
                        onChange={(e) => handleChangeSeverity(cluster, parseInt(e.target.value))}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                        title="Change Severity Level"
                      >
                        <option value={1}>Level 1 (Minor)</option>
                        <option value={2}>Level 2 (Low)</option>
                        <option value={3}>Level 3 (Medium)</option>
                        <option value={4}>Level 4 (High)</option>
                        <option value={5}>Level 5 (Critical)</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {cluster.severity_current < 5 && (
                        <button
                          type="button"
                          onClick={() => handleBumpSeverity(cluster)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1 transition-all shadow cursor-pointer"
                          title="Increase severity by 1 due to inactivity"
                        >
                          <Zap className="w-3 h-3" />
                          <span>+1 Level</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openClusterDetail(cluster)}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                      >
                        <span>Manage</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {clusters.length === 0 && currentTab !== 'admin-verify' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Civic Complaints in Queue</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            All dummy and hardcoded entries have been removed. When citizens submit real reports with photos via the portal, they will automatically be triaged and displayed here in real time.
          </p>
        </div>
      )}

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
                        <span className="text-xs font-mono text-amber-400 font-bold">{heldTicket.ticket_code?.startsWith('PENDING') ? 'PENDING APPROVAL (No Official ID Yet)' : heldTicket.ticket_code}</span>
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
                        {heldTicket.wide_photo_url ? (
                          <img
                            src={heldTicket.wide_photo_url}
                            alt="Wide"
                            className="h-44 w-full object-cover rounded-xl border border-slate-700 bg-slate-950"
                          />
                        ) : (
                          <div className="h-44 w-full rounded-xl border border-slate-700 bg-slate-950 flex items-center justify-center text-slate-500 text-xs">
                            No photo attached
                          </div>
                        )}
                        {heldTicket.wide_photo_url && (
                          <a
                            href={heldTicket.wide_photo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-emerald-400 hover:underline mt-1 inline-flex items-center space-x-1"
                          >
                            <span>Open Wide Image</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block mb-1">Near-View Photo (Close-up Texture):</span>
                        {heldTicket.near_photo_url ? (
                          <img
                            src={heldTicket.near_photo_url}
                            alt="Near"
                            className="h-44 w-full object-cover rounded-xl border border-slate-700 bg-slate-950"
                          />
                        ) : (
                          <div className="h-44 w-full rounded-xl border border-slate-700 bg-slate-950 flex items-center justify-center text-slate-500 text-xs">
                            No photo attached
                          </div>
                        )}
                        {heldTicket.near_photo_url && (
                          <a
                            href={heldTicket.near_photo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-emerald-400 hover:underline mt-1 inline-flex items-center space-x-1"
                          >
                            <span>Open Near Image</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="bg-amber-950/20 border border-amber-500/40 p-3.5 rounded-xl text-xs space-y-1.5">
                      <span className="font-bold text-amber-400 flex items-center space-x-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Hold Trigger & Model Diagnosis:</span>
                      </span>
                      <p className="text-slate-200 leading-relaxed font-mono text-[11px] bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                        {heldTicket.ai_summary}
                      </p>
                    </div>

                    {/* Officer Decision Bar */}
                    <div className="pt-3 border-t border-slate-700/60 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                        <div>
                          <label className="text-[10px] text-amber-300 uppercase font-bold block mb-1">
                            Assign Severity Level (Officer Determination):
                          </label>
                          <select
                            value={heldSeverityMap[heldTicket.id] || (cluster.severity_current > 0 ? cluster.severity_current : 3)}
                            onChange={(e) => setHeldSeverityMap({ ...heldSeverityMap, [heldTicket.id]: Number(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          >
                            <option value={5}>Level 5 - Critical Emergency Hazard (6h SLA)</option>
                            <option value={4}>Level 4 - High Priority Danger (24h SLA)</option>
                            <option value={3}>Level 3 - Standard Municipal Repair (48h SLA)</option>
                            <option value={2}>Level 2 - Moderate Cosmetic Defect (72h SLA)</option>
                            <option value={1}>Level 1 - Minor Non-Urgent Maintenance (72h SLA)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-emerald-400 uppercase font-bold block mb-1">
                            Assign Responsible Department:
                          </label>
                          <select
                            value={heldDeptMap[heldTicket.id] || cluster.department_name || departments[0]?.name || 'Solid Waste Management & Sanitation Board'}
                            onChange={(e) => setHeldDeptMap({ ...heldDeptMap, [heldTicket.id]: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            {departments.map((d) => (
                              <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <input
                          type="text"
                          placeholder="Officer review notes (optional for approval, required for rejection)..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="w-full sm:flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                        <div className="flex items-center space-x-2 w-full sm:w-auto">
                          <button
                            onClick={() => handleVerifyDecision(heldTicket.id, false)}
                            className="flex-1 sm:flex-initial px-4 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-all"
                          >
                            Reject as Fake
                          </button>
                          <button
                            onClick={() => handleVerifyDecision(heldTicket.id, true)}
                            className="flex-1 sm:flex-initial px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                          >
                            Approve & Assign Severity / ID
                          </button>
                        </div>
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
                      onClick={() => openClusterDetail(cluster)}
                      className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl p-3.5 cursor-pointer transition-all shadow-md space-y-2 group"
                    >
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-0.5 bg-slate-900 rounded">
                          {cluster.category.replace('_', ' ')}
                        </span>
                        <div className="flex items-center space-x-1">
                          {isCitizenEscalated(cluster) && (
                            <span className="text-[10px] font-extrabold text-white bg-red-600 border border-red-400 px-1.5 py-0.5 rounded-md flex items-center space-x-0.5 animate-pulse" title="Citizen Escalation Requested">
                              <Flame className="w-3 h-3 text-amber-200" />
                              <span>ESCALATED</span>
                            </span>
                          )}

                          {getClusterAgeDays(cluster.created_at) >= 3 && (
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/50 px-1.5 py-0.5 rounded-md flex items-center space-x-0.5" title={`${getClusterAgeDays(cluster.created_at)} days without resolution`}>
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>{getClusterAgeDays(cluster.created_at)}d</span>
                            </span>
                          )}

                          {cluster.flag_count > 1 && (
                            <span className="text-[10px] font-extrabold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded-md flex items-center space-x-1">
                              <Flag className="w-3 h-3" />
                              <span>{cluster.flag_count} flags</span>
                            </span>
                          )}
                        </div>
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

            {/* Citizen Escalation Alert Banner (ONLY shown when a citizen explicitly clicked escalation) */}
            {(() => {
              const escEvent = getCitizenEscalationEvent(selectedCluster);
              if (!escEvent) return null;
              return (
                <div className="p-3.5 bg-red-950/60 border border-red-500/50 rounded-xl flex items-start space-x-3 text-xs">
                  <Flame className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <span className="font-extrabold text-red-300 block uppercase tracking-wider">
                      🚨 Citizen Escalation Request Active
                    </span>
                    <p className="mt-1 text-slate-200">
                      {escEvent.message || 'Citizen reported unexpected delay or escalating danger. Priority dispatch recommended.'}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Photos Grid with Fallbacks & Direct Links */}
            {selectedCluster.tickets && selectedCluster.tickets.length > 0 && (
              <div className="space-y-4">
                {selectedCluster.tickets.map((t, idx) => (
                  <div key={t.id || idx} className="bg-slate-800/40 p-3 rounded-xl border border-slate-750 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-emerald-400 font-bold">
                        Report #{idx + 1}: {t.ticket_code} ({t.name})
                      </span>
                      <div className="flex items-center space-x-2">
                        {selectedCluster.tickets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSelectedTimelineTicketId(t.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                              selectedTimelineTicketId === t.id
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-emerald-300'
                            }`}
                          >
                            {selectedTimelineTicketId === t.id ? '✓ Viewing Timeline' : 'View Timeline'}
                          </button>
                        )}
                        <span className="text-slate-400 text-[11px]">
                          {new Date(t.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Wide Environment</span>
                        {t.wide_photo_url ? (
                          <img
                            src={t.wide_photo_url}
                            alt="Wide"
                            className="h-36 w-full object-cover rounded-xl border border-slate-700 bg-slate-950"
                          />
                        ) : (
                          <div className="h-36 w-full rounded-xl border border-slate-700 bg-slate-950 flex items-center justify-center text-slate-500 text-xs">
                            No photo
                          </div>
                        )}
                        {t.wide_photo_url && (
                          <a
                            href={t.wide_photo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-emerald-400 hover:underline mt-1 inline-flex items-center space-x-1"
                          >
                            <span>Full Photo ↗</span>
                          </a>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Close-up Damage</span>
                        {t.near_photo_url ? (
                          <img
                            src={t.near_photo_url}
                            alt="Near"
                            className="h-36 w-full object-cover rounded-xl border border-slate-700 bg-slate-950"
                          />
                        ) : (
                          <div className="h-36 w-full rounded-xl border border-slate-700 bg-slate-950 flex items-center justify-center text-slate-500 text-xs">
                            No photo
                          </div>
                        )}
                        {t.near_photo_url && (
                          <a
                            href={t.near_photo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-emerald-400 hover:underline mt-1 inline-flex items-center space-x-1"
                          >
                            <span>Full Photo ↗</span>
                          </a>
                        )}
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

            {/* Complaint Timeline History Section with Multi-Ticket Selector */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-700/60 pb-2.5">
                <div className="flex items-center space-x-2 text-white font-bold text-xs sm:text-sm">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Complaint Timeline History</span>
                </div>

                {/* Complaint Selector (if multi at 1 location) */}
                {selectedCluster.tickets && selectedCluster.tickets.length > 1 ? (
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] text-slate-400 font-semibold">Filter Report:</span>
                    <select
                      value={selectedTimelineTicketId}
                      onChange={(e) => setSelectedTimelineTicketId(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-emerald-400 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="all">All Reports at Location ({selectedCluster.tickets.length})</option>
                      {selectedCluster.tickets.map((t, idx) => (
                        <option key={t.id || idx} value={t.id}>
                          Report #{idx + 1}: {t.ticket_code} ({t.name})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  selectedCluster.tickets && selectedCluster.tickets.length === 1 && (
                    <span className="font-mono text-emerald-400 text-xs font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                      {selectedCluster.tickets[0].ticket_code} ({selectedCluster.tickets[0].name})
                    </span>
                  )
                )}
              </div>

              {/* Timeline Events List */}
              {(() => {
                const allEvents = selectedCluster.timeline || [];
                let displayEvents = allEvents;

                if (selectedTimelineTicketId !== 'all' && selectedCluster.tickets) {
                  const activeTicket = selectedCluster.tickets.find((t) => t.id === selectedTimelineTicketId);
                  if (activeTicket) {
                    const currentCode = (activeTicket.ticket_code || '').trim().toUpperCase();
                    displayEvents = allEvents.filter((item: any) => {
                      if (item.ticket_id && item.ticket_id !== activeTicket.id) {
                        return false;
                      }
                      const codeMatches = item.message?.match(/CP-\d{4}-\d{5,6}/gi);
                      if (codeMatches && codeMatches.length > 0) {
                        const isForThisTicket = codeMatches.some(
                          (code: string) => code.toUpperCase() === currentCode
                        );
                        if (!isForThisTicket) return false;
                      }
                      return true;
                    });
                  }
                }

                if (displayEvents.length === 0) {
                  return (
                    <div className="p-3 text-center text-xs text-slate-500 italic bg-slate-900/40 rounded-lg">
                      No recorded timeline updates for this specific complaint yet.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {displayEvents.map((item: any) => {
                      const isEscalation = item.type === 'escalated';
                      const isReopened = item.type === 'reopened';
                      const isClosed = item.type === 'closed';

                      return (
                        <div key={item.id} className="flex items-start space-x-2.5 text-xs">
                          <div
                            className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                              isEscalation
                                ? 'bg-amber-400 ring-4 ring-amber-400/30 animate-pulse'
                                : isReopened
                                ? 'bg-rose-400 ring-4 ring-rose-400/30'
                                : isClosed
                                ? 'bg-emerald-400 ring-4 ring-emerald-400/30'
                                : 'bg-indigo-400 ring-4 ring-indigo-400/20'
                            }`}
                          />
                          <div
                            className={`flex-1 p-2.5 rounded-lg border ${
                              isEscalation
                                ? 'bg-amber-950/20 border-amber-500/40'
                                : isReopened
                                ? 'bg-rose-950/20 border-rose-500/40'
                                : isClosed
                                ? 'bg-emerald-950/20 border-emerald-500/40'
                                : 'bg-slate-900/70 border-slate-750'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
                              <div className="flex items-center space-x-1.5">
                                <span className={`font-bold text-[11px] ${isEscalation ? 'text-amber-300' : 'text-slate-300'}`}>
                                  {item.actor || 'System'}
                                </span>
                                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                  {item.type.replace('_', ' ')}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(item.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className={`text-xs ${isEscalation ? 'text-amber-100 font-medium' : 'text-slate-300'}`}>
                              {item.message}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
