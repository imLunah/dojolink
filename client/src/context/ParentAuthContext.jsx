import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import SessionTimeoutModal from '../components/ui/SessionTimeoutModal';

export const ParentAuthContext = createContext(null);

export function ParentAuthProvider({ children }) {
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/parent/me')
      .then(setParent)
      .catch(() => setParent(null))
      .finally(() => setLoading(false));
  }, []);

  // A parent session that has run out.
  //
  // The portal had no answer for this: every request 401'd, `parent` stayed
  // set from the last load, and the pages stayed up showing whatever they had
  // already fetched with errors underneath. A parent whose session died
  // overnight came back to a portal that looked signed in and did nothing,
  // which reads as the app being broken rather than as being signed out.
  //
  // Fired by `api/client.js` on any non-silent 401. Two guards, and both are
  // load-bearing: `parent` because a 401 before sign-in is not a timeout (it
  // is just not being signed in, which the login page already says), and the
  // path because the staff shell listens on this same event and a director is
  // also a parent — without it, whichever context saw the event first put its
  // own modal up, and the button on it signed out the wrong account.
  //
  // `/parent/me` is in SILENT_401_PATHS, so the check on first load never
  // raises this.
  useEffect(() => {
    const handler = (e) => {
      if (!String(e?.detail?.path || '').startsWith('/parent/')) return;
      if (parent) setSessionExpired(true);
    };
    window.addEventListener('session_expired', handler);
    return () => window.removeEventListener('session_expired', handler);
  }, [parent]);

  // Clearing `parent` is what sends them back: every parent route is behind
  // `ParentRoute`, which redirects to the login page's parent tab without one.
  // The navigate is there anyway, so this does not depend on where they were
  // standing when the session ran out.
  const backToLogin = () => {
    setSessionExpired(false);
    setParent(null);
    navigate('/login?tab=parent', { replace: true });
  };

  async function login(centerCode, email, keepSignedIn = false) {
    const data = await api.post('/parent/login', {
      centerCode,
      email,
      keep_signed_in: keepSignedIn,
    });
    setParent(data);
    setSessionExpired(false);
    return data;
  }

  // Onboarding's save. The server answers with the whole parent payload, so
  // the name in the nav and the onboarded flag update in one step.
  async function saveProfile(fields) {
    const data = await api.post('/parent/profile', fields);
    setParent(data);
    return data;
  }

  async function logout() {
    try {
      await api.post('/parent/logout', {});
    } finally {
      setSessionExpired(false);
      setParent(null);
    }
  }

  return (
    <ParentAuthContext.Provider value={{ parent, loading, login, logout, saveProfile }}>
      {children}
      {sessionExpired && <SessionTimeoutModal onDismiss={backToLogin} />}
    </ParentAuthContext.Provider>
  );
}

export function useParentAuth() {
  return useContext(ParentAuthContext);
}
