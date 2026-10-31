import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getAppConfig } from '../config/env';

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export const getSupabaseClient = (): SupabaseClient | null => {
  const config = getAppConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey || config.supabaseUrl.includes('your-project')) {
    return null;
  }

  if (cachedClient && lastUrl === config.supabaseUrl && lastKey === config.supabaseAnonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false },
    });
    lastUrl = config.supabaseUrl;
    lastKey = config.supabaseAnonKey;
    return cachedClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
};
