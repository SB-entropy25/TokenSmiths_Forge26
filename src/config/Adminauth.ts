// Admin authentication (demo-grade).
// Credentials come from .env (VITE_ADMIN_USERNAME / VITE_ADMIN_PASSWORD).
// NOTE: VITE_* variables are compiled into the client bundle, so this keeps casual users
// out of the admin panel but is not a substitute for server-side auth + RLS.

const SESSION_KEY = 'CIVIC_ADMIN_SESSION';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const readEnv = () => {
    const env = (import.meta as any).env || {};
    return {
        username: String(env.VITE_ADMIN_USERNAME || '').trim(),
        password: String(env.VITE_ADMIN_PASSWORD || ''),
    };
};

export const isAdminConfigured = (): boolean => {
    const { username, password } = readEnv();
    return Boolean(username && password);
};

export const adminLogin = (username: string, password: string): boolean => {
    const creds = readEnv();
    if (!creds.username || !creds.password) return false;
    if (username.trim() === creds.username && password === creds.password) {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ exp: Date.now() + SESSION_TTL_MS }));
        } catch {
            /* ignore */
        }
        return true;
    }
    return false;
};

export const isAdminAuthenticated = (): boolean => {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return false;
        const { exp } = JSON.parse(raw);
        if (typeof exp === 'number' && exp > Date.now()) return true;
        sessionStorage.removeItem(SESSION_KEY);
    } catch {
        /* ignore */
    }
    return false;
};

export const adminLogout = () => {
    try {
        sessionStorage.removeItem(SESSION_KEY);
    } catch {
        /* ignore */
    }
};