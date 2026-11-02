import React from 'react';
import { Download, ArrowRight, ShieldCheck, CheckCircle2, Ban, RotateCcw } from 'lucide-react';
import { SubmissionResponse } from '../types';
import { generateTicketPdf } from '../utils/pdf';
import { getClusters } from '../services/api';
import { AiDiagnosticCard } from './AiDiagnosticCard';

interface TicketSuccessModalProps {
  response: SubmissionResponse;
  onTrack: (code: string) => void;
  onClose: () => void;
}

export const TicketSuccessModal: React.FC<TicketSuccessModalProps> = ({ response, onTrack, onClose }) => {
  const allClusters = getClusters();
  const cluster = allClusters.find((c) => c.id === response.cluster_id);
  const ticket = cluster?.tickets?.find((t) => t.ticket_code === response.ticket_code);

  const isRejected = response.portal_verdict === 'rejected' || response.status === 'rejected';
  const isHeld = response.status === 'under_verification' || response.portal_verdict === 'held';

  const handleDownloadPdf = () => {
    if (isRejected || isHeld) {
      alert('Cannot download receipt while grievance is pending officer approval.');
      return;
    }
    if (ticket) {
      generateTicketPdf(ticket, cluster);
    } else {
      const mockTicket: any = {
        ticket_code: response.ticket_code,
        category: cluster?.category || 'pothole',
        name: 'Citizen Report',
        email: 'Protected',
        mobile: 'XXXXXX0000',
        lat: cluster?.center_lat || 28.6139,
        lng: cluster?.center_lng || 77.2090,
        severity_final: response.severity_final,
        eta_hours: response.eta_hours,
        description: response.ai_formal_description || response.ai_summary,
        ai_summary: response.ai_summary,
        danger: response.danger,
        created_at: new Date().toISOString(),
      };
      generateTicketPdf(mockTicket, cluster);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-5">
        {/* Header Alert */}
        <div className="text-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2.5 shadow-lg ${
              isRejected
                ? 'bg-red-500/10 border border-red-500/40 text-red-400 shadow-red-500/10'
                : isHeld
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-amber-500/10'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-emerald-500/10'
            }`}
          >
            {isRejected ? (
              <Ban className="w-7 h-7" />
            ) : isHeld ? (
              <ShieldCheck className="w-7 h-7" />
            ) : (
              <CheckCircle2 className="w-7 h-7" />
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white">
            {isRejected
              ? 'Grievance Rejected by Portal AI'
              : isHeld
              ? 'Grievance Pending Officer Approval'
              : 'Grievance Formally Accepted'}
          </h2>

          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {isRejected
              ? 'Our multimodal AI inspected the photos and description. The evidence did not match public infrastructure or municipal repair criteria.'
              : isHeld
              ? 'Your complaint is queued for manual inspection by municipal officers. No Complaint ID is assigned yet.'
              : 'Multi-layer AI verification passed. Your complaint is registered in the municipal dispatch stream.'}
          </p>
        </div>

        {/* State Banner: Rejected vs Held (No Complaint ID) vs Accepted */}
        {isRejected ? (
          <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-3.5 text-center">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider block">
              Submission Disallowed
            </span>
            <p className="text-xs text-slate-300 mt-1">
              {response.message || response.ai_summary}
            </p>
          </div>
        ) : isHeld ? (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 text-center shadow-inner space-y-2.5">
            <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">
              Official Complaint ID
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-300 block tracking-wide">
              PENDING FOR APPROVAL
            </span>
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-lg p-3 text-left">
              <span className="text-[11px] font-bold text-amber-300 block mb-1">
                📋 Specific Reason Held for Officer Review:
              </span>
              <p className="text-xs text-slate-200 leading-relaxed font-mono text-[11px]">
                {response.ai_summary}
              </p>
            </div>
            <span className="text-[11px] text-slate-400 block leading-relaxed max-w-md mx-auto">
              No Complaint ID is generated yet. Once municipal officers review and approve this evidence, your official Complaint ID and downloadable PDF receipt will be activated in your account.
            </span>
          </div>
        ) : (
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 text-center shadow-inner">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold mb-0.5">
              Official Ticket Reference ID
            </span>
            <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 tracking-wider">
              {response.ticket_code}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Use this code along with your mobile number to track live status and dispatch updates.
            </span>
          </div>
        )}

        {/* AI Diagnostic Multi-Level Card */}
        <AiDiagnosticCard
          score={response.ai_generated_score || 0.06}
          aiSummary={response.ai_summary}
          formalDescription={response.ai_formal_description}
          severity={response.severity_final}
          danger={response.danger}
          context={response.context}
          verdict={response.portal_verdict || (isRejected ? 'rejected' : isHeld ? 'held' : 'accepted')}
          etaHours={response.eta_hours}
        />

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {isRejected ? (
            <button
              onClick={onClose}
              className="sm:col-span-2 w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-red-600/30"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry with Genuine Photos & Clear Description</span>
            </button>
          ) : isHeld ? (
            <button
              onClick={onClose}
              className="sm:col-span-2 w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-amber-600/30"
            >
              <span>View in My Account (Pending Verification)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              <button
                onClick={handleDownloadPdf}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-sm"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download Official PDF</span>
              </button>

              <button
                onClick={() => {
                  if (response.ticket_code) {
                    onTrack(response.ticket_code);
                  }
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-emerald-600/30"
              >
                <span>Track Progress in Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
