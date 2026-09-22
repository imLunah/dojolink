import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';
import Logo from '../components/ui/Logo';
import Modal from '../components/ui/Modal';
import { api } from '../api/client';
import { useLightOnly } from '../context/ThemeContext';

// The check-in kiosk: a tablet on the front counter where a family finds their
// ninja, picks one of today's classes and checks in. A child with no place in
// the class is booked into it first, the way MyStudio's own kiosk does; the
// server decides which classes a membership may join. Runs on a kiosk session,
// which is a center and nothing else, so nothing behind this page is reachable
// from it.

const EASE = [0.23, 1, 0.32, 1];

// A finished, undone or failed screen counts down on its button and then goes
// back to the name search by itself, so the next family never finds the last
// one's name on screen. A half-finished search or class pick goes back after
// a stretch with no taps.
const AUTO_BACK_S = 10;
const IDLE_MS = 30000;
const AUTO_BACK_STEPS = new Set(['done', 'undone', 'error']);

// MyStudio sends "04:00 PM".
const fmtTime = (t) => String(t || '').replace(/^0(\d)/, '$1');

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function StaffExit({ open, onClose }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) { setUsername(''); setPassword(''); setError(''); }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/kiosk/exit', { username, password });
      window.location.assign('/login');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const field = 'w-full rounded-lg border border-ninja-border bg-white px-3 py-2.5 font-ninja text-base text-ninja-navy focus:outline-none focus:border-ninja-blue';
  return (
    <Modal isOpen={open} onClose={onClose} title="Leave kiosk mode" width="max-w-sm">
      <form onSubmit={submit} className="space-y-3">
        <input aria-label="Staff username" placeholder="Staff username" autoComplete="off" autoCapitalize="none"
          value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
        <input aria-label="Password" placeholder="Password" type="password" autoComplete="off"
          value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
        {error && <p role="alert" className="font-ninja text-sm font-semibold text-ninja-red">{error}</p>}
        <button type="submit" disabled={busy || !username || !password}
          className="w-full font-ninja text-sm font-bold px-4 py-2.5 rounded-lg bg-ninja-blue text-white disabled:opacity-50">
          {busy ? 'Checking…' : 'Leave kiosk mode'}
        </button>
      </form>
    </Modal>
  );
}

function Screen({ children, k }) {
  return (
    <motion.div key={k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: EASE }} className="w-full">
      {children}
    </motion.div>
  );
}

export default function KioskPage() {
  useLightOnly();
  const now = useClock();
  const [me, setMe] = useState(undefined);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [member, setMember] = useState(null);
  const [classes, setClasses] = useState(null);
  const [picked, setPicked] = useState(null);
  // What the confirm screen is about to do to `picked`: check in, or undo.
  const [mode, setMode] = useState('checkin');
  const [step, setStep] = useState('search'); // search | classes | confirm | working | done | undone | error
  const [secondsLeft, setSecondsLeft] = useState(AUTO_BACK_S);
  const [outcome, setOutcome] = useState(null);
  const [staffOpen, setStaffOpen] = useState(false);
  const inputRef = useRef(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    api.get('/kiosk/me').then(setMe).catch(() => setMe(null));
  }, []);

  const reset = useCallback(() => {
    setQuery('');
    setResults([]);
    setMember(null);
    setClasses(null);
    setPicked(null);
    setMode('checkin');
    setOutcome(null);
    setStep('search');
  }, []);

  // Search as the name is typed, a beat after the last keystroke.
  useEffect(() => {
    if (step !== 'search') return undefined;
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return undefined; }
    setSearching(true);
    const seq = ++searchSeq.current;
    const id = setTimeout(async () => {
      try {
        const data = await api.get(`/kiosk/search?q=${encodeURIComponent(q)}`);
        if (seq !== searchSeq.current) return;
        setUnavailable(Boolean(data.unavailable));
        setResults(data.results || []);
      } catch (err) {
        if (seq !== searchSeq.current) return;
        setOutcome({ error: err.message });
        setStep('error');
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query, step]);

  // The count shown on the button is the timer, so the two cannot disagree.
  useEffect(() => {
    if (!AUTO_BACK_STEPS.has(step)) return undefined;
    setSecondsLeft(AUTO_BACK_S);
    const id = setInterval(() => setSecondsLeft((n) => n - 1), 1000);
    return () => clearInterval(id);
  }, [step]);
  useEffect(() => {
    if (AUTO_BACK_STEPS.has(step) && secondsLeft <= 0) reset();
  }, [step, secondsLeft, reset]);

  useEffect(() => {
    if (step === 'classes' || step === 'confirm' || (step === 'search' && query)) {
      const id = setTimeout(reset, IDLE_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [step, query, reset]);

  useEffect(() => {
    if (step === 'search' && me && !staffOpen) inputRef.current?.focus();
  }, [step, me, staffOpen]);

  const pickMember = async (m) => {
    setMember(m);
    setClasses(null);
    setStep('classes');
    try {
      const data = await api.get(`/kiosk/classes?participantId=${encodeURIComponent(m.participantId)}`);
      setClasses(data.classes || []);
    } catch (err) {
      setOutcome({ error: err.message });
      setStep('error');
    }
  };

  const confirm = async () => {
    if (!picked || !member) return;
    setStep('working');
    try {
      const body = { participantId: member.participantId, classKey: picked.classKey };
      if (mode === 'undo') {
        setOutcome(await api.post('/kiosk/undo', body));
        setStep('undone');
      } else {
        setOutcome(await api.post('/kiosk/checkin', body));
        setStep('done');
      }
    } catch (err) {
      setOutcome({ error: err.message });
      setStep('error');
    }
  };

  const askUndo = (c) => {
    setPicked(c);
    setMode('undo');
    setStep('confirm');
  };

  if (me === undefined) return <div className="min-h-[100dvh] bg-ninja-bg" />;

  if (me === null) {
    return (
      <div className="min-h-[100dvh] bg-ninja-bg flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Logo className="h-9" />
        <p className="font-ninja text-base text-ninja-navy max-w-sm">
          This device isn't set up as a check-in kiosk. A center director can start one from Kiosk in DojoLink.
        </p>
        <a href="/login" className="font-ninja text-sm font-bold text-ninja-blue-ink">Sign in to DojoLink</a>
      </div>
    );
  }

  const q = query.trim();
  const closed = !me.ready || unavailable;

  return (
    <div className="min-h-[100dvh] bg-ninja-bg flex flex-col">
      <header className="flex items-start justify-between gap-4 px-6 sm:px-10 pt-6">
        <div>
          <p className="font-ninja font-bold text-sm text-ninja-muted">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <p className="font-ninja font-extrabold text-2xl text-ninja-navy tabular-nums">
            {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <Logo className="h-8" />
      </header>

      <main className="flex-1 flex flex-col items-center px-6 sm:px-10 pt-10 sm:pt-16 pb-10">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" initial={false}>
            {step === 'search' && (
              <Screen k="search">
                <h1 className="font-ninja font-extrabold text-3xl sm:text-4xl text-ninja-navy text-center">
                  Welcome to {me.centerName}
                </h1>
                {closed ? (
                  <p className="mt-6 font-ninja text-lg text-ninja-muted text-center">
                    Check-in is unavailable right now. Please see the front desk.
                  </p>
                ) : (
                  <>
                    <label htmlFor="kiosk-search" className="block mt-8 mb-2 font-ninja font-bold text-base text-ninja-navy text-center">
                      Type your ninja's name to check in
                    </label>
                    <div className="relative">
                      <SearchIcon size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-ninja-muted" aria-hidden />
                      <input
                        id="kiosk-search" ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
                        autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false}
                        className="w-full rounded-2xl border border-ninja-border bg-white pl-12 pr-4 py-4 font-ninja text-xl text-ninja-navy placeholder:text-ninja-muted focus:outline-none focus:border-ninja-blue"
                        placeholder="First or last name"
                      />
                    </div>
                    <div className="mt-4 space-y-2" aria-live="polite">
                      {results.map((r) => (
                        <button
                          key={r.participantId} type="button" onClick={() => pickMember(r)}
                          className="w-full flex items-center justify-between gap-4 rounded-2xl border border-ninja-border bg-white px-5 py-4 text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
                        >
                          <span className="font-ninja font-extrabold text-xl text-ninja-navy truncate">
                            {r.firstName} {r.lastInitial}
                          </span>
                          <ChevronRightIcon size={22} className="flex-shrink-0 text-ninja-muted" aria-hidden />
                        </button>
                      ))}
                      {q.length >= 2 && !searching && results.length === 0 && (
                        <p className="pt-2 font-ninja text-base text-ninja-muted text-center">
                          No ninja found for "{q}". Please see the front desk.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </Screen>
            )}

            {step === 'classes' && member && (
              <Screen k="classes">
                <h1 className="font-ninja font-extrabold text-3xl text-ninja-navy text-center">
                  Which class is {member.firstName} here for?
                </h1>
                <div className="mt-6 space-y-2">
                  {classes === null && (
                    <p className="font-ninja font-bold text-lg text-ninja-muted text-center" role="status">Finding today's classes…</p>
                  )}
                  {classes?.length === 0 && (
                    <p className="font-ninja text-lg text-ninja-muted text-center">
                      There are no classes for {member.firstName} to check in to today. Please see the front desk.
                    </p>
                  )}
                  {classes?.map((c) => (
                    <button
                      key={c.classKey} type="button" disabled={c.checkedIn && !c.undoable}
                      onClick={() => (c.checkedIn ? askUndo(c) : (setPicked(c), setMode('checkin'), setStep('confirm')))}
                      className="w-full flex items-center justify-between gap-4 rounded-2xl border border-ninja-border bg-white px-5 py-4 text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98] disabled:active:scale-100"
                    >
                      <span className="min-w-0">
                        <span className="block font-ninja font-extrabold text-xl text-ninja-navy tabular-nums">
                          {fmtTime(c.startTime)}
                        </span>
                        <span className="block font-ninja text-sm text-ninja-muted">{c.className}</span>
                      </span>
                      <span className={`flex-shrink-0 font-ninja text-sm font-bold ${c.undoable ? 'text-ninja-red' : c.checkedIn || !c.booked ? 'text-ninja-muted' : 'text-ninja-blue-ink'}`}>
                        {c.undoable ? 'Checked in · Undo' : c.checkedIn ? 'Checked in' : c.booked ? 'Booked' : ''}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-6 text-center">
                  <button type="button" onClick={reset}
                    className="font-ninja text-lg font-bold px-10 py-3.5 rounded-2xl border border-ninja-border text-ninja-navy">
                    Back
                  </button>
                </div>
              </Screen>
            )}

            {step === 'confirm' && picked && member && (
              <Screen k="confirm">
                <div className="bg-white border border-ninja-border rounded-3xl p-8 text-center">
                  <p className="font-ninja font-bold text-base text-ninja-muted">
                    {mode === 'undo' ? 'Undo check-in for' : 'Check in'}
                  </p>
                  <p className="mt-1 font-ninja font-extrabold text-4xl text-ninja-navy">{member.firstName} {member.lastInitial}</p>
                  <p className="mt-2 font-ninja text-lg text-ninja-muted">{picked.className} · {fmtTime(picked.startTime)}</p>
                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <button type="button"
                      onClick={() => {
                        setPicked(null);
                        setMode('checkin');
                        // Undo from the finished screen has no class list behind it.
                        if (classes) setStep('classes'); else reset();
                      }}
                      className="font-ninja text-lg font-bold py-4 rounded-2xl border border-ninja-border text-ninja-navy">
                      Back
                    </button>
                    <button type="button" onClick={confirm}
                      className={`font-ninja text-lg font-bold py-4 rounded-2xl text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97] ${mode === 'undo' ? 'bg-ninja-red' : 'bg-ninja-blue'}`}>
                      {mode === 'undo' ? 'Undo' : 'Check in'}
                    </button>
                  </div>
                </div>
              </Screen>
            )}

            {step === 'working' && (
              <Screen k="working">
                <p className="font-ninja font-bold text-xl text-ninja-muted text-center" role="status">
                  {mode === 'undo' ? 'Undoing…' : 'Checking in…'}
                </p>
              </Screen>
            )}

            {step === 'done' && outcome && (
              <Screen k="done">
                <div className="bg-white border border-ninja-border rounded-3xl p-8 text-center" role="status">
                  <span className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-ninja-blue text-white">
                    <CheckIcon size={34} strokeWidth={3} aria-hidden />
                  </span>
                  <p className="mt-5 font-ninja font-extrabold text-3xl text-ninja-navy">
                    {outcome.already ? `${outcome.firstName} is already checked in` : `${outcome.firstName} is checked in`}
                  </p>
                  <p className="mt-2 font-ninja text-lg text-ninja-muted">{outcome.className} · {fmtTime(outcome.startTime)}</p>
                  <div className="mt-8 flex justify-center gap-3">
                    {!outcome.already && picked && (
                      <button type="button" onClick={() => askUndo({ ...picked, className: outcome.className, startTime: outcome.startTime })}
                        className="font-ninja text-lg font-bold px-8 py-3.5 rounded-2xl border border-ninja-border text-ninja-navy">
                        Undo
                      </button>
                    )}
                    <button type="button" onClick={reset}
                      className="font-ninja text-lg font-bold px-10 py-3.5 rounded-2xl bg-ninja-blue text-white tabular-nums">
                      Done ({secondsLeft})
                    </button>
                  </div>
                </div>
              </Screen>
            )}

            {step === 'undone' && outcome && (
              <Screen k="undone">
                <div className="bg-white border border-ninja-border rounded-3xl p-8 text-center" role="status">
                  <p className="font-ninja font-extrabold text-3xl text-ninja-navy">
                    {outcome.firstName ? `${outcome.firstName}'s check-in was undone` : 'Check-in undone'}
                  </p>
                  <p className="mt-2 font-ninja text-lg text-ninja-muted">
                    {outcome.unregistered ? 'Removed from ' : ''}{outcome.className} · {fmtTime(outcome.startTime)}
                  </p>
                  <button type="button" onClick={reset}
                    className="mt-8 font-ninja text-lg font-bold px-10 py-3.5 rounded-2xl bg-ninja-blue text-white tabular-nums">
                    Done ({secondsLeft})
                  </button>
                </div>
              </Screen>
            )}

            {step === 'error' && (
              <Screen k="error">
                <div className="bg-white border border-ninja-border rounded-3xl p-8 text-center" role="alert">
                  <p className="font-ninja font-extrabold text-2xl text-ninja-navy">
                    {outcome?.error || 'Something went wrong. Please see the front desk.'}
                  </p>
                  <button type="button" onClick={reset}
                    className="mt-8 font-ninja text-lg font-bold px-10 py-3.5 rounded-2xl border border-ninja-border text-ninja-navy tabular-nums">
                    Back ({secondsLeft})
                  </button>
                </div>
              </Screen>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="flex justify-end px-6 pb-5">
        <button type="button" onClick={() => setStaffOpen(true)}
          className="font-ninja text-xs font-bold text-ninja-muted px-3 py-2 rounded-lg hover:bg-white transition-colors">
          Staff
        </button>
      </footer>

      <StaffExit open={staffOpen} onClose={() => setStaffOpen(false)} />
    </div>
  );
}
