import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TabletSmartphoneIcon } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import { CARD } from '../../lib/surfaces';
import { SkeletonList } from '../../components/ui/Skeleton';
import { api } from '../../api/client';

// Setting up the check-in kiosk. A center that connected MyStudio with its
// password needs nothing here: the kiosk signs itself in with that saved login.
// Otherwise sign in to MyStudio's check-in portal once, then turn a tablet
// into the kiosk. Starting the kiosk signs
// this device out of DojoLink, so a family at the tablet cannot reach the app
// behind it. See server/routes/kiosk.js.

const EASE = [0.23, 1, 0.32, 1];
const field = 'w-full rounded-lg border border-ninja-border bg-white px-3 py-2 font-ninja text-sm text-ninja-navy placeholder:text-ninja-muted focus:outline-none focus:border-ninja-blue transition-colors';
const label = 'block font-ninja text-xs font-bold uppercase tracking-wide text-ninja-muted mb-1.5';
const primary = 'inline-flex items-center justify-center gap-1.5 font-ninja text-sm font-bold px-3.5 py-2 rounded-lg bg-ninja-blue text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center font-ninja text-sm font-bold px-3.5 py-2 rounded-lg border border-ninja-border text-ninja-navy hover:bg-ninja-bg transition-colors';

function fmtWhen(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

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
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/kiosk/setup').then(setSetup).catch((err) => setLoadError(err.message));
  }, []);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/kiosk/start', {});
      // A full load, not a route change: the staff session is gone and every
      // context holding it has to start over.
      window.location.assign('/kiosk');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
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
              ) : ready ? (
                <div className="space-y-3">
                  <p className="font-ninja text-sm text-ninja-navy">
                    Signed in as <span className="font-bold">{setup.loginEmail}</span>
                    {setup.companyName && <> for <span className="font-bold">{setup.companyName}</span></>}.
                  </p>
                  <p className="font-ninja text-xs text-ninja-muted">
                    {[setup.connectedByName && `Set up by ${setup.connectedByName}`, fmtWhen(setup.connectedAt)].filter(Boolean).join(' · ')}
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

            <section className={`${CARD} p-5 space-y-4 ${ready ? '' : 'opacity-60'}`}>
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-ninja-blue/10 text-ninja-blue-ink flex-shrink-0">
                  <TabletSmartphoneIcon size={20} strokeWidth={1.9} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="font-ninja font-extrabold text-base text-ninja-navy">Start the kiosk</h2>
                  <p className="font-ninja text-sm text-ninja-muted mt-0.5">
                    <span className="font-bold text-ninja-navy">Lock this device</span> signs it out of DojoLink and turns it into the check-in screen. A staff username and password takes it back out.
                  </p>
                  <p className="font-ninja text-sm text-ninja-muted mt-1.5">
                    <span className="font-bold text-ninja-navy">Open in a new tab</span> keeps you signed in, so anyone at the screen can reach DojoLink as you. Use it where staff can see the screen, or with the tablet locked to that tab.
                  </p>
                </div>
              </div>
              {confirmStart ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={start} disabled={busy} className={primary}>
                    {busy ? 'Starting…' : 'Sign out and start'}
                  </button>
                  <button type="button" onClick={() => setConfirmStart(false)} className={secondary}>Cancel</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={!ready} onClick={() => setConfirmStart(true)} className={primary}>
                    Lock this device
                  </button>
                  <button type="button" disabled={!ready} onClick={() => window.open('/kiosk', '_blank', 'noopener')}
                    className={`${secondary} disabled:opacity-50`}>
                    Open in a new tab
                  </button>
                </div>
              )}
            </section>

            {error && <p role="alert" className="font-ninja text-sm font-semibold text-ninja-red">{error}</p>}
          </>
        )}
      </div>
    </Layout>
  );
}
