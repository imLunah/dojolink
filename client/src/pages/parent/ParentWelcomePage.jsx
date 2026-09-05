import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useParentAuth } from '../../context/ParentAuthContext';
import { useParentPortal } from '../../context/ParentPortalContext';
import { useLightOnly } from '../../context/ThemeContext';
import { calcAge } from '../../lib/parentProgress';
import FamilyPass from '../../components/shared/FamilyPass';
import Logo from '../../components/ui/Logo';

// A parent's first sign-in. The same shape as the staff welcome: a short
// walk, with the family's pass beside it printing what they type. Name, then
// relationship, then the pass; it stays face up, and a tap or a drag turns it
// over to the ninjas it belongs to. Saving writes the parent_profiles row; having one is what
// lets ParentRoute through to the rest of the portal.
//
// Light only, like the rest of the parent portal.

const STEPS = ['welcome', 'name', 'details', 'done'];
const RELATIONSHIPS = ['Mom', 'Dad', 'Guardian', 'Grandparent', 'Other'];

const slide = {
  enter: (dir) => ({ x: dir > 0 ? 64 : -64, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -64 : 64, opacity: 0 }),
};
const transition = { x: { type: 'spring', stiffness: 360, damping: 34 }, opacity: { duration: 0.2 } };

function splitName(full = '') {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
}

// "Ava", "Ava & Max", "Ava, Max & Zoe".
function listNames(names) {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

const INPUT = 'w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-ninja-border text-ninja-navy font-ninja text-sm focus:border-ninja-blue focus:outline-none transition-colors';
const PRIMARY = 'flex-1 py-3.5 rounded-xl bg-ninja-blue text-white font-ninja font-bold text-sm hover:bg-ninja-blue/90 transition-colors disabled:opacity-50';

export default function ParentWelcomePage() {
  useLightOnly();
  const { parent, saveProfile } = useParentAuth();
  const portal = useParentPortal();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const onFile = splitName(parent?.prefill?.name || '');
  const [first, setFirst] = useState(onFile.first);
  const [last, setLast] = useState(onFile.last);
  const [relationship, setRelationship] = useState('');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Starts false, and there is no path that starts it true. A pre-ticked box
  // is not an agreement, it is a default somebody failed to notice.
  const [agreed, setAgreed] = useState(false);

  const fullName = `${first.trim()} ${last.trim()}`.trim();
  const firstName = first.trim() || 'there';
  const kids = (portal?.students || []).map((s) => s.full_name.split(' ')[0]);

  // The pass prints the form live: the parent's name as it is typed,
  // the ninjas with their ages on the back (the swatch and the front's
  // stripe are their belt colour), and under them the parent as they fill
  // themselves in. A ninja's belt is their CREATE belt when they have one,
  // else whatever program lists one first.
  const ninjas = (portal?.students || []).map((s) => {
    const programs = s.programs || [];
    const withBelt = programs.find((p) => p.program === 'CREATE' && p.belt_level) || programs.find((p) => p.belt_level);
    return { name: s.full_name, age: calcAge(s.birthday), belt: withBelt?.belt_level || null };
  });
  const passProps = {
    parentName: fullName,
    relationship,
    phone: parent?.phone || '',
    center: parent?.centerName,
    centerCode: parent?.centerCode,
    ninjas,
    side: 'front',
  };

  const go = (delta) => { setError(''); setDir(delta); setStep((s) => Math.min(Math.max(s + delta, 0), STEPS.length - 1)); };

  const confirmName = () => {
    if (!first.trim() || !last.trim()) { setError('Please enter your first and last name.'); return; }
    go(1);
  };

  const finish = async () => {
    if (!agreed) { setError('Please agree to the Terms and Privacy Policy to continue.'); return; }
    setError('');
    setSaving(true);
    try {
      // The server decides WHAT was agreed to and stamps the date; this only
      // reports that the box was ticked. It refuses a first save without it,
      // so the disabled button is a courtesy rather than the control.
      await saveProfile({
        first_name: first.trim(),
        last_name: last.trim(),
        relationship: relationship || null,
        accepted_terms: true,
      });
      navigate('/parent/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] bg-ninja-bg flex flex-col lg:items-center lg:justify-center overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/onboarding-bg.webp)' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-ninja-bg/70 via-ninja-bg/85 to-ninja-bg lg:from-ninja-bg/60 lg:via-ninja-bg/70 lg:to-ninja-bg/85" />

      {/* Phone: the steps hug their content and sit as one group in the
          middle of the screen, the button right under them — a step area
          that fills the screen leaves a field of nothing between the words
          and the button. Desktop keeps the two-column shell. */}
      <div className="relative flex-1 lg:flex-none flex flex-col justify-center max-w-md lg:max-w-4xl w-full mx-auto px-6 pt-[max(env(safe-area-inset-top),28px)] pb-[max(env(safe-area-inset-bottom),28px)] lg:my-10 lg:px-10 lg:py-10 lg:rounded-3xl lg:border lg:border-ninja-border lg:bg-ninja-bg/75 lg:backdrop-blur-xl lg:shadow-2xl lg:grid lg:grid-cols-[440px,minmax(0,1fr)] lg:gap-10 lg:items-center">
        {/* Desktop keeps the pass beside every step, including the flip. */}
        <div className="hidden lg:flex items-center justify-center">
          <FamilyPass {...passProps} scale={0.9} />
        </div>

        <div className="flex flex-col lg:flex-none">
          {/* Phone: the pass shows once the form is done with the keyboard.
              The name and details steps bring it up, and a card plus a
              keyboard plus inputs does not fit a fixed-height shell. */}
          {step === 3 && (
            <div className="lg:hidden flex justify-center">
              <FamilyPass {...passProps} scale={0.7} />
            </div>
          )}

          <div className={`relative overflow-hidden lg:h-[460px] ${step === 3 ? 'h-[min(400px,52dvh)]' : 'h-[min(440px,60dvh)]'}`}>
            <AnimatePresence mode="popLayout" custom={dir} initial={false}>
              {step === 0 && (
                <motion.div
                  key="welcome" custom={dir} variants={slide}
                  initial="enter" animate="center" exit="exit" transition={transition}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center"
                >
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}
                    className="mb-8"
                  >
                    <Logo variant="mark" className="h-28 text-ninja-navy" />
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                    className="text-ninja-blue font-ninja font-bold text-sm tracking-wide uppercase mb-2"
                  >
                    Welcome to
                  </motion.p>
                  <motion.h1
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
                    className="mb-3"
                  >
                    <Logo variant="wordmark" className="h-10 text-ninja-navy" />
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
                    className="text-ninja-muted font-ninja text-sm leading-relaxed max-w-xs"
                  >
                    {parent?.centerName ? `Code Ninjas ${parent.centerName}` : 'Your center'} has set up a parent account for you. Let's make it yours. It only takes a minute.
                  </motion.p>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="name" custom={dir} variants={slide}
                  initial="enter" animate="center" exit="exit" transition={transition}
                  className="absolute inset-0 flex flex-col justify-center"
                >
                  <h2 className="text-2xl font-black font-ninja text-ninja-navy mb-1.5">What's your name?</h2>
                  <p className="text-ninja-muted font-ninja text-sm mb-7">
                    {onFile.first ? 'The front desk wrote this down. Make sure it looks right.' : 'So the senseis know who they are talking to.'}
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="pw-first" className="block text-ninja-muted font-ninja text-xs font-semibold mb-1.5">First name</label>
                      <input id="pw-first" value={first} onChange={(e) => setFirst(e.target.value)} autoFocus autoComplete="given-name" className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="pw-last" className="block text-ninja-muted font-ninja text-xs font-semibold mb-1.5">Last name</label>
                      <input id="pw-last" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" className={INPUT} onKeyDown={(e) => { if (e.key === 'Enter') confirmName(); }} />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="details" custom={dir} variants={slide}
                  initial="enter" animate="center" exit="exit" transition={transition}
                  className="absolute inset-0 flex flex-col justify-center"
                >
                  <h2 className="text-2xl font-black font-ninja text-ninja-navy mb-1.5">Nice to meet you, {firstName}.</h2>
                  <p className="text-ninja-muted font-ninja text-sm mb-7">One more thing for the front desk, if you'd like.</p>
                  <div className="space-y-5">
                    <div>
                      <p className="block text-ninja-muted font-ninja text-xs font-semibold mb-1.5">I'm {kids.length === 1 && kids[0] ? `${kids[0]}'s` : 'their'}</p>
                      <div className="flex flex-wrap gap-2" role="group" aria-label="Relationship">
                        {RELATIONSHIPS.map((r) => {
                          const on = relationship === r;
                          return (
                            <button
                              key={r}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setRelationship(on ? '' : r)}
                              className={`px-4 py-2 rounded-full font-ninja font-bold text-sm border transition-colors ${
                                on ? 'bg-ninja-blue border-ninja-blue text-white' : 'border-ninja-border text-ninja-navy hover:border-ninja-blue/60'
                              }`}
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="done" custom={dir} variants={slide}
                  initial="enter" animate="center" exit="exit" transition={transition}
                  className="absolute inset-0 flex flex-col justify-center"
                >
                  <h2 className="text-2xl font-black font-ninja text-ninja-navy mb-1.5">You're all set, {firstName}.</h2>
                  <p className="text-ninja-muted font-ninja text-sm mb-6">
                    Here's your family pass. Inside you'll find {kids.length === 1 && kids[0] ? `${kids[0]}'s` : 'your ninjas\''} belts, classes and progress, and how busy the dojo is right now.
                  </p>
                  <dl className="rounded-2xl border border-ninja-border bg-white/[0.03] px-5 py-4 grid grid-cols-[auto,1fr] gap-x-5 gap-y-2 font-ninja text-sm">
                    <dt className="text-ninja-muted">Name</dt><dd className="text-ninja-navy font-bold">{fullName}</dd>
                    <dt className="text-ninja-muted">Relationship</dt><dd className="text-ninja-navy font-bold">{relationship || <span className="text-ninja-muted font-normal">Not given</span>}</dd>
                  </dl>

                  {/* THE AGREEMENT, on the last step and directly above the
                      button that acts on it. Not its own step: a step you
                      cannot leave without ticking a box is a dialog wearing a
                      step's clothes, and it would put the one legal moment in
                      the flow somewhere a parent has already stopped reading.
                      Here it is the last thing under the summary of what they
                      just filled in, next to the button that commits it.

                      The links open in a new tab on purpose. A parent who
                      wants to read the Terms should not lose the name they
                      just typed to do it — this form holds its state in
                      component state, and navigating away drops it. */}
                  <label className="flex items-start gap-3 mt-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => { setAgreed(e.target.checked); setError(''); }}
                      className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 rounded border-ninja-border text-ninja-blue focus:ring-ninja-blue cursor-pointer"
                    />
                    <span className="font-ninja text-[13px] leading-relaxed text-ninja-muted">
                      I agree to the{' '}
                      <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-ninja-blue font-bold hover:underline">Terms and Conditions</Link>
                      {' '}and the{' '}
                      <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-ninja-blue font-bold hover:underline">Privacy Policy</Link>.
                    </span>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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

          <div className="flex items-center gap-3 pt-5">
            {step > 0 ? (
              <motion.button
                whileTap={{ scale: 0.96 }} onClick={() => go(-1)} disabled={saving}
                className="px-5 py-3 rounded-xl bg-white/[0.04] border border-ninja-border text-ninja-navy font-ninja font-semibold text-sm hover:border-ninja-blue/60 transition-colors"
              >
                Back
              </motion.button>
            ) : <div className="w-px" />}

            {step === 0 && <motion.button whileTap={{ scale: 0.97 }} onClick={() => go(1)} className={PRIMARY}>Let's go</motion.button>}
            {step === 1 && <motion.button whileTap={{ scale: 0.97 }} onClick={confirmName} className={PRIMARY}>Continue</motion.button>}
            {step === 2 && <motion.button whileTap={{ scale: 0.97 }} onClick={() => go(1)} className={PRIMARY}>{relationship ? 'Continue' : 'Skip for now'}</motion.button>}
            {step === 3 && (
              <motion.button whileTap={{ scale: 0.97 }} onClick={finish} disabled={saving || !agreed} className={PRIMARY}>
                {saving ? 'Saving…' : 'Go to my portal'}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
