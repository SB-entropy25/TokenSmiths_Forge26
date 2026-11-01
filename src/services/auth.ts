import { getSupabaseClient } from './supabaseClient';
import { Ticket, Cluster } from '../types';
import { fetchLiveClusters } from './api';

export interface CitizenUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  avatar_url?: string;
  provider: 'google' | 'demo';
}

const CITIZEN_SESSION_KEY = 'CIVIC_CITIZEN_SESSION';

// Get active session from memory/localStorage
export const getStoredCitizen = (): CitizenUser | null => {
  try {
    const raw = localStorage.getItem(CITIZEN_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse citizen session', e);
  }
  return null;
};

export const setStoredCitizen = (user: CitizenUser | null) => {
  try {
    if (user) {
      localStorage.setItem(CITIZEN_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CITIZEN_SESSION_KEY);
    }
  } catch (e) {
    console.warn('Failed to save citizen session', e);
  }
};

/**
 * Sign In with Google via Supabase OAuth
 */
export const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase client not connected. Check .env' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.warn('Supabase Google OAuth initiation error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Google Auth failed' };
  }
};

/**
 * Quick Google Demo Sign-In (For local dev / hackathon when Google OAuth Client ID is not yet registered in GCP)
 */
export const signInWithGoogleMock = async (
  email: string,
  name: string,
  mobile: string
): Promise<CitizenUser> => {
  const user: CitizenUser = {
    id: `citizen-${Date.now()}`,
    email: email.trim().toLowerCase(),
    name: name.trim(),
    mobile: mobile.trim(),
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    provider: 'demo',
  };

  setStoredCitizen(user);
  await saveCitizenProfileToDb(user);
  return user;
};

/**
 * Sign Out
 */
export const signOutCitizen = async () => {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Ignore
    }
  }
  setStoredCitizen(null);
};

/**
 * Save / Update Citizen Profile in Supabase
 */
export const saveCitizenProfileToDb = async (user: CitizenUser) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    await supabase.from('citizen_profiles').upsert({
      id: user.id.includes('-') && user.id.length >= 32 ? user.id : undefined,
      email: user.email.toLowerCase(),
      name: user.name,
      mobile: user.mobile,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.info('Note: citizen_profiles table write completed or skipped:', err);
  }
};

/**
 * Fetch Citizen Profile from Supabase
 */
export const fetchCitizenProfileFromDb = async (email: string): Promise<CitizenUser | null> => {
  const supabase = getSupabaseClient();
  if (!supabase || !email) return null;

  try {
    const { data } = await supabase
      .from('citizen_profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        id: data.id || `citizen-${Date.now()}`,
        name: data.name,
        email: data.email,
        mobile: data.mobile || '',
        provider: 'google',
      };
    }
  } catch (err) {
    console.warn('Error reading citizen profile from Supabase:', err);
  }
  return null;
};

/**
 * Fetch all complaints belonging to this citizen (by email or user ID)
 */
export const fetchCitizenComplaints = async (email: string): Promise<Array<{ ticket: Ticket; cluster: Cluster }>> => {
  const cleanEmail = email.trim().toLowerCase();
  const clusters = await fetchLiveClusters();

  const results: Array<{ ticket: Ticket; cluster: Cluster }> = [];

  for (const cluster of clusters) {
    if (!cluster.tickets) continue;
    for (const ticket of cluster.tickets) {
      if (ticket.email && ticket.email.toLowerCase() === cleanEmail) {
        results.push({ ticket, cluster });
      }
    }
  }

  // Sort newest first
  return results.sort((a, b) => new Date(b.ticket.created_at).getTime() - new Date(a.ticket.created_at).getTime());
};
