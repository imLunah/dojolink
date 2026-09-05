import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { invalidateCurriculumCache } from './CurriculumContext';
import SessionTimeoutModal from '../components/ui/SessionTimeoutModal';

export const AuthContext = createContext(null);

// The session cookie is httpOnly, so the app cannot read it. This flag is the hint that a
// staff session probably exists, and the landing page uses it to decide whether waiting on
// /auth/me is worth a blank screen. It never grants anything — the server still decides.
const SESSION_HINT = 'dj-session';

export function hadSession() {
  try { return localStorage.getItem(SESSION_HINT) === '1'; } catch { return false; }
}

function setSessionHint(on) {
  try {
    if (on) localStorage.setItem(SESSION_HINT, '1');
    else localStorage.removeItem(SESSION_HINT);
  } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [viewAs, setViewAs] = useState(null);

  useEffect(() => {
    api.get('/auth/me')
      .then((data) => { setUser(data); setSessionHint(true); })
      .catch(() => { setUser(null); setSessionHint(false); })
      .finally(() => setLoading(false));
  }, []);

  // Listen for 401s fired by api/client.js — only show modal if already logged
  // in, and only for a request that was on the staff side. A parent-portal 401
  // is the parent session dying, not this one.
  useEffect(() => {
    const handler = (e) => {
      if (String(e?.detail?.path || '').startsWith('/parent/')) return;
      if (user) setSessionExpired(true);
    };
    window.addEventListener('session_expired', handler);
    return () => window.removeEventListener('session_expired', handler);
  }, [user]);

  async function login(username, password, keepSignedIn = false) {
    const data = await api.post('/auth/login', { username, password, keep_signed_in: keepSignedIn });
    setUser(data);
    setSessionHint(true);
    return data;
  }

  async function logout() {
    try {
      await api.post('/auth/logout', {});
    } finally {
      invalidateCurriculumCache();
      setViewAs(null);
      setUser(null);
      setSessionHint(false);
    }
  }

  const switchLocation = async (locationId) => {
    const data = await api.post('/auth/switch-location', { locationId });
    setUser(prev => ({ ...prev, activeLocation: data.activeLocation }));
  };

  // Read-only when a non-admin is viewing a center they're not assigned to. Admins write
  // everywhere; senseis only ever switch within their membership so they're never read-only.
  const isReadOnly = user?.role !== 'admin' &&
    !!user?.activeLocation &&
    !(user?.locationIds || []).includes(user?.activeLocation?.id);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, switchLocation, isReadOnly, viewAs, setViewAs }}>
      {children}
      {sessionExpired && (
        <SessionTimeoutModal onDismiss={() => { setSessionExpired(false); setUser(null); }} />
      )}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  return useContext(AuthContext);
}
