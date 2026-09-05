import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { HomeIcon, CalendarDaysIcon, LogOutIcon, ChevronLeftIcon } from 'lucide-react';
import { useParentAuth } from '../../context/ParentAuthContext';
import { useLightOnly } from '../../context/ThemeContext';
import Logo from '../ui/Logo';
import BugReportButton from '../ui/BugReportButton';
import { RocketIcon } from '../ui/icons';
import useIsDesktop from '../../lib/useIsDesktop';

// The parent portal's shell.
//
// A flat page. On desktop a white side nav runs down the left edge with a
// hairline beside it: the logo on top, the sections under it, the child
// and the account at the bottom. It collapses to an icon rail the
// same way the staff sidebar does, remembered per browser. On a phone the bar across the top
// is just the logo and the account, the pages carry their own large titles,
// and the sections live in a floating capsule at the bottom, the same
// material as the staff nav.
//
// `main` is a size container (container-type: inline-size) so the home
// banner can span the content region exactly with 100cqw — w-screen would
// run under the side nav. Nothing inside main is position: fixed, which the
// containment would re-anchor to main.
//
// Light only: the boot script in index.html skips the dark class under
// /parent and useLightOnly holds it off while the shell is mounted.

// Same widths as the staff Sidebar, so the two shells collapse to the same rail.
const EXPANDED_W = 240; // matches w-60
const COLLAPSED_W = 76;

// Home, and what the center has coming up. Courses was a section once and it
// is gone: its grid was a menu of the programs the profile already lists, and
// a course now opens from the card that describes it.
//
// Profile was a section too, and it is gone for a related reason. It was not
// one place — it was whichever child the switcher happened to be pointing at,
// which is why it needed the portal context to work out where it went. Home
// draws a card per ninja with the way into each one on it, so the nav was
// offering a second, ambiguous door to a room the page in front of you
// already opens. Events took the slot: it IS one place, the same for every
// family at the center, and until now the only way to see what was on was to
// wait for the home billboard to rotate around to it.
const TABS = [
  { to: '/parent/dashboard', label: 'Home', Glyph: HomeIcon },
  { to: '/parent/events', label: 'Events', Glyph: CalendarDaysIcon },
];

// The order the phone moves through: the sections on the bar, left to right,
// with the account on the end. It is the swipe order as well as the tab order,
// because a sideways throw can only mean "the next one along" and the bar is
// the only thing on screen that says what along means.
//
// A page that is NOT one of these — a ninja's profile, a listing — has no
// neighbour either side. Those do not swipe and they do not slide sideways:
// opening a child from the home is a step inward, not a step across, and
// sliding it in from the right would claim otherwise.
const SECTIONS = ['/parent/dashboard', '/parent/events', '/parent/account'];

function sectionIndex(pathname) {
  return SECTIONS.findIndex((to) => isActive(pathname, to));
}

// Where the shell last was, and where the phone bar's pill last sat, both kept
// at module scope ON PURPOSE. Every section is its own route, so moving from
// one to the next unmounts one ParentLayout and mounts the next: a ref inside
// the component would be born empty on arrival and could never say which way
// the move went. Only one parent shell is ever mounted, so one seat each is
// enough. The pill's is in SCREEN coordinates, because the capsule changes
// width when the labels swap and the same offset inside it is a different
// place on the glass.
let cameFrom = null;
let pillSeat = null;

// Same look as MobileNav: near-transparent capsule, refracting where the browser can.
export const GLASS = 'border border-white/30 dark:border-white/12 bg-white/[0.55] dark:bg-[#0c0f1a]/55 backdrop-blur-xl backdrop-saturate-[1.9] shadow-[0_14px_40px_rgb(26_46_74/0.18)] dark:shadow-[0_14px_40px_rgb(0_0_0/0.45)]';
export const REFRACT = { backdropFilter: 'url(#liquidGlass) blur(22px) saturate(1.8)', WebkitBackdropFilter: 'blur(22px) saturate(1.8)' };
// The displacement map behind #glassRim, as an image the filter can read.
const LENS_MAP = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' preserveAspectRatio='none'%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='rgb(0,128,128)'/%3E%3Cstop offset='0.74' stop-color='rgb(0,128,128)'/%3E%3Cstop offset='1' stop-color='rgb(128,128,128)'/%3E%3C/linearGradient%3E%3Crect width='2' height='2' fill='url(%23g)'/%3E%3C/svg%3E";

// One spring for both navs, so the rail's pill and the phone bar's pill are
// recognisably the same movement at two sizes.
const PILL_SPRING = { type: 'spring', stiffness: 480, damping: 36 };

function isActive(pathname, to) {
  return pathname === to || pathname.startsWith(to + '/');
}

// First letter of the first and last name. "P" until there is a name.
function initialsOf(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return parts.filter((_, i) => i === 0 || i === parts.length - 1).map((w) => w[0]).join('').toUpperCase() || 'P';
}

function ParentSideNav({ parentName, centerName, onLogout, onReport }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('parent-nav-collapsed') === '1');
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem('parent-nav-collapsed', c ? '0' : '1');
      return !c;
    });
  };

  // Parents have no profile picture, so the account row carries their
  // initials instead.
  const initials = initialsOf(parentName);
  const avatar = (
    <div className="w-8 h-8 rounded-full bg-ninja-blue flex items-center justify-center text-white font-ninja font-bold text-xs flex-shrink-0" aria-hidden>
      {initials}
    </div>
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="hidden lg:flex flex-col shrink-0 sticky top-0 h-screen bg-white border-r border-ninja-border z-40"
    >
      {/* Collapse toggle, floating on the nav's edge like the staff sidebar's. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-[72px] z-50 w-6 h-6 rounded-full bg-white border border-ninja-border shadow-sm flex items-center justify-center text-ninja-muted hover:text-ninja-blue hover:border-ninja-blue/50 transition-colors"
      >
        <motion.span
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="flex"
        >
          <ChevronLeftIcon strokeWidth={2.5} aria-hidden className="w-3.5 h-3.5" />
        </motion.span>
      </button>

      <div className={`py-5 border-b border-ninja-border overflow-hidden ${collapsed ? 'px-2 flex justify-center' : 'px-5'}`}>
        {collapsed ? (
          <Logo variant="mark" className="h-9 text-ninja-navy" />
        ) : (
          <>
            <Logo variant="lockup" className="h-8 text-ninja-navy" />
            <p className="mt-1.5 font-ninja text-[12px] v2 text-ninja-muted whitespace-nowrap">Parent Portal</p>
          </>
        )}
      </div>

      <nav aria-label="Parent portal" className="p-3 mt-1 space-y-0.5">
        {TABS.map((t) => {
          const active = isActive(pathname, t.match || t.to);
          return (
            <button
              key={t.label}
              type="button"
              onClick={() => navigate(t.to)}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? t.label : undefined}
              aria-label={collapsed ? t.label : undefined}
              className={`relative w-full flex items-center gap-3 py-2.5 rounded-xl font-ninja font-bold text-sm transition-colors whitespace-nowrap overflow-hidden ${
                collapsed ? 'px-0 justify-center' : 'px-3'
              } ${
                active ? 'text-ninja-blue-ink' : 'text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg'
              }`}
            >
              {/* THE SAME TINT, ON A PILL THAT TRAVELS. It was a class that
                  appeared on one row and vanished from another, so moving
                  between sections was a cut. One `layoutId` makes the two
                  states the same object: framer measures where it was and
                  where it now is and springs it between them, so the blue
                  slides from Home to Events and the section you chose is
                  somewhere it came FROM rather than somewhere that blinked
                  on. The phone bar has worked this way since it was built;
                  this is the rail catching up.

                  Still a background tint and an ink colour, which is the
                  house rule for an active nav row. No left-edge bar. */}
              {active && (
                <motion.span
                  layoutId="parent-rail-pill"
                  transition={PILL_SPRING}
                  className="absolute inset-0 rounded-xl bg-ninja-blue/10"
                />
              )}
              <t.Glyph strokeWidth={2.1} aria-hidden className="relative z-10 w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <motion.span className="relative z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, delay: 0.08 }}>
                  {t.label}
                </motion.span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        {/* The account row, same shape as the staff sidebar's: the parent's
            initials, their name over their center, and the report + sign
            out glyphs. The initials and name open Settings. The rail keeps
            only the initials; report and sign out live in Settings. */}
        <div className="p-3 border-t border-ninja-border">
          {collapsed ? (
            <div className="flex flex-col items-center py-1">
              <button
                type="button"
                onClick={() => navigate('/parent/account')}
                title="Settings"
                aria-label="Settings"
                aria-current={isActive(pathname, '/parent/account') ? 'page' : undefined}
                className="rounded-full hover:opacity-80 transition-opacity"
              >
                {avatar}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-2">
              <button
                type="button"
                onClick={() => navigate('/parent/account')}
                title="Settings"
                aria-current={isActive(pathname, '/parent/account') ? 'page' : undefined}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-xl hover:opacity-80 transition-opacity"
              >
                {avatar}
                <span className="flex-1 min-w-0">
                  <span className="block font-ninja font-bold text-ninja-navy text-sm truncate">{parentName || 'Parent'}</span>
                  {centerName && <span className="block font-ninja text-ninja-muted text-xs truncate">{centerName}</span>}
                </span>
              </button>
              <button
                onClick={onReport}
                title="Report a bug or suggest a feature"
                aria-label="Report a bug or suggest a feature"
                className="text-ninja-muted hover:text-ninja-red transition-colors flex-shrink-0 p-1"
              >
                <RocketIcon className="w-4 h-4" />
              </button>
              <button
                onClick={onLogout}
                title="Sign out"
                aria-label="Sign out"
                className="text-ninja-muted hover:text-ninja-red transition-colors flex-shrink-0 p-1"
              >
                <LogOutIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

// Where a tab sits on the glass, in screen coordinates, with the capsule's
// own left edge alongside so it can be turned back into an offset inside it.
function seatOf(bar, el) {
  const box = el.getBoundingClientRect();
  return { left: box.left, width: box.width, origin: bar.getBoundingClientRect().left + bar.clientLeft };
}

function ParentTabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { parent } = useParentAuth();
  const still = useReducedMotion();

  // The bar in one list, account included, so the pill has one set of seats
  // to travel between instead of two copies of itself in two branches.
  const items = useMemo(() => ([
    ...TABS.map((t) => ({
      to: t.to,
      label: t.label,
      glyph: (on) => (
        <t.Glyph
          strokeWidth={2.2}
          aria-hidden
          className={`w-[22px] h-[22px] transition-opacity duration-300 ${on ? 'text-ninja-blue-ink' : 'text-ninja-navy opacity-55'}`}
        />
      ),
    })),
    {
      to: '/parent/account',
      label: 'Account',
      glyph: (on) => (
        <span
          className={`w-7 h-7 rounded-full bg-ninja-blue flex items-center justify-center text-white font-ninja font-bold text-[10px] transition-opacity duration-300 ${on ? '' : 'opacity-80'}`}
          aria-hidden
        >
          {initialsOf(parent?.parentName)}
        </span>
      ),
    },
  ]), [parent?.parentName]);

  const active = items.findIndex((t) => isActive(pathname, t.to));
  const barRef = useRef(null);
  const btns = useRef([]);
  const pill = useAnimationControls();

  // THE PILL IS LIQUID: it does not slide from one tab to the next, it
  // STRETCHES across the gap and pulls itself in on the far side, the way a
  // drop of water leaves one surface for another. Two keyframes do it — the
  // span covering both tabs, then the destination — and the eye reads the
  // middle one as the pill being pulled rather than as a rectangle resizing.
  //
  // Measured rather than handed to `layoutId`, which is what used to move it.
  // A shared layout pill can only interpolate between two rectangles, and the
  // bridge is a third one that exists nowhere in the markup.
  //
  // Screen coordinates in, offsets out. The capsule is centred and its width
  // changes when the labels swap, so the same offset inside it before and
  // after a tab change is not the same place on screen; only the seat the
  // pill was actually painted at will start the movement without a jump.
  useLayoutEffect(() => {
    const bar = barRef.current;
    const el = btns.current[active];
    if (!bar) return;
    // No tab owns the page: a ninja's profile, a listing. The pill has
    // nothing to sit on, so it leaves rather than parking on the last tab.
    if (!el) { pillSeat = null; pill.start({ opacity: 0, transition: { duration: 0.16 } }); return; }

    const seat = seatOf(bar, el);
    const to = { left: seat.left - seat.origin, width: seat.width };
    const from = pillSeat ? { left: pillSeat.left - seat.origin, width: pillSeat.width } : null;
    pillSeat = seat;

    if (!from || still) { pill.set({ ...to, opacity: 1 }); return; }

    const lo = Math.min(from.left, to.left);
    const hi = Math.max(from.left + from.width, to.left + to.width);
    pill.set({ opacity: 1 });
    pill.start({
      left: [from.left, lo, to.left],
      width: [from.width, hi - lo, to.width],
      // Out fast, in slow. A drop lets go quickly and settles slowly, and
      // equal halves read as a rectangle being scrubbed between two sizes.
      transition: { duration: 0.44, times: [0, 0.42, 1], ease: ['easeOut', [0.22, 1, 0.3, 1]] },
    });
  }, [active, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // A rotation moves every seat. Re-seat without the stretch: nothing has
  // been chosen, so there is no movement to describe.
  useEffect(() => {
    const reseat = () => {
      const bar = barRef.current;
      const el = btns.current[active];
      if (!bar || !el) return;
      const seat = seatOf(bar, el);
      pillSeat = seat;
      pill.set({ left: seat.left - seat.origin, width: seat.width });
    };
    window.addEventListener('resize', reseat);
    return () => window.removeEventListener('resize', reseat);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <nav
      ref={barRef}
      aria-label="Parent portal"
      className={`lg:hidden fixed left-1/2 -translate-x-1/2 bottom-[max(1.1rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-0.5 p-1.5 rounded-full ${GLASS}`}
      style={REFRACT}
    >
      {/* Left and width rather than a transform: the pill is a capsule, and a
          scaled capsule has elliptical ends and a smeared shadow. It is
          absolutely positioned, so nothing else on the bar reflows with it.
          
          `inset-y-1.5` rather than a top of nothing and a height of 46. An
          absolute child is positioned against the capsule's PADDING box, and
          the tabs sit inside its content box, so a top of zero hung the pill
          the bar's own padding above them: it broke the top edge of the glass
          and left a gap along the bottom. Insetting by that same padding on
          both sides lands it on the tabs and takes its height from the bar,
          so it cannot drift again if the padding changes. */}
      <motion.span
        aria-hidden
        initial={{ opacity: 0, left: 0, width: 0 }}
        animate={pill}
        className="absolute inset-y-1.5 rounded-full bg-white/90 dark:bg-white/[0.14] shadow-[0_2px_8px_rgb(26_46_74/0.12),inset_0_1px_0_#fff] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]"
      />

      {items.map((t, i) => {
        const on = i === active;
        return (
          <button
            key={t.to}
            ref={(el) => { btns.current[i] = el; }}
            type="button"
            onClick={() => navigate(t.to)}
            aria-current={on ? 'page' : undefined}
            aria-label={t.label}
            className={`relative h-[46px] rounded-full flex items-center gap-1.5 ${t.label === 'Account' ? 'px-2.5' : 'px-3.5'}`}
          >
            {/* The chosen tab's contents come up to size as the pill arrives,
                so the label is something the pill delivered rather than
                something that appeared on top of it. */}
            <motion.span
              className="relative z-10 flex items-center gap-1.5"
              animate={still ? { scale: 1 } : (on ? { scale: [0.88, 1] } : { scale: 1 })}
              transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            >
              {t.glyph(on)}
              {on && (
                <motion.span
                  initial={still ? false : { opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.24, delay: 0.12, ease: 'easeOut' }}
                  className="font-ninja font-extrabold text-[13px] text-ninja-blue-ink pr-1"
                >
                  {t.label}
                </motion.span>
              )}
            </motion.span>
          </button>
        );
      })}
    </nav>
  );
}

// `bleed`: the page opens with a full-bleed hero on a phone, so the top bar
// stays out of its way below lg and the hero's own back chip is the way out.
// Every parent page opens at its banner.
//
// Nothing in this app reset the scroll on a route change, and React Router
// does not do it for you. On the parent portal that is worse than landing
// part way down a page, because the banner is pinned: at any offset the hero
// stays at the top of the screen but SHIFTED UP and DIMMED, with the sheet
// riding over its bottom edge and cutting the kit pills in half. It reads as
// a rendering fault rather than as a scroll position, which is exactly how it
// was reported.
//
// It has to key on the pathname rather than on mount. `/parent/students/:id`
// and `/parent/students/:id/courses/:program` render the SAME component at
// the same position in the tree, so opening a course from a profile does not
// remount anything and there is no mount for an effect to hang on.
//
// `scrollRestoration = 'manual'` is part of the fix and not tidiness: on a
// back or forward the browser restores the old offset AFTER the effect runs
// and puts the page straight back where it was. It is set while the portal is
// mounted and handed back on the way out, so the staff side keeps the
// browser's own behaviour.
//
// It returns the animation controls for the page, because the reset and the
// entrance are the same moment and have to happen in the same layout effect:
// the page has to be BOTH at the top and at zero opacity before the browser
// paints it, or the transition plays over a frame of the new page already
// sitting there at full strength.
function useTopOnNavigate(lateral) {
  const { pathname } = useLocation();
  const page = useAnimationControls();
  const still = useReducedMotion();

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    if (!previous) return undefined;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  // WHICH WAY THE MOVE WENT, worked out from the nav's own order rather than
  // handed in by whatever triggered it. A tap on the bar, a throw of the
  // thumb and the browser's back button are the same movement as far as the
  // page is concerned, and only one of the three could have told us.
  //
  // Zero for anything that is not a step along the bar. Opening a ninja from
  // the home is a step INWARD, and sliding it in from the side would claim
  // the home and the child sit next to each other.
  //
  // Zero on a desktop too, whatever the sections are. The side rail is a
  // COLUMN: moving from Home to Events moves the pill down it, and a page
  // arriving from the right would be describing a journey nothing on screen
  // just made. The phone's bar runs left to right, so there it agrees.

  // Layout effect, so the page is never painted at the old offset first.
  //
  // THE ENTRANCE. Moving between sections used to be a cut: one page was
  // gone and the next was there, with no frame in between saying they were
  // different pages rather than one page redrawing. It rises a few pixels
  // into place instead, which is short enough to be over before it is a wait
  // and long enough to read as an arrival.
  //
  // Only the incoming page animates. There is no exit, on purpose: an exit
  // means both pages are mounted at once, which doubles the document height
  // for the length of the animation and moves the scrollbar under the hand
  // of somebody who is already scrolling.
  //
  // The `y` has to land back at exactly zero. A lingering transform on this
  // wrapper would be a containing block around the pinned banners, and a
  // banner that cannot pin is the bug this same hook was written to fix.
  // framer writes `transform: none` once every value is at its default, so
  // it does, and there is a test for it below.
  useLayoutEffect(() => {
    const now = sectionIndex(pathname);
    const from = cameFrom;
    cameFrom = now >= 0 ? now : null;
    const dir = lateral && now >= 0 && from != null && now !== from ? Math.sign(now - from) : 0;

    window.scrollTo(0, 0);
    // Reduced motion still has to put the page back where it belongs: a
    // thrown page is left sitting off to one side otherwise.
    if (still) { page.set({ opacity: 1, x: 0, y: 0 }); return; }
    if (dir) {
      // ACROSS, not up. The section came from the side the thumb threw the
      // last one, so the two halves of the movement read as one sweep and
      // the bar's pill is travelling the same way at the same time.
      page.set({ opacity: 0, x: dir * 56, y: 0 });
      // `velocity: 0` is load-bearing. A spring reads the value's recent
      // history for its starting speed, and the jump `set` just made from 0
      // to 56 in a single frame looks like an enormous throw: without this
      // the page carried on out to 77px before turning round, which is a
      // wider gap at the edge than the 56 the code appears to ask for.
      page.start({ opacity: 1, x: 0, y: 0, transition: { type: 'spring', stiffness: 420, damping: 38, mass: 0.9, velocity: 0 } });
    } else {
      page.set({ opacity: 0, x: 0, y: 10 });
      page.start({ opacity: 1, x: 0, y: 0, transition: { duration: 0.34, ease: [0.23, 1, 0.32, 1] } });
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return page;
}

export default function ParentLayout({ children, bleed = false }) {
  const { parent, logout } = useParentAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [bugOpen, setBugOpen] = useState(false);
  const desktop = useIsDesktop();
  const page = useTopOnNavigate(!desktop);
  const still = useReducedMotion();
  // The parent portal is light only; there is no theme toggle here and the
  // shell holds the page light while it is up.
  useLightOnly();

  const handleLogout = async () => {
    await logout();
    navigate('/login?tab=parent');
  };

  // SWIPING BETWEEN SECTIONS, on a phone, the way a photo app does it. The
  // bar is three sections wide and a thumb reaching the bottom of a tall
  // screen is the least comfortable thing on it, so the sideways throw the
  // hand wants to make is the one that ought to work.
  //
  // The page follows the finger while the throw is happening, which is the
  // whole point: a gesture that does nothing until you let go is a button
  // with extra steps, and there is no way to change your mind halfway. It
  // rubber-bands at each end because there is nothing past Home on the left
  // or the account on the right, and a page that refuses to move at all
  // reads as a dropped touch rather than as an edge.
  //
  // Only on the three sections. A ninja's profile and a listing have no
  // neighbour, and both of them carry horizontal scrollers of their own —
  // the belt road, the sticker shelf — which a page-level swipe would fight
  // for the same finger.
  const here = sectionIndex(pathname);
  const swipeable = !desktop && here >= 0;
  const room = typeof window === 'undefined' ? 390 : window.innerWidth;

  // WHICH WAY THE THROW IS GOING, decided by whichever axis is actually
  // winning. This used to be framer's own `dragDirectionLock` and that prop
  // is gone on purpose: it tests the vertical axis FIRST, so a gesture that
  // has drifted 14px down and 4px across locks to vertical and stays there
  // for the rest of the throw, however far across it then goes. A thumb
  // swiping a phone pivots, so it arcs, so it does exactly that.
  //
  // The result was the worst of both: the page did not follow the finger,
  // because x was pinned by the lock, and on a real phone the browser took
  // the gesture as a scroll and cancelled the pointer, so nothing happened
  // at all. On a desktop, where nothing cancels it, the release still
  // navigated — a section change with no movement in front of it.
  //
  // A plain comparison has no favourite axis. Vertical still wins outright
  // when it deserves to, and `touch-action: pan-y` still leaves real
  // scrolling to the browser.
  const axis = useRef(null);

  const onDecide = (_event, info) => {
    const across = Math.abs(info.offset.x);
    const down = Math.abs(info.offset.y);
    const gone = Math.max(across, down);
    // PROVISIONAL UNTIL THE GESTURE HAS GONE SOMEWHERE. Deciding on the first
    // sample past a few pixels is the same mistake in a different coat: a
    // thumb that dips before it travels reads as vertical for one frame and
    // would be stuck with it. Up to 30px the answer keeps being revised, and
    // after that it is settled and a change of mind mid-throw cannot yank the
    // page sideways.
    if (gone >= 8 && (!axis.current || gone < 30)) {
      axis.current = across > down ? 'x' : 'y';
    }
    // A gesture that turned out to be a scroll leaves the page where it is.
    if (axis.current === 'y') page.set({ x: 0 });
  };

  const onThrow = (_event, info) => {
    // Only a sideways throw changes section. Reading `offset.x` alone was
    // what let a downward scroll with a little sideways drift in it land on
    // another page.
    if (axis.current !== 'x') {
      page.start({ x: 0, transition: { type: 'spring', stiffness: 560, damping: 44 } });
      return;
    }
    const dir = info.offset.x < 0 ? 1 : -1;
    const to = here + dir;
    // Distance OR speed, because a slow deliberate drag past a quarter of the
    // screen and a quick flick are both a person saying next, and asking for
    // distance alone makes the flick feel broken.
    //
    // The flick still has to cover ground. On speed alone a 40px twitch at
    // the tail of some other gesture changed section, which is the kind of
    // thing that happens with a thumb on a moving bus.
    const far = Math.abs(info.offset.x);
    const meant = far > room * 0.24 || (Math.abs(info.velocity.x) > 500 && far > room * 0.12);
    if (!meant || to < 0 || to >= SECTIONS.length) {
      page.start({ x: 0, transition: { type: 'spring', stiffness: 560, damping: 44 } });
      return;
    }
    if (still) { page.set({ x: 0 }); navigate(SECTIONS[to]); return; }
    // Let the throw land before the section changes. The page carries on the
    // way it was going and fades as it leaves, so the arriving one is
    // continuing a movement rather than interrupting it.
    page
      .start({ x: info.offset.x - dir * 44, opacity: 0, transition: { duration: 0.13, ease: 'easeOut' } })
      .then(() => navigate(SECTIONS[to]));
  };

  return (
    <div className="min-h-[100dvh] bg-ninja-bg lg:flex">
      {/* Liquid glass filter for the phone capsule. Chromium refracts; iOS
          Safari falls back to blur. Same filter the staff shell defines. */}
      <svg aria-hidden="true" className="absolute w-0 h-0 pointer-events-none" focusable="false">
        <filter id="liquidGlass" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.014" numOctaves="2" seed="17" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2.2" result="softNoise" />
          <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* The lens for the page sheet's glass rim. Not turbulence: a rim is
            a smooth bend, not a ripple. The map is a vertical gradient, held
            at full strength down to the 74% line and easing to nothing at the
            bottom; on the rim element that line is where the straight run of
            the band begins (lip over lip-plus-rim, 40/54 and 34/46 both land
            there), so the bend is strongest along the band's top edge and
            gone by the time it has dissolved into paper. Red carries the bend
            (0 = pull from above), blue is pinned at 128 so nothing moves
            sideways. iOS Safari cannot run an SVG filter in a backdrop and
            falls back to the blur and saturation alone. */}
        <filter id="glassRim" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage href={LENS_MAP} preserveAspectRatio="none" result="lens" />
          <feDisplacementMap in="SourceGraphic" in2="lens" scale="20" xChannelSelector="B" yChannelSelector="R" />
        </filter>
      </svg>

      <ParentSideNav
        parentName={parent?.parentName}
        centerName={parent?.centerName}
        onLogout={handleLogout}
        onReport={() => setBugOpen(true)}
      />

      {/* The phone's flat top bar: the logo and the account, nothing else. */}
      <header className={`bg-white border-b border-ninja-border ${bleed ? 'hidden' : 'lg:hidden'}`}>
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Logo variant="lockup" className="h-8 text-ninja-navy" />
            <span className="text-ninja-muted font-ninja text-[13px] v2 hidden sm:inline">Parent Portal</span>
          </div>
        </div>
      </header>

      {/* `overflow-x-clip`, not hidden: `clip` is not a scroll container, so
          the banners inside can still pin themselves to the viewport. Hidden
          would make main the scrollport and every sticky thing in the portal
          would stick to a box that never scrolls. */}
      <main className="flex-1 min-w-0 overflow-x-clip pt-5 lg:pt-7 pb-32 lg:pb-12 [container-type:inline-size]">
        <motion.div
          className="max-w-6xl mx-auto px-4 sm:px-6"
          animate={page}
          drag={swipeable ? 'x' : false}
          dragMomentum={false}
          dragElastic={0.14}
          dragConstraints={{ left: here < SECTIONS.length - 1 ? -room : 0, right: here > 0 ? room : 0 }}
          onDragStart={() => { axis.current = null; }}
          onDrag={onDecide}
          onDragEnd={onThrow}
        >
          {children}
        </motion.div>
      </main>

      <ParentTabBar />

      <BugReportButton open={bugOpen} onClose={() => setBugOpen(false)} reporter={{ name: parent?.parentName, role: 'parent' }} />
    </div>
  );
}
