import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import BeltIcon from '../components/ui/BeltIcon';
import { SkeletonCards } from '../components/ui/Skeleton';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CARD, PANEL } from '../lib/surfaces';
import { PROGRAM_LOGOS } from '../utils/beltConfig';
import useLiveRefresh from '../lib/useLiveRefresh';

// Who is in the dojo and how long each ninja has left, read out of IMPACT.
//
// IMPACT's own Live Ninjas board redraws only when a push message reaches it,
// so when that connection drops the countdown freezes until somebody reloads.
// This one asks the server every twenty seconds and counts down by itself in
// between, so the timers keep moving even through a missed answer.
//
// The server hands over when each session started and how long it is; the
// minutes are worked out here against this device's clock, every second.

const POLL_MS = 20000;
// Where a timer turns amber, as IMPACT's does near the end of a session.
const ALMOST_DONE_MIN = 10;

// Program colours are pinned, not accent: JR purple, CREATE blue. Inline hex
// because the strip is a coloured surface and dark mode's bg overrides would
// otherwise fight it.
const STRIP = { JR: '#4c1d95', CREATE: '#0c3d99' };

function minutesLeft(ninja, now) {
  const end = new Date(ninja.startedAt).getTime() + ninja.sessionMinutes * 60000;
  return Math.ceil((end - now) / 60000);
}

function clock(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

function hoursLabel(minutes) {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

function Avatar({ ninja }) {
  if (ninja.program === 'CREATE' && ninja.belt) {
    return (
      <span className="w-14 h-14 flex-shrink-0 rounded-full bg-ninja-bg flex items-center justify-center">
        <BeltIcon belt={ninja.belt} size={40} />
      </span>
    );
  }
  const logo = PROGRAM_LOGOS[ninja.program];
  if (logo) return <img src={logo} alt="" className="w-14 h-14 flex-shrink-0 object-contain" />;
  return <span className="w-14 h-14 flex-shrink-0 rounded-full bg-ninja-bg" />;
}

function NinjaCard({ ninja, now }) {
  const left = minutesLeft(ninja, now);
  const over = left <= 0;
  const almost = !over && left <= ALMOST_DONE_MIN;
  const start = new Date(ninja.startedAt);
  const end = new Date(start.getTime() + ninja.sessionMinutes * 60000);
  const number = over ? Math.abs(left) : left;

  return (
    <li className={`${CARD} overflow-hidden flex flex-col`}>
      <div className="flex items-stretch flex-1">
        <div className="flex items-center gap-3 p-3 min-w-0 flex-1">
          <Avatar ninja={ninja} />
          <div className="min-w-0">
            <p className="font-ninja font-extrabold text-ninja-navy text-xl leading-tight truncate">
              {ninja.firstName} {ninja.lastInitial}
            </p>
            <p className="font-ninja text-sm text-ninja-muted tabular-nums">
              {clock(start)} - {clock(end)}
            </p>
          </div>
        </div>
        <div
          className={`w-24 flex-shrink-0 flex flex-col items-center justify-center px-2 ${
            over ? 'bg-red-50 text-red-700' : almost ? 'bg-amber-50 text-amber-800' : 'bg-ninja-bg text-ninja-navy'
          }`}
        >
          <span className="font-ninja font-black text-4xl leading-none tabular-nums">
            {String(number).padStart(2, '0')}
          </span>
          <span className="font-ninja text-xs mt-1 text-center">{over ? 'Minutes over' : 'Minutes left'}</span>
        </div>
      </div>
      <p
        className="font-ninja text-sm font-semibold text-center py-2 px-3"
        style={{ backgroundColor: STRIP[ninja.program] || '#1e293b', color: '#ffffff' }}
      >
        {hoursLabel(ninja.weekMinutes)} this week | {Math.round((ninja.sessionMinutes / 60) * 10) / 10} hour session
      </p>
    </li>
  );
}

function Notice({ title, children }) {
  return (
    <div className={`${PANEL} p-5 max-w-lg`}>
      <p className="font-ninja font-bold text-ninja-navy">{title}</p>
      {children && <div className="mt-1 font-ninja text-sm text-ninja-muted">{children}</div>}
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

  const ninjas = data?.ninjas || [];
  const almostDone = ninjas.filter((n) => {
    const left = minutesLeft(n, now);
    return left > 0 && left <= ALMOST_DONE_MIN;
  }).length;
  const settingsLink = isManager ? (
    <Link to="/account?impact=1" className="text-ninja-blue font-semibold hover:underline">
      Open IMPACT settings
    </Link>
  ) : null;

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-ninja font-black text-4xl sm:text-5xl text-ninja-navy tabular-nums">
              {clock(new Date(now))}
            </h1>
            {data?.connected && data.status === 'connected' && (
              <p className="mt-1 font-ninja text-sm text-ninja-muted">
                {user?.activeLocation?.name || data.facilityName} | {ninjas.length} in the dojo | {almostDone} almost done
              </p>
            )}
          </div>
          {failedSince && Date.now() - failedSince > 60000 && (
            <p className="font-ninja text-sm text-amber-700">Can&apos;t reach IMPACT. Retrying.</p>
          )}
        </header>

        {!data ? (
          <SkeletonCards count={6} height={120} cols="sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" />
        ) : !data.connected ? (
          <Notice title="IMPACT isn't connected for this center.">
            {isManager ? (
              <>Sign in with your IMPACT account under Experimental in settings. {settingsLink}</>
            ) : (
              'A center director can connect it from their settings.'
            )}
          </Notice>
        ) : data.status === 'expired' ? (
          <Notice title="The IMPACT sign-in stopped working.">
            {isManager ? (
              <>Sign in again to bring the board back. {settingsLink}</>
            ) : (
              'A center director needs to sign in to IMPACT again from their settings.'
            )}
          </Notice>
        ) : ninjas.length === 0 ? (
          <Notice title="No ninjas in the dojo right now." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {ninjas.map((n) => (
              <NinjaCard key={n.id} ninja={n} now={now} />
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
