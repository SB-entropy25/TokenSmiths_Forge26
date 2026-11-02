import { getAppConfig } from '../config/env';
import { getSupabaseClient, resetSupabaseClient } from './supabaseClient';

export interface HealthStatus {
  supabaseDb: {
    status: 'checking' | 'connected' | 'error' | 'not_configured';
    message: string;
  };
  supabaseStorage: {
    status: 'checking' | 'connected' | 'error' | 'not_configured';
    message: string;
  };
  geminiAi: {
    status: 'checking' | 'connected' | 'error' | 'not_configured';
    message: string;
  };
}

export const runFullSystemDiagnostics = async (): Promise<HealthStatus> => {
  resetSupabaseClient(); // Force fresh connection test
  const config = getAppConfig();
  const supabase = getSupabaseClient();

  const result: HealthStatus = {
    supabaseDb: { status: 'checking', message: 'Verifying...' },
    supabaseStorage: { status: 'checking', message: 'Verifying...' },
    geminiAi: { status: 'checking', message: 'Verifying...' },
  };

  // 1. Check Supabase Database
  if (!supabase || !config.supabaseUrl || !config.supabaseAnonKey) {
    result.supabaseDb = {
      status: 'not_configured',
      message: 'Supabase URL or Anon Key missing in settings.',
    };
    result.supabaseStorage = {
      status: 'not_configured',
      message: 'Supabase credentials missing.',
    };
  } else {
    try {
      const { data, error } = await supabase.from('clusters').select('id').limit(1);
      if (error) {
        result.supabaseDb = {
          status: 'error',
          message: `Database error: ${error.message} (Code: ${error.code})`,
        };
      } else {
        result.supabaseDb = {
          status: 'connected',
          message: `Connected successfully to ${config.supabaseUrl}`,
        };
      }
    } catch (e: any) {
      result.supabaseDb = {
        status: 'error',
        message: `Network failure connecting to Supabase: ${e.message}`,
      };
    }

    // 2. Check Supabase Storage ('reports' bucket)
    try {
      const { data, error } = await supabase.storage.from('reports').list('', { limit: 1 });
      if (error) {
        result.supabaseStorage = {
          status: 'error',
          message: `Storage 'reports' bucket error: ${error.message}. (Did you run the storage policies SQL?)`,
        };
      } else {
        result.supabaseStorage = {
          status: 'connected',
          message: `Public storage bucket 'reports' verified and ready for citizen photos.`,
        };
      }
    } catch (e: any) {
      result.supabaseStorage = {
        status: 'error',
        message: `Storage check failed: ${e.message}`,
      };
    }
  }

  // 3. Check Google Gemini Flash Vision API
  const cleanKey = (config.geminiApiKey || '').trim().replace(/^["']|["']$/g, '');
  if (!cleanKey) {
    result.geminiAi = {
      status: 'not_configured',
      message: 'Gemini API key missing. (Running in smart offline heuristic mode).',
    };
  } else {
    try {
      let isSuccess = false;
      let lastErrMsg = '';
      const testModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.6-flash'];

      for (const m of testModels) {
        try {
          const pingUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${cleanKey}`;
          const res = await fetch(pingUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Respond with "PONG"' }] }],
            }),
          });

          if (res.ok) {
            isSuccess = true;
            result.geminiAi = {
              status: 'connected',
              message: `Gemini (${m}) active & verified with your key.`,
            };
            break;
          } else {
            lastErrMsg = await res.text();
          }
        } catch (fetchErr: any) {
          lastErrMsg = fetchErr.message;
        }
      }

      if (!isSuccess) {
        result.geminiAi = {
          status: 'error',
          message: `Gemini API key verification failed: ${lastErrMsg.slice(0, 180)}`,
        };
      }
    } catch (e: any) {
      result.geminiAi = {
        status: 'error',
        message: `Gemini network check failed: ${e.message}`,
      };
    }
  }

  return result;
};
