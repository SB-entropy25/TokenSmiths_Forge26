import React, { useState } from 'react';
import { Sliders, Save, RotateCcw, ShieldCheck, Mail, Globe, Database, Key, Sparkles, Zap, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { getAppConfig, saveAppConfig, resetAppConfig } from '../config/env';
import { runFullSystemDiagnostics, HealthStatus } from '../services/healthCheck';

interface ConfigModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ onClose, onSaved }) => {
  const current = getAppConfig();

  const [useDirectMode, setUseDirectMode] = useState(current.useDirectMode);
  const [geminiApiKey, setGeminiApiKey] = useState(current.geminiApiKey);
  const [supabaseUrl, setSupabaseUrl] = useState(current.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(current.supabaseAnonKey);
  const [n8nSubmitWebhookUrl, setN8nSubmitWebhookUrl] = useState(current.n8nSubmitWebhookUrl);
  const [formApiSecret, setFormApiSecret] = useState(current.formApiSecret);

  // Live Connection Test State
  const [testResult, setTestResult] = useState<HealthStatus | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTestConnections = async () => {
    // Save current values first to test with fresh inputs
    saveAppConfig({
      useDirectMode,
      geminiApiKey,
      supabaseUrl,
      supabaseAnonKey,
      n8nSubmitWebhookUrl,
      formApiSecret,
    });
    setTesting(true);
    const res = await runFullSystemDiagnostics();
    setTestResult(res);
    setTesting(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveAppConfig({
      useDirectMode,
      geminiApiKey,
      supabaseUrl,
      supabaseAnonKey,
      n8nSubmitWebhookUrl,
      formApiSecret,
    });
    onSaved();
    onClose();
  };

  const handleReset = () => {
    if (confirm('Reset settings to .env defaults?')) {
      resetAppConfig();
      onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">System & AI Backend Configuration</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {/* Direct Mode Banner */}
        <div className="mb-5 p-3.5 bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-xs text-white">Direct Mode (No n8n Required)</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useDirectMode}
                onChange={(e) => setUseDirectMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
          <p className="text-[11px] text-slate-300 mt-1">
            When enabled, the app communicates directly with Supabase Storage & Google Gemini API. Zero external tunnels or n8n containers required.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Gemini API Key */}
          <div>
            <label className="text-slate-300 font-semibold block mb-1 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Google Gemini API Key (Multimodal AI Vision & Danger Triage)</span>
            </label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-[10px] text-slate-500 block mt-1">
              Get free key instantly at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline">aistudio.google.com</a>. (If left blank, intelligent local heuristic is used).
            </span>
          </div>

          {/* Supabase URL */}
          <div>
            <label className="text-slate-300 font-semibold block mb-1 flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supabase Project URL</span>
            </label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Supabase Anon Key */}
          <div>
            <label className="text-slate-300 font-semibold block mb-1 flex items-center space-x-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supabase Anon Public Key</span>
            </label>
            <input
              type="password"
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Optional n8n Webhook (if user toggles Direct Mode off) */}
          {!useDirectMode && (
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1 flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <span>n8n Submit Webhook URL (POST /webhook/submit)</span>
                </label>
                <input
                  type="text"
                  value={n8nSubmitWebhookUrl}
                  onChange={(e) => setN8nSubmitWebhookUrl(e.target.value)}
                  placeholder="https://YOUR-N8N-TUNNEL/webhook/submit"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1 flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Webhook Secret (x-api-secret)</span>
                </label>
                <input
                  type="text"
                  value={formApiSecret}
                  onChange={(e) => setFormApiSecret(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>
          )}

          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/60 text-[11px] text-slate-400 flex items-center space-x-2">
            <Mail className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Email delivery is disabled: updates are stored in database timeline logs.</span>
          </div>

          {/* Live Diagnostics Card */}
          {testResult && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <span className="font-bold text-slate-200 block text-[11px]">Real-time Connection Test Results:</span>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span>Supabase Database:</span>
                  <span className={testResult.supabaseDb.status === 'connected' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {testResult.supabaseDb.status === 'connected' ? '✓ Connected' : '✕ Failed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Supabase Storage ('reports' bucket):</span>
                  <span className={testResult.supabaseStorage.status === 'connected' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {testResult.supabaseStorage.status === 'connected' ? '✓ Bucket Ready' : '✕ Bucket Missing/Blocked'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Gemini 1.5 Flash Vision:</span>
                  <span className={testResult.geminiAi.status === 'connected' ? 'text-emerald-400 font-bold' : 'text-purple-400 font-bold'}>
                    {testResult.geminiAi.status === 'connected' ? '✓ Verified Active' : 'Offline Heuristic'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleTestConnections}
              disabled={testing}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold flex items-center justify-center space-x-1.5 border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Test Connections'}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-semibold flex items-center justify-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="submit"
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/30"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Apply</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
