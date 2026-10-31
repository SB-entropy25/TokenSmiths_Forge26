// Centralized Application Configuration & Environment Settings
// Reads from Vite .env files and allows browser-level overrides for demo flexibility.

const STORAGE_KEY = 'CIVIC_APP_CONFIG_OVERRIDES';

export interface AppConfig {
  useDirectMode: boolean; // Direct Supabase + Gemini mode (No n8n required!)
  geminiApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  n8nSubmitWebhookUrl: string;
  n8nReopenWebhookUrl: string;
  formApiSecret: string;
  disableEmail: boolean;
  enableDemoFallback: boolean;
}

const getDefaultConfig = (): AppConfig => {
  const env = (import.meta as any).env || {};
  return {
    useDirectMode: env.VITE_USE_DIRECT_MODE !== 'false', // Default to TRUE (Direct Mode!)
    geminiApiKey: env.VITE_GEMINI_API_KEY || '',
    supabaseUrl: env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || '',
    n8nSubmitWebhookUrl: env.VITE_N8N_SUBMIT_WEBHOOK_URL || '',
    n8nReopenWebhookUrl: env.VITE_N8N_REOPEN_WEBHOOK_URL || '',
    formApiSecret: env.VITE_FORM_API_SECRET || 'civic-secret-key-2026',
    disableEmail: true, // As requested: no emails sent
    enableDemoFallback: true,
  };
};

export const getAppConfig = (): AppConfig => {
  const defaults = getDefaultConfig();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...defaults, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Failed to load config overrides from localStorage', e);
  }
  return defaults;
};

export const saveAppConfig = (overrides: Partial<AppConfig>): AppConfig => {
  const current = getAppConfig();
  const updated = { ...current, ...overrides };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save config overrides', e);
  }
  return updated;
};

export const resetAppConfig = (): AppConfig => {
  localStorage.removeItem(STORAGE_KEY);
  return getDefaultConfig();
};
