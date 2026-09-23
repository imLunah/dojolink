import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useAuth, hadSession } from '../context/AuthContext';
import { getHomePath } from '../lib/navTabs';
import { useLightOnly } from '../context/ThemeContext';
import Logo from '../components/ui/Logo';
import { DeskMockup, PhoneMockup } from '../components/landing/ProductMockups';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y:  0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// Each feature card leads with a vignette built from the app's own parts,
// the same way the hero draws its desk. Names are invented. The art answers
// the pointer, so the cards feel like the product rather than a brochure.
const popSpring = { type: 'spring', stiffness: 420, damping: 17 };

function CheckInVignette() {
  const still = useReducedMotion();
  return (
    <div className="flex items-center gap-5 h-28">
      <motion.img
        src="/ninjas/purple-cheer-medium.png"
        alt=""
        className="w-20 h-20 rounded-full bg-ninja-bg object-contain"
        whileHover={still ? undefined : { scale: 1.12, rotate: -6, y: -4 }}
        whileTap={still ? undefined : { scale: 0.94 }}
        transition={popSpring}
      />
      <div className="min-w-0">
        <div className="text-base font-extrabold text-ninja-navy leading-tight whitespace-nowrap">Maya R.</div>
        <div className="flex items-center gap-1.5 text-xs text-ninja-muted font-semibold whitespace-nowrap mt-0.5">
          <img src="/belts/belt-purple.svg" alt="" className="h-4" />
          Purple belt
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 whitespace-nowrap mt-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          In · 4:01 pm
        </div>
      </div>
    </div>
  );
}

const LADDER = [
  { belt: 'white',  cls: 'h-11' },
  { belt: 'yellow', cls: 'h-11' },
  { belt: 'orange', cls: 'h-16 drop-shadow-md' },
  { belt: 'green',  cls: 'h-11 opacity-35' },
  { belt: 'blue',   cls: 'h-11 opacity-35' },
];

function BeltLadderVignette() {
  const still = useReducedMotion();
  return (
    <div className="flex items-center justify-between h-28 px-1">
      {LADDER.map(({ belt, cls }) => (
        <motion.img
          key={belt}
          src={`/belts/belt-${belt}.svg`}
          alt=""
          className={cls}
          whileHover={still ? undefined : { scale: 1.25, y: -5 }}
          whileTap={still ? undefined : { scale: 0.92 }}
          transition={popSpring}
        />
      ))}
    </div>
  );
}

const STICKERS = [
  { src: 'yellow-2', cls: 'h-16 -rotate-6',                  hover: { scale: 1.16, rotate: 0, y: -5 } },
  { src: 'orange-3', cls: 'h-24 rotate-2 drop-shadow-md',     hover: { scale: 1.16, rotate: 0, y: -5 } },
  // The locked one answers the hand but stays locked: a small shake, no colour.
  { src: 'green-1',  cls: 'h-16 rotate-6 opacity-35 grayscale', hover: { scale: 1.05, rotate: [6, -2, 6] } },
];

function StickerVignette() {
  const still = useReducedMotion();
  return (
    <div className="flex items-center justify-center gap-4 h-28">
      {STICKERS.map(({ src, cls, hover }) => (
        <motion.img
          key={src}
          src={`/belt-stickers/${src}.png`}
          alt=""
          className={cls}
          whileHover={still ? undefined : hover}
          whileTap={still ? undefined : { scale: 0.92 }}
          transition={popSpring}
        />
      ))}
    </div>
  );
}

const FEATURES = [
  {
    art: CheckInVignette,
    title: 'Pick up where they left off',
    blurb: 'Instructors open a ninja and see the last session logged, what comes next, and any special instructions on file.',
  },
  {
    art: BeltLadderVignette,
    title: 'Belt and lesson progress',
    blurb: 'Every lesson checked off moves a ninja up the ladder, so instructors always know what comes next.',
  },
  {
    art: StickerVignette,
    title: 'A portal for parents',
    blurb: 'Parents follow belts, badges, and milestones from home, without having to catch someone at pickup.',
  },
];

function GetStarted({ onClick, tone = 'white' }) {
  const solid = tone === 'solid';
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`font-ninja font-bold text-lg px-12 py-4 rounded-2xl ${
        solid ? 'bg-ninja-blue text-white' : 'bg-white text-ninja-blue'
      }`}
      style={{ boxShadow: solid ? '0 10px 26px rgb(0 106 221 / 0.22)' : '0 12px 36px rgb(9 30 66 / 0.28)' }}
    >
      <span className="flex items-center justify-center gap-2.5">
        Get Started
        <motion.span
          animate={{ x: [0, 5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          →
        </motion.span>
      </span>
    </motion.button>
  );
}

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  // Only someone who has signed in before is worth holding a spinner for. A first-time
  // visitor gets the hero on the first frame instead of waiting out /auth/me.
  const [maybeSignedIn] = useState(hadSession);
  // The public face of the product is light, full stop — a staff member's dark
  // preference waits for them past the sign-in door.
  useLightOnly();

  useEffect(() => {
    if (!loading && user) {
      navigate(getHomePath(user), { replace: true });
    }
  }, [user, loading, navigate]);

  // Where the fade-out lands: Sign in goes to the login form, Get Started to
  // the guided walk-through. The chunk is fetched on the press so it has
  // the length of the fade to arrive.
  const handleSignIn = () => setLeaving('/login');
  const handleGetStarted = () => { import('./GetStartedPage'); setLeaving('/start'); };

  // ── Scroll-linked 3D ─────────────────────────────────────────────────
  // The product window loads leaning back in perspective and stands up as
  // the visitor scrolls, rising a little as it goes.
  const { scrollY } = useScroll();
  const still = useReducedMotion();
  const windowTilt  = useTransform(scrollY, [0, 300], still ? [0, 0] : [10, 0]);
  const windowLift  = useTransform(scrollY, [0, 600], still ? [0, 0] : [0, -70]);

  if ((loading && maybeSignedIn) || user) {
    return (
      <div className="theme-locked min-h-[100dvh] bg-ninja-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-ninja-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      className="theme-locked min-h-[100dvh] bg-ninja-bg text-ninja-navy font-ninja"
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={() => { if (leaving) navigate(leaving, { state: { fromLanding: true } }); }}
    >
      {/* ── Hero: a full-bleed brand-blue block the product rises out of ── */}
      <div>
        <section className="relative rounded-b-3xl sm:rounded-b-[40px]">
          {/* Background layer clips to the rounded shape; content may overflow it */}
          <div className="absolute inset-x-0 top-0 bottom-56 sm:bottom-0 rounded-[inherit] overflow-hidden bg-ninja-blue">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 60% 55% at 50% 0%, rgba(255,255,255,0.14) 0%, transparent 65%), ' +
                  'radial-gradient(ellipse 45% 45% at 12% 85%, rgba(255,255,255,0.07) 0%, transparent 70%)',
              }}
            />
          </div>

          {/* Top bar */}
          <motion.header
            className="relative z-10 flex items-center justify-between px-5 sm:px-10 pt-5 sm:pt-7"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Logo variant="lockup" className="h-7 sm:h-9 text-white" accent="currentColor" />
            <div className="flex items-center gap-3 sm:gap-5">
              <button
                onClick={handleSignIn}
                className="font-ninja font-bold text-sm text-white/80 hover:text-white transition-colors"
              >
                Sign in
              </button>
              <button
                onClick={handleGetStarted}
                className="hidden sm:block bg-white text-ninja-blue font-ninja font-bold text-sm px-5 py-2 rounded-full hover:bg-blue-50 transition-colors"
              >
                Get Started
              </button>
            </div>
          </motion.header>

          {/* Centered copy */}
          <motion.div
            className="relative z-10 text-center max-w-3xl mx-auto px-5 sm:px-6 pt-12 sm:pt-16"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            <motion.h1
              variants={fadeUp}
              className="font-black tracking-tight text-white mb-5"
              style={{ fontSize: 'clamp(32px, 5.2vw, 58px)', lineHeight: 1.1 }}
            >
              TEACH. TRACK. REPORT.
              <span className="block">All from one app.</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="text-white/85 text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-8 sm:mb-10"
            >
              Link check-ins, student progress, and operations tracker all together.
            </motion.p>
            <motion.div variants={fadeUp} className="hidden sm:flex justify-center">
              <GetStarted onClick={handleGetStarted} />
            </motion.div>
          </motion.div>

          {/* Product window, rising out of the hero's bottom edge */}
          <motion.div
            className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mt-10 sm:mt-14 sm:-mb-36"
            style={{ perspective: 1200 }}
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              className="relative"
              style={{ rotateX: windowTilt, y: windowLift, transformStyle: 'preserve-3d' }}
            >
              <div className="sm:hidden"><PhoneMockup /></div>
              <div className="hidden sm:block"><DeskMockup /></div>
            </motion.div>
          </motion.div>

          <motion.div
            className="sm:hidden relative z-10 px-5 pt-9 flex justify-center"
            initial={still ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <GetStarted onClick={handleGetStarted} tone="solid" />
          </motion.div>
        </section>
      </div>

      {/* ── Features ── */}
      <motion.section
        className="max-w-5xl mx-auto px-5 sm:px-6 pt-32 sm:pt-52 pb-10 text-center"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
      >
        <motion.h2 variants={fadeUp} className="font-black tracking-tight text-3xl sm:text-4xl mb-3">
          Everything the dojo runs on
        </motion.h2>
        <motion.p variants={fadeUp} className="text-ninja-muted max-w-xl mx-auto leading-relaxed mb-10 sm:mb-12">
          Built for the day-to-day: fewer tabs at the front desk, clearer progress on the floor,
          and parents who never have to ask how it went.
        </motion.p>
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 text-left">
          {FEATURES.map(({ art: Art, title, blurb }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              className="bg-white border border-ninja-border rounded-2xl shadow-sm p-5 sm:p-6"
            >
              <div aria-hidden="true" className="select-none">
                <Art />
              </div>
              <h3 className="font-extrabold text-ninja-navy mt-4 mb-1.5">{title}</h3>
              <p className="text-sm text-ninja-muted leading-relaxed">{blurb}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="flex items-center justify-center flex-wrap gap-3 pb-8 px-6 text-xs text-ninja-muted">
        <Link to="/privacy" className="hover:text-ninja-blue transition-colors">Privacy Policy</Link>
        <span className="opacity-40">·</span>
        <Link to="/terms" className="hover:text-ninja-blue transition-colors">Terms</Link>
        <span className="opacity-40">·</span>
        <Link to="/accessibility" className="hover:text-ninja-blue transition-colors">Accessibility</Link>
        <span className="opacity-40">·</span>
        <span>&copy; 2026 DojoLink</span>
      </footer>
    </motion.div>
  );
}
