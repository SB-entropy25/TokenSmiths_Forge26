import React, { useState, useEffect } from 'react';
import { CitizenUser, signInWithGoogle, signInWithGoogleMock, signOutCitizen, saveCitizenProfileToDb, fetchCitizenProfileFromDb, setStoredCitizen } from '../services/auth';
import { getSupabaseClient } from '../services/supabaseClient';
import { User, LogIn, LogOut, CheckCircle2, History, PlusCircle, Phone, Mail, ArrowRight, Shield, Sparkles } from 'lucide-react';
import { Ticket, Cluster } from '../types';

interface CitizenAuthCardProps {
  user: CitizenUser | null;
  onUserChange: (user: CitizenUser | null) => void;
  activeView: 'new' | 'history';
  onViewChange: (view: 'new' | 'history') => void;
  userComplaints: Array<{ ticket: Ticket; cluster: Cluster }>;
  onSelectTicket: (ticketCode: string) => void;
}

export const CitizenAuthCard: React.FC<CitizenAuthCardProps> = ({
  user,
  onUserChange,
  activeView,
  onViewChange,
  userComplaints,
  onSelectTicket,
}) => {
  const [mobileInput, setMobileInput] = useState(user?.mobile || '');
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [savingMobile, setSavingMobile] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoEmail, setDemoEmail] = useState('');
  const [demoName, setDemoName] = useState('');
  const [demoPhone, setDemoPhone] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');

  // Keep local inputs in sync when user changes
  useEffect(() => {
    if (user) {
      if (user.mobile) setMobileInput(user.mobile);
      if (user.name) setNameInput(user.name);
    }
  }, [user]);

  // Listen to Supabase OAuth redirects and existing sessions
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const email = session.user.email || '';
        const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split('@')[0];
        const avatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture;
        const existing = await fetchCitizenProfileFromDb(email);

        const citizen: CitizenUser = {
          id: session.user.id,
          email,
          name,
          mobile: existing?.mobile || '',
          avatar_url: avatar,
          provider: 'google',
        };

        setStoredCitizen(citizen);
        onUserChange(citizen);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const email = session.user.email || '';
        const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split('@')[0];
        const avatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture;
        const existing = await fetchCitizenProfileFromDb(email);

        const citizen: CitizenUser = {
          id: session.user.id,
          email,
          name,
          mobile: existing?.mobile || '',
          avatar_url: avatar,
          provider: 'google',
        };

        setStoredCitizen(citizen);
        onUserChange(citizen);
      } else if (event === 'SIGNED_OUT') {
        onUserChange(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError('');

    const res = await signInWithGoogle();
    if (!res.success) {
      // If Google OAuth is not configured in Supabase console yet, open seamless quick-login modal
      setAuthError(res.error || 'Google OAuth not configured in Supabase. Use Quick Demo Sign-in.');
      setShowDemoModal(true);
    }
    setSigningIn(false);
  };

  const handleSaveMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(mobileInput.trim())) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!user) return;
    setSavingMobile(true);
    const updated: CitizenUser = {
      ...user,
      name: nameInput.trim() || user.name,
      mobile: mobileInput.trim(),
    };
    setStoredCitizen(updated);
    await saveCitizenProfileToDb(updated);
    onUserChange(updated);
    setSavingMobile(false);
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoEmail.trim() || !demoName.trim() || !/^\d{10}$/.test(demoPhone.trim())) {
      alert('Please provide valid Name, Email, and 10-digit Mobile number.');
      return;
    }

    const u = await signInWithGoogleMock(demoEmail, demoName, demoPhone);
    onUserChange(u);
    setShowDemoModal(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl mb-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      {!user ? (
        // NOT SIGNED IN: Explanatory Banner & Google Sign-in Button
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Citizen Portal Account
              </span>
              <span className="text-xs text-slate-400">• Optional One-Click Login</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white">
              Sign in with Google to Track Your Grievances
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Login to automatically save your contact info for 1-click future reports, track live resolution timelines of all your past complaints, and access official receipts without re-entering ticket IDs.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full sm:w-auto flex items-center justify-center space-x-3 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-lg shadow-white/10 transition-all cursor-pointer border border-slate-300"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{signingIn ? 'Connecting...' : 'Continue with Google'}</span>
            </button>

            <button
              onClick={() => setShowDemoModal(true)}
              className="w-full sm:w-auto text-xs px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold border border-slate-700 transition-all"
            >
              Quick Sign-in
            </button>
          </div>
        </div>
      ) : (
        // SIGNED IN: User Profile & Switcher between 'Register New' vs 'My Past Complaints'
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-emerald-400 font-bold text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-sm text-white">{user.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Verified Citizen
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5">
                  <span className="flex items-center space-x-1">
                    <Mail className="w-3 h-3 text-slate-500" />
                    <span>{user.email}</span>
                  </span>
                  {user.mobile && (
                    <span className="flex items-center space-x-1 font-mono">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{user.mobile}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  signOutCitizen();
                  onUserChange(null);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Missing Mobile Banner for First-Time Google Login */}
          {!user.mobile && (
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-amber-300 block">First-Time Setup Required</span>
                <span className="text-[11px] text-slate-400">Complete your profile below with your 10-digit mobile number to activate grievance filing.</span>
              </div>
            </div>
          )}

          {/* View Switcher: File New vs My Past Complaints */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onViewChange('new')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeView === 'new'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>File New Complaint</span>
              </button>

              <button
                onClick={() => onViewChange('history')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeView === 'history'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>My Complaints ({userComplaints.length})</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-400 hidden sm:inline">
              ✓ Contact details auto-filled from your profile
            </span>
          </div>

          {/* History Accordion if active */}
          {activeView === 'history' && (
            <div className="mt-4 pt-3 border-t border-slate-800 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Your Registered Complaints History
              </h4>

              {userComplaints.length === 0 ? (
                <div className="bg-slate-800/50 rounded-xl p-5 text-center text-xs text-slate-400">
                  <p>You haven't submitted any complaints under this Google account yet.</p>
                  <button
                    onClick={() => onViewChange('new')}
                    className="mt-2 text-emerald-400 hover:underline font-bold"
                  >
                    + Submit your first complaint
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {userComplaints.map(({ ticket, cluster }) => {
                    const isPendingApproval = cluster.status === 'under_verification' || ticket.ticket_code?.startsWith('PENDING') || ticket.ai_flag;
                    const displayCode = isPendingApproval ? 'PENDING APPROVAL' : ticket.ticket_code;

                    return (
                      <div
                        key={ticket.id}
                        onClick={() => {
                          if (!isPendingApproval) {
                            onSelectTicket(ticket.ticket_code);
                          }
                        }}
                        className={`bg-slate-800/80 hover:bg-slate-800 border rounded-xl p-3.5 transition-all space-y-2 ${
                          isPendingApproval
                            ? 'border-amber-500/40 cursor-default'
                            : 'border-slate-700 cursor-pointer hover:border-emerald-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-mono font-bold text-xs ${isPendingApproval ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {displayCode}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            isPendingApproval
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : cluster.status === 'closed'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : cluster.status === 'rejected'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {isPendingApproval ? 'Pending Approval' : cluster.status.replace('_', ' ')}
                          </span>
                        </div>

                        <p className="text-xs text-slate-200 line-clamp-1">
                          {ticket.description}
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
                          <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                          {isPendingApproval ? (
                            <span className="text-amber-400 font-semibold text-[10px]">
                              Awaiting Officer Approval (No ID yet)
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                              <span>Track Status</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Demo Sign-In Modal (fallback if GCP OAuth client is not activated yet) */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Google Account Sign-In</h3>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Enter your citizen details. These will be saved into Supabase for 1-click access and grievance history.
            </p>

            <form onSubmit={handleDemoSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={demoName}
                  onChange={(e) => setDemoName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Google Email</label>
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com"
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">10-Digit Mobile Number</label>
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  maxLength={10}
                  value={demoPhone}
                  onChange={(e) => setDemoPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowDemoModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
                >
                  Confirm & Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1st-Time Google Auth Onboarding Modal: Prompts for Mobile & Confirms Name */}
      {user && !user.mobile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-4 relative">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-md">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-black text-white pt-1">Google Sign-In Verified!</h3>
              <p className="text-xs text-slate-400">
                Welcome to the Municipal Grievance Portal. Please confirm your details and provide your mobile number for SMS dispatch updates.
              </p>
            </div>

            <form onSubmit={handleSaveMobile} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Citizen Full Name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Google Email (Linked)</label>
                <div className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-300 font-mono flex items-center justify-between">
                  <span>{user.email}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  10-Digit Mobile Number <span className="text-amber-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  autoFocus
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  value={mobileInput}
                  onChange={(e) => setMobileInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Required to track tickets, receive officer resolution photos, and verify reports. Stored securely in Supabase.
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingMobile}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{savingMobile ? 'Saving Profile...' : 'Save Profile & Unlock Portal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
