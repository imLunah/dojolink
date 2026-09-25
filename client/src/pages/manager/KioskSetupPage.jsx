import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TabletSmartphoneIcon } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import { Link } from 'react-router-dom';
import { CARD } from '../../lib/surfaces';
import MyStudioReconnect from '../../components/manager/MyStudioReconnect';
import { SkeletonList } from '../../components/ui/Skeleton';
import Segmented from '../../components/ui/Segmented';
import ColorPalette from '../../components/theme/ColorPalette';
import { api } from '../../api/client';

// Setting up the check-in kiosk. The kiosk signs itself in to MyStudio's
// check-in portal with the center's saved MyStudio login, so there is no
// password to type here: when that fails, the repair is the same emailed-code
// reconnect the Daily schedule card uses. The kiosk opens in a tab beside this
// session. See server/routes/kiosk.js.

const EASE = [0.23, 1, 0.32, 1];
const primary = 'inline-flex items-center justify-center gap-1.5 font-ninja text-sm font-bold px-3.5 py-2 rounded-lg bg-ninja-blue text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center font-ninja text-sm font-bold px-3.5 py-2 rounded-lg border border-ninja-border text-ninja-navy hover:bg-ninja-bg transition-colors';

// How far from now a class's start can be and still show on the kiosk. The
// number is typed and saved when the field is left or Enter is pressed, so a
// half-typed "6" on the way to 60 is never saved.
function ClassWindowSetting({ minutes, onSave }) {
  const [draft, setDraft] = useState(String(minutes || 60));
  const [bad, setBad] = useState(false);
  useEffect(() => { if (minutes) setDraft(String(minutes)); }, [minutes]);

  const on = Boolean(minutes);
  const commit = () => {
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 5 || n > 720) { setBad(true); return; }
    setBad(false);
    if (n !== minutes) onSave(n);
  };

  return (
    <div className="space-y-3">
      <Segmented
        label="Classes shown"
        layoutId="kiosk-window"
        value={on ? 'near' : 'day'}
        onChange={(v) => {
          if (v === 'day' && on) onSave(null);
          if (v === 'near' && !on) { const n = Number(draft); onSave(Number.isInteger(n) && n >= 5 && n <= 720 ? n : 60); }
        }}
        options={[
          { value: 'day', label: 'All day' },
          { value: 'near', label: 'Near now' },
        ]}
      />
      {on ? (
        <div className="flex flex-wrap items-center gap-2 font-ninja text-sm text-ninja-navy">
          <span>Classes starting within</span>
          <input
            type="number" inputMode="numeric" min={5} max={720} step={5}
            aria-label="Minutes before and after now"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setBad(false); }}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className="w-20 rounded-lg border border-ninja-border bg-white px-2.5 py-1.5 font-ninja text-sm text-ninja-navy tabular-nums focus:outline-none focus:border-ninja-blue"
          />
          <span>minutes of now, before or after.</span>
          {bad && <span role="alert" className="w-full font-semibold text-ninja-red">Use a number from 5 to 720.</span>}
        </div>
      ) : (
        <p className="font-ninja text-sm text-ninja-muted">Every class left today is shown.</p>
      )}
    </div>
  );
}

// What each MyStudio class name is at this center. Centers name classes
// their own way ("Robotics", "CREATE - Coding", "CLUBS: Minecraft") and the
// kiosk only places a name that is exactly a program's, so the rest landed on
// Today's Board with no program. A class mapped to a club puts the ninja in
// today's session of that club instead of on the board.
// See server/lib/classMappings.js.
function ClassNames() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/kiosk/class-mappings').then(setData).catch((err) => setError(err.message));
  }, []);

  const valueOf = (c) => (c.clubId ? `c:${c.clubId}` : c.program ? `p:${c.program}` : c.automatic ? `p:${c.automatic}` : '');

  const save = async (c, value) => {
    const program = value.startsWith('p:') ? value.slice(2) : null;
    const clubId = value.startsWith('c:') ? Number(value.slice(2)) : null;
    // Picking the program the name already matches on its own is the same as
    // no mapping, so it clears rather than storing a copy of the rule.
    const clear = !value || (program && program === c.automatic);
    const before = data;
    setData({
      ...data,
      classes: data.classes.map((x) => (x.title === c.title
        ? { ...x, program: clear ? null : program, clubId: clear ? null : clubId }
        : x)),
    });
    setError('');
    try {
      setData(await api.put('/kiosk/class-mappings', clear ? { title: c.title } : { title: c.title, program, clubId }));
    } catch (err) {
      setData(before);
      setError(err.message);
    }
  };

  if (!data && !error) return null;
  if (data && !data.classes.length) return null;

  return (
    <section className={`${CARD} p-5 space-y-3`}>
      <h2 className="font-ninja font-extrabold text-base text-ninja-navy">MyStudio class names</h2>
      {data && (
        <ul className="divide-y divide-ninja-border">
          {data.classes.map((c) => (
            <li key={c.title} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="font-ninja text-sm font-bold text-ninja-navy min-w-0 break-words">{c.title}</span>
              <select
                aria-label={`What ${c.title} is`}
                value={valueOf(c)}
                onChange={(e) => save(c, e.target.value)}
                className="w-48 rounded-lg border border-ninja-border bg-white px-2.5 py-1.5 font-ninja text-sm text-ninja-navy focus:outline-none focus:border-ninja-blue"
              >
                {!c.automatic && <option value="">Not set</option>}
                <optgroup label="Programs">
                  {data.programs.map((p) => <option key={p} value={`p:${p}`}>{p}</option>)}
                </optgroup>
                {data.clubs.length > 0 && (
                  <optgroup label="Clubs">
                    {data.clubs.map((club) => <option key={club.id} value={`c:${club.id}`}>{club.name}</option>)}
                  </optgroup>
                )}
              </select>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="font-ninja text-sm font-semibold text-ninja-red">{error}</p>}
    </section>
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
                // does, so this offers the same repair as the Daily schedule
                // card, on its own.
                <div>
                  <p className="font-ninja text-sm font-bold text-ninja-navy">
                    {setup.blocked === 'expired'
                      ? 'The MyStudio connection ran out'
                      : setup.blocked === 'off'
                        ? 'The kiosk is turned off for this center'
                        : "MyStudio isn't connected"}
                  </p>
                  <div className="mt-2 max-w-md">
                    {setup.blocked === 'off' ? (
                      <Link to="/account?mystudio=1" className="font-ninja text-sm font-semibold text-ninja-blue hover:underline">
                        Turn it on from Account settings
                      </Link>
                    ) : setup.blocked === 'expired' ? (
                      <MyStudioReconnect onConnected={reload} />
                    ) : (
                      <Link to="/account?mystudio=1" className="font-ninja text-sm font-semibold text-ninja-blue hover:underline">
                        Connect it from Account settings
                      </Link>
                    )}
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
                <div className="space-y-3">
                  {setup.off && setup.canUseSavedLogin ? (
                    <>
                      <p className="font-ninja text-sm text-ninja-navy">The kiosk is turned off.</p>
                      <button type="button" onClick={turnOn} disabled={busy} className={primary}>
                        {busy ? 'Turning on…' : 'Turn on'}
                      </button>
                    </>
                  ) : (
                    // The kiosk signs in with the center's MyStudio login, so
                    // the fix is always to sign MyStudio in again, never a
                    // second password form. Once the code is in, turn the
                    // kiosk on with the login that was just saved.
                    <div>
                      <p className="font-ninja text-sm font-bold text-ninja-navy">
                        {setup.off ? 'The kiosk is turned off' : "The kiosk couldn't sign in to MyStudio"}
                      </p>
                      <div className="mt-2 max-w-md">
                        <MyStudioReconnect onConnected={turnOn} />
                      </div>
                    </div>
                  )}
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
              <section className={`${CARD} p-5 space-y-3`}>
                <h2 className="font-ninja font-extrabold text-base text-ninja-navy">Names</h2>
                <Segmented
                  label="Names"
                  layoutId="kiosk-names"
                  value={setup.showNames === false ? 'search' : 'all'}
                  onChange={(v) => { const showNames = v === 'all'; if (showNames !== (setup.showNames !== false)) saveSetting({ showNames }); }}
                  options={[
                    { value: 'all', label: 'Show all' },
                    { value: 'search', label: 'Only when searched' },
                  ]}
                />
                <p className="font-ninja text-sm text-ninja-muted">
                  {setup.showNames === false
                    ? 'Nobody is listed until a family types at least two letters of a name.'
                    : "Everyone who can check in is listed before anyone types."}
                </p>
              </section>
            )}

            {ready && (
              <section className={`${CARD} p-5 space-y-3`}>
                <h2 className="font-ninja font-extrabold text-base text-ninja-navy">Classes shown</h2>
                <ClassWindowSetting
                  minutes={setup.classWindowMinutes || null}
                  onSave={(classWindowMinutes) => saveSetting({ classWindowMinutes })}
                />
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

            {ready && <ClassNames />}

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
