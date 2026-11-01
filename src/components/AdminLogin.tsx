import React, { useState } from 'react';
import { Lock, User, LogIn, AlertTriangle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { adminLogin, isAdminConfigured } from '../config/adminAuth';

interface AdminLoginProps {
    onSuccess: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const configured = isAdminConfigured();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (adminLogin(username, password)) {
            setError('');
            onSuccess();
        } else {
            setError('Invalid username or password.');
            setPassword('');
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />

            <div className="relative w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-2xl p-7 shadow-2xl animate-fade-in">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center mb-3">
                        <ShieldCheck className="w-6 h-6 text-indigo-400" />
                    </div>
                    <h1 className="text-xl font-extrabold text-white">Municipal Officer Login</h1>
                    <p className="text-xs text-slate-400 mt-1">Authorized personnel only</p>
                </div>

                {!configured && (
                    <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                            Admin credentials are not set. Add <code className="font-mono">VITE_ADMIN_USERNAME</code> and{' '}
                            <code className="font-mono">VITE_ADMIN_PASSWORD</code> to your <code className="font-mono">.env</code> and restart the dev server.
                        </span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    <div>
                        <label className="text-slate-300 font-semibold block mb-1">Username</label>
                        <div className="relative">
                            <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                autoComplete="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-slate-300 font-semibold block mb-1">Password</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-semibold">{error}</div>
                    )}

                    <button
                        type="submit"
                        disabled={!configured}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center space-x-2 shadow-md shadow-indigo-600/30 transition-all"
                    >
                        <LogIn className="w-4 h-4" />
                        <span>Sign in</span>
                    </button>
                </form>

                <a href="#/" className="mt-5 flex items-center justify-center space-x-1.5 text-xs text-slate-500 hover:text-slate-300">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to public site</span>
                </a>
            </div>
        </div>
    );
};