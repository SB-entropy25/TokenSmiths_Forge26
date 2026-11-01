import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getAppConfig } from '../config/env';

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export const resetSupabaseClient = () => {
  cachedClient = null;
  lastUrl = '';
  lastKey = '';
};

export const getSupabaseClient = (): SupabaseClient | null => {
  const config = getAppConfig();
  const cleanUrl = (config.supabaseUrl || '').trim();
  const cleanKey = (config.supabaseAnonKey || '').trim();

  if (!cleanUrl || !cleanKey || cleanUrl.includes('your-project')) {
    return null;
  }

  if (cachedClient && lastUrl === cleanUrl && lastKey === cleanKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    lastUrl = cleanUrl;
    lastKey = cleanKey;
    return cachedClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
};
