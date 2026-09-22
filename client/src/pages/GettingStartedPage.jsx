import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SmilePlusIcon,
  ClipboardCheckIcon,
  PencilIcon,
  TrendingUpIcon,
  UsersIcon,
  UserPlusIcon,
  ChartNoAxesColumnIncreasingIcon,
  UsersRoundIcon,
  RocketIcon,
} from 'lucide-react';
import Lottie from 'lottie-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { getHomePath } from '../lib/navTabs';

// Screen glyphs, by the key each screen carries.
const ICONS = {
  wave: SmilePlusIcon,
  checkin: ClipboardCheckIcon,
  log: PencilIcon,
  progress: TrendingUpIcon,
  clubs: UsersIcon,
  roster: UserPlusIcon,
  reports: ChartNoAxesColumnIncreasingIcon,
  staff: UsersRoundIcon,
  rocket: RocketIcon,
};

// Each screen: media is tried first; falls back to the icon if the asset is missing.
// Drop real clips/animations in client/public/onboarding/ and fill `src` (e.g. media:{type:'video',src:'/onboarding/checkin.webm'}).
const WELCOME = { icon: 'wave', media: { type: 'lottie', src: '/onboarding/welcome.json' }, title: 'Welcome to DojoLink', body: 'A quick tour of the basics. Swipe through, takes about a minute.' };
const FINISH = { icon: 'rocket', media: { type: 'lottie', src: '/onboarding/celebrate.json' }, title: 'You’re all set 🥷', body: 'You can reopen this anytime from your Account page. Let’s go!' };

const SENSEI = [
  { icon: 'checkin', media: { type: 'video', src: '/onboarding/checkin.webm' }, title: 'Check in your ninjas', body: 'Open the Today tab, tap a ninja to check them in, and assign them to a sensei.' },
  { icon: 'log', media: { type: 'video', src: '/onboarding/log.webm' }, title: 'Log a session', body: 'Open a ninja, record the lessons they worked on, any belt advancement, and a quick note.' },
  { icon: 'progress', media: { type: 'video', src: '/onboarding/progress.webm' }, title: 'Track progress', body: 'Each profile shows belt, current project, % complete, and full session history.' },
  { icon: 'clubs', media: { type: 'video', src: '/onboarding/clubs.webm' }, title: 'Run clubs', body: 'In Clubs, start a session, mark attendance, and add notes or resources.' },
];

const MANAGER = [
  { icon: 'roster', media: { type: 'video', src: '/onboarding/roster.webm' }, title: 'Manage the roster', body: 'In Ninjas, search, add, or import students from CSV, and edit or archive any profile.' },
  { icon: 'reports', media: { type: 'video', src: '/onboarding/reports.webm' }, title: 'See the big picture', body: 'Reports shows enrollment, belt distribution, inactive students, and belt advancements.' },
  { icon: 'staff', media: { type: 'video', src: '/onboarding/staff.webm' }, title: 'Manage your team', body: 'Use Staff to add or remove senseis, reset credentials, and set profile photos.' },
];

function FallbackIcon({ name }) {
  const Glyph = ICONS[name] || ICONS.rocket;
  return <Glyph width={72} height={72} strokeWidth={1.6} className="text-ninja-blue" />;
}

function OnboardingMedia({ screen }) {
  const { media, icon } = screen;
  const [failed, setFailed] = useState(false);
  const [lottieData, setLottieData] = useState(null);

  useEffect(() => {
    setFailed(false); setLottieData(null);
    if (media?.type === 'lottie' && media.src) {
      let alive = true;
      fetch(media.src)
        .then((r) => { if (!r.ok) throw new Error('missing'); return r.json(); })
        .then((d) => { if (alive) setLottieData(d); })
        .catch(() => { if (alive) setFailed(true); });
      return () => { alive = false; };
    }
  }, [media?.type, media?.src]);

  const showFallback = !media || media.type === 'none' || failed || (media.type === 'lottie' && !lottieData);

  return (
    <div className="w-full aspect-[4/3] rounded-3xl bg-ninja-blue/[0.06] border border-ninja-border flex items-center justify-center overflow-hidden">
      {!showFallback && media.type === 'video' && (
        <video src={media.src} autoPlay loop muted playsInline onError={() => setFailed(true)} className="w-full h-full object-cover" />
      )}
      {!showFallback && media.type === 'lottie' && lottieData && (
        <Lottie animationData={lottieData} loop className="w-3/4 h-3/4" />
      )}
      {showFallback && <FallbackIcon name={icon} />}
    </div>
  );
}

const variants = {
  enter: (dir) => ({ x: dir > 0 ? 340 : -340, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -340 : 340, opacity: 0 }),
};
const SWIPE_THRESHOLD = 60;

export default function GettingStartedPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const [finishing, setFinishing] = useState(false);

  const isManager = ['manager', 'admin'].includes(user?.role);
  const screens = [WELCOME, ...SENSEI, ...(isManager ? MANAGER : []), FINISH];
  const dashPath = getHomePath();
  const screen = screens[page];
  const isLast = page === screens.length - 1;

  const paginate = (delta) => {
    const nextPage = page + delta;
    if (nextPage < 0 || nextPage >= screens.length) return;
    setDir(delta); setPage(nextPage);
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try { await api.post('/onboarding/complete', {}); } catch {}
    if (user && !user.onboarded) setUser({ ...user, onboarded: true });
    navigate(dashPath, { replace: true });
  };

  const next = () => { isLast ? finish() : paginate(1); };

  return (
    <div className="relative min-h-[100dvh] bg-ninja-bg flex flex-col overflow-hidden">
      {/* Scenic background (matches the Welcome onboarding page) */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/onboarding-bg.webp)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ninja-bg/70 via-ninja-bg/85 to-ninja-bg" />

      <div className="relative flex-1 flex flex-col max-w-md w-full mx-auto px-5 pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),24px)]">
        {/* Top: progress dots + skip */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-1.5">
            {screens.map((s, i) => (
              <motion.span key={s.title} className="h-1.5 rounded-full bg-ninja-blue"
                animate={{ width: i === page ? 22 : 7, opacity: i === page ? 1 : 0.3 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            ))}
          </div>
          {!isLast && (
            <button onClick={finish} className="text-ninja-muted hover:text-ninja-navy font-ninja text-sm font-semibold transition-colors">Skip</button>
          )}
        </div>

        {/* Swipeable screen */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <AnimatePresence mode="popLayout" custom={dir} initial={false}>
            <motion.div
              key={page}
              custom={dir}
              variants={variants}
              initial="enter" animate="center" exit="exit"
              transition={{ x: { type: 'spring', stiffness: 320, damping: 32 }, opacity: { duration: 0.2 } }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(e, { offset, velocity }) => {
                const swipe = offset.x + velocity.x * 0.2;
                if (swipe < -SWIPE_THRESHOLD) paginate(1);
                else if (swipe > SWIPE_THRESHOLD) paginate(-1);
              }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center cursor-grab active:cursor-grabbing"
            >
              <div className="w-full mb-7"><OnboardingMedia screen={screen} /></div>
              <h1 className="text-2xl font-black font-ninja text-ninja-navy mb-2 px-2">{screen.title}</h1>
              <p className="text-ninja-muted font-ninja text-sm leading-relaxed px-3 max-w-sm">{screen.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom: back / next */}
        <div className="flex items-center gap-3 pt-5">
          {page > 0 ? (
            <motion.button onClick={() => paginate(-1)} whileTap={{ scale: 0.96 }}
              className="px-5 py-3 rounded-xl bg-white border border-ninja-border text-ninja-navy font-ninja font-semibold text-sm hover:border-ninja-blue transition-colors">
              Back
            </motion.button>
          ) : <div className="w-px" />}
          <motion.button onClick={next} whileTap={{ scale: 0.97 }} disabled={finishing}
            className="flex-1 py-3.5 rounded-xl bg-ninja-blue text-white font-ninja font-bold text-sm hover:bg-ninja-blue/90 transition-colors disabled:opacity-60">
            {isLast ? (finishing ? 'Loading…' : 'Get started') : 'Next'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
