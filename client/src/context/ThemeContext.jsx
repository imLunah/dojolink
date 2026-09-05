import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { getAccent, buildAccentTokens, buildCustomTokens, isDefaultAccent, isCustomAccent } from '../lib/accents';

const ThemeContext = createContext(null);

const ACCENT_VARS = ['--ninja-blue', '--ninja-blue-hover', '--ninja-blue-ink'];
// Cleared on every apply so any stale tint from older builds (which used to
// recolor the surfaces) goes away — accent now only touches the brand color.
const STALE_TINT_VARS = ['--ninja-bg', '--ninja-border', '--ninja-navy', '--ninja-muted'];

// Write the accent CSS vars straight to <html>. Pure DOM — no React, no
// storage — so it's cheap enough to call on every drag frame.
function writeAccentVars(accent, dark) {
  const root = document.documentElement;
  STALE_TINT_VARS.forEach((v) => root.style.removeProperty(v));
  if (isDefaultAccent(accent)) {
    ACCENT_VARS.forEach((v) => root.style.removeProperty(v));
    return;
  }
  const tokens = isCustomAccent(accent) ? buildCustomTokens(accent, dark) : buildAccentTokens(getAccent(accent), dark);
  for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('dj-theme');
      return saved === null ? true : saved === 'dark';
    } catch { return true; }
  });

  // 'default' = original DojoLink theme (no accent tint). Otherwise an accent id.
  const [accent, setAccentState] = useState(() => {
    try { return localStorage.getItem('dj-accent') || 'default'; } catch { return 'default'; }
  });

  // Per-device opt-in for in-progress / power-user features (theme customizer,
  // etc). Off by default. Read synchronously so gated routes never flash.
  const [experimental, setExperimentalState] = useState(() => {
    try { return localStorage.getItem('dj-experimental') === '1'; } catch { return false; }
  });
  // Display setting, desktop-only: move the nav from the sidebar to a
  // horizontal top bar. Per-device, so no account sync.
  const [horizontalNav, setHorizontalNavState] = useState(() => {
    try { return localStorage.getItem('dj-nav-horizontal') === '1'; } catch { return false; }
  });
  const setHorizontalNav = useCallback((v) => {
    const on = !!v;
    setHorizontalNavState(on);
    try { localStorage.setItem('dj-nav-horizontal', on ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  const setExperimental = useCallback((v) => {
    const on = !!v;
    setExperimentalState(on);
    try { localStorage.setItem('dj-experimental', on ? '1' : '0'); } catch { /* ignore */ }
    if (!on) {
      // Turning the flag off resets everything it unlocked: the accent goes
      // back to the stock theme, and the rev bump persists that to the account.
      setAccentState('default');
      setRev((r) => r + 1);
    }
  }, []);

  // ── Light lock ─────────────────────────────────────────────────────
  // A surface that is light-only (the parent portal) holds a lock while it
  // is mounted; the page paints light without the stored preference
  // changing, so a staff member's dark mode is waiting when they come back.
  const [lightLocks, setLightLocks] = useState(0);
  const lockLight = useCallback(() => {
    setLightLocks((n) => n + 1);
    return () => setLightLocks((n) => n - 1);
  }, []);
  const paintDark = dark && lightLocks === 0;

  // ── Mode (light/dark) ──────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('dj-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    if (paintDark) root.classList.add('dark');
    else root.classList.remove('dark');
    const t = setTimeout(() => root.classList.remove('theme-transitioning'), 400);
    return () => clearTimeout(t);
  }, [paintDark]);

  // ── Accent → retint the whole theme, or clear for Default ───────────
  // Inline vars on <html> beat both :root and .dark rules. For 'default' we
  // remove them so the stock index.css values rule again.
  useEffect(() => {
    writeAccentVars(accent, paintDark);
    localStorage.setItem('dj-accent', isDefaultAccent(accent) ? 'default' : accent);
  }, [accent, paintDark]);

  // Live, throwaway accent application for dragging — paints the CSS vars
  // without touching React state or localStorage (no app-wide re-render).
  const previewAccent = useCallback((hex) => writeAccentVars(hex, paintDark), [paintDark]);

  // rev bumps on every user-initiated change (not on hydrate) so the account-sync
  // bridge can tell a real preference change from applying the saved one.
  const [rev, setRev] = useState(0);
  const bump = () => setRev((r) => r + 1);

  const applyAccent = (id) => {
    if (isDefaultAccent(id)) return setAccentState('default');
    if (isCustomAccent(id)) return setAccentState(id);
    setAccentState(getAccent(id).id);
  };

  const toggle = () => { setDark((d) => !d); bump(); };
  const setMode = (mode) => { setDark(mode === 'dark'); bump(); };
  const setAccent = (id) => { applyAccent(id); bump(); };

  // Apply a saved theme from the account without marking it as a user change.
  const hydrate = useCallback((mode, accentId) => {
    if (mode) setDark(mode === 'dark');
    if (accentId !== undefined && accentId !== null) applyAccent(accentId);
  }, []);

  const settings = useMemo(
    () => ({ mode: dark ? 'dark' : 'light', accentColor: accent }),
    [dark, accent]
  );

  const value = useMemo(
    () => ({ dark, toggle, setMode, accent, setAccent, previewAccent, settings, rev, hydrate, experimental, setExperimental, horizontalNav, setHorizontalNav, lockLight }),
    [dark, accent, settings, previewAccent, rev, hydrate, experimental, setExperimental, horizontalNav, setHorizontalNav, lockLight]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Paint light for as long as the calling component is mounted.
export function useLightOnly() {
  const { lockLight } = useTheme();
  useEffect(() => lockLight(), [lockLight]);
}
