import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { PRESET_AVATARS } from '../lib/avatars';
import StaffBadge from '../components/shared/StaffBadge';

// First-run onboarding for a brand-new account (must_reset_password = true).
// Flow: Welcome → confirm name → pick avatar → set username + password → hand off.

const STEPS = ['welcome', 'name', 'avatar', 'credentials'];

const slide = {
  enter: (dir) => ({ x: dir > 0 ? 64 : -64, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -64 : 64, opacity: 0 }),
};
const transition = { x: { type: 'spring', stiffness: 360, damping: 34 }, opacity: { duration: 0.2 } };

function splitName(full = '') {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
}

function PasswordRule({ ok, children }) {
  return (
    <li className="flex items-center gap-2 font-ninja text-xs">
      <motion.span
        initial={false}
        animate={{ scale: ok ? 1 : 0.9 }}
        className={`flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${ok ? 'bg-emerald-500 text-white' : 'bg-ninja-red/15 text-ninja-red'}`}
      >
        {ok ? '✓' : '✕'}
      </motion.span>
      <span className={ok ? 'text-ninja-navy' : 'text-ninja-muted'}>{children}</span>
    </li>
  );
}

export default function WelcomePage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const initial = splitName(user?.displayName);
  const [editingName, setEditingName] = useState(false);
  const [first, setFirst] = useState(initial.first);
  const [last, setLast] = useState(initial.last);
  const [confirmedName, setConfirmedName] = useState('');

  const [avatar, setAvatar] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fullName = `${first.trim()} ${last.trim()}`.trim();
  const firstName = first.trim() || 'there';

  // What the badge prints. It follows the form live: the name as it is typed,
  // the avatar as it is picked, and on the credentials step the card turns
  // over to print the username on the back.
  const roleLabel = user?.role === 'manager' ? 'Director' : user?.role === 'admin' ? 'Admin' : 'Sensei';
  const badge = (
    <StaffBadge
      name={fullName}
      username={username}
      avatar={avatar}
      role={roleLabel}
      center={user?.activeLocation?.name}
      side={step === 3 ? 'back' : 'front'}
    />
  );

  const pwChecks = useMemo(() => ({
    len: password.length >= 6,
    upper: /[A-Z]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    match: password.length > 0 && password === confirm,
  }), [password, confirm]);
  const pwValid = pwChecks.len && pwChecks.upper && pwChecks.special && pwChecks.match;

  const go = (delta) => { setError(''); setDir(delta); setStep((s) => Math.min(Math.max(s + delta, 0), STEPS.length - 1)); };

  const confirmName = () => {
    if (!fullName) { setError('Please enter your name.'); return; }
    setConfirmedName(fullName);
    setEditingName(false);
    go(1);
  };

  const finish = async () => {
    setError('');
    if (!username.trim()) return setError('Choose a username.');
    if (!pwValid) return setError('Please meet all password requirements.');

    setSaving(true);
    try {
      const payload = { username: username.trim(), new_password: password.trim() };
      if (confirmedName && confirmedName !== user?.displayName) payload.display_name = confirmedName;
      const res = await api.patch('/users/me', payload);
      // Avatar is a nice-to-have — never fail setup over it.
      if (avatar) await api.patch('/users/me/avatar', { profile_pic_url: avatar }).catch(() => {});
      setUser((prev) => ({
        ...prev,
        username: res.username || prev.username,
        displayName: payload.display_name || prev.displayName,
        profilePicUrl: avatar || prev.profilePicUrl,
        mustResetPassword: false,
      }));
      const dashPath = user?.role === 'sensei' ? '/sensei/dashboard'
        : user?.role === 'admin' ? '/admin/locations'
        : '/manager/overview';
      navigate(dashPath, { replace: true });
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] bg-ninja-bg flex flex-col lg:items-center lg:justify-center overflow-hidden">
      {/* Scenic background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/onboarding-bg.webp)' }}
      />
      {/* Dark scrim so dark-theme text stays legible over the bright scene */}
      <div className="absolute inset-0 bg-gradient-to-b from-ninja-bg/70 via-ninja-bg/85 to-ninja-bg lg:from-ninja-bg/60 lg:via-ninja-bg/70 lg:to-ninja-bg/85" />

      <div className="relative flex-1 lg:flex-none flex flex-col max-w-md lg:max-w-4xl w-full mx-auto px-6 pt-[max(env(safe-area-inset-top),28px)] pb-[max(env(safe-area-inset-bottom),28px)] lg:my-10 lg:px-10 lg:py-10 lg:rounded-3xl lg:border lg:border-ninja-border lg:bg-ninja-bg/75 lg:backdrop-blur-xl lg:shadow-2xl lg:grid lg:grid-cols-[380px,minmax(0,1fr)] lg:gap-10 lg:items-center">
        {/* The badge. Desktop keeps it beside every step; on the phone a
            smaller one sits above the form once there is something to print. */}
        <div className="hidden lg:flex items-center justify-center">
          {badge}
        </div>

        <div className="flex flex-col flex-1 min-h-0 lg:flex-none">
        {/* Progress */}
        <div className="flex items-center gap-1.5 py-2">
          {STEPS.map((stepName, i) => (
            <motion.span
              key={stepName}
              className="h-1.5 rounded-full bg-ninja-blue"
              animate={{ width: i === step ? 26 : 8, opacity: i <= step ? 1 : 0.25 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          ))}
        </div>

        {/* Phone: the badge appears where there is room for it. The name-edit
            and credentials forms bring the keyboard up under a fixed-height
            shell, and a card plus a keyboard plus three inputs does not fit —
            desktop keeps the badge through every step, including the flip. */}
        {step > 0 && step < 3 && !editingName && (
          <div className="lg:hidden flex justify-center">
            <StaffBadge
              name={fullName}
              username={username}
              avatar={avatar}
              role={roleLabel}
              center={user?.activeLocation?.name}
              side={step === 3 ? 'back' : 'front'}
              scale={0.42}
            />
          </div>
        )}

        <div className="flex-1 min-h-0 lg:flex-none lg:h-[460px] relative overflow-hidden">
          <AnimatePresence mode="popLayout" custom={dir} initial={false}>
            {/* ── Step 1: Welcome ───────────────────────────── */}
            {step === 0 && (
              <motion.div
                key="welcome" custom={dir} variants={slide}
                initial="enter" animate="center" exit="exit" transition={transition}
                className="absolute inset-0 flex flex-col items-center justify-center text-center"
              >
                <motion.img
                  src="/CodeNinjasCelebrate.webp" alt=""
                  initial={{ scale: 0.6, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}
                  className="h-36 mb-8 drop-shadow-xl"
                />
                <motion.p
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                  className="text-ninja-blue font-ninja font-bold text-sm tracking-wide uppercase mb-2"
                >
                  Welcome to
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
                  className="text-4xl font-black font-ninja text-ninja-navy mb-3"
                >
                  Dojo<span className="text-ninja-blue">Link</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
                  className="text-ninja-muted font-ninja text-sm leading-relaxed max-w-xs"
                >
                  Let's get your account set up. It only takes a minute.
                </motion.p>
              </motion.div>
            )}

            {/* ── Step 2: Confirm name ──────────────────────── */}
            {step === 1 && (
              <motion.div
                key="name" custom={dir} variants={slide}
                initial="enter" animate="center" exit="exit" transition={transition}
                className="absolute inset-0 flex flex-col justify-center"
              >
                {!editingName ? (
                  <>
                    <h2 className="text-2xl font-black font-ninja text-ninja-navy mb-1.5">Is this your name?</h2>
                    <p className="text-ninja-muted font-ninja text-sm mb-7">Your center director set this up. Make sure it looks right.</p>

                    <div className="rounded-2xl border border-ninja-border bg-white/[0.03] px-6 py-7 mb-7 text-center">
                      <p className="text-2xl font-bold font-ninja text-ninja-navy break-words">{fullName || '—'}</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <motion.button
                        whileTap={{ scale: 0.98 }} onClick={confirmName}
                        className="w-full py-3.5 rounded-xl bg-ninja-blue text-white font-ninja font-bold text-sm hover:bg-ninja-blue/90 transition-colors"
                      >
                        Yes, that's me
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.98 }} onClick={() => { setError(''); setEditingName(true); }}
                        className="w-full py-3.5 rounded-xl bg-white/[0.04] border border-ninja-border text-ninja-navy font-ninja font-semibold text-sm hover:border-ninja-blue/60 transition-colors"
                      >
                        No, let me fix it
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-black font-ninja text-ninja-navy mb-1.5">What's your name?</h2>
                    <p className="text-ninja-muted font-ninja text-sm mb-7">Enter your first and last name.</p>

                    <div className="space-y-4 mb-7">
                      <div>
                        <label className="block text-ninja-muted font-ninja text-xs font-semibold mb-1.5">First name</label>
                        <input
                          value={first} onChange={(e) => setFirst(e.target.value)} autoFocus
                          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-ninja-border text-ninja-navy font-ninja text-sm focus:border-ninja-blue focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-ninja-muted font-ninja text-xs font-semibold mb-1.5">Last name</label>
                        <input
                          value={last} onChange={(e) => setLast(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-ninja-border text-ninja-navy font-ninja text-sm focus:border-ninja-blue focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <motion.button
                        whileTap={{ scale: 0.98 }} onClick={confirmName}
                        className="w-full py-3.5 rounded-xl bg-ninja-blue text-white font-ninja font-bold text-sm hover:bg-ninja-blue/90 transition-colors"
                      >
                        Save & continue
                      </motion.button>
                      <button
                        onClick={() => { setError(''); const n = splitName(confirmedName || user?.displayName); setFirst(n.first); setLast(n.last); setEditingName(false); }}
                        className="w-full py-2 text-ninja-muted hover:text-ninja-navy font-ninja text-sm font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ── Step 3: Pick avatar ───────────────────────── */}
            {step === 2 && (
              <motion.div
                key="avatar" custom={dir} variants={slide}
                initial="enter" animate="center" exit="exit" transition={transition}
                className="absolute inset-0 flex flex-col justify-center"
              >
                <h2 className="text-2xl font-black font-ninja text-ninja-navy mb-1.5">Pick your avatar</h2>
                <p className="text-ninja-muted font-ninja text-sm mb-7">Choose how you'll show up around the dojo. You can change it anytime from your account.</p>

                <div className="grid grid-cols-5 gap-3 justify-items-center">
                  {PRESET_AVATARS.map(({ src, label }) => {
                    const isActive = avatar === src;
                    return (
                      <motion.button
                        key={src}
                        type="button"
                        whileTap={{ scale: 0.92 }}
                        onClick={() => setAvatar(isActive ? '' : src)}
                        className={`relative w-14 h-14 rounded-full overflow-hidden border-2 transition-all hover:scale-105 ${
                          isActive ? 'border-ninja-blue ring-2 ring-ninja-blue/30' : 'border-ninja-border hover:border-ninja-blue'
                        }`}
                        title={label}
                      >
                        <img src={src} alt={label} className="w-full h-full object-cover bg-ninja-bg" />
                        {isActive && (
                          <div className="absolute inset-0 bg-ninja-blue/20 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">✓</span>
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── Step 4: Credentials ───────────────────────── */}
            {step === 3 && (
              <motion.div
                key="credentials" custom={dir} variants={slide}
                initial="enter" animate="center" exit="exit" transition={transition}
                className="absolute inset-0 flex flex-col justify-center"
              >
                <h2 className="text-2xl font-black font-ninja text-ninja-navy mb-1.5">Nice to meet you, {firstName}.</h2>
                <p className="text-ninja-muted font-ninja text-sm mb-6">Set a username and password to secure your account.</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-ninja-muted font-ninja text-xs font-semibold mb-1.5">Username</label>
                    <input
                      value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-ninja-border text-ninja-navy font-ninja text-sm focus:border-ninja-blue focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-ninja-muted font-ninja text-xs font-semibold mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
                        className="w-full px-4 py-3 pr-16 rounded-xl bg-white/[0.04] border border-ninja-border text-ninja-navy font-ninja text-sm focus:border-ninja-blue focus:outline-none transition-colors"
                      />
                      <button type="button" onClick={() => setShowPw((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ninja-muted hover:text-ninja-navy font-ninja text-xs font-semibold">
                        {showPw ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-ninja-muted font-ninja text-xs font-semibold mb-1.5">Confirm password</label>
                    <input
                      type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-ninja-border text-ninja-navy font-ninja text-sm focus:border-ninja-blue focus:outline-none transition-colors"
                    />
                  </div>

                  <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
                    <PasswordRule ok={pwChecks.len}>At least 6 characters</PasswordRule>
                    <PasswordRule ok={pwChecks.upper}>One uppercase letter</PasswordRule>
                    <PasswordRule ok={pwChecks.special}>One special character</PasswordRule>
                    <PasswordRule ok={pwChecks.match}>Passwords match</PasswordRule>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="text-ninja-red font-ninja text-sm text-center pt-3"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Footer nav */}
        <div className="flex items-center gap-3 pt-5">
          {step > 0 && !editingName ? (
            <motion.button
              whileTap={{ scale: 0.96 }} onClick={() => go(-1)}
              className="px-5 py-3 rounded-xl bg-white/[0.04] border border-ninja-border text-ninja-navy font-ninja font-semibold text-sm hover:border-ninja-blue/60 transition-colors"
            >
              Back
            </motion.button>
          ) : <div className="w-px" />}

          {step === 0 && (
            <motion.button
              whileTap={{ scale: 0.97 }} onClick={() => go(1)}
              className="flex-1 py-3.5 rounded-xl bg-ninja-blue text-white font-ninja font-bold text-sm hover:bg-ninja-blue/90 transition-colors"
            >
              Let's go
            </motion.button>
          )}
          {step === 2 && (
            <motion.button
              whileTap={{ scale: 0.97 }} onClick={() => go(1)}
              className="flex-1 py-3.5 rounded-xl bg-ninja-blue text-white font-ninja font-bold text-sm hover:bg-ninja-blue/90 transition-colors"
            >
              {avatar ? 'Continue' : 'Skip for now'}
            </motion.button>
          )}
          {step === 3 && (
            <motion.button
              whileTap={{ scale: 0.97 }} onClick={finish} disabled={saving || !pwValid || !username.trim()}
              className="flex-1 py-3.5 rounded-xl bg-ninja-blue text-white font-ninja font-bold text-sm hover:bg-ninja-blue/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Setting up…' : 'Finish setup'}
            </motion.button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
