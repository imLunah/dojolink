import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';
import Logo from '../components/ui/Logo';
import { api } from '../api/client';
import { useLightOnly } from '../context/ThemeContext';
import { buildAccentTokens, buildCustomTokens, accentInk } from '../lib/accents';

// The check-in kiosk: a screen at the front counter, opened in a tab by a
// signed-in director, where a family finds their ninja, picks one of today's
// classes and checks in. A child with no place in
// the class is booked into it first, the way MyStudio's own kiosk does; the
// server decides which classes a membership may join. Closing the tab is the
// way out.

const EASE = [0.23, 1, 0.32, 1];

// A finished, undone or failed screen counts down on its button and then goes
// back to the name search by itself, so the next family never finds the last
// one's name on screen. A half-finished search or class pick goes back after
// a stretch with no taps.
const AUTO_BACK_S = 10;
const IDLE_MS = 30000;
const AUTO_BACK_STEPS = new Set(['done', 'undone', 'error']);
const RESULT_STEPS = new Set(['confirm', 'working', 'done', 'undone', 'error']);
// With names hidden (a Kiosk page setting), nobody is listed until a search
// has this many letters. The server holds the same line.
const HIDDEN_MIN_LETTERS = 2;

// DojoLink blue, for a center that has not picked a kiosk color.
const DEFAULT_KIOSK_COLOR = '#006add';

const hexRgb = (hex) => {
  const n = parseInt(String(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// t of the color, the rest white.
const tint = (rgb, t) => rgb.map((v) => Math.round(v * t + 255 * (1 - t)));
const css = (rgb) => `rgb(${rgb.join(' ')})`;

// The theme a center's color paints: a panel running from a pale wash of the
// color at the top to the full color at the bottom, like MyStudio's own
// kiosk, with the date and time in a shade of it dark enough to read there.
function kioskTheme(hex) {
  const rgb = hexRgb(hex);
  return {
    panel: `linear-gradient(180deg, ${css(tint(rgb, 0.08))} 0%, ${css(tint(rgb, 0.3))} 38%, ${css(rgb)} 100%)`,
    ink: css(accentInk(rgb, false)),
  };
}

// One class on one line: the time in a fixed column so the names line up, a
// dashed rule between them, and both at the same size and weight, since at a
// busy hour the name is what tells three 3:00 PM rows apart.
function ClassLabel({ startTime, className }) {
  return (
    <span className="min-w-0 flex items-center gap-4 font-ninja font-extrabold text-xl text-ninja-navy">
      <span className="w-24 flex-shrink-0 tabular-nums">{fmtTime(startTime)}</span>
      <span aria-hidden className="self-stretch border-l-2 border-dashed border-ninja-border" />
      <span className="truncate">{className}</span>
    </span>
  );
}

// "04:00 PM" as minutes since midnight, or null.
function startMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(String(t || '').trim());
  if (!m) return null;
  return (Number(m[1]) % 12 + (/PM/i.test(m[3]) ? 12 : 0)) * 60 + Number(m[2]);
}

// Scrolls a class list so the classes starting at the current time are at the
// top: at 4:10 the 4:00 classes lead, and the ones already under way sit just
// above, a scroll away for a family running late. Runs when the list arrives.
function useScrollToNow(list) {
  const ref = useRef(null);
  useEffect(() => {
    const box = ref.current;
    if (!box || !list || !list.length) return;
    const d = new Date();
    const now = d.getHours() * 60 + d.getMinutes();
    const starts = list.map((c) => startMinutes(c.startTime));
    // The latest start that has already come round; before the first class,
    // the list simply starts at the top.
    const current = Math.max(-1, ...starts.filter((m) => m !== null && m <= now));
    if (current < 0) { box.scrollTop = 0; return; }
    const row = box.querySelector(`[data-start="${current}"]`);
    // The box is position: relative, so offsetTop is already measured from it.
    if (row) box.scrollTop = row.offsetTop;
  }, [list]);
  return ref;
}

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

// `center` stands a short screen (confirm, done, error) in the middle of the
// tablet instead of leaving it at the top of an empty page.
function Screen({ children, k, center = false }) {
  return (
    <motion.div key={k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: EASE }} className={`w-full flex-1 min-h-0 flex flex-col ${center ? 'justify-center pb-16' : ''}`}>
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
  const classesBox = useScrollToNow(classes);
  const [picked, setPicked] = useState(null);
  // What the confirm screen is about to do to `picked`: check in, or undo.
  const [mode, setMode] = useState('checkin');
  // Name first: search -> classes -> confirm. Class first: schedule -> roster -> confirm.
  const [step, setStep] = useState('search'); // search | classes | schedule | roster | confirm | working | done | undone | error
  const [schedule, setSchedule] = useState(null);
  const scheduleBox = useScrollToNow(schedule);
  const [roster, setRoster] = useState(null);
  const [rosterQuery, setRosterQuery] = useState('');
  // Where Back on the confirm screen returns to.
  const [confirmFrom, setConfirmFrom] = useState(null);
  const homeStep = useRef('search');
  const [secondsLeft, setSecondsLeft] = useState(AUTO_BACK_S);
  const [outcome, setOutcome] = useState(null);
  const inputRef = useRef(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    api.get('/kiosk/me')
      .then((data) => {
        if (data?.flow === 'class') { homeStep.current = 'schedule'; setStep('schedule'); }
        setMe(data);
      })
      .catch(() => setMe(null));
  }, []);

  const reset = useCallback(() => {
    setQuery('');
    setResults([]);
    setMember(null);
    setClasses(null);
    setPicked(null);
    setMode('checkin');
    setOutcome(null);
    setRoster(null);
    setRosterQuery('');
    setConfirmFrom(null);
    setStep(homeStep.current);
  }, []);

  // The whole list shows before anyone types, and the box narrows it a beat
  // after the last keystroke.
  useEffect(() => {
    if (step !== 'search' || !me?.ready) return undefined;
    const q = query.trim();
    if (me.showNames === false && q.length < HIDDEN_MIN_LETTERS) {
      searchSeq.current += 1;
      setResults([]);
      setSearching(false);
      return undefined;
    }
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
    }, q ? 250 : 0);
    return () => clearTimeout(id);
  }, [query, step, me]);

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
    if (step === 'classes' || step === 'roster' || step === 'confirm' || (step === 'search' && query)) {
      const id = setTimeout(reset, IDLE_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [step, query, reset]);

  useEffect(() => {
    if (step === 'search' && me) inputRef.current?.focus();
  }, [step, me]);

  // The class list is read fresh every time the kiosk comes back to it.
  useEffect(() => {
    if (step !== 'schedule' || !me?.ready) return undefined;
    let alive = true;
    setSchedule(null);
    api.get('/kiosk/schedule')
      .then((data) => { if (alive) { setUnavailable(Boolean(data.unavailable)); setSchedule(data.classes || []); } })
      .catch((err) => { if (alive) { setOutcome({ error: err.message }); setStep('error'); } });
    return () => { alive = false; };
  }, [step, me]);

  const pickClass = async (c) => {
    setPicked(c);
    setRoster(null);
    setRosterQuery('');
    setStep('roster');
    try {
      const data = await api.get(`/kiosk/roster?classKey=${encodeURIComponent(c.classKey)}`);
      setRoster(data.roster || []);
    } catch (err) {
      setOutcome({ error: err.message });
      setStep('error');
    }
  };

  // Names hidden: a class's roster is fetched per search, since the server
  // only ever sends the matches. Shown names load once, in pickClass.
  const rosterSeq = useRef(0);
  useEffect(() => {
    if (step !== 'roster' || !picked || me?.showNames !== false) return undefined;
    const rq = rosterQuery.trim();
    const seq = ++rosterSeq.current;
    if (rq.length < HIDDEN_MIN_LETTERS) { setRoster([]); return undefined; }
    const id = setTimeout(async () => {
      try {
        const data = await api.get(`/kiosk/roster?classKey=${encodeURIComponent(picked.classKey)}&q=${encodeURIComponent(rq)}`);
        if (seq === rosterSeq.current) setRoster(data.roster || []);
      } catch (err) {
        if (seq === rosterSeq.current) { setOutcome({ error: err.message }); setStep('error'); }
      }
    }, 250);
    return () => clearTimeout(id);
  }, [rosterQuery, step, picked, me]);

  const pickFromRoster = (kid, action) => {
    setMember(kid);
    setMode(action);
    setConfirmFrom('roster');
    setStep('confirm');
  };

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
    setConfirmFrom(classes ? 'classes' : null);
    setStep('confirm');
  };

  if (me === undefined) return <div className="min-h-[100dvh] bg-ninja-bg" />;

  if (me === null) {
    return (
      <div className="min-h-[100dvh] bg-ninja-bg flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Logo className="h-9" />
        <p className="font-ninja text-base text-ninja-navy max-w-sm">
          The check-in kiosk opens from Kiosk in DojoLink, signed in as a center director.
        </p>
        <a href="/login" className="font-ninja text-sm font-bold text-ninja-blue-ink">Sign in to DojoLink</a>
      </div>
    );
  }

  const q = query.trim();
  const closed = !me.ready || unavailable;
  // The kiosk wears the center's color, set on the Kiosk page, rather than the
  // accent of whoever opened the tab. Every ninja-blue inside reads these.
  const colorVars = me.color ? buildCustomTokens(me.color, false) : buildAccentTokens('blue', false);
  const theme = kioskTheme(me.color || DEFAULT_KIOSK_COLOR);

  return (
    // The page is exactly one screen and never scrolls; long lists scroll in
    // their own box, so the clock, the search and the back button stay put.
    // Always the landscape layout, at every width (the owner's call): the
    // center's color as a panel on the left, check-in on the right.
    <div className="h-[100dvh] overflow-hidden bg-white flex flex-row" style={colorVars}>
      <aside
        className="flex-shrink-0 w-[44%] flex flex-col px-5 md:px-10 pt-6 pb-8 lg:pb-12"
        style={{ background: theme.panel }}
      >
        <div className="flex items-start justify-between gap-4 font-ninja font-bold text-base md:text-lg lg:text-xl" style={{ color: theme.ink }}>
          <div>
            <p>{now.toLocaleDateString('en-US', { weekday: 'long' })}</p>
            <p className="tabular-nums">{now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
          </div>
          <p className="tabular-nums text-right">{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
        </div>
        <div className="flex-1 flex items-center justify-center py-6 lg:py-10">
          {/* Inline white, not bg-white: this card sits on the color panel and
              must not follow any theme override. */}
          <div className="w-full max-w-md rounded-3xl px-5 md:px-8 py-10 lg:py-20 text-center shadow-sm" style={{ backgroundColor: 'rgb(255 255 255 / 0.88)' }}>
            <Logo className="h-7 lg:h-9 mx-auto" />
            <h1 className="mt-6 lg:mt-8 font-ninja font-extrabold text-3xl md:text-4xl lg:text-5xl text-ninja-navy text-balance">
              Welcome to {me.centerName}
            </h1>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 min-h-0 flex flex-col items-center px-5 md:px-10 pt-8 lg:pt-12 pb-6">
        <div className={`w-full flex-1 min-h-0 flex flex-col ${RESULT_STEPS.has(step) ? 'max-w-2xl' : 'max-w-xl'}`}>
          <AnimatePresence mode="wait" initial={false}>
            {step === 'search' && (
              <Screen k="search">
                {closed ? (
                  <p className="font-ninja text-lg text-ninja-muted text-center">
                    Check-in is unavailable right now. Please see the front desk.
                  </p>
                ) : (
                  <>
                    <label htmlFor="kiosk-search" className="block mb-3 font-ninja font-bold text-xl text-ninja-navy text-center">
                      Find your ninja to check in
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
                    <div className="mt-4 flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-2xl" aria-live="polite">
                      <div className="space-y-2">
                      {results.map((r) => (
                        <button
                          key={r.participantId} type="button" onClick={() => pickMember(r)}
                          className="w-full flex items-center justify-between gap-2 rounded-xl border border-ninja-border bg-white px-5 py-3.5 text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
                        >
                          <span className="font-ninja font-bold text-lg text-ninja-navy truncate">
                            {r.firstName} {r.lastName}
                          </span>
                          <ChevronRightIcon size={22} className="flex-shrink-0 text-ninja-muted" aria-hidden />
                        </button>
                      ))}
                      </div>
                      {/* Inside the list box, so an empty list shows its message
                          at the top rather than at the foot of the screen. */}
                      {searching && results.length === 0 && (
                        <p className="pt-2 font-ninja font-bold text-lg text-ninja-muted text-center" role="status">Finding ninjas…</p>
                      )}
                      {q && !searching && results.length === 0 && (me.showNames !== false || q.length >= HIDDEN_MIN_LETTERS) && (
                        <p className="pt-2 font-ninja text-base text-ninja-muted text-center">
                          No ninja found for "{q}". Please see the front desk.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </Screen>
            )}

            {step === 'schedule' && (
              <Screen k="schedule">
                {closed ? (
                  <p className="font-ninja text-lg text-ninja-muted text-center">
                    Check-in is unavailable right now. Please see the front desk.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 font-ninja font-bold text-xl text-ninja-navy text-center">
                      Pick your class to check in
                    </p>
                    <div ref={scheduleBox} className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 rounded-2xl">
                      {schedule === null && (
                        <p className="font-ninja font-bold text-lg text-ninja-muted text-center" role="status">Finding today's classes…</p>
                      )}
                      {schedule?.length === 0 && (
                        <p className="font-ninja text-lg text-ninja-muted text-center">
                          There are no more classes today. Please see the front desk.
                        </p>
                      )}
                      {schedule?.map((c) => (
                        <button
                          key={c.classKey} type="button" onClick={() => pickClass(c)} data-start={startMinutes(c.startTime) ?? ''}
                          className="w-full flex items-center justify-between gap-4 rounded-2xl border border-ninja-border bg-white px-5 py-4 text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
                        >
                          <ClassLabel startTime={c.startTime} className={c.className} />
                          <ChevronRightIcon size={22} className="flex-shrink-0 text-ninja-muted" aria-hidden />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </Screen>
            )}

            {step === 'roster' && picked && (
              <Screen k="roster">
                <h1 className="font-ninja font-extrabold text-3xl text-ninja-navy text-center">
                  {picked.className} · {fmtTime(picked.startTime)}
                </h1>
                <div className="relative mt-6">
                  <SearchIcon size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-ninja-muted" aria-hidden />
                  <input
                    aria-label="Find your ninja" value={rosterQuery} onChange={(e) => setRosterQuery(e.target.value)}
                    autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false}
                    className="w-full rounded-2xl border border-ninja-border bg-white pl-12 pr-4 py-4 font-ninja text-xl text-ninja-navy placeholder:text-ninja-muted focus:outline-none focus:border-ninja-blue"
                    placeholder="Find your ninja"
                  />
                </div>
                <div className="mt-4 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 rounded-2xl">
                  {roster === null && (
                    <p className="font-ninja font-bold text-lg text-ninja-muted text-center" role="status">Finding ninjas…</p>
                  )}
                  {(() => {
                    if (!roster) return null;
                    const rq = rosterQuery.trim().toLowerCase();
                    if (me.showNames === false && rq.length < HIDDEN_MIN_LETTERS) return null;
                    const shown = rq
                      ? roster.filter((k) => {
                          const first = k.firstName.toLowerCase();
                          const last = (k.lastName || '').toLowerCase();
                          return first.startsWith(rq) || last.startsWith(rq) || `${first} ${last}`.startsWith(rq);
                        })
                      : roster;
                    if (!shown.length) {
                      return (
                        <p className="font-ninja text-lg text-ninja-muted text-center">
                          {rq ? `No ninja found for "${rosterQuery.trim()}".` : 'No ninjas can check in to this class here.'} Please see the front desk.
                        </p>
                      );
                    }
                    return shown.map((k) => (
                      k.checkedIn ? (
                        <div key={k.participantId}
                          className="w-full flex items-center justify-between gap-4 rounded-2xl border border-ninja-border bg-white px-5 py-3.5">
                          <span className="min-w-0">
                            <span className="block font-ninja font-bold text-lg text-ninja-navy truncate">{k.firstName} {k.lastName}</span>
                            <span className="block font-ninja text-sm text-ninja-muted">Checked in</span>
                          </span>
                          {k.undoable && (
                            <button type="button" onClick={() => pickFromRoster(k, 'undo')}
                              className="flex-shrink-0 font-ninja text-base font-bold px-6 py-3 rounded-xl bg-ninja-red text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]">
                              Undo
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          key={k.participantId} type="button" onClick={() => pickFromRoster(k, 'checkin')}
                          className="w-full flex items-center justify-between gap-4 rounded-2xl border border-ninja-border bg-white px-5 py-3.5 text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
                        >
                          <span className="font-ninja font-bold text-lg text-ninja-navy truncate">{k.firstName} {k.lastName}</span>
                          <span className="ml-auto flex-shrink-0 flex items-center gap-3">
                            {k.booked && <span className="font-ninja text-sm font-bold text-ninja-blue-ink">Booked</span>}
                            <ChevronRightIcon size={22} className="text-ninja-muted" aria-hidden />
                          </span>
                        </button>
                      )
                    ));
                  })()}
                </div>
                <div className="mt-6 flex-shrink-0 text-center">
                  <button type="button" onClick={reset}
                    className="font-ninja text-lg font-bold px-10 py-3.5 rounded-2xl border border-ninja-border text-ninja-navy">
                    Back
                  </button>
                </div>
              </Screen>
            )}

            {step === 'classes' && member && (
              <Screen k="classes">
                <h1 className="font-ninja font-extrabold text-3xl text-ninja-navy text-center">
                  Which class is {member.firstName} here for?
                </h1>
                <div ref={classesBox} className="relative mt-6 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 rounded-2xl">
                  {classes === null && (
                    <p className="font-ninja font-bold text-lg text-ninja-muted text-center" role="status">Finding {member.firstName}'s classes…</p>
                  )}
                  {classes?.length === 0 && (
                    <p className="font-ninja text-lg text-ninja-muted text-center">
                      There are no classes for {member.firstName} to check in to today. Please see the front desk.
                    </p>
                  )}
                  {classes?.map((c) => (
                    c.checkedIn ? (
                      <div key={c.classKey} data-start={startMinutes(c.startTime) ?? ''}
                        className="w-full flex items-center justify-between gap-4 rounded-2xl border border-ninja-border bg-white px-5 py-4">
                        <ClassLabel startTime={c.startTime} className={c.className} />
                        <span className="ml-auto flex-shrink-0 font-ninja text-sm font-bold text-ninja-muted">Checked in</span>
                        {c.undoable && (
                          <button type="button" onClick={() => askUndo(c)}
                            className="flex-shrink-0 font-ninja text-base font-bold px-6 py-3 rounded-xl bg-ninja-red text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]">
                            Undo
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        key={c.classKey} type="button" data-start={startMinutes(c.startTime) ?? ''}
                        onClick={() => { setPicked(c); setMode('checkin'); setConfirmFrom('classes'); setStep('confirm'); }}
                        className="w-full flex items-center justify-between gap-4 rounded-2xl border border-ninja-border bg-white px-5 py-4 text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
                      >
                        <ClassLabel startTime={c.startTime} className={c.className} />
                        <span className="ml-auto flex-shrink-0 flex items-center gap-3">
                          {c.booked && <span className="font-ninja text-sm font-bold text-ninja-blue-ink">Booked</span>}
                          <ChevronRightIcon size={22} className="text-ninja-muted" aria-hidden />
                        </span>
                      </button>
                    )
                  ))}
                </div>
                <div className="mt-6 flex-shrink-0 text-center">
                  <button type="button" onClick={reset}
                    className="font-ninja text-lg font-bold px-10 py-3.5 rounded-2xl border border-ninja-border text-ninja-navy">
                    Back
                  </button>
                </div>
              </Screen>
            )}

            {step === 'confirm' && picked && member && (
              <Screen k="confirm" center>
                <div className="bg-white border border-ninja-border rounded-3xl px-10 py-12 text-center">
                  <p className="font-ninja font-bold text-xl text-ninja-muted">
                    {mode === 'undo' ? 'Undo check-in for' : 'Check in'}
                  </p>
                  <p className="mt-2 font-ninja font-extrabold text-6xl text-ninja-navy">{member.firstName} {member.lastName}</p>
                  <p className="mt-3 font-ninja text-2xl text-ninja-muted">{picked.className} · {fmtTime(picked.startTime)}</p>
                  <div className="mt-10 grid grid-cols-2 gap-4">
                    <button type="button"
                      onClick={() => {
                        setMode('checkin');
                        if (confirmFrom === 'roster') { setStep('roster'); return; }
                        setPicked(null);
                        // Undo from the finished screen has no list behind it.
                        if (confirmFrom === 'classes' && classes) setStep('classes'); else reset();
                      }}
                      className="font-ninja text-2xl font-bold py-6 rounded-2xl border border-ninja-border text-ninja-navy">
                      Back
                    </button>
                    <button type="button" onClick={confirm}
                      className={`font-ninja text-2xl font-bold py-6 rounded-2xl text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97] ${mode === 'undo' ? 'bg-ninja-red' : 'bg-ninja-blue'}`}>
                      {mode === 'undo' ? 'Undo' : 'Check in'}
                    </button>
                  </div>
                </div>
              </Screen>
            )}

            {step === 'working' && (
              <Screen k="working" center>
                <p className="font-ninja font-bold text-3xl text-ninja-muted text-center" role="status">
                  {mode === 'undo' ? 'Undoing…' : 'Checking in…'}
                </p>
              </Screen>
            )}

            {step === 'done' && outcome && (
              <Screen k="done" center>
                <div className="bg-white border border-ninja-border rounded-3xl px-10 py-12 text-center" role="status">
                  <span className="mx-auto w-24 h-24 rounded-full flex items-center justify-center bg-ninja-blue text-white">
                    <CheckIcon size={52} strokeWidth={3} aria-hidden />
                  </span>
                  <p className="mt-6 font-ninja font-extrabold text-5xl text-ninja-navy">
                    {outcome.already ? `${outcome.firstName} is already checked in` : `${outcome.firstName} is checked in`}
                  </p>
                  <p className="mt-3 font-ninja text-2xl text-ninja-muted">{outcome.className} · {fmtTime(outcome.startTime)}</p>
                  <div className="mt-10 flex justify-center gap-4">
                    {!outcome.already && picked && (
                      <button type="button" onClick={() => askUndo({ ...picked, className: outcome.className, startTime: outcome.startTime })}
                        className="font-ninja text-2xl font-bold px-12 py-6 rounded-2xl border border-ninja-border text-ninja-navy">
                        Undo
                      </button>
                    )}
                    <button type="button" onClick={reset}
                      className="font-ninja text-2xl font-bold px-14 py-6 rounded-2xl bg-ninja-blue text-white tabular-nums">
                      Done ({secondsLeft})
                    </button>
                  </div>
                </div>
              </Screen>
            )}

            {step === 'undone' && outcome && (
              <Screen k="undone" center>
                <div className="bg-white border border-ninja-border rounded-3xl px-10 py-12 text-center" role="status">
                  <p className="font-ninja font-extrabold text-5xl text-ninja-navy">
                    {outcome.firstName ? `${outcome.firstName}'s check-in was undone` : 'Check-in undone'}
                  </p>
                  <p className="mt-3 font-ninja text-2xl text-ninja-muted">
                    {outcome.unregistered ? 'Removed from ' : ''}{outcome.className} · {fmtTime(outcome.startTime)}
                  </p>
                  <button type="button" onClick={reset}
                    className="mt-10 font-ninja text-2xl font-bold px-14 py-6 rounded-2xl bg-ninja-blue text-white tabular-nums">
                    Done ({secondsLeft})
                  </button>
                </div>
              </Screen>
            )}

            {step === 'error' && (
              <Screen k="error" center>
                <div className="bg-white border border-ninja-border rounded-3xl px-10 py-12 text-center" role="alert">
                  <p className="font-ninja font-extrabold text-4xl text-ninja-navy">
                    {outcome?.error || 'Something went wrong. Please see the front desk.'}
                  </p>
                  <button type="button" onClick={reset}
                    className="mt-10 font-ninja text-2xl font-bold px-14 py-6 rounded-2xl border border-ninja-border text-ninja-navy tabular-nums">
                    Back ({secondsLeft})
                  </button>
                </div>
              </Screen>
            )}
          </AnimatePresence>
        </div>
      </main>

    </div>
  );
}
