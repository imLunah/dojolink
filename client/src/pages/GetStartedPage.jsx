import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, IdCard, ChevronRight, ArrowRight } from 'lucide-react';
import { useParentAuth } from '../context/ParentAuthContext';
import { useLightOnly } from '../context/ThemeContext';
import Logo from '../components/ui/Logo';
import KeepSignedIn from '../components/auth/KeepSignedIn';
import { STAFF_HELP, PARENT_HELP } from '../components/auth/signInHelp';

// Get Started: one question per screen, so a first-time visitor never has to
// work out which half of the login form is theirs.
//
//   who  → I'm a parent          → code → email → signed in
//        → I work at a center    → staff → the login page
//
// A parent signs in right here, because the two answers they need are the
// whole credential and asking them twice is a chore. Staff are sent to the
// login page instead: a username and password need no explaining, only the
// news that a director makes the account.

const EASE = [0.22, 1, 0.36, 1];

// Steps slide the way the visitor is travelling: forward from the right, back
// from the left. Opaque at rest and short, so it reads as a page turning.
const slide = {
  enter: (dir) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.32, ease: EASE } },
  exit: (dir) => ({ opacity: 0, x: dir * -28, transition: { duration: 0.18, ease: 'easeIn' } }),
};

const INPUT =
  'w-full border border-ninja-border text-ninja-navy rounded-xl px-4 py-3 sm:py-3.5 font-ninja text-base ' +
  'focus:outline-none focus:border-ninja-blue focus:ring-2 focus:ring-ninja-blue/10 transition-all bg-white';

const PRIMARY =
  'w-full bg-ninja-blue text-white font-ninja font-bold text-lg py-4 rounded-2xl ' +
  'flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed';

function Heading({ children, sub }) {
  return (
    <div className="mb-6 sm:mb-8">
      <h1 className="text-ninja-navy font-ninja font-black text-3xl sm:text-4xl leading-tight mb-2 sm:mb-3">
        {children}
      </h1>
      {sub && <p className="text-ninja-muted font-ninja text-sm sm:text-base leading-relaxed">{sub}</p>}
    </div>
  );
}

function Choice({ icon: Icon, title, detail, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className="group w-full text-left bg-white border border-ninja-border rounded-2xl p-4 sm:p-5 flex items-center gap-4 transition-shadow shadow-sm hover:shadow-md"
    >
      <span className="w-12 h-12 rounded-xl bg-ninja-blue/10 text-ninja-blue group-hover:bg-ninja-blue group-hover:text-white transition-colors flex items-center justify-center flex-shrink-0">
        <Icon className="w-6 h-6" aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-ninja font-extrabold text-ninja-navy text-lg leading-snug">{title}</span>
        <span className="block font-ninja text-sm text-ninja-muted leading-snug mt-0.5">{detail}</span>
      </span>
      <ChevronRight
        className="w-5 h-5 text-ninja-muted group-hover:text-ninja-blue group-hover:translate-x-0.5 transition-all flex-shrink-0"
        aria-hidden="true"
      />
    </motion.button>
  );
}

// A quiet "I'm stuck" link that opens its answer in place, under the thing
// it is about, rather than sending anyone somewhere else to read it.
function Reveal({ label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="font-ninja font-bold text-sm text-ninja-blue hover:underline underline-offset-4"
      >
        {label}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl bg-white border border-ninja-border px-4 py-3.5 font-ninja text-sm text-ninja-navy leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const answer = (list, i) => list[i].a;

export default function GetStartedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromLanding = location.state?.fromLanding;
  const { login: parentLogin } = useParentAuth();
  useLightOnly();

  // The path is a stack, so Back always returns to the screen it came from.
  const [path, setPath] = useState(['who']);
  const [dir, setDir] = useState(1);
  const step = path[path.length - 1];
  const go = (next) => { setDir(1); setPath((p) => [...p, next]); };
  const back = () => {
    if (path.length === 1) { navigate('/'); return; }
    setDir(-1);
    setPath((p) => p.slice(0, -1));
  };

  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const me = await parentLogin(code.trim(), email.trim(), keepSignedIn);
      navigate(me?.onboarded === false ? '/parent/welcome' : '/parent/dashboard');
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  let body;
  if (step === 'who') {
    body = (
      <>
        <Heading sub="Tell us who you are and we'll walk you through signing in.">
          Let's get you started
        </Heading>
        <div className="space-y-3">
          <Choice
            icon={Users}
            title="I'm a parent"
            detail="Follow your ninja's belts, badges and progress"
            onClick={() => go('code')}
          />
          <Choice
            icon={IdCard}
            title="I work at a center"
            detail="Sensei or Center Director"
            onClick={() => go('staff')}
          />
        </div>
      </>
    );
  } else if (step === 'staff') {
    body = (
      <>
        <Heading sub="Your Center Director or administrator creates your DojoLink account and gives you a username and password.">
          Sign in with your staff account
        </Heading>
        <motion.button
          type="button"
          whileTap={{ scale: 0.985 }}
          onClick={() => navigate('/login')}
          className={PRIMARY}
          style={{ boxShadow: '0 6px 32px rgba(0,106,221,0.28)' }}
        >
          Go to sign in <ArrowRight className="w-5 h-5" aria-hidden="true" />
        </motion.button>
        <Reveal label="I don't know my login">
          {answer(STAFF_HELP, 0)}
        </Reveal>
      </>
    );
  } else if (step === 'code') {
    body = (
      <form onSubmit={(e) => { e.preventDefault(); if (code) go('email'); }}>
        <Heading sub="Enter the center code provided by the Center Director at your ninja's location.">
          What's your center code?
        </Heading>
        <label htmlFor="start-code" className="sr-only">Center code</label>
        <input
          id="start-code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={10}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
          placeholder="ABC123"
          autoFocus
          className={`${INPUT} font-semibold tracking-[0.2em] text-center text-xl sm:text-2xl py-4 sm:py-4`}
        />
        <motion.button
          type="submit"
          disabled={!code}
          whileTap={{ scale: 0.985 }}
          className={`${PRIMARY} mt-4`}
        >
          Continue <ArrowRight className="w-5 h-5" aria-hidden="true" />
        </motion.button>
        <Reveal label="I don't have a code">
          {answer(PARENT_HELP, 0)}
        </Reveal>
      </form>
    );
  } else {
    body = (
      <form onSubmit={signIn}>
        <Heading sub="Use the email address you gave the center when you signed your ninja up. It's the one they have on file.">
          Which email is on file?
        </Heading>
        <label htmlFor="start-email" className="sr-only">Email address</label>
        <input
          id="start-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          placeholder="you@email.com"
          required
          autoFocus
          className={INPUT}
        />
        <div className="mt-4">
          <KeepSignedIn checked={keepSignedIn} onChange={setKeepSignedIn} />
        </div>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div role="alert" className="mt-4 bg-red-50 text-ninja-red rounded-xl px-4 py-3 font-ninja text-sm">
                {error}{' '}
                <button type="button" onClick={back} className="font-bold underline underline-offset-2">
                  Check the code ({code})
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          type="submit"
          disabled={loading || !email}
          whileTap={{ scale: 0.985 }}
          className={`${PRIMARY} mt-4`}
          style={{ boxShadow: '0 6px 32px rgba(0,106,221,0.28)' }}
        >
          {loading ? (
            <>
              <motion.span
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
              />
              Signing in…
            </>
          ) : (
            <>Go to Parent Portal <ArrowRight className="w-5 h-5" aria-hidden="true" /></>
          )}
        </motion.button>
        <Reveal label="Not sure which email?">
          {answer(PARENT_HELP, 1)}
        </Reveal>
      </form>
    );
  }

  return (
    <div className="theme-locked min-h-[100dvh] bg-ninja-bg flex flex-col items-center justify-start sm:justify-center px-5 sm:px-6 py-8 sm:py-12 overflow-x-hidden">
      {fromLanding && (
        <motion.div
          className="fixed inset-0 z-50 pointer-events-none"
          style={{ background: 'rgb(var(--ninja-bg))' }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        />
      )}
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1.5 text-ninja-muted hover:text-ninja-blue transition-colors font-ninja text-sm font-semibold"
          >
            ← Back
          </button>
          <Link
            to="/login"
            className="text-ninja-muted hover:text-ninja-blue transition-colors font-ninja text-sm font-semibold"
          >
            Sign in
          </Link>
        </div>

        <div className="mb-6 sm:mb-10">
          <Logo variant="lockup" className="h-9 sm:h-12 text-ninja-navy" />
        </div>

        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
