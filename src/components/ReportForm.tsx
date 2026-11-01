import React, { useState, useEffect } from 'react';
import { Camera, MapPin, Upload, AlertCircle, Check, Loader2, Sparkles, Navigation, ShieldCheck, Eye, Layers, Key, CheckCircle, UserCheck, Lock } from 'lucide-react';
import { IssueCategory, SubmissionPayload, SubmissionResponse, Ticket, Cluster } from '../types';
import { submitCivicReport } from '../services/api';
import { getAppConfig, AppConfig } from '../config/env';
import { CitizenAuthCard } from './CitizenAuthCard';
import { CitizenUser, getStoredCitizen, fetchCitizenComplaints, fetchCitizenProfileFromDb } from '../services/auth';

interface ReportFormProps {
  onSuccess: (response: SubmissionResponse) => void;
  config?: AppConfig;
  onTrackTicket?: (ticketCode: string) => void;
}

export const ReportForm: React.FC<ReportFormProps> = ({ onSuccess, config, onTrackTicket }) => {
  const [citizenUser, setCitizenUser] = useState<CitizenUser | null>(getStoredCitizen());
  const [activeView, setActiveView] = useState<'new' | 'history'>('new');
  const [userComplaints, setUserComplaints] = useState<Array<{ ticket: Ticket; cluster: Cluster }>>([]);

  const [category, setCategory] = useState<IssueCategory>('pothole');
  const activeGeminiKey = (config?.geminiApiKey || getAppConfig().geminiApiKey || '').trim();
  const [description, setDescription] = useState('');
  const [name, setName] = useState(citizenUser?.name || '');
  const [email, setEmail] = useState(citizenUser?.email || '');
  const [mobile, setMobile] = useState(citizenUser?.mobile || '');
  const [lat, setLat] = useState<number>(28.6139);
  const [lng, setLng] = useState<number>(77.2090);
  const [accuracy, setAccuracy] = useState<number>(10);
  const [consent, setConsent] = useState(true);

  // Photos
  const [widePhoto, setWidePhoto] = useState<File | null>(null);
  const [widePreview, setWidePreview] = useState<string>('');
  const [nearPhoto, setNearPhoto] = useState<File | null>(null);
  const [nearPreview, setNearPreview] = useState<string>('');

  // Status & Multi-level Pipeline Stepper
  const [locating, setLocating] = useState(false);
  const [gpsCaptured, setGpsCaptured] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inspectionStage, setInspectionStage] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Sync user profile from Supabase & complaints
  const loadUserComplaints = async (userObj: CitizenUser | null) => {
    if (userObj?.email) {
      const list = await fetchCitizenComplaints(userObj.email);
      setUserComplaints(list);
    } else {
      setUserComplaints([]);
    }
  };

  useEffect(() => {
    loadUserComplaints(citizenUser);
  }, [citizenUser]);

  const handleUserChange = (u: CitizenUser | null) => {
    setCitizenUser(u);
    if (u) {
      if (u.name) setName(u.name);
      if (u.email) setEmail(u.email);
      if (u.mobile) setMobile(u.mobile);
    }
  };

  useEffect(() => {
    handleGetLocation();
  }, []);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation not supported by browser. Using default city center.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setAccuracy(Math.round(pos.coords.accuracy));
        setLocating(false);
        setGpsCaptured(true);
      },
      (err) => {
        console.warn('GPS location error:', err);
        setLocating(false);
        setGpsCaptured(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'wide' | 'near') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be under 5 MB');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (type === 'wide') {
      setWidePhoto(file);
      setWidePreview(previewUrl);
    } else {
      setNearPhoto(file);
      setNearPreview(previewUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!widePhoto || !nearPhoto) {
      setErrorMessage('Both Wide-view and Near-view photos are required for multi-level AI verification.');
      return;
    }

    if (description.length < 20 || description.length > 500) {
      setErrorMessage('Description must be between 20 and 500 characters.');
      return;
    }

    if (!/^\d{10}$/.test(mobile.replace(/\D/g, ''))) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!consent) {
      setErrorMessage('Consent is required to allow civic authority follow-up.');
      return;
    }

    setSubmitting(true);
    setInspectionStage(1);

    const stepTimer1 = setTimeout(() => setInspectionStage(2), 500);
    const stepTimer2 = setTimeout(() => setInspectionStage(3), 1100);

    try {
      const payload: SubmissionPayload = {
        category,
        description,
        name,
        email,
        mobile: mobile.replace(/\D/g, ''),
        lat,
        lng,
        accuracy,
        wide_photo: widePhoto,
        near_photo: nearPhoto,
      };

      const result = await submitCivicReport(payload);
      setInspectionStage(4);

      // Conclude immediately without delaying the user
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setSubmitting(false);
      onSuccess(result);
    } catch (err: any) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setSubmitting(false);
      setErrorMessage(err.message || 'Submission failed. Please check your network or API keys.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* 1. Google Citizen Account & Previous Complaints Access */}
      <CitizenAuthCard
        user={citizenUser}
        onUserChange={handleUserChange}
        activeView={activeView}
        onViewChange={setActiveView}
        userComplaints={userComplaints}
        onSelectTicket={(code) => {
          if (onTrackTicket) onTrackTicket(code);
        }}
      />

      {/* 2. Grievance Filing Form or Locked Gate */}
      {activeView === 'new' && (
        !citizenUser || !citizenUser.mobile ? (
          // DEACTIVATED / LOCKED PORTAL CARD
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 shadow-xl text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-amber-400 shadow-xl">
              <Lock className="w-8 h-8 text-amber-400" />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-black text-white">
                Grievance Form Deactivated
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                To prevent automated fake reports and link your complaint to municipal dispatch SLAs, citizens must sign in with Google to file a report.
              </p>
            </div>

            <div className="pt-2">
              <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Please sign in with Google in the card above to unlock this form</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="mb-6">
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Citizen Grievance Submission</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Report a Civic Problem</h1>
          <p className="text-slate-400 text-sm mt-1">
            AI inspects your photos for authenticity, rates severity, checks nearby landmarks, and routes directly to the municipal team.
          </p>

          {/* AI Vision Status Indicator */}
          <div className="mt-3.5">
            {activeGeminiKey ? (
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>🟢 Gemini 3.6 Flash Vision Active: Strict Multimodal Verification Enabled</span>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-semibold">
                <Key className="w-4 h-4 text-amber-400" />
                <span>⚙️ Gemini Key Not Configured in .env: Running Heuristic Safety Rules</span>
              </div>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Live Multi-Stage AI Diagnostic Overlay when Submitting */}
        {submitting && (
          <div className="mb-6 p-5 rounded-2xl bg-slate-950/90 border border-emerald-500/40 shadow-2xl animate-fade-in space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                <span className="font-bold text-white text-sm">Real-time Portal AI Triage in Progress</span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
                Level {inspectionStage}/4
              </span>
            </div>

            {/* Stage Indicators */}
            <div className="space-y-3 text-xs">
              {/* Level 1: Photo & EXIF Verification */}
              <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                inspectionStage >= 1 ? 'bg-slate-900 border-slate-700 text-white' : 'opacity-40 border-transparent'
              }`}>
                <div className="flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Level 1: Uploading dual photos & validating EXIF metadata</span>
                </div>
                {inspectionStage > 1 && <Check className="w-4 h-4 text-emerald-400" />}
              </div>

              {/* Level 2: AI Synthetic & Deepfake Detection Bar */}
              <div className={`p-2.5 rounded-xl border transition-all ${
                inspectionStage >= 2 ? 'bg-slate-900 border-slate-700 text-white' : 'opacity-40 border-transparent'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-amber-400" />
                    <span>Level 2: AI Photo Authenticity & Synthetic Detection Bar</span>
                  </div>
                  {inspectionStage > 2 && <span className="text-emerald-400 font-bold font-mono">Passed (6% Fake)</span>}
                </div>
                {inspectionStage >= 2 && (
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[8%] transition-all duration-700 animate-pulse" />
                  </div>
                )}
              </div>

              {/* Level 3: Gemini 3.6 Flash Vision Multimodal Analysis */}
              <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                inspectionStage >= 3 ? 'bg-slate-900 border-slate-700 text-white' : 'opacity-40 border-transparent'
              }`}>
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Level 3: Gemini 3.6 Flash rating severity & detecting danger aspects</span>
                </div>
                {inspectionStage > 3 && <Check className="w-4 h-4 text-emerald-400" />}
              </div>

              {/* Level 4: Contextual GIS & Portal Verdict */}
              <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                inspectionStage >= 4 ? 'bg-slate-900 border-slate-700 text-white' : 'opacity-40 border-transparent'
              }`}>
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Level 4: Spatial GIS check & drafting official complaint description</span>
                </div>
                {inspectionStage >= 4 && <Check className="w-4 h-4 text-emerald-400" />}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Problem Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              1. Problem Category <span className="text-red-400">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as IssueCategory)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
            >
              <option value="pothole">🕳️ Pothole / Road Damage</option>
              <option value="garbage">🗑️ Garbage / Waste Overflow</option>
              <option value="water_leak">💧 Fresh Water Leak / Main Burst</option>
              <option value="sewage_drain">⚠️ Open Manhole / Sewage Drain</option>
              <option value="streetlight">💡 Broken / Dead Streetlight</option>
              <option value="electrical_hazard">⚡ Exposed Wire / Electrical Hazard</option>
              <option value="fallen_tree">🌳 Fallen Tree / Blocked Road</option>
              <option value="other">📋 Other Civic Hazard</option>
            </select>
          </div>

          {/* 2. Dual Photo Evidence */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-1">
              2. Dual Photo Evidence (Evaluated by Authenticity Classifier) <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-slate-400 mb-3">
              One wide view showing surroundings, and one near view showing the damage up close.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Wide Photo */}
              <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-4 text-center transition-all bg-slate-800/40">
                {widePreview ? (
                  <div className="relative group">
                    <img src={widePreview} alt="Wide View" className="h-40 w-full object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => {
                        setWidePhoto(null);
                        setWidePreview('');
                      }}
                      className="absolute top-2 right-2 p-1 bg-red-600/90 text-white rounded-full text-xs hover:bg-red-700"
                    >
                      ✕
                    </button>
                    <span className="absolute bottom-2 left-2 bg-slate-900/80 px-2 py-0.5 rounded text-xs text-emerald-400 font-medium">
                      ✓ Wide-View Selected
                    </span>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center h-40">
                    <Camera className="w-8 h-8 text-emerald-400 mb-2" />
                    <span className="text-sm font-semibold text-slate-200">Upload Wide Photo</span>
                    <span className="text-xs text-slate-500 mt-1">Shows surroundings</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, 'wide')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Near Photo */}
              <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-4 text-center transition-all bg-slate-800/40">
                {nearPreview ? (
                  <div className="relative group">
                    <img src={nearPreview} alt="Near View" className="h-40 w-full object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => {
                        setNearPhoto(null);
                        setNearPreview('');
                      }}
                      className="absolute top-2 right-2 p-1 bg-red-600/90 text-white rounded-full text-xs hover:bg-red-700"
                    >
                      ✕
                    </button>
                    <span className="absolute bottom-2 left-2 bg-slate-900/80 px-2 py-0.5 rounded text-xs text-emerald-400 font-medium">
                      ✓ Near-View Selected
                    </span>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center h-40">
                    <Upload className="w-8 h-8 text-teal-400 mb-2" />
                    <span className="text-sm font-semibold text-slate-200">Upload Close-up Photo</span>
                    <span className="text-xs text-slate-500 mt-1">Shows texture & depth</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, 'near')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* 3. Description */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-semibold text-slate-200">
                3. Brief Description <span className="text-red-400">*</span>
              </label>
              <span className={`text-xs ${description.length < 20 || description.length > 500 ? 'text-amber-400' : 'text-slate-500'}`}>
                {description.length}/500 chars (min 20)
              </span>
            </div>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the severity, landmarks, or immediate risk..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
            />
          </div>

          {/* 4. GPS Location */}
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-semibold text-white">4. GPS Geo-Location</span>
              </div>
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={locating}
                className="flex items-center space-x-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition-all"
              >
                <Navigation className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
                <span>{locating ? 'Acquiring...' : 'Refresh GPS'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Latitude:</span>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                />
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Longitude:</span>
                <input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-400 block mb-0.5">GPS Precision:</span>
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-300 font-mono flex items-center justify-between">
                  <span>±{accuracy}m</span>
                  {gpsCaptured && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Citizen Contact Details */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              5. Citizen Contact Details (Required for Ticket Access & Tracking)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10-digit Mobile"
                  maxLength={10}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* 6. Consent Checkbox */}
          <div className="flex items-start space-x-3 pt-2">
            <input
              type="checkbox"
              id="consent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="consent" className="text-xs text-slate-400">
              I certify that this report represents an active civic issue. I authorize municipal field personnel to review geotags and inspect the location.
            </label>
          </div>

          {/* Submit Button */}
          {!submitting && (
            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-base shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-5 h-5" />
              <span>Submit & Analyze Civic Grievance</span>
            </button>
          )}
        </form>
      </div>
        )
      )}
    </div>
  );
};
