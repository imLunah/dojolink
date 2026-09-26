import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeftIcon,
  ChevronUpIcon,
  MapPinIcon,
  UsersIcon,
  HourglassIcon,
  XIcon,
  MinusIcon,
  PlusIcon,
  Loader2Icon,
  Undo2Icon,
} from 'lucide-react';
import BeltIcon from '../components/ui/BeltIcon';
import Logo from '../components/ui/Logo';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PROGRAM_LOGOS } from '../utils/beltConfig';
import useLiveRefresh from '../lib/useLiveRefresh';

// Who is in the dojo and how long each ninja has left, read out of IMPACT.
//
// A wall screen, opened in its own tab and left up, so it draws its own page
// rather than sitting in the app shell, and it is dressed like IMPACT's Live
// Ninjas board because that is the board the senseis already read at a glance:
// white clock header curving into a blue sky, a card per ninja with the
// minutes in a panel on the right and the week's hours on a strip hanging
// under it.
//
// It also does what IMPACT's board does, with IMPACT's own requests:
//   - a ninja whose time is up gets an x that takes them off the board;
//   - Removed Today lists them with Add Back;
//   - Hidden Ninjas lists the accounts IMPACT keeps off the board;
//   - tapping a card opens the timer, which lengthens or shortens the session
//     and so moves when that ninja's computer signs them out.
//
// IMPACT's own board redraws only when a push message reaches it, so when that
// connection drops the countdown freezes until somebody reloads. This one asks
// the server every twenty seconds and counts down by itself in between.
//
// Every colour is inline hex. The screen looks the same whatever theme the
// signed-in director picked, and dark mode's class overrides would otherwise
// reach into it.

const POLL_MS = 20000;
// Where a timer turns amber, as IMPACT's does near the end of a session.
const ALMOST_DONE_MIN = 10;

const INK = '#1b2a5c';
const MUTED = '#5b6b8c';
const BLUE = '#3b82f6';
const PANEL = { normal: ['#eef2f8', INK], almost: ['#fbe9d2', '#8a4b0f'], over: ['#fde2e2', '#b42318'] };
// Program colours are pinned, not accent: JR purple, CREATE navy, as IMPACT.
const STRIP = { JR: '#5b2a8e', CREATE: '#1f4677' };
const SHADOW = '0 6px 18px rgba(20, 50, 110, 0.18)';

function endOf(ninja, sessionMinutes = ninja.sessionMinutes) {
  return new Date(new Date(ninja.startedAt).getTime() + sessionMinutes * 60000);
}

function minutesLeft(ninja, now) {
  return Math.ceil((endOf(ninja).getTime() - now) / 60000);
}

function clock(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

function hours(minutes) {
  return Math.round((minutes / 60) * 10) / 10;
}

function Avatar({ ninja, size = 68 }) {
  if (ninja.program === 'CREATE' && ninja.belt) {
    return (
      <span className="flex-shrink-0 rounded-full flex items-center justify-center" style={{ width: size, height: size, backgroundColor: '#f1f4f9' }}>
        <BeltIcon belt={ninja.belt} size={Math.round(size * 0.76)} />
      </span>
    );
  }
  const logo = PROGRAM_LOGOS[ninja.program];
  if (logo) return <img src={logo} alt="" className="flex-shrink-0 object-contain" style={{ width: size, height: size, transform: 'scale(1.06)' }} />;
  return <span className="flex-shrink-0 rounded-full" style={{ width: size, height: size, backgroundColor: '#f1f4f9' }} />;
}

function NinjaCard({ ninja, now, busy, onOpen, onRemove }) {
  const left = minutesLeft(ninja, now);
  const over = left <= 0;
  const [panelBg, panelInk] = over ? PANEL.over : left <= ALMOST_DONE_MIN ? PANEL.almost : PANEL.normal;
  const name = `${ninja.firstName} ${ninja.lastInitial}`;

  return (
    <li className="relative flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(ninja)}
        aria-label={`${name}, change session time`}
        className="relative z-10 flex items-stretch rounded-xl overflow-hidden text-left transition-transform duration-150 active:scale-[0.98]"
        style={{ backgroundColor: '#ffffff', boxShadow: SHADOW }}
      >
        <span className="flex items-center gap-3 pl-3 pr-2 py-3 min-w-0 flex-1">
          <Avatar ninja={ninja} />
          <span className="min-w-0 flex-1 text-center">
            <span className="block font-ninja font-extrabold text-[26px] leading-tight" style={{ color: INK }}>{name}</span>
            <span className="block font-ninja text-[17px] tabular-nums whitespace-nowrap" style={{ color: MUTED }}>
              {clock(new Date(ninja.startedAt))} - {clock(endOf(ninja))}
            </span>
          </span>
        </span>
        <span className="w-[108px] flex-shrink-0 flex flex-col items-center justify-center px-1" style={{ backgroundColor: panelBg, color: panelInk }}>
          <span className="font-ninja font-black text-[46px] leading-none tabular-nums">
            {String(over ? Math.abs(left) : left).padStart(2, '0')}
          </span>
          <span className="font-ninja text-[15px] mt-1.5 whitespace-nowrap">{over ? 'Minutes Over' : 'Minutes Left'}</span>
        </span>
      </button>
      {/* Hangs under the card and a little inside its edges, like a tab. */}
      <p
        className="mx-2.5 -mt-1 pt-3 pb-2.5 px-3 rounded-b-lg font-ninja text-[17px] font-semibold text-center"
        style={{ backgroundColor: STRIP[ninja.program] || STRIP.CREATE, color: '#ffffff', boxShadow: '0 4px 10px rgba(20, 50, 110, 0.2)' }}
      >
        {hours(ninja.weekMinutes)} {hours(ninja.weekMinutes) === 1 ? 'Hour' : 'Hours'} This Week | {hours(ninja.sessionMinutes)} Hour Session
      </p>
      {/* Only once time is up, as on IMPACT's board. Reversible from Removed
          Today, so it acts on the press. */}
      {over && (
        <button
          type="button"
          onClick={() => onRemove(ninja)}
          disabled={busy}
          aria-label={`Remove ${name} from the board`}
          className="absolute -top-2.5 -right-2.5 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-transform duration-150 active:scale-90 disabled:opacity-60"
          style={{ backgroundColor: '#e5484d', color: '#ffffff', boxShadow: SHADOW }}
        >
          {busy ? <Loader2Icon size={18} className="animate-spin" aria-hidden /> : <XIcon size={20} strokeWidth={3} aria-hidden />}
        </button>
      )}
    </li>
  );
}

// IMPACT's add-time choices, by program: what can be added to the current end.
function stepsFor(program) {
  switch (String(program || '').toLowerCase()) {
    case 'create':
      return [30, 60, 90, 120, 150, 180, 210, 240];
    case 'academies':
      return [15, 30, 45, 60];
    default:
      return [15, 30, 45, 60, 75, 90, 105, 120];
  }
}

// Change how long a session runs. Everything is kept as "minutes past the
// normal session", the number IMPACT stores, so the stepper, the quick picks
// and the limit all speak the same unit.
function TimerDialog({ ninja, now, onClose, onSave }) {
  const current = Math.max(0, ninja.sessionMinutes - ninja.defaultMinutes);
  const [extra, setExtra] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    panelRef.current?.querySelector('button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const endFor = (x) => endOf(ninja, ninja.defaultMinutes + x);
  const valid = (x) => x >= 0 && x <= ninja.maxExtraMinutes && endFor(x).getTime() > now;
  const changed = extra !== current;
  const name = `${ninja.firstName} ${ninja.lastInitial}`;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(ninja, extra);
    } catch (err) {
      setError(err.message || 'IMPACT did not take that.');
      setSaving(false);
    }
  };

  const step = 'w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-150 active:scale-90 disabled:opacity-35';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 30, 60, 0.45)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Session time for ${name}`}
        className="w-full max-w-md rounded-2xl p-6 font-ninja"
        style={{ backgroundColor: '#ffffff', color: INK, boxShadow: '0 20px 50px rgba(15, 30, 60, 0.35)' }}
      >
        <div className="flex items-center gap-3">
          <Avatar ninja={ninja} size={52} />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-2xl leading-tight">{name}</p>
            <p className="text-[15px] tabular-nums" style={{ color: MUTED }}>
              {clock(new Date(ninja.startedAt))} - {clock(endOf(ninja))}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: MUTED }}>
            <XIcon size={22} aria-hidden />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-5">
          <button type="button" className={step} style={{ backgroundColor: '#eef2f8', color: INK }}
            onClick={() => setExtra((x) => x - 15)} disabled={saving || !valid(extra - 15)} aria-label="15 minutes less">
            <MinusIcon size={22} strokeWidth={2.5} aria-hidden />
          </button>
          <div className="text-center min-w-[9rem]">
            <p className="font-black text-4xl tabular-nums">{clock(endFor(extra))}</p>
            <p className="text-sm mt-0.5" style={{ color: MUTED }}>
              {extra === 0 ? 'Normal session' : `${extra} minutes extra`}
            </p>
          </div>
          <button type="button" className={step} style={{ backgroundColor: '#eef2f8', color: INK }}
            onClick={() => setExtra((x) => x + 15)} disabled={saving || !valid(extra + 15)} aria-label="15 minutes more">
            <PlusIcon size={22} strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {stepsFor(ninja.program).map((m) => {
            const x = current + m;
            const on = extra === x;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setExtra(x)}
                disabled={saving || !valid(x)}
                className="rounded-lg px-2 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-35"
                style={on ? { backgroundColor: BLUE, color: '#ffffff' } : { backgroundColor: '#f1f4f9', color: INK }}
              >
                Extend to {clock(endFor(x))} ({m} mins)
              </button>
            );
          })}
        </div>

        {error && <p className="mt-4 text-sm font-semibold" style={{ color: '#b42318' }}>{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={saving || !changed || !valid(extra)}
          className="mt-5 w-full rounded-xl py-3 text-base font-bold flex items-center justify-center gap-2 transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
          style={{ backgroundColor: BLUE, color: '#ffffff' }}
        >
          {saving && <Loader2Icon size={18} className="animate-spin" aria-hidden />}
          Update
        </button>
      </div>
    </div>
  );
}

function Notice({ title, children }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl p-6 text-center" style={{ backgroundColor: '#ffffff', boxShadow: SHADOW }}>
      <p className="font-ninja font-extrabold text-xl" style={{ color: INK }}>{title}</p>
      {children && <div className="mt-2 font-ninja" style={{ color: MUTED }}>{children}</div>}
    </div>
  );
}

// A list that opens upward off the status bar: Hidden Ninjas and Removed
// Today. Disabled when empty, as IMPACT's are. A titled sheet of one-line
// rows split by hairlines, so twelve removals read as a list rather than
// twelve boxes.
function BarMenu({ id, label, title, items, open, onToggle, renderItem, color }) {
  const empty = items.length === 0;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        disabled={empty}
        aria-expanded={open}
        aria-controls={id}
        className="flex items-center gap-3 rounded-lg px-4 h-12 min-w-[14rem] font-ninja text-[18px] font-semibold whitespace-nowrap transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:hover:brightness-100"
        style={{ backgroundColor: color, color: '#ffffff' }}
      >
        {items.length} {label}
        <ChevronUpIcon size={20} aria-hidden className={`ml-auto transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
      {open && !empty && (
        <div
          id={id}
          className="absolute bottom-full right-0 mb-3 w-[22rem] rounded-2xl overflow-hidden font-ninja"
          style={{ backgroundColor: '#ffffff', boxShadow: '0 12px 30px rgba(15, 30, 60, 0.25)' }}
        >
          <p className="px-4 pt-3.5 pb-2.5 text-[16px] font-bold" style={{ color: INK, borderBottom: '1px solid #edf1f7' }}>
            {title}
          </p>
          <ul className="max-h-[50vh] overflow-y-auto no-scrollbar">
            {items.map((n, i) => (
              <li key={n.id} className="flex items-center gap-3 px-4 py-2" style={i ? { borderTop: '1px solid #edf1f7' } : undefined}>
                {renderItem(n)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// IMPACT's footer, cleaned up: one navy bar across the whole bottom with the
// center and its two counts on the left, the two lists on the right. The
// counts read as one line each ("6 Online"), in the colour IMPACT gives them.
function Stat({ Icon, children, color }) {
  return (
    <span className="flex items-center gap-2 text-[20px] font-semibold whitespace-nowrap" style={{ color }}>
      <Icon size={22} aria-hidden />
      {children}
    </span>
  );
}

const DIVIDER = <span aria-hidden className="self-stretch w-px my-5" style={{ backgroundColor: 'rgba(255,255,255,0.14)' }} />;

export default function LiveNinjasPage() {
  const { user } = useAuth();
  const isManager = ['manager', 'admin'].includes(user?.role);
  const [data, setData] = useState(null);
  const [failedSince, setFailedSince] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [timerFor, setTimerFor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [menu, setMenu] = useState(null); // 'hidden' | 'removed' | null
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => {
    api
      .get('/impact/live')
      .then((body) => {
        setData(body);
        setFailedSince(null);
      })
      .catch(() => setFailedSince((since) => since || Date.now()));
  }, []);

  useEffect(() => {
    setData(null);
    load();
  }, [load, user?.activeLocation?.id]);

  useLiveRefresh(load, { intervalMs: POLL_MS });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const before = document.title;
    document.title = 'Live Ninjas';
    return () => { document.title = before; };
  }, []);

  // Each action answers with the board as IMPACT now has it.
  const act = async (ninja, path, body) => {
    setBusyId(ninja.id);
    setActionError('');
    try {
      setData(await api.post(`/impact/scan-ins/${ninja.id}/${path}`, body || {}));
    } catch (err) {
      setActionError(err.message || 'IMPACT did not take that.');
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  const remove = (ninja) => act(ninja, 'remove').catch(() => {});
  const addBack = (ninja) => act(ninja, 'add-back').catch(() => {});
  const saveTime = async (ninja, extraMinutes) => {
    await act(ninja, 'time', { extraMinutes });
    setTimerFor(null);
  };

  const ninjas = data?.ninjas || [];
  const removed = data?.removed || [];
  const hidden = data?.hidden || [];
  const almostDone = ninjas.filter((n) => {
    const left = minutesLeft(n, now);
    return left > 0 && left <= ALMOST_DONE_MIN;
  }).length;
  const live = data?.connected && data.status === 'connected';
  const settingsLink = isManager ? (
    <Link to="/account?impact=1" className="font-bold underline" style={{ color: '#2563eb' }}>
      Open IMPACT settings
    </Link>
  ) : null;
  const toggle = (which) => setMenu((m) => (m === which ? null : which));

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden font-ninja"
      style={{ background: 'linear-gradient(180deg, #5b9fe6 0%, #7fb4ec 45%, #b7d5f3 100%)' }}
    >
      {/* Scenery: a pale planet rising in the bottom corner and two specks. */}
      <span aria-hidden className="absolute -left-40 -bottom-48 w-[420px] h-[420px] rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.35)' }} />
      <span aria-hidden className="absolute left-[16%] bottom-[5%] w-5 h-5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
      <span aria-hidden className="absolute left-[20%] bottom-[3%] w-4 h-4 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />

      <header className="relative">
        <div className="relative z-10 flex items-center justify-center h-[104px] px-6" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #eef5fd 100%)' }}>
          <Link
            to="/manager/overview"
            aria-label="Back to DojoLink"
            className="absolute left-6 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: BLUE, color: '#ffffff' }}
          >
            <ChevronLeftIcon size={24} aria-hidden />
          </Link>
          <h1 className="font-ninja font-black text-[64px] leading-none tabular-nums" style={{ color: INK }}>
            {clock(new Date(now))}
          </h1>
          <div className="absolute right-6 flex flex-col items-end gap-1">
            <span style={{ color: INK }}>
              <Logo className="h-9 w-auto hidden sm:block" accent="#006ADD" />
            </span>
            {failedSince && now - failedSince > 60000 && (
              <p className="font-ninja text-sm font-semibold" style={{ color: '#b45309' }}>
                Can&apos;t reach IMPACT. Retrying.
              </p>
            )}
          </div>
        </div>
        {/* The white header's hem: a soft swell into the sky, with a paler
            wave behind it for depth. */}
        <svg aria-hidden viewBox="0 0 1440 90" preserveAspectRatio="none" className="block w-full h-[70px] -mt-px">
          <path d="M0,0 H1440 V38 C1180,70 900,26 620,44 C380,60 160,52 0,30 Z" fill="rgba(255,255,255,0.35)" />
          <path d="M0,0 H1440 V18 C1150,48 880,6 600,24 C360,40 150,36 0,14 Z" fill="#eef5fd" />
        </svg>
      </header>

      <main className="relative px-4 sm:px-6 pb-36">
        {actionError && (
          <p className="mx-auto mb-5 max-w-lg rounded-xl px-4 py-3 text-center font-ninja font-semibold" style={{ backgroundColor: '#ffffff', color: '#b42318', boxShadow: SHADOW }}>
            {actionError}
          </p>
        )}
        {!data ? null : !data.connected ? (
          <Notice title="IMPACT isn't connected for this center.">
            {isManager ? <>Sign in with your IMPACT account under Experimental in settings. {settingsLink}</> : 'A center director can connect it from their settings.'}
          </Notice>
        ) : data.status === 'expired' ? (
          <Notice title="The IMPACT sign-in stopped working.">
            {isManager ? <>Sign in again to bring the board back. {settingsLink}</> : 'A center director needs to sign in to IMPACT again from their settings.'}
          </Notice>
        ) : ninjas.length === 0 ? (
          <Notice title="No ninjas in the dojo right now." />
        ) : (
          <ul className="grid gap-x-6 gap-y-7 pt-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
            {ninjas.map((n) => (
              <NinjaCard key={n.id} ninja={n} now={now} busy={busyId === n.id} onOpen={setTimerFor} onRemove={remove} />
            ))}
          </ul>
        )}
      </main>

      {live && (
        <footer
          className="fixed bottom-0 inset-x-0 z-20 flex items-stretch gap-6 px-6 sm:px-8 h-[84px] font-ninja"
          style={{ backgroundColor: '#0f2346', boxShadow: '0 -8px 24px rgba(15, 35, 70, 0.18)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <MapPinIcon size={22} aria-hidden style={{ color: '#9fb0cf' }} />
            <span className="font-extrabold text-[22px] truncate" style={{ color: '#ffffff' }}>
              {data.facilityName || user?.activeLocation?.name}
            </span>
          </div>
          {DIVIDER}
          <Stat Icon={UsersIcon} color="#5ad19a">{ninjas.length} Online</Stat>
          {DIVIDER}
          <Stat Icon={HourglassIcon} color="#f2b14c">{almostDone} Almost Done</Stat>
          <div className="ml-auto flex items-center gap-3">
          <BarMenu
            id="hidden-ninjas"
            label="Hidden Ninjas"
            color="#46536b"
            items={hidden}
            open={menu === 'hidden'}
            onToggle={() => toggle('hidden')}
            title="Hidden from the board"
            renderItem={(n) => (
              <>
                <Avatar ninja={n} size={34} />
                <span className="font-bold text-[16px] truncate" style={{ color: INK }}>{n.firstName} {n.lastInitial}</span>
                <span className="ml-auto text-sm tabular-nums whitespace-nowrap" style={{ color: MUTED }}>
                  {clock(new Date(n.startedAt))} - {clock(endOf(n))}
                </span>
              </>
            )}
          />
          <BarMenu
            id="removed-today"
            label="Removed Today"
            color="#3b82f6"
            items={removed}
            open={menu === 'removed'}
            onToggle={() => toggle('removed')}
            title="Removed today"
            renderItem={(n) => (
              <>
                <Avatar ninja={n} size={34} />
                <span className="font-bold text-[16px] truncate" style={{ color: INK }}>{n.firstName} {n.lastInitial}</span>
                <span className="ml-auto text-sm tabular-nums whitespace-nowrap" style={{ color: MUTED }}>
                  {clock(new Date(n.removedAt))}
                </span>
                <button
                  type="button"
                  onClick={() => addBack(n)}
                  disabled={busyId === n.id}
                  aria-label={`Add ${n.firstName} ${n.lastInitial} back to the board`}
                  className="flex items-center gap-1 rounded-md px-1.5 py-1 -mr-1.5 text-sm font-bold whitespace-nowrap transition-colors hover:bg-[#eef3fd] disabled:opacity-50"
                  style={{ color: '#2563eb' }}
                >
                  {busyId === n.id ? <Loader2Icon size={15} className="animate-spin" aria-hidden /> : <Undo2Icon size={15} strokeWidth={2.5} aria-hidden />}
                  Add back
                </button>
              </>
            )}
          />
          </div>
        </footer>
      )}

      {timerFor && (
        <TimerDialog
          key={timerFor.id}
          ninja={ninjas.find((n) => n.id === timerFor.id) || timerFor}
          now={now}
          onClose={() => setTimerFor(null)}
          onSave={saveTime}
        />
      )}
    </div>
  );
}
