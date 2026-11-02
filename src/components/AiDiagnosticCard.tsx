import React from 'react';
import { ShieldCheck, AlertTriangle, Sparkles, CheckCircle2, Clock, MapPin, Eye, FileText, Ban } from 'lucide-react';
import { DangerAspects, ContextData } from '../types';

interface AiDiagnosticCardProps {
  score?: number; // 0.0 to 1.0 (synthetic score)
  aiSummary: string;
  formalDescription?: string;
  severity: number;
  danger?: DangerAspects;
  context?: ContextData;
  verdict?: 'accepted' | 'held' | 'rejected';
  etaHours?: number;
}

export const AiDiagnosticCard: React.FC<AiDiagnosticCardProps> = ({
  score = 0.06,
  aiSummary,
  formalDescription,
  severity,
  danger,
  context,
  verdict = 'accepted',
  etaHours = 24,
}) => {
  // Score percentage (synthetic confidence) — show real score without forcing 95%!
    const isModelOverloaded =
    aiSummary.includes('Model Undergoing Updates') ||
    aiSummary.includes('undergoing updates') ||
    aiSummary.includes('servers currently busy');

  // Score percentage (synthetic confidence) — show real score without forcing 95%!
  const percentage = isModelOverloaded ? 0 : Math.round(Math.max(0, Math.min(1, score || 0)) * 100);

  const isHeld = verdict === 'held' || percentage >= 50 || isModelOverloaded;
  const isSuspicious = !isHeld && percentage >= 30;
  const isRejected = verdict === 'rejected';
  const isAuthentic = !isHeld && !isSuspicious && !isRejected;

  const barColor = isModelOverloaded ? 'bg-amber-500/50' : isHeld ? 'bg-red-500' : isSuspicious ? 'bg-amber-500' : 'bg-emerald-500';
  const scoreBadgeColor = isHeld
    ? 'text-amber-300 bg-amber-500/20 border-amber-500/40'
    : isRejected
    ? 'text-red-400 bg-red-500/20 border-red-500/40'
    : 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40';

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
      {/* 1. Portal Submission Verdict Banner */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${
          isHeld
            ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
            : verdict === 'rejected'
            ? 'bg-red-950/40 border-red-500/40 text-red-300'
            : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            {isHeld ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            ) : verdict === 'rejected' ? (
              <Ban className="w-5 h-5 text-red-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            )}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block">
                Portal Decision Status
              </span>
              <span className="text-sm font-extrabold text-white">
                {isHeld
                  ? 'HELD FOR ADMIN VERIFICATION (Pending Approval)'
                  : verdict === 'rejected'
                  ? 'REJECTED BY PORTAL'
                  : 'ACCEPTED & DISPATCHED TO MUNICIPAL DEPT'}
              </span>
            </div>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-bold border ${scoreBadgeColor}`}
          >
            {isHeld ? 'Held for Review' : verdict === 'rejected' ? 'Rejected' : 'Verified Genuine'}
          </span>
        </div>

        {/* Hold reason shown prominently for both Admin and Citizen */}
        {isHeld && (
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-lg p-2.5 text-xs text-slate-200">
            <span className="font-bold text-amber-300">📋 Hold Reason: </span>
            <span className="font-mono text-[11px] text-amber-100">{aiSummary}</span>
          </div>
        )}
      </div>

      {/* 2. AI Photo Authenticity & Synthetic Detection Bar (Only shown if description check passed) */}
      {(!isRejected || (score && score > 0)) && (
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span>AI Authenticity & Deepfake Detection Bar</span>
          </div>
          <span className="font-mono font-bold text-slate-300">
            {isModelOverloaded
              ? 'Forensics Paused (Model Traffic Peak)'
              : `${100 - percentage}% Authentic (${percentage}% Synthetic Confidence)`}
          </span>
        </div>

        {/* The Visual Meter Bar */}
        <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700 relative">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${Math.max(5, percentage)}%` }}
          />
        </div>

        {/* Legend / Scale Markers */}
        <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
          <span className="text-emerald-400">&lt; 30% (Real Photo - Passed)</span>
          <span className="text-amber-400">30% - 80% (Held for Review)</span>
          <span className="text-red-400">&gt; 80% (Direct Rejection)</span>
        </div>

        <p className="text-[11px] text-slate-400">
          {isModelOverloaded
            ? '⏸️ Visual AI server reached capacity limits during filing. No synthetic anomalies flagged; forwarded for admin verification.'
            : percentage > 80
            ? '🚨 High synthetic probability (>80% AI generated). Upload disallowed by portal AI.'
            : isHeld
            ? '⚠️ Moderate synthetic score (between 30-80%). Placed in officer verification queue.'
            : '✓ Real genuine photo (below 30% synthetic). Verified authentic smartphone camera capture.'}
        </p>
      </div>
      )}

      {/* 3. Gemini Multimodal Hazard Triage */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Triage Severity</span>
          <span className="text-xs sm:text-sm font-extrabold text-amber-400">
            {isModelOverloaded || severity === 0 ? 'Pending Officer Review' : `Level ${severity} / 5`}
          </span>
        </div>

        <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Escalation SLA</span>
          <span className="text-xs sm:text-sm font-extrabold text-white">
            {isModelOverloaded || etaHours === 0 ? 'Set on Approval' : `${etaHours} Hours`}
          </span>
        </div>

        <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">School/Hospital</span>
          <span className="text-xs font-bold text-slate-200">
            {context?.nearSchoolOrHospital ? '🏥 Within 300m (+1)' : 'None Nearby'}
          </span>
        </div>

        <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Rain / Flood Risk</span>
          <span className="text-xs font-bold text-slate-200">
            {context?.rainForecast ? '🌧️ Rain Forecast' : '☀️ Clear Skies'}
          </span>
        </div>
      </div>

      {/* 4. Danger Aspects Badges */}
      {danger && (
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
            Active Hazard & Danger Aspects:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {isModelOverloaded || severity === 0 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-md">
                🔍 Pending Officer Visual Inspection
              </span>
            ) : Object.entries(danger).filter(([_, val]) => Boolean(val)).length > 0 ? (
              Object.entries(danger)
                .filter(([_, val]) => Boolean(val))
                .map(([key]) => (
                  <span
                    key={key}
                    className="text-[10px] font-bold px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-md"
                  >
                    ⚠️ {key.replace(/_/g, ' ').toUpperCase()}
                  </span>
                ))
            ) : (
              <span className="text-[10px] text-slate-400">Standard non-critical repair</span>
            )}
          </div>
        </div>
      )}

      {/* 5. Official AI-Synthesized Complaint Description */}
      <div className="bg-slate-800/40 border border-slate-700/80 rounded-xl p-3.5 space-y-1.5">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isHeld ? 'Submitted Grievance Summary' : 'Official Complaint Description'}</span>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed font-sans">
          {formalDescription || aiSummary}
        </p>
      </div>
    </div>
  );
};
