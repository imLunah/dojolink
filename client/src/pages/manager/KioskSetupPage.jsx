import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TabletSmartphoneIcon } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import { Link } from 'react-router-dom';
import { CARD, PANEL } from '../../lib/surfaces';
import MyStudioReconnect from '../../components/manager/MyStudioReconnect';
import { SkeletonList } from '../../components/ui/Skeleton';
import Segmented from '../../components/ui/Segmented';
import ColorPalette from '../../components/theme/ColorPalette';
import { api } from '../../api/client';

// Setting up the check-in kiosk. A center that connected MyStudio with its
// password needs nothing here: the kiosk signs itself in with that saved login.
// Otherwise sign in to MyStudio's check-in portal once, then turn a tablet
// into the kiosk. The kiosk opens in a tab beside this session. See
// server/routes/kiosk.js.

const EASE = [0.23, 1, 0.32, 1];
const field = 'w-full rounded-lg border border-ninja-border bg-white px-3 py-2 font-ninja text-sm text-ninja-navy placeholder:text-ninja-muted focus:outline-none focus:border-ninja-blue transition-colors';
const label = 'block font-ninja text-xs font-bold uppercase tracking-wide text-ninja-muted mb-1.5';
const primary = 'inline-flex items-center justify-center gap-1.5 font-ninja text-sm font-bold px-3.5 py-2 rounded-lg bg-ninja-blue text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center font-ninja text-sm font-bold px-3.5 py-2 rounded-lg border border-ninja-border text-ninja-navy hover:bg-ninja-bg transition-colors';

function SignInForm({ onDone, expired }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [branches, setBranches] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api.post('/kiosk/setup', { email, password, companyId: companyId || undefined });
      setPassword('');
      onDone(data);
    } catch (err) {
      if (err.status === 409 && err.data?.branches) {
        setBranches(err.data.branches);
        setCompanyId(err.data.branches[0]?.companyId || '');
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="font-ninja text-sm text-ninja-muted">
        {expired
          ? 'The check-in portal sign-in has expired. Sign in again to bring the kiosk back.'
          : 'Sign in with the MyStudio account you use for the check-in portal.'}
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="kiosk-email" className={label}>MyStudio email</label>
          <input id="kiosk-email" type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} className={field} required />
        </div>
        <div>
          <label htmlFor="kiosk-password" className={label}>Password</label>
          <input id="kiosk-password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className={field} required />
        </div>
      </div>
      {branches && (
        <div>
          <label htmlFor="kiosk-branch" className={label}>Center</label>
          <select id="kiosk-branch" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={field}>
            {branches.map((b) => (
              <option key={b.companyId} value={b.companyId}>{b.companyName || b.companyId}</option>
            ))}
          </select>
        </div>
      )}
      {error && <p role="alert" className="font-ninja text-sm font-semibold text-ninja-red">{error}</p>}
      <button type="submit" disabled={busy || !email || !password} className={primary}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function KioskSetupPage() {
  const [setup, setSetup] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reload = () => api.get('/kiosk/setup').then(setSetup).catch((err) => setLoadError(err.message));
  useEffect(() => { reload(); }, []);

  // Optimistic: the control moves at once and goes back if the save fails.
  const saveSetting = async (change) => {
    const before = setup;
    setSetup({ ...setup, ...change });
    setError('');
    try {
      setSetup(await api.patch('/kiosk/setup', change));
    } catch (err) {
      setSetup(before);
      setError(err.message);
    }
  };

  const setFlow = (flow) => { if (flow !== setup.flow) saveSetting({ flow }); };

  // The native picker fires on every step of a drag. The color follows it on
  // screen at once and is saved once the dragging stops.
  const pickTimer = useRef(null);
  useEffect(() => () => clearTimeout(pickTimer.current), []);
  const pickCustom = (value) => {
    const color = String(value).toLowerCase();
    setSetup((cur) => ({ ...cur, color }));
    clearTimeout(pickTimer.current);
    pickTimer.current = setTimeout(async () => {
      setError('');
      try {
        setSetup(await api.patch('/kiosk/setup', { color }));
      } catch (err) {
        setError(err.message);
      }
    }, 600);
  };
  // 'default' from the palette is DojoLink's own blue, stored as no color.
  const setColor = (value) => {
    const color = value === 'default' ? null : String(value).toLowerCase();
    if (color !== (setup.color || null)) saveSetting({ color });
  };

  const turnOn = async () => {
    setBusy(true);
    setError('');
    try {
      setSetup(await api.post('/kiosk/setup', {}));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError('');
    try {
      setSetup(await api.delete('/kiosk/setup'));
      setConfirmDisconnect(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const ready = setup?.connected && setup.status === 'connected';

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}>
          <h1 className="font-ninja font-extrabold text-2xl text-ninja-navy">Kiosk</h1>
          <p className="font-ninja text-sm text-ninja-muted mt-0.5">
            Families check their ninja in on a tablet. Each check-in goes to MyStudio and onto Today's Board.
          </p>
        </motion.header>

        {!setup && !loadError && <SkeletonList rows={3} />}
        {loadError && <p role="alert" className="font-ninja text-sm font-semibold text-ninja-red">{loadError}</p>}

        {setup && (
          <>
            <section className={`${CARD} p-5 space-y-4`}>
              <h2 className="font-ninja font-extrabold text-base text-ninja-navy">MyStudio check-in portal</h2>
              {setup.configured === false ? (
                <p className="font-ninja text-sm text-ninja-muted">MyStudio is not set up on this server.</p>
              ) : setup.blocked ? (
                // The kiosk runs only while the center's MyStudio connection
                // does. Greyed behind the same repair the Daily schedule card
                // offers; the two panels share one grid cell so the card grows
                // with the reconnect form instead of clipping it.
                <div className="grid">
                  <div aria-hidden className="col-start-1 row-start-1 space-y-3 blur-[3px] opacity-50 select-none pointer-events-none">
                    <p className="font-ninja text-sm text-ninja-navy">Signed in as a MyStudio account for this center.</p>
                    <p className="font-ninja text-sm font-bold text-ninja-muted">Turn off</p>
                  </div>
                  <div className={`col-start-1 row-start-1 ${PANEL} p-3.5`}>
                    <p className="font-ninja text-sm font-bold text-ninja-navy">
                      {setup.blocked === 'expired' ? 'The MyStudio connection ran out' : "MyStudio isn't connected"}
                    </p>
                    <div className="mt-2">
                      {setup.blocked === 'expired' ? (
                        <MyStudioReconnect onConnected={reload} />
                      ) : (
                        <Link to="/account?mystudio=1" className="font-ninja text-sm font-semibold text-ninja-blue hover:underline">
                          Connect it from Account settings
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ) : ready ? (
                <div className="space-y-3">
                  <p className="font-ninja text-sm text-ninja-navy">
                    Signed in as <span className="font-bold">{setup.loginEmail}</span>
                    {setup.companyName && <> for <span className="font-bold">{setup.companyName}</span></>}.
                  </p>
                  {confirmDisconnect ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={disconnect} disabled={busy}
                        className="font-ninja text-sm font-bold px-3.5 py-2 rounded-lg bg-ninja-red text-white disabled:opacity-50">
                        Turn off
                      </button>
                      <button type="button" onClick={() => setConfirmDisconnect(false)} className={secondary}>Keep on</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDisconnect(true)}
                      className="font-ninja text-sm font-bold text-ninja-muted hover:text-ninja-red transition-colors">
                      Turn off
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {setup.off && (
                    <p className="font-ninja text-sm text-ninja-navy">The kiosk is turned off.</p>
                  )}
                  {setup.canUseSavedLogin && (
                    <button type="button" onClick={turnOn} disabled={busy} className={primary}>
                      {busy ? 'Turning on…' : 'Turn on with your MyStudio connection'}
                    </button>
                  )}
                  {setup.canUseSavedLogin && !setup.off && (
                    <p className="font-ninja text-sm text-ninja-muted">
                      Signing in with your saved MyStudio login didn't work. Try again, or sign in below.
                    </p>
                  )}
                  <SignInForm expired={setup.connected && setup.status === 'expired'} onDone={setSetup} />
                </div>
              )}
            </section>

            {ready && (
              <section className={`${CARD} p-5 space-y-3`}>
                <h2 className="font-ninja font-extrabold text-base text-ninja-navy">Start with</h2>
                <Segmented
                  label="Start with"
                  layoutId="kiosk-flow"
                  value={setup.flow || 'name'}
                  onChange={setFlow}
                  options={[
                    { value: 'name', label: "Ninja's name" },
                    { value: 'class', label: 'Class' },
                  ]}
                />
                <p className="font-ninja text-sm text-ninja-muted">
                  {(setup.flow || 'name') === 'class'
                    ? "Families pick today's class, then find their ninja in it."
                    : 'Families find their ninja, then pick one of their classes.'}
                </p>
              </section>
            )}

            {ready && (
              <section className={`${CARD} p-5 space-y-4`}>
                <h2 className="font-ninja font-extrabold text-base text-ninja-navy">Color</h2>
                <div className="flex flex-wrap items-center gap-4">
                  <ColorPalette value={setup.color || 'default'} onChange={setColor} />
                  <label className="relative flex items-center gap-2 font-ninja text-sm font-bold text-ninja-navy cursor-pointer">
                    <span
                      className="w-7 h-7 rounded-full ring-1 ring-black/10"
                      style={{ background: 'conic-gradient(#ef4444, #eab308, #22c55e, #14b8a6, #3b82f6, #8b5cf6, #ec4899, #ef4444)' }}
                      aria-hidden
                    />
                    Custom
                    <input
                      type="color"
                      aria-label="Custom kiosk color"
                      value={setup.color || '#006add'}
                      onChange={(e) => pickCustom(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </label>
                </div>
              </section>
            )}

            <section className={`${CARD} p-5 space-y-4 ${ready ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-3">
                <TabletSmartphoneIcon size={20} strokeWidth={1.9} className="flex-shrink-0 text-ninja-muted" aria-hidden />
                <div className="min-w-0">
                  <h2 className="font-ninja font-extrabold text-base text-ninja-navy">Open the kiosk</h2>
                </div>
              </div>
              <button type="button" disabled={!ready} onClick={() => window.open('/kiosk', '_blank', 'noopener')} className={primary}>
                Open in a new tab
              </button>
            </section>

            {error && <p role="alert" className="font-ninja text-sm font-semibold text-ninja-red">{error}</p>}
          </>
        )}
      </div>
    </Layout>
  );
}
