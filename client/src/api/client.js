const BASE = '/api';

// Paths where a 401 is expected (not a timeout — just "not logged in")
const SILENT_401_PATHS = ['/auth/me', '/parent/me'];

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401 && !SILENT_401_PATHS.includes(path)) {
      // The path rides along because both shells listen on this one event and
      // a person can hold BOTH sessions at once — a director is also a parent.
      // Without it, a parent-side 401 raises the staff modal over the parent
      // portal, and the button on it signs out the wrong account.
      window.dispatchEvent(new CustomEvent('session_expired', { detail: { path } }));
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(err.error || 'Request failed');
    // The message is what gets shown; these are for the callers that need to
    // branch on which kind of failure it was rather than just report it.
    error.status = res.status;
    error.data = err;
    throw error;
  }
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
