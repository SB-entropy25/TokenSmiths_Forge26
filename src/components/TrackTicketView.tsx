import React, { useState } from 'react';
import { Search, ShieldAlert, CheckCircle, Clock, AlertTriangle, ArrowRight, RefreshCw, FileText, Camera, Check, Flame, Zap } from 'lucide-react';
import { trackTicket, reopenTicket, requestTicketEscalation, isWithinReopenWindow } from '../services/api';
import { generateTicketPdf } from '../utils/pdf';
import { AiDiagnosticCard } from './AiDiagnosticCard';

interface TrackTicketViewProps {
  initialCode?: string;
}

export const TrackTicketView: React.FC<TrackTicketViewProps> = ({ initialCode = '' }) => {
  const [ticketCode, setTicketCode] = useState(initialCode);
  const [mobileLast4, setMobileLast4] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Reopen Form
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenPhoto, setReopenPhoto] = useState<File | null>(null);
  const [reopenPhotoPreview, setReopenPhotoPreview] = useState('');
  const [reopening, setReopening] = useState(false);
  const [reopenSuccess, setReopenSuccess] = useState(false);

  // Escalation Form
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [escalateSuccess, setEscalateSuccess] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSearchResult(null);
    setReopenSuccess(false);
    setEscalateSuccess(false);

    if (!ticketCode.trim()) {
      setErrorMessage('Please enter your Ticket ID (e.g. CP-2026-XXXXXX).');
      return;
    }

    if (!/^\d{4}$/.test(mobileLast4.trim())) {
      setErrorMessage('Please enter the last 4 digits of your mobile number for verification.');
      return;
    }

    setLoading(true);
    try {
      const result = await trackTicket(ticketCode, mobileLast4);
      setLoading(false);
      if (!result) {
        setErrorMessage('No ticket found matching this Ticket ID and mobile last 4 digits. Please verify.');
      } else {
        setSearchResult(result);
      }
    } catch (err) {
      setLoading(false);
      setErrorMessage('Failed to search ticket database. Please try again.');
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim() || !reopenPhoto) {
      alert('Please provide a reason and at least one proof photo showing that the issue is still unresolved.');
      return;
    }

    setReopening(true);
    try {
      await reopenTicket(ticketCode, mobileLast4, reopenReason, reopenPhoto);
      setReopening(false);
      setShowReopenModal(false);
      setReopenSuccess(true);
      // Refresh ticket state
      const refreshed = await trackTicket(ticketCode, mobileLast4);
      setSearchResult(refreshed);
    } catch (err: any) {
      setReopening(false);
      alert(err.message || 'Failed to reopen ticket');
    }
  };

  const handleEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateReason.trim()) {
      alert('Please provide a reason describing why this issue requires urgent escalation.');
      return;
    }

    setEscalating(true);
    try {
      await requestTicketEscalation(ticketCode, mobileLast4, escalateReason);
      setEscalating(false);
      setShowEscalateModal(false);
      setEscalateSuccess(true);
      setEscalateReason('');
      // Refresh ticket state
      const refreshed = await trackTicket(ticketCode, mobileLast4);
      setSearchResult(refreshed);
    } catch (err: any) {
      setEscalating(false);
      alert(err.message || 'Failed to request escalation');
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">RECEIVED</span>;
      case 'assigned':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">ASSIGNED TO DEPT</span>;
      case 'in_progress':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">CREW IN PROGRESS</span>;
      case 'closed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">RESOLVED / CLOSED</span>;
      case 'reopened':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">REOPENED BY CITIZEN</span>;
      case 'under_verification':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">AI VERIFICATION</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Search Bar Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Track Civic Grievance Progress</h2>
        <p className="text-slate-400 text-xs sm:text-sm mb-5">
          Enter your Ticket ID and verify with the last 4 digits of the mobile phone registered on submission.
        </p>

        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <input
              type="text"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
              placeholder="e.g. CP-2026-XXXXXX"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <input
              type="text"
              maxLength={4}
              value={mobileLast4}
              onChange={(e) => setMobileLast4(e.target.value.replace(/\D/g, ''))}
              placeholder="Last 4 digits of mobile"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-600/30"
            >
              <Search className="w-4 h-4" />
              <span>{loading ? 'Querying Records...' : 'Verify & Look Up Ticket'}</span>
            </button>
          </div>
        </form>

        {errorMessage && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            {errorMessage}
          </div>
        )}

        {reopenSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center space-x-2">
            <Check className="w-4 h-4" />
            <span>Ticket has been reopened and escalated to department lead.</span>
          </div>
        )}

        {escalateSuccess && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-center space-x-2">
            <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
            <span>Escalation alert recorded and highlighted on the Municipal Command Console with top priority.</span>
          </div>
        )}
      </div>

      {/* Ticket Details & Timeline */}
      {searchResult && (
        <div className="space-y-6 animate-fade-in">
          {/* Main Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-4 border-b border-slate-800 gap-3">
              <div>
                <span className="text-xs uppercase text-slate-500 font-semibold block">Ticket Reference</span>
                <h3 className="text-2xl font-mono font-extrabold text-white">{searchResult.ticket.ticket_code}</h3>
                <span className="text-xs text-slate-400">
                  Filed on {new Date(searchResult.ticket.created_at).toLocaleDateString()} at{' '}
                  {new Date(searchResult.ticket.created_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {statusBadge(searchResult.cluster.status)}
                {(searchResult.timeline?.some((t: any) => t.type === 'escalated' && (t.actor?.toLowerCase().includes('citizen') || t.message?.toLowerCase().includes('citizen escalation')))) && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1 animate-pulse" title="Citizen escalation requested and flagged on Officer Console">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">ESCALATION ACTIVE</span>
                  </span>
                )}
                <button
                  onClick={() => generateTicketPdf(searchResult.ticket, searchResult.cluster)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs flex items-center space-x-1"
                  title="Download Receipt PDF"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
              </div>
            </div>

            {/* Info Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Category</span>
                <span className="text-sm font-bold text-white capitalize">
                  {searchResult.ticket.category.replace('_', ' ')}
                </span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Severity Level</span>
                <span className="text-sm font-bold text-amber-400">
                  Level {searchResult.cluster.severity_current} / 5
                </span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Assigned Dept</span>
                <span className="text-xs font-semibold text-slate-200 line-clamp-1">
                  {searchResult.cluster.department_name || 'Dispatch Pending'}
                </span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Cluster Reports</span>
                <span className="text-sm font-bold text-emerald-400">
                  {searchResult.cluster.flag_count} Citizens Reported
                </span>
              </div>
            </div>

            {/* Photos */}
            <div className="my-4">
              <span className="text-xs text-slate-400 font-semibold block mb-2">Original Submitted Evidence:</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <img
                    src={searchResult.ticket.wide_photo_url}
                    alt="Wide View"
                    className="w-full h-32 object-cover rounded-xl border border-slate-700"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">Wide Environment</span>
                </div>
                <div>
                  <img
                    src={searchResult.ticket.near_photo_url}
                    alt="Near View"
                    className="w-full h-32 object-cover rounded-xl border border-slate-700"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">Close-up Damage</span>
                </div>
              </div>
            </div>

            {/* AI Multi-Level Diagnostic Check & Detection Bar */}
            <div className="my-5">
              <AiDiagnosticCard
                score={searchResult.ticket.ai_generated_score}
                aiSummary={searchResult.ticket.ai_summary}
                formalDescription={`Official Draft: ${searchResult.ticket.ai_summary}`}
                severity={searchResult.cluster.severity_current}
                danger={searchResult.ticket.danger}
                context={searchResult.ticket.context}
                verdict={searchResult.cluster.status === 'under_verification' ? 'held' : 'accepted'}
                etaHours={searchResult.ticket.eta_hours}
              />
            </div>

            {/* Closure Proof Photo & Reopen Opportunity */}
            {searchResult.cluster.status === 'closed' && (
              <div className="my-5 p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Official Completion Proof Photo by Field Team</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Closed: {new Date(searchResult.cluster.closed_at).toLocaleDateString()}
                  </span>
                </div>

                {searchResult.cluster.proof_photo_url && (
                  <img
                    src={searchResult.cluster.proof_photo_url}
                    alt="Work Done Proof"
                    className="w-full h-44 object-cover rounded-xl border border-emerald-500/30 mb-3"
                  />
                )}

                {searchResult.canReopen ? (
                  <div className="pt-2 border-t border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <p className="text-xs text-slate-300">
                      Problem not fixed properly? You have a <strong>5-day guarantee window</strong> to reopen this grievance with new photos.
                    </p>
                    <button
                      onClick={() => setShowReopenModal(true)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reopen Grievance</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    The 5-day reopening window has concluded. If a new issue has arisen at this spot, please file a new report.
                  </p>
                )}
              </div>
            )}

            {/* Active Grievance Escalation Action Card */}
            {searchResult.cluster.status !== 'closed' && searchResult.cluster.status !== 'rejected' && (
              <div className="my-5 p-4 bg-gradient-to-r from-amber-950/40 via-orange-950/25 to-slate-900 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span>Request Immediate Escalation</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Experiencing unexpected delay or condition worsening? Alert the municipal command room to prioritize field dispatch.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEscalateModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md shadow-orange-900/40 flex-shrink-0 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Escalate Grievance</span>
                </button>
              </div>
            )}

            {/* Public Timeline - Filtered strictly to the selected complaint ID */}
            <div className="mt-6 pt-5 border-t border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Audited Timeline & Updates</span>
                </h4>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                  {searchResult.ticket.ticket_code}
                </span>
              </div>

              {(() => {
                const currentCode = (searchResult.ticket.ticket_code || '').toUpperCase();
                const ticketEvents = (searchResult.timeline || []).filter((item: any) => {
                  // If explicit ticket_id is present, it MUST match this ticket
                  if (item.ticket_id && item.ticket_id !== searchResult.ticket.id) {
                    return false;
                  }
                  // If the message references a complaint ID, it must match this ticket
                  const codeMatches = item.message?.match(/CP-\d{4}-\d{5,6}/gi);
                  if (codeMatches && codeMatches.length > 0) {
                    const isForThisTicket = codeMatches.some(
                      (code: string) => code.toUpperCase() === currentCode
                    );
                    if (!isForThisTicket) return false;
                  }
                  return true;
                });

                if (ticketEvents.length === 0) {
                  return (
                    <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400">
                      Report registered and under municipal review. Updates for {currentCode} will appear here.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {ticketEvents.map((item: any) => {
                      const isEscalation = item.type === 'escalated';
                      const isReopened = item.type === 'reopened';
                      return (
                        <div key={item.id} className="flex items-start space-x-3 text-xs">
                          <div
                            className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                              isEscalation
                                ? 'bg-amber-400 ring-4 ring-amber-400/30 animate-pulse'
                                : isReopened
                                ? 'bg-rose-400 ring-4 ring-rose-400/30'
                                : 'bg-emerald-500 ring-4 ring-emerald-500/20'
                            }`}
                          />
                          <div
                            className={`flex-1 p-3 rounded-xl border ${
                              isEscalation
                                ? 'bg-gradient-to-r from-amber-950/30 to-slate-800/50 border-amber-500/40 shadow-sm'
                                : isReopened
                                ? 'bg-rose-950/20 border-rose-500/40'
                                : 'bg-slate-800/40 border-slate-750'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
                              <div className="flex items-center space-x-1.5">
                                <span className={`font-semibold ${isEscalation ? 'text-amber-300' : 'text-slate-200'}`}>
                                  {item.actor}
                                </span>
                                {isEscalation && (
                                  <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold flex items-center space-x-0.5">
                                    <Flame className="w-2.5 h-2.5 text-orange-400" />
                                    <span>Escalation Logged</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500">{new Date(item.created_at).toLocaleString()}</span>
                            </div>
                            <p className={`text-xs leading-relaxed ${isEscalation ? 'text-amber-100/90 font-medium' : 'text-slate-300'}`}>
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
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Reopen Civic Grievance</h3>
            <p className="text-xs text-slate-400 mb-4">
              Please explain why the repair is unsatisfactory and attach a new photo showing the persisting condition.
            </p>

            <form onSubmit={handleReopenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Reopening *</label>
                <textarea
                  rows={3}
                  required
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. Patch broke after rain / Wire was taped but is hanging again..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Condition Photo *</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setReopenPhoto(f);
                      setReopenPhotoPreview(URL.createObjectURL(f));
                    }
                  }}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-emerald-400 hover:file:bg-slate-700"
                />
                {reopenPhotoPreview && (
                  <img src={reopenPhotoPreview} alt="New Proof" className="h-28 w-full object-cover rounded-lg mt-2" />
                )}
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reopening}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
                >
                  {reopening ? 'Submitting to n8n...' : 'Submit Reopen Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Escalation Request Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <Flame className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Escalate Complaint to Command Desk</h3>
                <span className="text-xs text-slate-400 font-mono">{searchResult?.ticket.ticket_code}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              This request flags your complaint with top priority on the municipal command room dashboard and alerts active dispatchers.
            </p>

            <form onSubmit={handleEscalateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Reason for Urgency / Delay Notice <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder="e.g. 3 days passed with no repair / Hazard is expanding and blocking traffic / Exposed live wire..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEscalateModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={escalating}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1 shadow-md shadow-amber-600/30"
                >
                  {escalating ? 'Sending Escalation...' : 'Dispatch Escalation Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};