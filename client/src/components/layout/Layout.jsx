import { useState, useEffect, useRef, createContext, useContext, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import MobileNav from './MobileNav';
import BugReportButton from '../ui/BugReportButton';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../api/client';
import { getMobileNavTabs } from '../../lib/navTabs';
import { ONBOARDING_ENABLED } from '../../lib/features';
import { WarningIcon } from '../ui/icons';
import { XIcon } from 'lucide-react';

const SKIP_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);

// True when the thing under the finger has its own use for a sideways drag, so
// the page must not steal it to change tabs. `data-no-swipe` is how a component
// says that about itself: the task board's cards are swiped between stages,
// and a card that both moved and navigated away would have done neither.
function touchTargetShouldScroll(el) {
  let node = el;
  while (node && node !== document.body) {
    if (SKIP_TAGS.has(node.tagName)) return true;
    if (node.dataset && node.dataset.noSwipe !== undefined) return true;
    const style = window.getComputedStyle(node);
    const ox = style.overflowX;
    if ((ox === 'auto' || ox === 'scroll') && node.scrollWidth > node.clientWidth) return true;
    node = node.parentElement;
  }
  return false;
}

export const LayoutPreviewContext = createContext(false);

const TAB_LAZY_MAP = {
  '/manager/overview': lazy(() => import('../../pages/manager/DirectorDashboard')),
  '/manager/dashboard': lazy(() => import('../../pages/manager/ManagerDashboard')),
  '/sensei/dashboard': lazy(() => import('../../pages/sensei/SenseiDashboard')),
  '/sensei/tasks': lazy(() => import('../../pages/sensei/SenseiTasksPage')),
  '/manager/students': lazy(() => import('../../pages/manager/StudentRoster')),
  '/clubs': lazy(() => import('../../pages/ClubsPage')),
  '/manager/staff': lazy(() => import('../../pages/manager/StaffPage')),
  '/manager/reports': lazy(() => import('../../pages/manager/reports/ReportsLayout')),
  '/curriculum-roadmap': lazy(() => import('../../pages/CurriculumRoadmapPage')),
  '/account': lazy(() => import('../../pages/AccountPage')),
};

function AnnouncementBanner({ text, title, dismissId }) {
  const storageKey = `ann_dismissed_${dismissId ?? encodeURIComponent(text).slice(0, 32)}`;
  const [dismissed, setDismissed] = useState(() => !!sessionStorage.getItem(storageKey));
  const dismiss = () => { sessionStorage.setItem(storageKey, '1'); setDismissed(true); };
  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
          className="border-b border-ninja-border px-4 sm:px-6 py-2.5 flex items-center gap-3"
        >
          <WarningIcon className="w-4 h-4 text-ninja-red flex-shrink-0" />
          <p className="flex-1 text-ninja-navy font-ninja text-sm leading-snug">
            {title && <span className="font-bold">{title}. </span>}{text}
          </p>
          <button onClick={dismiss} className="text-ninja-muted hover:text-ninja-navy transition-colors flex-shrink-0" aria-label="Dismiss announcement">
            <XIcon className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Per-center announcements posted by Center Directors (announcements table).
// Shown to every staff member at the active location, above the app content.
function LocationAnnouncements() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    api.get('/announcements').then((d) => { if (alive) setItems(d || []); }).catch(() => {});
    return () => { alive = false; };
  }, [user?.activeLocation?.id]);
  return items.map((a) => (
    <AnnouncementBanner key={a.id} dismissId={`loc_${a.id}`} title={a.title} text={a.message} />
  ));
}

function AdjacentPanel({ tab, panelRef, side }) {
  const Component = tab ? TAB_LAZY_MAP[tab.to] : null;
  if (!Component) return null;
  return (
    <div
      ref={panelRef}
      className="absolute top-0 left-0 right-0 bg-ninja-bg lg:hidden pointer-events-none overflow-hidden"
      style={{ transform: `translateX(${side === 'left' ? '-100%' : '100%'})`, willChange: 'transform' }}
    >
      <LayoutPreviewContext.Provider value={true}>
        <div className="px-4 py-4 sm:px-6 sm:py-8">
          <Suspense fallback={null}>
            <Component />
          </Suspense>
        </div>
      </LayoutPreviewContext.Provider>
    </div>
  );
}

// `motionKey` replaces the route as the page's enter animation key. A section
// with its own tabs (Reports) passes a constant so switching tab does not
// remount and re-fade its navigation and filters; it animates its own content.
export default function Layout({ children, motionKey }) {
  const isPreview = useContext(LayoutPreviewContext);
  const { user, viewAs } = useAuth();
  // Desktop-only display setting: nav runs along the top instead of the sidebar.
  const { horizontalNav: useTopNav } = useTheme();
  const [bugOpen, setBugOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const dragRef = useRef(null);
  const prevPanelRef = useRef(null);
  const nextPanelRef = useRef(null);
  const lastScrollY = useRef(0);
  const [navCompact, setNavCompact] = useState(false);

  // The swipe preview panels are mobile-only, and `lg:hidden` was hiding them
  // rather than skipping them: on desktop both adjacent routes still mounted
  // inside display:none, so every Recharts container in the dashboard and
  // Reports measured 0x0 and warned on each render. Decide in JS instead, the
  // way the Account page picks its layout, so desktop mounts neither panel.
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsWide(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleMainScroll = (e) => {
    const y = e.currentTarget.scrollTop;
    if (y < 24) { setNavCompact(false); lastScrollY.current = y; return; }
    const dy = y - lastScrollY.current;
    if (dy > 6) setNavCompact(true);
    else if (dy < -6) setNavCompact(false);
    lastScrollY.current = y;
  };
  const touchStart = useRef(null);
  const isHorizontalSwipe = useRef(false);
  const swipeDirRef = useRef(null);
  const animating = useRef(false);
  const swipeBlocked = useRef(false);
  const swipeTimer = useRef(null);

  // Tapping a nav icon mid-swipe must win: cancel the pending swipe navigate + reset its visuals.
  const cancelPendingSwipe = () => {
    if (swipeTimer.current) { clearTimeout(swipeTimer.current); swipeTimer.current = null; }
    if (!animating.current) return;
    animating.current = false;
    if (dragRef.current) { dragRef.current.style.transition = ''; dragRef.current.style.transform = ''; }
    if (prevPanelRef.current) { prevPanelRef.current.style.transition = 'none'; prevPanelRef.current.style.transform = 'translateX(-100%)'; }
    if (nextPanelRef.current) { nextPanelRef.current.style.transition = 'none'; nextPanelRef.current.style.transform = 'translateX(100%)'; }
  };

  useEffect(() => {
    if (isPreview) return;
    if (user?.mustResetPassword && location.pathname !== '/welcome') {
      navigate('/welcome', { replace: true });
    } else if (ONBOARDING_ENABLED && user && !user.mustResetPassword && user.onboarded === false && location.pathname !== '/getting-started') {
      // New account, password already set → send through the Getting Started page once.
      navigate('/getting-started', { replace: true });
    }
  }, [isPreview, user?.mustResetPassword, user?.onboarded, location.pathname, navigate]);

  useEffect(() => {
    if (isPreview) return;

    const handleStart = (e) => {
      if (animating.current) return;
      if (touchTargetShouldScroll(e.target)) return;
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isHorizontalSwipe.current = false;
      swipeDirRef.current = null;
      swipeBlocked.current = false;
    };

    const handleMove = (e) => {
      if (!touchStart.current || !dragRef.current || animating.current) return;
      const dx = e.touches[0].clientX - touchStart.current.x;
      const dy = e.touches[0].clientY - touchStart.current.y;

      if (!isHorizontalSwipe.current) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Require clearly horizontal gesture before intercepting (same 1.5× ratio as navigation threshold)
        if (Math.abs(dx) < Math.abs(dy) * 1.5) { touchStart.current = null; return; }
        e.preventDefault();
        isHorizontalSwipe.current = true;
        swipeDirRef.current = dx < 0 ? 'left' : 'right';

        const tabs = getMobileNavTabs(user, viewAs);
        const idx = tabs.findIndex(t => t.to === location.pathname);
        if (idx === -1 && dx < 0) { swipeBlocked.current = true; return; }
        if (idx !== -1) {
          const adjIdx = dx < 0 ? idx + 1 : idx - 1;
          if (adjIdx < 0 || adjIdx >= tabs.length) { swipeBlocked.current = true; return; }
        }
      }

      // Vertical escape: gesture latched horizontal but turned clearly vertical while
      // the drag is still small — release to native scroll (fixes scroll-lock mid-gesture).
      if (Math.abs(dx) < 40 && Math.abs(dy) > Math.abs(dx) * 1.5) {
        isHorizontalSwipe.current = false;
        swipeDirRef.current = null;
        touchStart.current = null;
        dragRef.current.style.transition = 'none';
        dragRef.current.style.transform = '';
        if (prevPanelRef.current) { prevPanelRef.current.style.transition = 'none'; prevPanelRef.current.style.transform = 'translateX(-100%)'; }
        if (nextPanelRef.current) { nextPanelRef.current.style.transition = 'none'; nextPanelRef.current.style.transform = 'translateX(100%)'; }
        return;
      }

      if (swipeBlocked.current) return;
      e.preventDefault();
      dragRef.current.style.transform = `translate3d(${dx}px, 0, 0)`;
      dragRef.current.style.transition = 'none';
      if (prevPanelRef.current) {
        prevPanelRef.current.style.transform = `translate3d(calc(-100% + ${dx}px), 0, 0)`;
        prevPanelRef.current.style.transition = 'none';
      }
      if (nextPanelRef.current) {
        nextPanelRef.current.style.transform = `translate3d(calc(100% + ${dx}px), 0, 0)`;
        nextPanelRef.current.style.transition = 'none';
      }
    };

    const handleEnd = (e) => {
      if (!touchStart.current || animating.current) return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      touchStart.current = null;
      isHorizontalSwipe.current = false;
      const dir = swipeDirRef.current;
      swipeDirRef.current = null;

      const el = dragRef.current;
      if (!el) return;
      if (swipeBlocked.current) { swipeBlocked.current = false; return; }

      const SPRING = 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)';

      if (Math.abs(dx) >= 60 && Math.abs(dx) >= Math.abs(dy) * 1.5) {
        const tabs = getMobileNavTabs(user, viewAs);
        const idx = tabs.findIndex(t => t.to === location.pathname);

        if (idx === -1 && dx > 0) {
          animating.current = true;
          el.style.transition = SPRING;
          el.style.transform = 'translate3d(100%, 0, 0)';
          swipeTimer.current = setTimeout(() => {
            swipeTimer.current = null;
            if (prevPanelRef.current) {
              prevPanelRef.current.style.transition = 'none';
              prevPanelRef.current.style.transform = 'translateX(-100%)';
            }
            if (nextPanelRef.current) {
              nextPanelRef.current.style.transition = 'none';
              nextPanelRef.current.style.transform = 'translateX(100%)';
            }
            el.style.transform = '';
            el.style.transition = '';
            animating.current = false;
            navigate(-1);
          }, 280);
          return;
        }

        if (idx !== -1) {
          const canGoNext = dx < 0 && idx < tabs.length - 1;
          const canGoPrev = dx > 0 && idx > 0;
          if (canGoNext || canGoPrev) {
            animating.current = true;
            const nextPath = canGoNext ? tabs[idx + 1].to : tabs[idx - 1].to;
            el.style.transition = SPRING;
            el.style.transform = `translate3d(${dx < 0 ? '-100%' : '100%'}, 0, 0)`;

            // Slide in the appropriate adjacent panel
            const incomingPanel = dx < 0 ? nextPanelRef : prevPanelRef;
            if (incomingPanel.current) {
              incomingPanel.current.style.transition = SPRING;
              incomingPanel.current.style.transform = 'translate3d(0, 0, 0)';
            }

            swipeTimer.current = setTimeout(() => {
              swipeTimer.current = null;
              if (prevPanelRef.current) {
                prevPanelRef.current.style.transition = 'none';
                prevPanelRef.current.style.transform = 'translateX(-100%)';
              }
              if (nextPanelRef.current) {
                nextPanelRef.current.style.transition = 'none';
                nextPanelRef.current.style.transform = 'translateX(100%)';
              }
              el.style.transform = '';
              el.style.transition = '';
              animating.current = false;
              navigate(nextPath, { state: { swipeDir: dir, fromSwipe: true } });
            }, 280);
            return;
          }
        }
      }

      const SNAP = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
      el.style.transition = SNAP;
      el.style.transform = 'translate3d(0, 0, 0)';
      if (prevPanelRef.current) {
        prevPanelRef.current.style.transition = SNAP;
        prevPanelRef.current.style.transform = 'translateX(-100%)';
      }
      if (nextPanelRef.current) {
        nextPanelRef.current.style.transition = SNAP;
        nextPanelRef.current.style.transform = 'translateX(100%)';
      }
    };

    const handleCancel = () => {
      touchStart.current = null;
    };

    document.addEventListener('touchstart', handleStart, { passive: true });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd, { passive: true });
    document.addEventListener('touchcancel', handleCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleStart);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleCancel);
    };
  }, [isPreview, user, viewAs, location.pathname, navigate]);

  // Content-only render for adjacent preview panels (no shell, no sidebar, no nav)
  if (isPreview) {
    return <>{children}</>;
  }

  const tabs = getMobileNavTabs(user, viewAs);
  const currentIdx = tabs.findIndex(t => t.to === location.pathname);
  const prevTab = currentIdx > 0 ? tabs[currentIdx - 1] : null;
  const nextTab = currentIdx < tabs.length - 1 ? tabs[currentIdx + 1] : null;

  const fromSwipe = location.state?.fromSwipe;
  const swipeDir = location.state?.swipeDir;
  const enterX = fromSwipe ? 0 : (swipeDir === 'left' ? '100%' : swipeDir === 'right' ? '-100%' : 0);

  return (
    <div className={`fixed inset-0 overflow-hidden flex flex-col bg-ninja-bg lg:static lg:inset-auto lg:overflow-visible lg:min-h-[100dvh] ${useTopNav ? '' : 'lg:flex-row'}`}>
      {/* Liquid-glass refraction filter — displaces the backdrop so content warps through the glass.
          Renders in Chromium; iOS Safari ignores url() in backdrop-filter and falls back to blur. */}
      <svg aria-hidden="true" className="absolute w-0 h-0 pointer-events-none" focusable="false">
        <filter id="liquidGlass" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.014" numOctaves="2" seed="17" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2.2" result="softNoise" />
          <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {useTopNav
        ? <TopNav onOpenBug={() => setBugOpen(true)} />
        : <Sidebar onOpenBug={() => setBugOpen(true)} />}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {user?.announcement && <AnnouncementBanner text={user.announcement} />}
        {!isPreview && <LocationAnnouncements />}
        {/* overflow-y-auto is the mobile app shell's scroller (the wrapper is
            fixed inset-0 there). On desktop the wrapper is static and main
            stretches to its content, so main never actually scrolls — the
            document does. Leaving overflow-y-auto on regardless made main the
            nearest scrollport for position:sticky, and a scrollport that never
            scrolls gives sticky nothing to stick to, which killed sticky on
            every desktop page. handleMainScroll only feeds MobileNav, so it
            costs nothing to drop the scroller at lg. */}
        <main onScroll={handleMainScroll} className="flex-1 overflow-y-auto lg:overflow-visible min-h-0 max-w-7xl lg:max-w-none mx-auto w-full px-4 sm:px-6 lg:px-8 pt-[max(env(safe-area-inset-top),1.25rem)] lg:pt-8 pb-28 lg:pb-8">
          <div className="relative overflow-x-hidden overflow-y-hidden lg:overflow-x-visible lg:overflow-y-visible">
            {!isWide && prevTab && (
              <AdjacentPanel key={prevTab.to} tab={prevTab} panelRef={prevPanelRef} side="left" />
            )}
            {!isWide && nextTab && (
              <AdjacentPanel key={nextTab.to} tab={nextTab} panelRef={nextPanelRef} side="right" />
            )}

            <div ref={dragRef} className="relative bg-ninja-bg touch-pan-y lg:touch-auto">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={motionKey ?? location.key}
                  initial={{ x: enterX, opacity: fromSwipe ? 1 : 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={fromSwipe ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: '100%' }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>
        <MobileNav compact={navCompact} onBeforeNavigate={cancelPendingSwipe} />
      </div>
      <BugReportButton
        open={bugOpen}
        onClose={() => setBugOpen(false)}
        reporter={{ name: user?.displayName, role: user?.role, location: user?.activeLocation?.name }}
      />
    </div>
  );
}
