import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from 'lucide-react';
import ParentLayout from '../../components/layout/ParentLayout';
import { api } from '../../api/client';
import { useParentAuth } from '../../context/ParentAuthContext';
import { useParentPortal } from '../../context/ParentPortalContext';
import { Hero, Emblem, Group, Row, StatusText, MoreLink, PinnedHero, PageSheet } from '../../components/parent/ParentUI';
import Logo from '../../components/ui/Logo';
import { FLAT } from '../../lib/surfaces';
import { SkeletonCards } from '../../components/ui/Skeleton';
import { fmtDay, fmtLongDay, calcAge } from '../../lib/parentProgress';
import { ninjaSrc } from '../../utils/ninjas';
import { hoursFor, slotsFor, fmtHour } from '../../lib/centerHours';
import { ymd, listingHook, HOUSE, WASH, PLATE } from '../../lib/eventListing';

// Home: the family at a glance.
//
// One card per child, each led by their last class in the colour of the
// program it was in, then the few sessions before it. Above them, the live
// schedule: how busy the center is, hour by hour, with today's current hour
// lit. Nothing here needs a child opened; the cards come off the family list.


// Monday to Sunday of the current week, as local dates.
function thisWeek() {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// How long a check-in is taken to mean a ninja is in the building.
//
// ONE HOUR, which is the session they were signed in for. A ninja counts on
// the hour they arrived in, and on the next one too where their hour runs into
// it — checked in at 3:40, they are in the room for the three o'clock bar and
// for part of the four o'clock one, so both count them. When the hour is up
// they stop counting anywhere.
//
// It was two hours for a spell, on the reasoning that a session over-runs and
// erring high is the kinder error for a parent deciding whether to come. That
// reached too far: one arrival lit three consecutive bars, so a single late
// check-in kept the chart busy until closing. An hour is the thing that
// actually happened, and it is the only span the data supports — there is no
// check-OUT anywhere in it (`daily_assignments` records the arrival and
// nothing else), so a longer stay is a guess dressed as a measurement.
const STAY_MIN = 60;

// How busy the center is today, by the hour, drawn the way a map app draws
// "popular times": bars on a baseline, a dashed line at the week's peak,
// hour ticks underneath, and the hour happening now in the strong colour
// with a Live marker. Every check-in is a STAY of a ninja in the building,
// so a bar counts everyone whose stay touched it rather than everyone who
// walked in during it, and that includes the live one. Hours still to come
// show what this week's earlier days did at that hour, faintly, so the shape
// of the afternoon is there before it happens. Refreshes every minute while
// the tab is showing, so a parent deciding whether to come now is looking at
// now.
function LiveSchedule({ center }) {
  const days = useMemo(thisWeek, []);
  const [now, setNow] = useState(() => new Date());
  const today = ymd(now);
  const [slots, setSlots] = useState(null);
  const [hover, setHover] = useState(null); // hour whose count is showing

  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.hidden) return;
      api.get(`/parent/schedule?today=${ymd(new Date())}`)
        .then((r) => { if (alive) { setSlots(r?.slots || []); setNow(new Date()); } })
        .catch(() => { if (alive) setSlots((s) => s || []); });
    };
    load();
    const t = setInterval(load, 60_000);
    document.addEventListener('visibilitychange', load);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', load); };
  }, []);

  // A check-in is a STAY of a ninja in the building, not a moment. So a bar
  // is not "who arrived in this hour", it is "who was in the room during it":
  // an arrival at 3:40 is still here at 4:21 and belongs to both bars. That is
  // why a ninja can be counted more than once across the day and why the bars
  // do not sum to the number of children who came — the chart answers how busy
  // the room was, the way a map app draws popular times, and nobody adds those
  // up.
  //
  // "day|hour" -> ninjas in the room at some point in that hour, plus the
  // week's busiest hour as the ceiling every bar is measured against.
  const { counts, weekMax, byDay } = useMemo(() => {
    const byDay = new Map();
    for (const { day: d, minute, count } of slots || []) {
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push({ minute, count });
    }
    const counts = new Map();
    for (const date of days) {
      const d = ymd(date);
      const arrivals = byDay.get(d);
      if (!arrivals) continue;
      for (const h of slotsFor(date)) {
        // [start, start + STAY_MIN) overlaps [h:00, h+1:00): they arrived
        // before this hour was over and had not left before it began.
        //
        // The second test INCLUDES the stay that runs out exactly on the
        // hour, because a bucket is five minutes wide and named after the
        // earliest of them: a ninja filed under 3:00 checked in somewhere in
        // 3:00 to 3:04, so they leave somewhere in 5:00 to 5:04 and were in
        // the room when the five o'clock hour began.
        const n = arrivals.reduce((sum, a) =>
          (a.minute < h * 60 + 60 && a.minute + STAY_MIN >= h * 60 ? sum + a.count : sum), 0);
        if (n) counts.set(`${d}|${h}`, n);
      }
    }
    return { counts, weekMax: Math.max(1, ...counts.values()), byDay };
  }, [slots, days]);

  const hourSlots = slotsFor(now);
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const todayHours = hoursFor(now);
  const openNow = todayHours && nowHour >= todayHours.open && nowHour < todayHours.close;
  const nowSlot = openNow ? Math.floor(nowHour) : null;

  // THE LIVE BAR IS A COUNT OF THE ROOM, NOT A SUMMARY OF THE HOUR, and it is
  // the only bar that can be. Every other bar on the chart stands for an hour
  // that is over, and the honest reading of a finished hour is how busy it
  // got: everyone whose stay touched it. Applying that to the hour in progress
  // makes the number monotonic — it can only ever go up until the hour turns
  // over — so a center that emptied at ten past still read seven at half past,
  // and the bar contradicted the room.
  //
  // So the live bar counts the ninjas whose hour has not run out yet. That is
  // the rule as it was asked for: a check-in puts a ninja on the chart for an
  // hour, carries them into the next slot if their hour reaches it, and takes
  // them off when the hour is up. It rises as ninjas arrive and falls as their
  // hours expire, and at any moment it is the number of ninjas in the
  // building, which is the one thing a parent deciding whether to come now is
  // reading it for.
  //
  // The two readings are labelled apart rather than blurred: the live bar says
  // "here now", a finished hour says how many ninjas it saw. Do NOT put the
  // hour-summary count back on the live bar to make the arithmetic uniform.
  // Uniform arithmetic is what made it lie.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hereNow = (byDay.get(today) || []).reduce(
    (sum, a) => (a.minute <= nowMin && a.minute + STAY_MIN > nowMin ? sum + a.count : sum), 0);

  let status;
  if (openNow) {
    status = `Open until ${fmtHour(todayHours.close)}`;
  } else if (todayHours && nowHour < todayHours.open) {
    status = `Opens today at ${fmtHour(todayHours.open)}`;
  } else {
    const next = new Date(now);
    for (let i = 1; i <= 7; i++) {
      next.setDate(next.getDate() + 1);
      const h = hoursFor(next);
      if (h) { status = `Closed · Opens ${DAY_SHORT[(next.getDay() + 6) % 7]} ${fmtHour(h.open)}`; break; }
    }
  }

  const tick = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;

  return (
    <section className={`${FLAT} px-4 py-3.5 sm:px-5`}>
      <div className="flex items-baseline justify-between gap-3">
        {/* The truncate belongs to the words, not the row: the pinging ring
            grows past the dot's own 8px box, and an overflow-hidden wrapper
            shaves the half of it that reaches left. */}
        <p className="font-ninja text-[11px] font-extrabold uppercase tracking-[0.08em] text-ninja-muted min-w-0 flex items-center gap-1.5">
          {openNow && <span className="relative flex w-2 h-2 flex-shrink-0" aria-hidden><span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-60" /><span className="relative rounded-full w-2 h-2 bg-green-500" /></span>}
          <span className="truncate">{openNow ? 'Live' : 'Today'}{center ? ` at ${center}` : ''}</span>
        </p>
        <p className="font-ninja text-[12px] v2 text-ninja-muted flex-shrink-0 truncate">{status}</p>
      </div>

      {hourSlots.length === 0 ? (
        <p className="font-ninja text-sm text-ninja-muted py-6 text-center">Closed today</p>
      ) : (
        <div className="mt-4">
          {/* Peak line: the week's busiest hour is the ceiling every bar is
              measured against, so today reads against a normal week. */}
          <div className="flex items-center gap-2 mb-1">
            <span className="flex-1 border-t border-dashed border-ninja-border" aria-hidden />
            <span className="font-ninja text-[10px] text-ninja-muted">peak</span>
          </div>
          <div className="flex items-end gap-1.5 sm:gap-2 h-24 border-b border-ninja-border" role="img" aria-label={`How busy the center is today: ${hourSlots.map((h) => `${fmtHour(h)} ${nowSlot === h ? hereNow : (counts.get(`${today}|${h}`) || 0)}`).join(', ')}`}>
            {hourSlots.map((h, i) => {
              const live = nowSlot === h;
              const n = live ? hereNow : (counts.get(`${today}|${h}`) || 0);
              const future = nowSlot == null ? nowHour < h : h > nowSlot;
              const pct = Math.min(100, Math.round((n / weekMax) * 100));
              const showing = hover === h;
              const count = live
                ? (n === 0 ? 'Nobody here right now' : `${n} here now`)
                : `${n} ninja${n === 1 ? '' : 's'}`;
              const lift = `calc(${n > 0 ? Math.max(pct, 6) : 2}% + 6px)`;
              return (
                <div
                  key={h}
                  className="relative flex-1 min-w-0 h-full flex flex-col justify-end cursor-default"
                  onMouseEnter={() => setHover(h)}
                  onMouseLeave={() => setHover((v) => (v === h ? null : v))}
                  onClick={() => setHover((v) => (v === h ? null : h))}
                  onFocus={() => setHover(h)}
                  onBlur={() => setHover((v) => (v === h ? null : v))}
                  tabIndex={0}
                  aria-label={`${fmtHour(h)}: ${count}`}
                >
                  {/* The count pops over the bar on hover, tap or focus; the
                      live bar's own label steps aside for it. */}
                  {showing ? (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-ninja-navy text-white font-ninja text-[11px] font-bold whitespace-nowrap shadow-sm pointer-events-none z-10"
                      style={{ bottom: lift }}
                    >
                      {count}
                    </span>
                  ) : live && (
                    <span className="absolute left-1/2 -translate-x-1/2 font-ninja text-[10px] font-extrabold uppercase tracking-wide text-ninja-blue-ink whitespace-nowrap" style={{ bottom: lift }}>
                      Live
                    </span>
                  )}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${n > 0 ? Math.max(pct, 6) : 2}%` }}
                    transition={{ type: 'spring', stiffness: 240, damping: 28, delay: i * 0.04 }}
                    className={`w-full rounded-t-md transition-colors ${live ? 'bg-ninja-blue' : future ? (showing ? 'bg-ninja-blue/30' : 'bg-ninja-blue/20') : (showing ? 'bg-ninja-blue/75' : 'bg-ninja-blue/55')}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 sm:gap-2 mt-1.5">
            {hourSlots.map((h) => {
              const live = nowSlot === h;
              return (
                <span key={h} className={`flex-1 min-w-0 text-center font-ninja text-[11px] leading-none ${live ? 'font-extrabold text-ninja-blue-ink' : 'text-ninja-muted'}`}>{tick(h)}</span>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// The center's event listings, at the top of the home. One listing is a
// banner; more than one rotates like a slideshow, sliding to the next every
// few seconds, with dots to jump. A mouse resting on it holds it still, and
// Learn more opens the listing's own page. No date tile: the eyebrow already
// says the date, and the tile sat on top of the artwork. Everything is inline
// color: the image gets a dark wash for the white ink, the imageless fallback
// is a deep navy, and neither can be fought by the .dark overrides.
//
// Learn more USED TO grow the banner downward in place, and the reason it no
// longer does is worth keeping: a listing's description is the longest prose
// in the portal and the banner is the tallest thing on the page, so opened
// together they were taller than a phone. The banner had to give up the top
// of the screen while it was open, and getting back to your own ninja meant
// scrolling up, finding the button and closing it. A listing also had no
// address of its own, so a CD could not send a family a link to the thing
// they were promoting. It is a page now, at /parent/events/:id, and this is
// a poster again: something to look at, with one way in.
//
// The banner runs edge to edge across the content region: it escapes main's
// max-w-6xl column with the left-1/2 trick sized in container units — main is
// a size container in ParentLayout, so 100cqw is the region beside the side
// nav, where w-screen would run underneath it. Its ink stays in its own inner
// max-w-6xl column so the text still lines up with the page content below.
//
// Square on all four corners, on purpose, and taller than a card wants to be:
// this is the one surface the centre advertises on, so it is a poster rather
// than a component. A radius here rounds off the artwork somebody chose, and
// the height is what makes a parent look at it before they scroll past to
// their own ninja. The ninja's banner rounds its bottom corners because it is
// a page's header; this one does not, because it is the page's billboard.
function EventSlideshow({ events }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => { if (idx >= events.length && events.length) setIdx(0); }, [events.length, idx]);
  // Only a mouse pauses: a touch has no "leave", so a pointer pause on a
  // phone would stick and the slideshow would never move again.
  useEffect(() => {
    if (events.length < 2 || paused) return;
    const t = setInterval(() => setIdx((n) => (n + 1) % events.length), 6000);
    return () => clearInterval(t);
  }, [events.length, paused]);
  // No listings is still a banner: the hero holds its place with the house
  // gradient and says so, instead of the page opening on a hole.
  if (!events.length) {
    return (
      <PinnedHero>
      <section
        className="relative left-1/2 -translate-x-1/2 w-[100cqw] overflow-hidden text-white"
        style={{ background: HOUSE }}
        aria-label="Events at the center"
      >
        <span aria-hidden className="absolute inset-0" style={{ background: WASH }} />
        <div className="relative h-64 sm:h-80 lg:h-[24rem]">
          <div className="relative h-full max-w-6xl mx-auto flex items-center px-4 sm:px-6">
            {/* Opacity on the element, not the color: the mark's paths
                overlap, and a translucent color doubles up where they do. */}
            <span aria-hidden className="absolute right-6 top-1/2 -translate-y-1/2 hidden sm:block" style={{ color: '#ffffff', opacity: 0.22 }}>
              <Logo variant="mark" className="h-24" />
            </span>
            <div className="min-w-0">
              <p className="font-ninja text-[12px] sm:text-[13px] font-extrabold uppercase tracking-[0.08em] opacity-90 truncate">Announcements</p>
              <p className="font-ninja font-extrabold text-[32px] sm:text-[40px] lg:text-[52px] leading-tight mt-1.5">No upcoming events</p>
            </div>
          </div>
        </div>
      </section>
      </PinnedHero>
    );
  }

  const ev = events[Math.min(idx, events.length - 1)];
  const isToday = ev.event_date === ymd(new Date());
  const when = ev.event_date
    ? `${isToday ? 'Today' : fmtLongDay(ev.event_date)}${ev.event_time ? ` · ${ev.event_time}` : ''}`
    : null;
  const hook = listingHook(ev);
  // A listing with nothing but a title has a page, but that page would be the
  // banner again and nothing else, so the button stays off it. The gate is
  // the same one it always was.
  const hasMore = Boolean(ev.description || ev.event_url || when);

  return (
    // The billboard holds the top of the screen and the page rides up over
    // it, the way the ninja's own banner does on their profile.
    <PinnedHero>
    <section
      className="relative left-1/2 -translate-x-1/2 w-[100cqw] overflow-hidden text-white"
      style={{ background: PLATE }}
      aria-label="Events at the center"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setPaused(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setPaused(false); }}
    >
      {/* The artwork backs the whole section. It crossfades between listings;
          the words slide. */}
      <AnimatePresence initial={false}>
        <motion.span
          key={ev.id}
          aria-hidden
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          style={ev.image_url
            ? { background: `url("${ev.image_url}") center / cover no-repeat` }
            : { background: HOUSE }}
        />
      </AnimatePresence>
      {/* The wash that keeps white ink readable on any artwork. */}
      <span aria-hidden className="absolute inset-0" style={{ background: WASH }} />

      <div className="relative h-64 sm:h-80 lg:h-[24rem]">
        <AnimatePresence initial={false}>
          <motion.div
            key={ev.id}
            className="absolute inset-0"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="relative h-full max-w-6xl mx-auto flex items-center px-4 sm:px-6">
              {/* Opacity on the element, not the color: the mark's paths
                  overlap, and a translucent color doubles up where they do. */}
              {!ev.image_url && (
                <span aria-hidden className="absolute right-6 top-1/2 -translate-y-1/2 hidden sm:block" style={{ color: '#ffffff', opacity: 0.22 }}>
                  <Logo variant="mark" className="h-24" />
                </span>
              )}
              <div className="min-w-0">
                <p className="font-ninja text-[12px] sm:text-[13px] font-extrabold uppercase tracking-[0.08em] opacity-90 truncate">
                  {ev.event_date ? (isToday ? 'Happening today' : 'Coming up') : 'Announcement'}{when ? ` · ${when}` : ''}
                </p>
                <p className="font-ninja font-extrabold text-[32px] sm:text-[40px] lg:text-[52px] leading-[1.05] mt-1.5 truncate">{ev.title}</p>
                {hook && <p className="font-ninja text-[14px] sm:text-[16px] font-bold opacity-90 mt-1.5 line-clamp-2 sm:line-clamp-1">{hook}</p>}
                {hasMore && (
                  <Link
                    to={`/parent/events/${ev.id}`}
                    className="mt-3.5 inline-flex items-center gap-1 font-ninja text-[13px] sm:text-[14px] font-extrabold rounded-full px-4 py-1.5 transition-colors hover:bg-white/25"
                    style={{ background: 'rgb(255 255 255 / 0.18)', border: '1px solid rgb(255 255 255 / 0.3)' }}
                  >
                    Learn more ›
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        {events.length > 1 && (
          <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {events.map((e, i) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Show event ${i + 1} of ${events.length}`}
                aria-current={i === Math.min(idx, events.length - 1) ? 'true' : undefined}
                className="w-2 h-2 rounded-full transition-colors"
                style={{ background: i === Math.min(idx, events.length - 1) ? 'rgb(255 255 255 / 0.95)' : 'rgb(255 255 255 / 0.4)' }}
              />
            ))}
          </span>
        )}
      </div>
    </section>
    </PinnedHero>
  );
}

// What to say about a session in one line under its title.
function sessionTitle(s) {
  return s.project_at || s.lesson_name || s.module_name || s.sub_program || `${s.program} session`;
}

// `wide` is the one-ninja layout: the card is the whole row, so instead of a
// stack it becomes two columns at lg — the banner on the left, recent sessions
// on the right. With siblings the stacked card in a half column stays.
//
// THE BANNER IS THE NINJA, NOT THEIR LAST CLASS. It used to lead with the
// project from the most recent session ("Last class · Wed, Aug 19 / Capstone
// Project / CREATE · Black belt · with Sensei John"), which put a session in
// the biggest type on the card and then listed more sessions immediately
// beside it — and since the banner took sessions[0] while the list started at
// sessions[1], the two read as the same thing said twice whenever a ninja
// works on one project across visits. It is the profile's banner now: who the
// ninja is, and nothing else. The sessions are the list's job and they are
// only in one place.
//
// WHAT IS DELIBERATELY NOT ON IT, all three removed on the user's call across
// three passes: "Ninja since", the program count, and finally the belt. The
// count was a number with nothing behind it (a parent knows how many classes
// their own child is in) and it only existed to keep the belt company; with
// the belt gone too, the banner is the ninja and their name and nothing else.
// The belt has not been lost — it is the first thing on the profile the banner
// opens, at four times this size, and it was the one thing here that a
// JR-only ninja could never have.
//
// THE COLUMNS DO NOT STRETCH EACH OTHER — except they do now, and on purpose.
// The grid used to stretch the banner to whatever the list beside it needed,
// so a few short lines sat centred in a 250px slab of flat blue. Filling it is
// not enough on its own: a ninja with one session has a one-row list, and then
// the hole moves to the other column. The banner is a fixed MINIMUM height
// with `items-stretch`, so it reaches the bottom of the card (or the blue
// stops short of the corner) while never dropping below a size the art can
// stand in. 248 is a shade more than three rows plus their eyebrow; under
// three rows it drops to 200.
//
// The stacked card keeps the emblem instead of the ninja: at half a column the
// banner is only as tall as its own lines, and a ninja cropped to the
// shoulders is worse than no ninja.
function ChildCard({ child, wide = false }) {
  const programs = child.programs || [];
  const sessions = child.recent_sessions || [];
  const clubs = child.recent_clubs || [];
  const still = useReducedMotion();
  const banner = useRef(null);
  const [lit, setLit] = useState(false);

  // The same rule the profile banner uses, and it has to be the same or the
  // two pages give one ninja two identities: CREATE is the spine of the
  // centre, so its belt is the ninja's belt where they are in it; otherwise
  // the banner takes the colour of whatever they ARE in and shows no belt at
  // all rather than inventing a White one for a JR-only ninja. It is
  // deliberately NOT the last class's program, which would recolour a child's
  // card because of what they did on Tuesday.
  const createEnrollment = programs.find((p) => p.program === 'CREATE');
  const heroProgram = createEnrollment ? 'CREATE' : (programs[0]?.program || 'CREATE');
  const belt = createEnrollment?.belt_level || null;
  const age = calcAge(child.birthday);

  // Pointer tracking, in motion values rather than state: this runs on every
  // pointer move and a setState here would re-render the card, its list and
  // its art on every frame. Same springs the profile banner uses, so the
  // ninja drifts at the same weight in both places.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 90, damping: 18, mass: 0.4 });
  const sy = useSpring(py, { stiffness: 90, damping: 18, mass: 0.4 });
  const ninjaX = useTransform(sx, (v) => v * 18);
  const ninjaY = useTransform(sy, (v) => v * 9);
  // The light follows the pointer across the banner and travels further than
  // it, so the highlight leads the cursor rather than sitting under it.
  const lightX = useTransform(sx, (v) => `${50 + v * 70}%`);
  const lightY = useTransform(sy, (v) => `${50 + v * 70}%`);
  const light = useMotionTemplate`radial-gradient(circle at ${lightX} ${lightY}, rgb(255 255 255 / 0.16), transparent 62%)`;

  const onMove = (e) => {
    if (still || e.pointerType === 'touch') return;
    const r = banner.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onEnter = (e) => { if (!still && e.pointerType !== 'touch') setLit(true); };
  const onLeave = () => { px.set(0); py.set(0); setLit(false); };

  // Every session, not sessions[1..]: the banner no longer spends the first
  // one on a headline, so holding it back would drop the most recent class off
  // the card entirely.
  const recent = [
    ...sessions.map((s) => ({ key: `s${s.session_date}${s.created_at}`, date: s.session_date, title: sessionTitle(s), sub: `${s.program} · ${fmtDay(s.session_date)}`, status: s.status_at })),
    ...clubs.map((c) => ({ key: `c${c.session_date}${c.club_name}`, date: c.session_date, title: c.club_name, sub: `Club · ${fmtDay(c.session_date)}`, status: 'club' })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3);

  const profile = `/parent/students/${child.id}`;

  return (
    <article className={`${FLAT} overflow-hidden flex flex-col ${wide ? 'lg:grid lg:grid-cols-2 lg:items-stretch' : ''}`}>
      {/* THE WHOLE BANNER IS THE LINK. It was a card with a "Full profile" link
          in the corner of it, which is a small target for the one thing this
          card is for, and it left the ninja — the most obviously tappable
          object on the page — inert. Everything inside is therefore markup and
          not an anchor: "Full profile" below is a SPAN styled like the link it
          used to be, because an anchor inside an anchor is invalid and browsers
          resolve it by dropping one.
          
          It also means the ninja cannot be tapped to cheer the way it is on
          the profile page: a tap here navigates. It cheers on hover instead,
          which touch never sees and which is exactly the pointer this effect
          is for.
          
          The banner has no card padding around it: it runs to the card's own
          edges and the card's radius clips it, so the blue IS the whole of the
          ninja's half rather than a rectangle floating on white in a 20px
          moat. On the stacked card that is the full width across the top,
          which is the shape the profile page has. */}
      <Link
        ref={banner}
        to={profile}
        aria-label={`Open ${child.full_name}'s profile`}
        onPointerMove={onMove}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
        className={`group relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 ${wide ? (recent.length >= 3 ? 'lg:min-h-[248px]' : 'lg:min-h-[200px]') : ''}`}
      >
        <Hero program={heroProgram} className="!rounded-none flex h-full flex-col justify-between !p-5 lg:!p-6">
          {/* The light. Under everything (it is the first child and the hero
              isolates its own stacking context), over the gradient, and gone
              entirely under reduced motion rather than parked in the middle
              where it would read as a permanent bright spot. */}
          {!still && (
            <motion.span aria-hidden className="pointer-events-none absolute inset-0 transition-opacity duration-300"
              style={{ backgroundImage: light, opacity: lit ? 1 : 0 }} />
          )}

          {/* A DIRECT child of the hero, and a box rather than a bare image.
              Both matter. Inside the text it would be positioned against text
              that moves, so it floated instead of standing on anything. And
              the banner's height is not always the same: a fixed-height
              picture is either cropped to the chest or swimming. The box is
              `inset-y-0` so it is exactly as tall as the banner, hung 16px
              past the bottom edge so the feet crop rather than land on it, and
              `object-contain object-bottom` keeps the art standing on the
              floor at whatever size fits. */}
          {wide && (
            <motion.span
              aria-hidden
              style={still ? undefined : { x: ninjaX, y: ninjaY }}
              className="hidden lg:block absolute right-5 top-0 bottom-[-16px] w-[186px] pointer-events-none"
            >
              <motion.img
                src={ninjaSrc(belt, lit ? 'cheer' : 'wave', child.ninja_skin_tone)}
                alt=""
                draggable={false}
                animate={still ? undefined : { y: lit ? -10 : 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                className="h-full w-full object-contain object-bottom select-none drop-shadow-[0_14px_22px_rgba(4,10,24,0.4)]"
              />
              {/* Both poses are fetched up front: swapping to a file the
                  browser has never seen leaves a frame of nothing in the
                  middle of the hop, which reads as the ninja vanishing. */}
              <img src={ninjaSrc(belt, 'cheer', child.ninja_skin_tone)} alt="" aria-hidden className="absolute w-px h-px opacity-0" />
            </motion.span>
          )}

          <div className={`relative flex items-start justify-between gap-4 ${wide ? 'lg:block lg:pr-[196px]' : ''}`}>
            <div className="min-w-0">
              {age != null && age >= 3 && (
                <p className="font-ninja text-[12px] font-extrabold opacity-85 truncate">Age {age}</p>
              )}
              <h2 className={`font-ninja font-extrabold leading-tight mt-1 truncate text-[22px] ${wide ? 'lg:text-[34px] lg:tracking-[-0.03em]' : ''}`}>
                {child.full_name}
              </h2>
            </div>
            {/* The PROGRAM's mark, not the belt roundel. `Emblem` draws the
                belt when it is handed one for CREATE, which is right on a
                course banner — that page is about the belt. This card is about
                the ninja, and since the belt stat came off it the roundel was
                the only belt left on it, saying a thing the card no longer
                says anywhere else. Withholding `belt` is what picks the
                program logo; the wide card still needs `belt` for the ninja's
                own art. */}
            {!wide && <Emblem program={heroProgram} size={64} tilt />}
          </div>

          {/* The link, at the foot of the banner rather than in its top corner,
              which is where the ninja's raised arm is and where the words
              landed across it. Down here it is inside the same padding that
              already keeps the text clear of the art. */}
          <div className={`relative flex items-end mt-3 ${wide ? 'lg:mt-0 lg:pr-[196px]' : ''}`}>
            <span className="ml-auto inline-flex items-center gap-0.5 font-ninja text-[13px] font-extrabold text-white">
              Full profile
              <ChevronRightIcon size={15} strokeWidth={2.6} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </div>
        </Hero>
      </Link>

      {/* The sessions carry the padding the card used to, since the banner
          gave it up. */}
      <div className="p-4 sm:p-5">
      {recent.length > 0 ? (
        /* Bare: the rows are already inside a card, and a second white box
           around them was a hairline drawn a few pixels inside another
           hairline around the same colour. */
        <Group bare title="Recent" action={<MoreLink to={profile}>All sessions</MoreLink>}>
          {recent.map((r, i) => (
            <Row key={r.key} first={i === 0} title={r.title} subtitle={r.sub} trailing={<StatusText status={r.status} />} />
          ))}
        </Group>
      ) : (
        <p className="font-ninja text-[13px] v2 text-ninja-muted px-1">
          Sessions show up here as soon as a sensei logs one.
        </p>
      )}
      </div>
    </article>
  );
}

export default function ParentHome() {
  const { parent } = useParentAuth();
  const { students, listError } = useParentPortal();
  // The center's published event listings for the slideshow. `today` is the
  // browser's local date so an event stays "today" through its own evening —
  // the server clock is UTC and would drop it at 5pm California time.
  const [events, setEvents] = useState([]);
  useEffect(() => {
    let alive = true;
    api.get(`/parent/events?today=${ymd(new Date())}`)
      .then((rows) => { if (alive) setEvents(rows || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Every ninja on the family, always. The switcher that used to filter this
  // to one of them is gone: Home draws a card per ninja, so it was a control
  // for hiding something already on the screen.
  const visible = students || [];

  return (
    <ParentLayout>
      <div className="relative">
        {/* The banner is the page's opening, where the Home title used to be:
            first in flow, pinned to the top of the screen, and the rest of
            the page rides up over it on the sheet below. */}
        <EventSlideshow events={events} />

        <PageSheet corner="square">
          <div className="space-y-4 lg:space-y-5">

          {students === null ? (
            <SkeletonCards count={2} cols="lg:grid-cols-2" height={320} label="Loading your family" />
          ) : listError ? (
            <div className={`${FLAT} p-8 text-center`}><p className="text-ninja-red font-ninja text-sm">{listError}</p></div>
          ) : students.length === 0 ? (
            <div className={`${FLAT} p-8 text-center space-y-1`}>
              <p className="text-ninja-navy font-ninja font-bold">No ninjas are linked to this email yet.</p>
              <p className="text-ninja-muted font-ninja text-sm">Ask the front desk to add your email to your child's record.</p>
            </div>
          ) : (
            <>
              <LiveSchedule center={parent?.centerName} />
              <div className={`grid grid-cols-1 gap-4 ${visible.length > 1 ? 'lg:grid-cols-2' : ''}`}>
                {visible.map((c) => <ChildCard key={c.id} child={c} wide={visible.length === 1} />)}
              </div>
            </>
          )}
          </div>
        </PageSheet>
      </div>
    </ParentLayout>
  );
}
