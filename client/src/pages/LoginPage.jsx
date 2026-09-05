import { useState } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getHomePath } from '../lib/navTabs';
import { EyeIcon as LucideEye, EyeOffIcon as LucideEyeOff } from 'lucide-react';
import { useParentAuth } from '../context/ParentAuthContext';
import ThemeToggle from '../components/ui/ThemeToggle';
import Logo from '../components/ui/Logo';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y:  0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

function EyeIcon({ open }) {
  const Glyph = open ? LucideEye : LucideEyeOff;
  return <Glyph className="w-5 h-5" />;
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'parent' ? 'parent' : 'staff');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentCode, setParentCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { login: parentLogin } = useParentAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromLanding = location.state?.fromLanding;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'parent') {
        const me = await parentLogin(parentCode.trim(), parentEmail.trim(), keepSignedIn);
        navigate(me?.onboarded === false ? '/parent/welcome' : '/parent/dashboard');
      } else {
        const user = await login(username, password, keepSignedIn);
        navigate(getHomePath(user));
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="theme-locked min-h-[100dvh] bg-ninja-bg flex flex-col items-center justify-start sm:justify-center px-5 sm:px-6 py-8 sm:py-12">
      {fromLanding && (
        <motion.div
          className="fixed inset-0 z-50 pointer-events-none"
          style={{ background: '#1c2132' }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        />
      )}
      <div className="fixed top-3 right-4 z-30"><ThemeToggle /></div>


      <motion.div
        className="w-full max-w-lg"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Back to landing */}
        <motion.div variants={fadeUp} className="mb-5 sm:mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-ninja-muted hover:text-ninja-blue transition-colors font-ninja text-sm font-semibold"
          >
            ← Back
          </Link>
        </motion.div>

        {/* DojoLink logo — big and prominent */}
        <motion.div variants={fadeUp} className="mb-5 sm:mb-8">
          <Logo variant="lockup" className="h-9 sm:h-12 text-ninja-navy" />
        </motion.div>

        {/* Hero copy */}
        <motion.h1 variants={fadeUp} className="text-ninja-navy font-ninja font-black text-3xl sm:text-4xl lg:text-5xl leading-tight mb-2 sm:mb-3">
          Welcome Back
        </motion.h1>
        <AnimatePresence mode="wait">
          {tab === 'parent' && (
            <motion.p
              key="parent-sub"
              variants={fadeUp}
              initial="hidden" animate="show" exit="hidden"
              className="text-ninja-muted font-ninja text-sm sm:text-base leading-relaxed mb-5 sm:mb-8"
            >
              Enter the email address linked to your child's account.
            </motion.p>
          )}
          {tab === 'staff' && (
            <motion.div key="staff-spacer" className="mb-5 sm:mb-8" />
          )}
        </AnimatePresence>

        {/* Tab switcher */}
        <motion.div variants={fadeUp} className="relative flex bg-ninja-bg border border-ninja-border rounded-2xl p-1 mb-4 sm:mb-6">
          <motion.div
            className="absolute top-1 bottom-1 bg-white rounded-xl shadow-sm"
            layout
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            style={{ width: 'calc(50% - 4px)', left: tab === 'staff' ? 4 : 'calc(50%)' }}
          />
          {[{ id: 'staff', label: 'Sensei / Center Director' }, { id: 'parent', label: 'Parent' }].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(''); }}
              className={`relative z-10 flex-1 py-2.5 font-ninja font-bold text-sm rounded-xl transition-colors duration-200 ${
                tab === t.id ? 'text-ninja-navy' : 'text-ninja-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </motion.div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          <AnimatePresence mode="wait">
            {tab === 'staff' ? (
              <motion.div
                key="staff-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{    opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="space-y-4"
              >
                {/* Username */}
                <div>
                  <label htmlFor="login-username" className="block text-ninja-navy font-ninja font-bold text-xs uppercase tracking-widest mb-2">
                    Username
                  </label>
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. sensei_alex"
                    required
                    autoFocus
                    className="w-full border border-ninja-border text-ninja-navy rounded-xl px-4 py-3 sm:py-3.5 font-ninja text-base focus:outline-none focus:border-ninja-blue focus:ring-2 focus:ring-ninja-blue/10 transition-all bg-white"
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="login-password" className="block text-ninja-navy font-ninja font-bold text-xs uppercase tracking-widest mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      required
                      className="w-full border border-ninja-border text-ninja-navy rounded-xl px-4 py-3 sm:py-3.5 pr-12 font-ninja text-base focus:outline-none focus:border-ninja-blue focus:ring-2 focus:ring-ninja-blue/10 transition-all bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-ninja-muted hover:text-ninja-navy transition-colors"
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>

              </motion.div>
            ) : (
              <motion.div
                key="parent-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{    opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {/* The code first, because it says which center this is, and
                    the email only means anything inside one. Uppercased as it
                    is typed: it gets read aloud and copied off a flyer, and
                    nobody should have to wonder whether case matters. */}
                <label htmlFor="parent-code" className="block text-ninja-navy font-ninja font-bold text-xs uppercase tracking-widest mb-2">
                  Center Code
                </label>
                <input
                  id="parent-code"
                  name="centerCode"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={10}
                  value={parentCode}
                  onChange={(e) => setParentCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                  placeholder="ABC123"
                  required
                  autoFocus
                  className="w-full border border-ninja-border text-ninja-navy rounded-xl px-4 py-3 sm:py-3.5 font-ninja font-semibold tracking-[0.2em] text-base focus:outline-none focus:border-ninja-blue focus:ring-2 focus:ring-ninja-blue/10 transition-all bg-white"
                />

                <label htmlFor="parent-email" className="block text-ninja-navy font-ninja font-bold text-xs uppercase tracking-widest mt-4 mb-2">
                  Email Address
                </label>
                <input
                  id="parent-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  className="w-full border border-ninja-border text-ninja-navy rounded-xl px-4 py-3 sm:py-3.5 font-ninja text-base focus:outline-none focus:border-ninja-blue focus:ring-2 focus:ring-ninja-blue/10 transition-all bg-white"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Keep me signed in. Outside the tabs: a parent on the family iPad
              has the same reason to want it as a sensei on the front desk, and
              the control is the same control. */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex-shrink-0">
              <input
                id="keep-signed-in"
                name="keepSignedIn"
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="sr-only"
              />
              <motion.div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                  keepSignedIn ? 'bg-ninja-blue border-ninja-blue' : 'border-ninja-border bg-white'
                }`}
                whileTap={{ scale: 0.85 }}
              >
                <AnimatePresence>
                  {keepSignedIn && (
                    <motion.svg
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{   scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', damping: 16, stiffness: 400 }}
                      className="w-3 h-3 text-white"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                    </motion.svg>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
            <span className="font-ninja text-sm text-ninja-navy group-hover:text-ninja-blue transition-colors">
              Keep me signed in on this device
            </span>
          </label>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{    opacity: 0, height: 0 }}
                className="bg-red-50 border border-red-200 text-ninja-red rounded-xl px-4 py-3 font-ninja text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA */}
          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.985 }}
            className="relative w-full bg-ninja-blue text-white font-ninja font-bold text-lg py-4 rounded-2xl overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 6px 32px rgba(0,106,221,0.28)' }}
          >
            <motion.span
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              initial={{ x: '-100%' }}
              whileHover={{ x: '100%' }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
            <span className="relative flex items-center justify-center gap-2">
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
                <>
                  {tab === 'parent' ? 'Go to Parent Portal' : 'Enter the dojo'} →
                </>
              )}
            </span>
          </motion.button>
        </form>
      </motion.div>
      <p className="text-center mt-6 text-ninja-muted font-ninja text-xs flex items-center justify-center gap-2">
        <Link to="/privacy" className="hover:text-ninja-blue transition-colors">Privacy Policy</Link>
        <span>·</span>
        <Link to="/terms" className="hover:text-ninja-blue transition-colors">Terms and Conditions</Link>
        <span>·</span>
        <Link to="/accessibility" className="hover:text-ninja-blue transition-colors">Accessibility</Link>
      </p>
    </div>
  );
}
