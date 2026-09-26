import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeftIcon, MapPinIcon, UsersIcon, HourglassIcon } from 'lucide-react';
import BeltIcon from '../components/ui/BeltIcon';
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
const PANEL = { normal: ['#eef2f8', INK], almost: ['#fbe9d2', '#8a4b0f'], over: ['#fde2e2', '#b42318'] };
// Program colours are pinned, not accent: JR purple, CREATE navy, as IMPACT.
const STRIP = { JR: '#5b2a8e', CREATE: '#1f4677' };
const SHADOW = '0 6px 18px rgba(20, 50, 110, 0.18)';

function minutesLeft(ninja, now) {
  const end = new Date(ninja.startedAt).getTime() + ninja.sessionMinutes * 60000;
  return Math.ceil((end - now) / 60000);
}

function clock(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

function hours(minutes) {
  return Math.round((minutes / 60) * 10) / 10;
}

function Avatar({ ninja }) {
  if (ninja.program === 'CREATE' && ninja.belt) {
    return (
      <span className="w-[68px] h-[68px] flex-shrink-0 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f1f4f9' }}>
        <BeltIcon belt={ninja.belt} size={52} />
      </span>
    );
  }
  const logo = PROGRAM_LOGOS[ninja.program];
  if (logo) return <img src={logo} alt="" className="w-[72px] h-[72px] flex-shrink-0 object-contain" />;
  return <span className="w-[68px] h-[68px] flex-shrink-0 rounded-full" style={{ backgroundColor: '#f1f4f9' }} />;
}

function NinjaCard({ ninja, now }) {
  const left = minutesLeft(ninja, now);
  const over = left <= 0;
  const [panelBg, panelInk] = over ? PANEL.over : left <= ALMOST_DONE_MIN ? PANEL.almost : PANEL.normal;
  const start = new Date(ninja.startedAt);
  const end = new Date(start.getTime() + ninja.sessionMinutes * 60000);

  return (
    <li className="flex flex-col">
      <div className="relative z-10 flex items-stretch rounded-xl overflow-hidden" style={{ backgroundColor: '#ffffff', boxShadow: SHADOW }}>
        <div className="flex items-center gap-3 pl-3 pr-2 py-3 min-w-0 flex-1">
          <Avatar ninja={ninja} />
          <div className="min-w-0 flex-1 text-center">
            <p className="font-ninja font-extrabold text-[26px] leading-tight" style={{ color: INK }}>
              {ninja.firstName} {ninja.lastInitial}
            </p>
            <p className="font-ninja text-[17px] tabular-nums whitespace-nowrap" style={{ color: MUTED }}>
              {clock(start)} - {clock(end)}
            </p>
          </div>
        </div>
        <div className="w-[108px] flex-shrink-0 flex flex-col items-center justify-center px-1" style={{ backgroundColor: panelBg, color: panelInk }}>
          <span className="font-ninja font-black text-[46px] leading-none tabular-nums">
            {String(over ? Math.abs(left) : left).padStart(2, '0')}
          </span>
          <span className="font-ninja text-[15px] mt-1.5 whitespace-nowrap">{over ? 'Minutes Over' : 'Minutes Left'}</span>
        </div>
      </div>
      {/* Hangs under the card and a little inside its edges, like a tab. */}
      <p
        className="mx-2.5 -mt-1 pt-3 pb-2.5 px-3 rounded-b-lg font-ninja text-[17px] font-semibold text-center"
        style={{ backgroundColor: STRIP[ninja.program] || STRIP.CREATE, color: '#ffffff', boxShadow: '0 4px 10px rgba(20, 50, 110, 0.2)' }}
      >
        {hours(ninja.weekMinutes)} {hours(ninja.weekMinutes) === 1 ? 'Hour' : 'Hours'} This Week | {hours(ninja.sessionMinutes)} Hour Session
      </p>
    </li>
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

function StatusBar({ location, online, almostDone }) {
  const item = 'flex items-center gap-2 whitespace-nowrap';
  const bar = <span style={{ color: '#c3cde0' }}>|</span>;
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-full px-6 py-3 font-ninja text-[17px] font-semibold"
      style={{ backgroundColor: '#ffffff', color: INK, boxShadow: SHADOW }}
    >
      <span className={item}><MapPinIcon size={20} style={{ color: '#3b82f6' }} aria-hidden />{location}</span>
      {bar}
      <span className={item}><UsersIcon size={20} style={{ color: '#3b82f6' }} aria-hidden />{online} Online</span>
      {bar}
      <span className={item}><HourglassIcon size={20} style={{ color: '#e08a1e' }} aria-hidden />{almostDone} Session Almost Done</span>
    </div>
  );
}

export default function LiveNinjasPage() {
  const { user } = useAuth();
  const isManager = ['manager', 'admin'].includes(user?.role);
  const [data, setData] = useState(null);
  const [failedSince, setFailedSince] = useState(null);
  const [now, setNow] = useState(() => Date.now());

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

  const ninjas = data?.ninjas || [];
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
            style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}
          >
            <ChevronLeftIcon size={24} aria-hidden />
          </Link>
          <h1 className="font-ninja font-black text-[64px] leading-none tabular-nums" style={{ color: INK }}>
            {clock(new Date(now))}
          </h1>
          {failedSince && now - failedSince > 60000 && (
            <p className="absolute right-6 font-ninja text-sm font-semibold" style={{ color: '#b45309' }}>
              Can&apos;t reach IMPACT. Retrying.
            </p>
          )}
        </div>
        {/* The white header's hem: a soft swell into the sky, with a paler
            wave behind it for depth. */}
        <svg aria-hidden viewBox="0 0 1440 90" preserveAspectRatio="none" className="block w-full h-[70px] -mt-px">
          <path d="M0,0 H1440 V38 C1180,70 900,26 620,44 C380,60 160,52 0,30 Z" fill="rgba(255,255,255,0.35)" />
          <path d="M0,0 H1440 V18 C1150,48 880,6 600,24 C360,40 150,36 0,14 Z" fill="#eef5fd" />
        </svg>
      </header>

      <main className="relative px-4 sm:px-6 pb-28">
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
          <ul className="grid gap-x-6 gap-y-7" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
            {ninjas.map((n) => (
              <NinjaCard key={n.id} ninja={n} now={now} />
            ))}
          </ul>
        )}
      </main>

      {live && (
        <div className="fixed bottom-5 inset-x-0 z-20 flex justify-center px-4">
          <StatusBar location={user?.activeLocation?.name || data.facilityName} online={ninjas.length} almostDone={almostDone} />
        </div>
      )}
    </div>
  );
}
