import { Fragment, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpenIcon, BugIcon, UsersIcon, CalendarIcon, ChevronDownIcon,
  ChevronRightIcon, ChevronLeftIcon, LogOutIcon, SearchIcon, ClockIcon,
  TrophyIcon, WrenchIcon, LayoutGridIcon, ListTodoIcon, ClipboardCheckIcon,
  GiftIcon, CalendarDaysIcon, CakeIcon,
} from 'lucide-react';
import Logo from '../ui/Logo';

// The landing page's product shots are drawn in markup from the app's own
// tokens and art, so they stay crisp at any density and never fall out of step
// with the brand. Every name here is invented; no real roster ships publicly.

// Belt ribbon colours, for the ring a CREATE ninja's belt icon sits in. These are
// the swatches the belt art is cut from, and they have no token because
// nothing else in the app draws a belt as a bare colour.
const BELT_HEX = {
  white: '#cbd5e1', yellow: '#eab308', orange: '#f97316', green: '#22c55e',
  blue: '#3b82f6', purple: '#8b5cf6', brown: '#92400e', black: '#1f2937',
};

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',     Glyph: LayoutGridIcon },
  { id: 'today',      label: "Today's Board", icon: '/icons/today.png' },
  { id: 'ninjas',     label: 'Ninjas',        icon: '/icons/roster.png' },
  { id: 'clubs',      label: 'Clubs',         icon: '/icons/clubs.png' },
  { id: 'staff',      label: 'Staff',         icon: '/icons/staff.png' },
  { id: 'curriculum', label: 'Curriculum',    Glyph: BookOpenIcon },
];

const STATS = [
  { label: 'CHECKED IN', value: 6, dot: 'bg-ninja-blue' },
  { label: 'LOGGED',     value: 2, dot: 'bg-emerald-500' },
  { label: 'NOT LOGGED', value: 3, dot: 'bg-amber-500', lead: true },
  { label: 'OVERDUE',    value: 1, dot: 'bg-red-500' },
];

const FILTERS = ['All', 'CREATE', 'JR', 'Robotics Academy', 'AI Academy'];

// status drives the card's edge: green is logged, amber still owes a log,
// red has been owing one since a past session.
const BOARD = [
  { name: 'Mason Rivera',   belt: 'purple',             program: 'CREATE · Purple L3', status: 'logged',  note: 'Logged ✓',             action: 'Edit Log' },
  { name: 'Ava Chen',       logo: 'jr_logo.webp',       program: 'JR',                 status: 'todo',    note: 'Not logged yet',       action: 'Log Progress' },
  { name: 'Liam Patel',     logo: 'robotics_logo.png',  program: 'Robotics Academy',   status: 'overdue', note: 'Overdue · Sat, Sep 5', action: 'Log Progress' },
  { name: 'Sofia Martinez', belt: 'green',              program: 'CREATE · Green L2',  status: 'todo',    note: 'Not logged yet',       action: 'Log Progress' },
  { name: 'Noah Kim',       logo: 'ai_logo.png',        program: 'AI Academy',         status: 'logged',  note: 'Logged ✓',             action: 'Edit Log' },
  { name: 'Emma Johnson',   belt: 'yellow',             program: 'CREATE · Yellow L1', status: 'todo',    note: 'Not logged yet',       action: 'Log Progress' },
];

const EDGE = {
  logged:  'border-ninja-border',
  todo:    'border-ninja-border',
  overdue: 'border-ninja-border',
};
const NOTE_DOT = {
  logged:  'bg-emerald-500',
  todo:    'bg-amber-500',
  overdue: 'bg-red-500',
};
const NOTE_TEXT = {
  logged:  'text-emerald-600',
  todo:    'text-amber-600',
  overdue: 'text-red-600',
};

// The roster table. A ninja with a chosen sticker shows it on a white disc;
// everyone else gets initials on a colour hashed from their name, which is
// what the real page does. Belt is a bare word there, not a chip.
const ROSTER_CHIPS = [
  { label: 'All', count: 24 }, { label: 'CREATE', count: 12 },
  { label: 'Robotics Academy', count: 4 }, { label: 'AI Academy', count: 3 },
  { label: 'JR', count: 5 },
];

const ROSTER = [
  { name: 'Mason Rivera',   sticker: 'dragon.png',  programs: ['belt-purple'],                   belt: 'Purple', seen: 'Today' },
  { name: 'Sofia Martinez', ink: '#22c55e',         programs: ['belt-green'],                    belt: 'Green',  seen: 'Today' },
  { name: 'Emma Johnson',   sticker: 'unicorn.png', programs: ['belt-yellow', 'jr_logo.webp'],   belt: 'Yellow', seen: 'Today' },
  { name: 'Ava Chen',       ink: '#8b5cf6',         programs: ['jr_logo.webp'],                  belt: null,     seen: 'Yesterday' },
  { name: 'Liam Patel',     sticker: 'robot.png',   programs: ['robotics_logo.png'],             belt: null,     seen: 'Sat, Sep 5' },
  { name: 'Noah Kim',       ink: '#f97316',         programs: ['ai_logo.png', 'belt-orange'],    belt: 'Orange', seen: 'Today' },
];

// Cover gradients are the club colour keys the real page uses.
const CLUBS = [
  { name: 'Minecraft Club', solid: '#15803d', day: 'Tuesday',  blurb: 'Build and script worlds together, one afternoon a week.' },
  { name: 'Robotics Lab',   solid: '#1d4ed8', day: 'Thursday', blurb: 'Drive, sense and solve with the kits from the shelf.' },
  { name: 'Roblox Studio',  solid: '#7c3aed', day: 'Saturday', blurb: 'Publish a game your friends can actually play.' },
];

const STAFF = [
  { initials: 'KN', name: 'Kai Nakamura', handle: 'kai.n',   role: 'Sensei',          logs: 12 },
  { initials: 'RM', name: 'Rosa Medina',  handle: 'rosa.m',  role: 'Center Director', lead: true, logs: 4 },
  { initials: 'DO', name: 'Dev Okonkwo',  handle: 'dev.o',   role: 'Sensei',          logs: 9 },
  { initials: 'HT', name: 'Hana Tran',    handle: 'hana.t',  role: 'Sensei',          logs: 0 },
];

const PROGRAM_TABS = [
  { name: 'CREATE',           logo: '/programs/create_logo.webp' },
  { name: 'JR',               logo: '/programs/jr_logo.webp' },
  { name: 'AI Academy',       logo: '/programs/ai_logo.png' },
  { name: 'Robotics Academy', logo: '/programs/robotics_logo.png' },
  { name: 'VR Coding',        logo: '/programs/vr_coding_logo.webp' },
];

// The full CREATE ladder for the hero's belt road, White to Black and the four
// Degrees. The Degrees have no vector art and stay PNGs, as in the app.
const BELT_ROAD = [
  ['white', 'svg'], ['yellow', 'svg'], ['orange', 'svg'], ['green', 'svg'],
  ['blue', 'svg'], ['purple', 'svg'], ['brown', 'svg'], ['red', 'svg'],
  ['black', 'svg'], ['bronze', 'png'], ['silver', 'png'], ['platinum', 'png'],
  ['gold', 'png'],
];

// Invented project names. The franchise curriculum is not public, so the
// mockup borrows the page's shape and none of its words. The kind icons are
// the curriculum page's own vocabulary: Build a wrench, Solve a bug, the
// Adventure a trophy.
const PROJECT_KIND = {
  Build:     { Icon: WrenchIcon, color: '#9138a3' },
  Solve:     { Icon: BugIcon,    color: '#ef3e43' },
  Adventure: { Icon: TrophyIcon, color: '#4fc390' },
};

const LEVEL_PROJECTS = [
  { kind: 'Build',     name: 'A sprite of your own' },
  { kind: 'Solve',     name: 'Debug the runaway cat' },
  { kind: 'Build',     name: 'Costumes and the stage' },
  { kind: 'Solve',     name: 'Debug the silent button' },
  { kind: 'Adventure', name: 'Create with what you know' },
];

// The dashboard every staff member now lands on. Quick links are the sensei's
// set; the schedule, calendar and check-ins are invented like everything else.
const QUICK = [
  { label: 'My Tasks',      Icon: ListTodoIcon },
  { label: "Today's Board", Icon: ClipboardCheckIcon },
  { label: 'Curriculum',    Icon: BookOpenIcon },
  { label: "What's New",    Icon: GiftIcon },
];

const SCHEDULE = [
  { time: '4:00 PM', name: 'CREATE',           rows: [['Mason Rivera', 'Purple Belt'], ['Sofia Martinez', 'Green Belt'], ['Emma Johnson', 'Yellow Belt']] },
  { time: '5:00 PM', name: 'Robotics Academy', rows: [['Liam Patel', 'Robotics'], ['Noah Kim', 'AI Academy']] },
];

// Day of the month and the event type colours the calendar uses. Days past the
// end of a short month simply don't draw.
const CAL_EVENTS = [
  { day: 4,  title: 'Game Night',     color: '#2563eb' },
  { day: 11, title: 'Parents Night',  color: '#ec4899' },
  { day: 19, title: 'Tournament',     color: '#f59e0b' },
  { day: 26, title: 'Field Trip',     color: '#10b981' },
];
const CAL_BIRTHDAYS = [{ day: 8, name: 'Ava' }, { day: 23, name: 'Noah' }];

// Ninjas a week for the last eight weeks.
const WEEKLY = [38, 42, 40, 47, 45, 52, 49, 56];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const MINI_CARD = 'bg-white border border-ninja-border rounded-2xl shadow-sm p-4';

function MiniCalendar() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lead = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const month = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className={MINI_CARD}>
      <div className="flex items-center justify-between mb-2.5">
        <div>
          <div className="text-sm font-bold text-ninja-navy">Calendar</div>
          <div className="text-[10px] text-ninja-muted">Events and ninja birthdays at this center</div>
        </div>
        <span className="text-[11px] font-bold text-ninja-blue">+ New event</span>
      </div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-bold text-ninja-navy">{month}</span>
        <span className="flex items-center gap-1 text-ninja-muted">
          <span className="text-[10px] font-bold px-1.5">Today</span>
          <ChevronLeftIcon className="w-3.5 h-3.5" aria-hidden="true" />
          <ChevronRightIcon className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </div>
      <div className="grid grid-cols-7 mb-0.5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d} className="text-center text-[8px] font-bold uppercase tracking-wide text-ninja-muted py-0.5">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <span key={`b${i}`} />;
          const isToday = day === now.getDate();
          const ev = CAL_EVENTS.find((e) => e.day === day);
          const bd = CAL_BIRTHDAYS.find((b) => b.day === day);
          return (
            <div
              key={day}
              className={`min-h-[38px] rounded-md border p-1 ${isToday ? 'border-ninja-blue bg-ninja-blue/5' : 'border-transparent'}`}
            >
              <span className={`block text-[9px] font-bold tabular-nums leading-none ${isToday ? 'text-ninja-blue' : 'text-ninja-navy'}`}>{day}</span>
              {ev && (
                <span className="mt-1 block truncate rounded px-1 py-px text-[7.5px] font-semibold text-white leading-tight" style={{ background: ev.color }}>
                  {ev.title}
                </span>
              )}
              {bd && (
                <span
                  className="mt-1 flex items-center gap-0.5 rounded px-1 py-px text-[7.5px] font-semibold leading-tight"
                  style={{ background: 'rgba(219, 39, 119, 0.14)', color: 'var(--birthday-ink)' }}
                >
                  <CakeIcon className="w-2 h-2 shrink-0" aria-hidden="true" />
                  <span className="truncate">{bd.name}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckInCard() {
  const w = 300;
  const h = 70;
  const max = Math.max(...WEEKLY) * 1.1;
  const pts = WEEKLY.map((v, i) => [(i / (WEEKLY.length - 1)) * (w - 8) + 4, h - (v / max) * (h - 6)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [ex, ey] = pts[pts.length - 1];

  return (
    <div className={MINI_CARD}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-ninja-navy">Check-ins</span>
        <span className="inline-flex items-center gap-0.5 rounded-lg border border-ninja-border px-2 py-0.5 text-[10px] font-bold text-ninja-navy">
          View all <ChevronRightIcon className="w-3 h-3" aria-hidden="true" />
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-ninja-navy leading-none tabular-nums">{WEEKLY[WEEKLY.length - 1]}</span>
        <span className="text-[11px] text-ninja-muted">ninjas this week</span>
      </div>
      {/* Stretched to the card, so the stroke opts out of the scaling and the
          end dot sits outside the SVG where it can stay round. */}
      <div className="relative h-[70px] mt-2" aria-hidden="true">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="mockCheckInFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--ninja-blue))" stopOpacity="0.32" />
              <stop offset="100%" stopColor="rgb(var(--ninja-blue))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${ex.toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`} fill="url(#mockCheckInFill)" />
          <path d={line} fill="none" stroke="rgb(var(--ninja-blue))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          className="absolute w-2.5 h-2.5 -ml-[5px] -mt-[5px] rounded-full bg-ninja-blue ring-2 ring-white"
          style={{ left: `${(ex / w) * 100}%`, top: `${(ey / h) * 100}%` }}
        />
      </div>
      <div className="mt-3 pt-3 border-t border-ninja-border grid grid-cols-3 gap-3">
        {[['Busiest day', 14], ['Ninjas a week', 46], ['vs previous 8 weeks', '+12%']].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <div className={`text-base font-black leading-none tabular-nums ${String(value).startsWith('+') ? 'text-emerald-500' : 'text-ninja-navy'}`}>{value}</div>
            <div className="text-[10px] text-ninja-muted mt-1 truncate">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardView() {
  return (
    <>
      <div className="mb-5">
        <div className="text-xs text-ninja-muted">{todayLabel()}</div>
        <h3 className="text-3xl font-black tracking-tight leading-none text-ninja-navy mt-1">
          {greeting()}, <span className="text-ninja-blue">Kai</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        <div className="space-y-3">
          <div className={MINI_CARD}>
            <div className="text-sm font-bold text-ninja-navy mb-3">Quick links</div>
            <div className="grid grid-cols-1 gap-1.5">
              {QUICK.map(({ label, Icon }) => (
                <span key={label} className="flex items-center gap-1.5 rounded-lg border border-ninja-border px-2 py-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0 text-ninja-muted" aria-hidden="true" />
                  <span className="text-[11px] font-bold text-ninja-navy truncate">{label}</span>
                </span>
              ))}
            </div>
          </div>

          <div className={MINI_CARD}>
            <div className="flex items-center gap-1.5 text-sm font-bold text-ninja-navy mb-3">
              <CalendarDaysIcon className="w-4 h-4 text-ninja-muted" aria-hidden="true" />
              Daily schedule
            </div>
            <div className="space-y-2">
              {SCHEDULE.map((g) => (
                <div key={g.time} className="rounded-lg border border-ninja-border overflow-hidden">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-ninja-bg">
                    <span className="text-[11px] font-bold text-ninja-navy tabular-nums">{g.time}</span>
                    <span className="text-[10px] text-ninja-muted truncate">{g.name}</span>
                    <span className="ml-auto text-[10px] text-ninja-muted tabular-nums">{g.rows.length}</span>
                  </div>
                  {g.rows.map(([name, belt]) => (
                    <div key={name} className="flex items-center gap-2 px-2.5 py-1.5 border-t border-ninja-border text-[11px] text-ninja-navy">
                      <span className="truncate">{name}</span>
                      <span className="ml-auto text-[10px] text-ninja-muted whitespace-nowrap">{belt}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <MiniCalendar />
          <CheckInCard />
        </div>
      </div>
    </>
  );
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function Avatar({ belt, logo, size = 'w-10 h-10' }) {
  if (logo) {
    return <img src={`/programs/${logo}`} alt="" className={`${size} rounded-full object-contain shrink-0`} />;
  }
  return (
    <span
      className={`${size} rounded-full p-[2.5px] shrink-0`}
      style={{ background: BELT_HEX[belt] }}
    >
      <img src={`/belts/belt-${belt}.svg`} alt="" className="w-full h-full rounded-full bg-white object-contain p-0.5" />
    </span>
  );
}

// A program symbol is drawn bare, no pill: CREATE shows the belt, every other
// program shows its own logo.
function ProgramSymbol({ id }) {
  const src = id.startsWith('belt-') ? `/belts/${id}.svg` : `/programs/${id}`;
  return <img src={src} alt="" className="w-5 h-5 object-contain" />;
}

function PanelHeader({ title, blue, sub, right }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="min-w-0">
        <h3 className="text-2xl font-extrabold text-ninja-navy tracking-tight leading-none">
          {title}
          {blue && <span className="text-ninja-blue">{blue}</span>}
        </h3>
        <div className="text-xs font-semibold text-ninja-muted mt-1.5">{sub}</div>
      </div>
      {right}
    </div>
  );
}

const PILL = 'text-[11px] font-bold rounded-lg px-3 py-1.5 whitespace-nowrap';
const GHOST = `${PILL} bg-white border border-ninja-border text-ninja-navy`;
const SOLID = `${PILL} bg-ninja-blue text-white`;

function SearchBox({ placeholder, w = 'w-36' }) {
  return (
    <span className={`${w} flex items-center gap-1.5 bg-white border border-ninja-border rounded-lg px-2.5 py-1.5`}>
      <SearchIcon className="w-3 h-3 text-ninja-muted shrink-0" aria-hidden="true" />
      <span className="text-[11px] text-ninja-muted truncate">{placeholder}</span>
    </span>
  );
}

function TodayView() {
  return (
    <>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-3xl font-black tracking-tight leading-none">
            <span className="text-ninja-navy">Today&apos;s </span>
            <span className="text-ninja-blue">Ninjas</span>
          </h3>
          <div className="text-xs font-semibold text-ninja-muted mt-1.5">{todayLabel()}</div>
          <div className="text-xs font-bold text-ninja-navy mt-0.5">Welcome Sensei Kai</div>
        </div>
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="relative w-9 h-9 rounded-xl bg-white border border-ninja-border flex items-center justify-center">
            <UsersIcon className="w-4 h-4 text-ninja-navy" />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-ninja-blue text-white text-[9px] font-black flex items-center justify-center">6</span>
          </span>
          <span className="w-9 h-9 rounded-xl bg-white border border-ninja-border flex items-center justify-center">
            <BookOpenIcon className="w-4 h-4 text-ninja-navy" />
          </span>
          <span className="w-9 h-9 rounded-xl bg-white border border-ninja-border flex items-center justify-center">
            <CalendarIcon className="w-4 h-4 text-ninja-navy" />
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {STATS.map(({ label, value, dot, lead }) => (
          <div
            key={label}
            className={`bg-white rounded-xl px-3.5 py-3 border ${lead ? 'border-ninja-blue' : 'border-ninja-border'}`}
          >
            <div className="text-[9px] font-extrabold tracking-[0.12em] text-ninja-muted">{label}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-ninja-navy leading-none">{value}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        {FILTERS.map((f, i) => (
          <span
            key={f}
            className={`text-[11px] font-bold rounded-full px-3 py-1.5 ${
              i === 0 ? 'bg-ninja-blue text-white' : 'bg-white border border-ninja-border text-ninja-navy'
            }`}
          >
            {f}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {BOARD.map((n) => (
          <div key={n.name} className={`bg-white rounded-xl border-2 ${EDGE[n.status]} p-3`}>
            <div className="flex items-center gap-2.5">
              <Avatar {...n} />
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold text-ninja-navy leading-tight truncate">{n.name}</div>
                <div className="text-[11px] font-semibold text-ninja-blue truncate">{n.program}</div>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 text-[11px] font-bold mt-2.5 ${NOTE_TEXT[n.status]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${NOTE_DOT[n.status]}`} />
              {n.note}
            </div>
            <div className="mt-2.5 w-full text-center text-[11px] font-bold text-ninja-blue border-[1.5px] border-ninja-blue/60 rounded-lg py-2">
              {n.action}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-ninja-border px-4 py-3 mt-3 flex items-center justify-between">
        <span className="text-sm font-extrabold text-ninja-navy">Clubs today</span>
        <span className={SOLID}>+ Check In Club</span>
      </div>
    </>
  );
}

const ROSTER_COLS = { gridTemplateColumns: '18px 2fr 1.4fr 1fr 1.1fr 28px' };

function RosterView() {
  return (
    <>
      <PanelHeader
        title="Ninjas"
        sub="24 active ninjas"
        right={
          <div className="flex items-center gap-2 shrink-0">
            <span className={GHOST}>Archived</span>
            <span className={GHOST}>Import CSV</span>
            <span className={SOLID}>+ Add Ninja</span>
          </div>
        }
      />

      {/* The filter bar sits on the page, above the card, the way it does in the app */}
      <div className="flex items-center gap-2 mb-3">
        <SearchBox placeholder="Search..." />
        {ROSTER_CHIPS.map(({ label, count }, i) => (
          <span
            key={label}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-[11px] border whitespace-nowrap ${
              i === 0 ? 'bg-ninja-blue text-white border-ninja-blue' : 'bg-white text-ninja-navy border-ninja-border'
            }`}
          >
            {label}
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
              i === 0 ? 'bg-white/25 text-white' : 'bg-ninja-bg text-ninja-muted'
            }`}>{count}</span>
          </span>
        ))}
        <span className="ml-auto text-[11px] text-ninja-muted font-semibold whitespace-nowrap">
          Sort: <span className="text-ninja-navy font-bold">Last session ↓</span>
        </span>
      </div>

      <div className="bg-white border border-ninja-border rounded-2xl shadow-sm overflow-hidden">
        <div
          className="grid gap-4 px-4 py-2.5 border-b border-ninja-border bg-ninja-bg text-[9px] font-bold text-ninja-muted uppercase tracking-widest"
          style={ROSTER_COLS}
        >
          <span />
          <span>Name</span>
          <span>Programs</span>
          <span>Belt</span>
          <span>Last session</span>
          <span />
        </div>
        {ROSTER.map((r) => (
          <div
            key={r.name}
            className="grid gap-4 px-4 py-2.5 items-center border-b border-ninja-border/60 last:border-b-0"
            style={ROSTER_COLS}
          >
            <span className="w-3.5 h-3.5 rounded border border-ninja-border bg-white" />
            <div className="flex items-center gap-2.5 min-w-0">
              {r.sticker ? (
                <span className="w-8 h-8 rounded-full bg-white border border-ninja-border flex items-center justify-center shrink-0">
                  <img src={`/stickers/${r.sticker}`} alt="" className="w-full h-full object-contain p-0.5" />
                </span>
              ) : (
                <span
                  className="w-8 h-8 rounded-full text-white font-bold text-[11px] flex items-center justify-center shrink-0"
                  style={{ background: r.ink }}
                >
                  {r.name.split(' ').map((w) => w[0]).join('')}
                </span>
              )}
              <span className="text-[13px] font-bold text-ninja-navy truncate">{r.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {r.programs.map((id) => <ProgramSymbol key={id} id={id} />)}
            </div>
            <span className="text-[12px] font-bold text-ninja-navy">
              {r.belt || <span className="text-ninja-muted italic">—</span>}
            </span>
            <span className="text-[12px] font-semibold text-ninja-navy">{r.seen}</span>
            <span className="text-ninja-muted text-right leading-none">···</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ClubsView() {
  return (
    <>
      <PanelHeader
        title="Clubs"
        sub="Weekly optional clubs at your center."
        right={<span className={SOLID}>+ Create Club</span>}
      />
      <div className="grid grid-cols-3 gap-4">
        {CLUBS.map((c) => (
          <div key={c.name} className="bg-white border border-ninja-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div
              className="relative aspect-video"
              style={{ background: `linear-gradient(135deg, ${c.solid} 0%, ${c.solid}b3 100%)` }}
            >
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-white/15 text-5xl leading-none">
                {c.name[0]}
              </span>
            </div>
            <div className="flex-1 flex flex-col px-4 pt-3 pb-3">
              <div className="text-sm font-bold text-ninja-navy leading-snug">{c.name}</div>
              <div className="flex items-center gap-1.5 mt-1.5 text-ninja-muted text-[10px] font-semibold">
                <ClockIcon className="w-3 h-3" aria-hidden="true" />
                {c.day}
              </div>
              <div className="text-[11px] text-ninja-muted leading-relaxed mt-2">{c.blurb}</div>
              <div className="mt-auto pt-3 text-[11px] font-semibold text-ninja-muted">View club →</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function StaffView() {
  return (
    <>
      <PanelHeader
        title="Center "
        blue="Staff"
        sub="Code Ninjas Yorba Linda"
        right={
          <div className="flex items-center gap-2 shrink-0">
            <SearchBox placeholder="Search staff..." w="w-32" />
            <span className={GHOST}>Archived</span>
            <span className={SOLID}>+ Add Staff</span>
          </div>
        }
      />
      <div className="bg-white border border-ninja-border rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-3 border-b border-ninja-border bg-ninja-bg px-4 py-2.5 text-[9px] font-semibold text-ninja-muted uppercase tracking-widest">
          <span>Name</span>
          <span>Username</span>
          <span className="text-right">Progress Logs</span>
        </div>
        {STAFF.map((s) => (
          <div key={s.name} className="grid grid-cols-3 items-center px-4 py-3 border-b border-ninja-border last:border-b-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-full bg-ninja-blue text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                {s.initials}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-ninja-navy truncate leading-tight">{s.name}</div>
                <div className={`text-[9px] font-bold uppercase tracking-wide mt-0.5 ${s.lead ? 'text-ninja-blue' : 'text-ninja-muted'}`}>
                  {s.role}
                </div>
              </div>
            </div>
            <span className="text-[12px] text-ninja-muted">@{s.handle}</span>
            <span className={`text-right text-lg font-bold ${s.logs ? 'text-ninja-blue' : 'text-ninja-border'}`}>
              {s.logs}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// The segmented control the curriculum page picks programs and sections with:
// a sunken track and one raised white pill on the choice.
function SegTrack({ label, children }) {
  return (
    <div aria-label={label} className="inline-flex items-center gap-1 p-1 rounded-[14px] bg-ninja-navy/[0.05] border border-ninja-border">
      {children}
    </div>
  );
}

function SegPill({ active, logo, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-8 rounded-[10px] text-[11px] whitespace-nowrap ${logo ? 'pl-1.5 pr-2.5' : 'px-3'} ${
        active
          ? 'font-extrabold text-ninja-navy bg-white ring-1 ring-ninja-border shadow-[0_1px_2px_rgb(6_13_26_/_0.08),0_4px_12px_-4px_rgb(6_13_26_/_0.18)]'
          : 'font-bold text-ninja-muted'
      }`}
    >
      {logo && <img src={logo} alt="" className={`w-5 h-5 object-contain ${active ? '' : 'opacity-60 saturate-50'}`} />}
      {label}
    </span>
  );
}

// Curriculum reads the way a parent reads a course now: the CREATE hero with
// the belt road across it, segmented switchers for program and section, and
// the open level beside the ladder of all levels. With no ninja on the page
// the whole road is lit and the rows say what a level holds.
function CurriculumView() {
  return (
    <>
      {/* Hero: the CREATE blue, the belt as scenery faded off the top right,
          and the road along the bottom with White grown as the belt open. */}
      <div
        className="relative overflow-hidden rounded-2xl text-white px-5 pt-4 pb-4"
        style={{ background: 'linear-gradient(145deg, #2f74e6 0%, #1355c9 50%, #0c3d99 100%)', isolation: 'isolate' }}
      >
        <span
          aria-hidden="true"
          className="absolute -top-1/4 right-[-2.5rem] h-[150%] aspect-square pointer-events-none"
          style={{
            zIndex: -1,
            maskImage: 'linear-gradient(to bottom left, #000 55%, transparent 96%)',
            WebkitMaskImage: 'linear-gradient(to bottom left, #000 55%, transparent 96%)',
          }}
        >
          <img src="/belts/belt-white-lg.svg" alt="" className="w-full h-full object-contain" />
        </span>

        <div className="text-[10px] font-extrabold opacity-85">CREATE · Curriculum</div>
        <div className="text-[26px] font-extrabold leading-none mt-1 tracking-[-0.015em]">White belt</div>
        <div className="text-[11px] font-semibold opacity-85 mt-1.5">4 levels · Blocks · earns Yellow</div>

        <div className="flex items-start mt-4">
          {BELT_ROAD.map(([b, ext], i) => (
            <Fragment key={b}>
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="block flex-1 min-w-[8px] -mx-[9px] mt-[16px] h-[2px] bg-white/85"
                />
              )}
              <span className="flex flex-col items-center w-[44px] shrink-0">
                <span className="flex items-center justify-center h-[34px]">
                  <img
                    src={`/belts/belt-${b}.${ext}`}
                    alt=""
                    className={`object-contain ${i === 0 ? 'w-[34px] h-[34px]' : 'w-5 h-5'}`}
                  />
                </span>
                <span className={`mt-1 text-[9px] leading-none capitalize text-white ${i === 0 ? 'font-extrabold' : 'font-bold'}`}>
                  {b}
                </span>
              </span>
            </Fragment>
          ))}
        </div>
      </div>

      {/* Programs on the left, Course or Resources on the right */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <SegTrack label="Programs">
          {PROGRAM_TABS.map(({ name, logo }, i) => (
            <SegPill key={name} active={i === 0} logo={logo} label={name} />
          ))}
        </SegTrack>
        <SegTrack label="Section">
          <SegPill active label="Course" />
          <SegPill label="Resources" />
        </SegTrack>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3 items-start mt-3">
        {/* The open level: its projects on a white inset, the game it builds
            dropped on the corner like a photo. */}
        <div className="tint-blue rounded-[22px] overflow-hidden">
          <div className="flex items-start gap-3 pl-4 pr-4 pt-3.5 pb-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.08em]" style={{ color: 'var(--tint-ink)' }}>
                Level 1
              </div>
              <div className="text-[16px] font-extrabold text-ninja-navy leading-tight mt-0.5">Meet the editor</div>
              <div className="text-[11px] text-ninja-muted mt-0.5">5 projects</div>
            </div>
            {/* The belt's own poster sticker in the corner where the app drops
                the level's art. The real page shows the game's screenshot
                there, but the shots carry the projects' printed names, and the
                mockup shows none of the curriculum's words. */}
            <img
              src="/belt-stickers/white-1.png"
              alt=""
              className="w-[92px] shrink-0 rotate-3 drop-shadow-[0_12px_16px_rgb(6_13_26_/_0.25)]"
            />
          </div>
          <div className="mx-3 mb-3 rounded-[14px] overflow-hidden border border-ninja-navy/[0.06] bg-white">
            {LEVEL_PROJECTS.map(({ kind, name }, i) => {
              const { Icon, color } = PROJECT_KIND[kind];
              return (
                <div key={name} className={`flex items-center gap-2.5 px-3.5 py-2 ${i === 0 ? '' : 'border-t border-ninja-navy/[0.08]'}`}>
                  <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0" style={{ background: color }}>
                    <Icon className="w-3.5 h-3.5 text-white" strokeWidth={2.7} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-extrabold text-ninja-navy truncate">{name}</span>
                    <span className="block text-[10.5px] text-ninja-muted">{kind}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* The ladder of every level, each led by the medal it is awarded with */}
        <div className="bg-white border border-ninja-border rounded-[22px] overflow-hidden">
          <div className="px-4 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ninja-muted">
            White levels
          </div>
          {[1, 2, 3, 4].map((lv) => (
            <div key={lv} className={`flex items-center gap-3 px-4 py-2.5 ${lv === 1 ? 'bg-ninja-blue/[0.06]' : 'border-t border-ninja-navy/[0.08]'}`}>
              <img src={`/levels/white-${lv}.png`} alt="" className="w-8 object-contain shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-extrabold text-ninja-navy">Level {lv}</span>
                <span className="block text-[10.5px] text-ninja-muted">5 projects</span>
              </span>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ninja-muted/60 shrink-0" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const VIEWS = {
  dashboard: DashboardView, today: TodayView, ninjas: RosterView, clubs: ClubsView,
  staff: StaffView, curriculum: CurriculumView,
};


// The desktop shot is the app, not a picture of it: the sidebar really
// navigates, so a visitor can look around before they ever sign in.
export function DeskMockup() {
  const [tab, setTab] = useState('dashboard');
  const still = useReducedMotion();
  const View = VIEWS[tab];

  return (
    <div
      className="rounded-2xl bg-white border border-ninja-border overflow-hidden select-none text-left"
      style={{ boxShadow: '0 30px 80px rgb(9 30 66 / 0.28)' }}
    >
      <div className="flex">
        {/* Sidebar */}
        <div className="w-48 shrink-0 bg-white border-r border-ninja-border p-4 flex flex-col">
          <Logo variant="lockup" className="h-6 text-ninja-navy mb-4" title="" />

          <div className="flex items-center justify-between border border-ninja-border rounded-lg px-3 py-2 mb-4">
            <span className="text-xs font-bold text-ninja-navy">Yorba Linda</span>
            <ChevronDownIcon className="w-3.5 h-3.5 text-ninja-muted" aria-hidden="true" />
          </div>

          <nav className="flex flex-col gap-1">
            {NAV.map(({ id, label, icon, Glyph }) => {
              const on = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-pressed={on}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    on ? 'bg-ninja-blue/10 text-ninja-blue' : 'text-ninja-navy hover:bg-ninja-bg'
                  }`}
                >
                  {icon
                    ? <img src={icon} alt="" className={`w-6 h-6 object-contain ${on ? '' : 'opacity-60'}`} />
                    : <Glyph className="w-6 h-6" strokeWidth={2} aria-hidden="true" />}
                  <span className="text-[13px] font-bold">{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-ninja-muted">Appearance</span>
              <span className="w-9 h-5 rounded-full bg-ninja-border p-0.5">
                <span className="block w-4 h-4 rounded-full bg-white" />
              </span>
            </div>
            <div className="flex items-center gap-2.5 pt-3 border-t border-ninja-border">
              <span className="w-8 h-8 rounded-full bg-ninja-blue text-white font-black text-[11px] flex items-center justify-center">
                KN
              </span>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-ninja-navy leading-tight">Kai Nakamura</div>
                <div className="text-[10px] font-semibold text-ninja-muted">Sensei</div>
              </div>
              <LogOutIcon className="w-4 h-4 text-ninja-muted ml-auto" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Panel */}
        <div className="flex-1 min-w-0 bg-ninja-bg p-6 min-h-[780px] lg:min-h-[630px]">
          <motion.div
            key={tab}
            initial={still ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <View />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// The parent portal, on the phone it was drawn for.
const ROAD = ['white', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black'];
const BOOK = [
  '/impact/purple-3-array-of-sunshine.png',
  '/impact/blue-2-comment-like-and-subscribe.png',
  '/impact/green-4-gps.png',
  '/impact/orange-1-x-and-y-marks-the-spot.png',
];

export function PhoneMockup() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-[300px] rounded-[2.5rem] bg-ninja-navy p-2.5 select-none pointer-events-none text-left"
      style={{ boxShadow: '0 30px 80px rgb(9 30 66 / 0.35)' }}
    >
      <div className="rounded-[2rem] overflow-hidden bg-ninja-bg">
        {/* Blue hero */}
        <div className="relative bg-ninja-blue px-5 pt-3 pb-8">
          <div className="flex items-center justify-between text-[11px] font-bold text-white">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="w-1 h-2.5 rounded-sm bg-white/80" />
              <span className="w-1 h-3 rounded-sm bg-white/80" />
              <span className="ml-0.5 w-5 h-2.5 rounded-[3px] border border-white/70 p-[1.5px]">
                <span className="block h-full w-2/3 rounded-[1px] bg-white/80" />
              </span>
            </span>
          </div>

          <span className="mt-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <ChevronLeftIcon className="w-4 h-4 text-white" />
          </span>

          <div className="relative z-10 mt-3 max-w-[62%]">
            <div className="text-[10px] font-extrabold tracking-[0.14em] text-white/75">CREATE · AGE 10</div>
            <div className="text-[34px] font-black text-white leading-[1.05] mt-1">Mason<br />Rivera</div>
            <div className="flex items-end gap-5 mt-3">
              <div>
                <div className="text-xl font-black text-white leading-none">48</div>
                <div className="text-[9px] font-extrabold tracking-[0.12em] text-white/70 mt-1">SESSIONS</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <img src="/belts/belt-purple.svg" alt="" className="h-5" />
                  <span className="text-lg font-black text-white leading-none">Purple</span>
                </div>
                <div className="text-[9px] font-extrabold tracking-[0.12em] text-white/70 mt-1">LEVEL 3</div>
              </div>
            </div>
          </div>

          <img
            src="/ninjas/purple-wave-medium.png"
            alt=""
            className="absolute right-0 top-8 w-36 h-36 object-contain"
          />
        </div>

        {/* Sheet */}
        <div className="bg-ninja-bg rounded-t-3xl -mt-5 relative z-10 px-4 pt-4 pb-5">
          {/* Belt card */}
          <div className="relative rounded-2xl bg-ninja-blue overflow-hidden p-4">
            <img
              src="/belts/belt-purple.svg"
              alt=""
              className="absolute -right-6 -top-4 h-28 opacity-25"
            />
            <div className="relative">
              <div className="text-[9px] font-extrabold tracking-[0.12em] text-white/70">CREATE · MASON</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xl font-black text-white leading-tight">Purple belt</span>
                <ChevronRightIcon className="w-4 h-4 text-white/80" />
              </div>
              <div className="text-[11px] font-semibold text-white/80 mt-0.5">Level 3 · 3 of 6</div>
              <div className="flex items-center justify-between mt-3">
                {ROAD.map((b, i) => (
                  <img
                    key={b}
                    src={`/belts/belt-${b}.svg`}
                    alt=""
                    className={i === 5 ? 'h-7 drop-shadow' : i < 5 ? 'h-4' : 'h-4 opacity-40'}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Level chips */}
          <div className="flex items-center gap-2 mt-3 overflow-hidden">
            <span className="flex items-center gap-1.5 bg-white border border-ninja-border rounded-full px-3 py-2 whitespace-nowrap">
              <img src="/levels/purple-1.png" alt="" className="w-4 h-4 object-contain" />
              <span className="text-[11px] font-bold text-ninja-navy">Level 1</span>
            </span>
            <span className="flex items-center gap-1.5 bg-white border border-ninja-border rounded-full px-3 py-2 whitespace-nowrap">
              <img src="/levels/purple-2.png" alt="" className="w-4 h-4 object-contain" />
              <span className="text-[11px] font-bold text-ninja-navy">Level 2</span>
            </span>
            <span className="bg-ninja-blue rounded-full px-3.5 py-2 text-[11px] font-bold text-white whitespace-nowrap">
              Level 3
            </span>
            <span className="bg-white border border-ninja-border rounded-full px-3.5 py-2 text-[11px] font-bold text-ninja-navy whitespace-nowrap">
              Level 4
            </span>
          </div>

          {/* Sticker book */}
          <div className="bg-white rounded-2xl border border-ninja-border p-4 mt-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[9px] font-extrabold tracking-[0.12em] text-ninja-muted">STICKER BOOK</div>
                <div className="text-xl font-black text-ninja-navy leading-tight mt-0.5">17 of 48</div>
              </div>
              <span className="text-[11px] font-bold text-ninja-blue">Open ›</span>
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              {BOOK.map((src) => (
                <img key={src} src={src} alt="" className="w-11 h-11 object-contain" />
              ))}
              <img
                src="/impact/purple-4-arrays-all-the-way-down.png"
                alt=""
                className="w-11 h-11 object-contain opacity-30 grayscale"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
