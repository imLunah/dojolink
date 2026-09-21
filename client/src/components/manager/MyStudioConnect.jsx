import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CircleCheckIcon,
  TriangleAlertIcon,
  Trash2Icon,
  Loader2Icon,
} from 'lucide-react';
import Modal from '../ui/Modal';
import FloatingPanel from '../ui/FloatingPanel';
import Button from '../ui/Button';
import { api } from '../../api/client';
import useIsDesktop from '../../lib/useIsDesktop';
import { formatExpiry, hoursUntil } from '../../lib/useExpectedToday';
import useMyStudioSignIn, { CODE_LENGTH } from '../../lib/useMyStudioSignIn';

// Connecting a center to the studio management system it already uses.
//
// This used to ask only for a cookie copied out of devtools, on the reasoning
// that a session lasts a month and a password would have to be stored to be
// worth anything. The first half turned out to be wrong: a pasted session died
// the same day it was made, which turns a monthly errand into a daily one.
//
// So the normal path is now signing in here. MyStudio emails a six digit code
// every time, which no amount of engineering removes, but with the password held
// encrypted on the server a renewal is one button and six digits instead of a
// trip through the network tab.
//
// The cookie paste stays, below the fold. The sign-in copies two undocumented
// actions out of MyStudio's own login page, and the day they change it, pasting
// a cookie is still going to work.
//
// A connection belongs to the center, not to the person who set it up. Upstream
// accounts are scoped to one center each, so a director connecting their account
// is connecting their center, and the next director there inherits it.

const FIELD =
  'w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue';

// Copy as cURL, because the honest alternative is worse.
//
// Two of the values that authorize the connection are httpOnly, so the console
// cannot read them and no button on this page can fetch them. Someone has to go
// into devtools once. The first version of these steps said to find the cookie
// row inside Request Headers, and the first person to read it got stuck, which
// is fair: that is a developer's instruction. Copy as cURL is one menu item in a
// place people already right click, it always contains the cookie, and the
// server pulls it out of whatever lands on the clipboard.
//
// Name one row instead of describing a filter. Two rounds of filter advice both
// failed in the same way: "any mystudio.io row" includes the HubSpot and Stripe
// requests, which carry mystudio.io inside their own query strings, and includes
// cn.mystudio.io, which serves uploaded images and never sees the sign-in. The
// follow-up, mystudio.io/api, is only true if you type it and then reload, since
// a filter hides captured rows rather than producing new ones, and the person
// following it had already loaded the page.
//
// The document request is the one row that is always there, always first, always
// on the signed-in host, and needs no filter to find. It is also the row the
// first person to work this out reached for unprompted.
const STEPS = [
  'Sign in to MyStudio and go to its home page.',
  'Press F12 to open devtools, then click the Network tab.',
  'Reload the page, keeping devtools open.',
  'Right click the very first row, named home, and choose Copy, then Copy as cURL.',
  'Paste the whole thing below. Only the cookie part is kept.',
];

function formatWhen(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MyStudioConnect({ isOpen, onClose, status, onChanged, centerName }) {
  const isDesktop = useIsDesktop();
  const [cookie, setCookie] = useState('');
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [confirmingForget, setConfirmingForget] = useState(false);
  const [cookieOpen, setCookieOpen] = useState(false);
  // Opening the sign-in on a connection that is already working.
  const [showSignIn, setShowSignIn] = useState(false);

  // The two-step sign-in itself, shared with the dashboard's schedule card.
  const signIn = useMyStudioSignIn({ status, onChanged, onDone: onClose, active: isOpen });
  const {
    step, email, setEmail, password, setPassword, code, setCode,
    error, notice, setError, setNotice,
    savedEmail, hasSavedPassword, awaitingEmail,
    sendCode, cancelCode, verifyCode, canVerify,
  } = signIn;

  // The panel's own calls — pasting a cookie, forgetting a password, pulling
  // the connection — are not part of signing in, so they carry their own flag
  // and the controls read whichever is running.
  const [panelBusy, setBusy] = useState(false);
  const busy = signIn.busy || panelBusy;

  // A closed panel keeps no credential and leaves no confirm armed.
  //
  // The step is deliberately NOT reset here. Fetching the emailed code means
  // leaving this panel, and on desktop clicking outside closes it, so wiping
  // the step on close is what left the first person to try this holding a code
  // with nowhere to put it. Where the flow is up to lives on the server now.
  useEffect(() => {
    if (isOpen) return;
    setCookie('');
    setBusy(false);
    setConfirmingDisconnect(false);
    setConfirmingForget(false);
    setCookieOpen(false);
    setShowSignIn(false);
    signIn.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // When MyStudio's own sign-in is the broken thing rather than the
  // credential, the cookie fallback has to be visible, not folded away behind
  // a disclosure nobody opens.
  useEffect(() => {
    if (signIn.signInUnavailable) setCookieOpen(true);
  }, [signIn.signInUnavailable]);

  const connect = useCallback(async () => {
    if (!cookie.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await api.post('/mystudio/connect', { cookie });
      setCookie('');
      onChanged?.(next);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not connect.');
    } finally {
      setBusy(false);
    }
  }, [cookie, busy, onChanged, onClose]);

  // What this connection is allowed to power here. Server-enforced; this only
  // asks.
  const setFeature = useCallback(
    async (key, value) => {
      // Optimistic: a switch that waits on a round trip feels broken.
      const previous = status;
      onChanged?.({
        ...(status || {}),
        features: { ...(status?.features || {}), [key]: value },
      });
      try {
        onChanged?.(await api.patch('/mystudio/features', { [key]: value }));
      } catch (err) {
        onChanged?.(previous);
        setError(err.message || 'Could not change that setting.');
      }
    },
    [status, onChanged]
  );

  const forgetPassword = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await api.delete('/mystudio/login/saved');
      onChanged?.(next);
      setConfirmingForget(false);
      setNotice('Password forgotten. Renewing will ask for it again.');
    } catch (err) {
      setError(err.message || 'Could not forget the password.');
      setConfirmingForget(false);
    } finally {
      setBusy(false);
    }
  }, [busy, onChanged]);

  const disconnect = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await api.delete('/mystudio/connect');
      onChanged?.(next);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not disconnect.');
      setConfirmingDisconnect(false);
    } finally {
      setBusy(false);
    }
  }, [busy, onChanged, onClose]);

  const connected = status?.connected;
  const expired = connected && status.status === 'expired';
  // Connected and pulling. Nothing needs doing, so nothing should be asked for.
  const healthy = connected && !expired;
  const features = status?.features || { booked: true, import: true };
  const lastSynced = formatWhen(status?.lastSyncedAt);

  const body = (
    <div className="space-y-4">
      {!status?.configured && (
        <p className="font-ninja text-sm text-ninja-navy rounded-xl border border-ninja-border bg-ninja-bg p-3">
          MyStudio is not set up on the server yet, so connecting is turned off.
        </p>
      )}

      {connected && (
        <div className="rounded-xl border border-ninja-border p-3">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden
              className={
                expired
                  ? 'mt-0.5 text-amber-600 dark:text-amber-400'
                  : 'mt-0.5 text-emerald-600 dark:text-emerald-400'
              }
            >
              {expired ? <TriangleAlertIcon size={17} /> : <CircleCheckIcon size={17} />}
            </span>
            <div className="min-w-0">
              {/* MyStudio's own name for the center is the best label, but it
                  comes from a session that expires sooner than the credential
                  does, so it is often missing. Our name for the same center says
                  more than "Connected center" ever did. */}
              <p className="font-ninja text-sm font-semibold text-ninja-navy">
                {status.companyName || centerName || 'Connected'}
              </p>
              <p className="font-ninja text-xs text-ninja-muted">
                {expired
                  ? 'The MyStudio session ran out. Sign in again to pick it back up.'
                  : lastSynced
                    ? `Last checked ${lastSynced}`
                    : 'Connected. Nothing pulled yet.'}
              </p>
              {savedEmail && (
                <p className="font-ninja text-xs text-ninja-muted mt-0.5">
                  Signed in as {savedEmail}
                </p>
              )}
              {status.connectedByName && (
                <p className="font-ninja text-xs text-ninja-muted mt-0.5">
                  Set up by {status.connectedByName}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* The sign-in. Two steps, because MyStudio emails a code between them. */}
      {step === 'code' ? (
        <div>
          <p className="font-ninja text-xs font-semibold uppercase tracking-wide text-ninja-muted mb-2">
            Enter the code
          </p>
          <p className="font-ninja text-sm text-ninja-navy mb-3">
            MyStudio emailed a six digit code to{' '}
            <span className="font-semibold">{email || awaitingEmail || savedEmail}</span>.
          </p>

          <label htmlFor="mystudio-code" className="sr-only">
            MyStudio code
          </label>
          {/* Six digits and no more. The field used to take eight, which let a
              fat-fingered seventh sit there invisibly at the end of a code that
              looked right, and spent an attempt to say so. */}
          <input
            id="mystudio-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') verifyCode();
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            placeholder="123456"
            autoFocus
            className={`${FIELD} font-mono tracking-[0.5em] indent-[0.5em] text-center text-xl py-3`}
            disabled={busy}
          />

          {/* The primary action on its own line, so the two quiet ones beside it
              stop reading as one run-on phrase. */}
          <Button
            onClick={verifyCode}
            className="w-full mt-3"
            disabled={!canVerify}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2Icon size={15} className="animate-spin" aria-hidden />
                Checking
              </span>
            ) : (
              'Finish connecting'
            )}
          </Button>

          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              onClick={() => sendCode({ resend: true })}
              disabled={busy}
              className="font-ninja text-sm text-ninja-muted hover:text-ninja-navy transition-colors disabled:opacity-60"
            >
              Send a new code
            </button>
            <button
              type="button"
              onClick={cancelCode}
              className="font-ninja text-sm text-ninja-muted hover:text-ninja-navy transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      ) : healthy && !showSignIn ? (
        // Working connections are not asked to sign in.
        //
        // This block used to sit open on a healthy connection, offering to email
        // a code for no stated reason, which reads as a step somebody forgot to
        // finish rather than the repair it is. Signing in again is only ever a
        // repair, so it waits behind a quiet link until something is wrong or
        // somebody goes looking for it.
        <button
          type="button"
          onClick={() => setShowSignIn(true)}
          className="font-ninja text-sm text-ninja-muted hover:text-ninja-navy transition-colors"
        >
          Sign in again
        </button>
      ) : (
        <div>
          <p className="font-ninja text-xs font-semibold uppercase tracking-wide text-ninja-muted mb-2">
            {expired ? 'Reconnect' : connected ? 'Sign in again' : 'Sign in to MyStudio'}
          </p>

          {hasSavedPassword ? (
            <p className="font-ninja text-sm text-ninja-navy mb-3">
              Your password is saved, so this only needs the code MyStudio emails
              you.
            </p>
          ) : (
            <div className="space-y-2 mb-3">
              <div>
                <label htmlFor="mystudio-email" className="sr-only">
                  MyStudio email
                </label>
                <input
                  id="mystudio-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="Email"
                  className={FIELD}
                  disabled={busy || !status?.configured}
                />
              </div>
              <div>
                <label htmlFor="mystudio-password" className="sr-only">
                  MyStudio password
                </label>
                <input
                  id="mystudio-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendCode();
                  }}
                  autoComplete="current-password"
                  placeholder="Password"
                  className={FIELD}
                  disabled={busy || !status?.configured}
                />
              </div>
              <p className="font-ninja text-xs text-ninja-muted">
                Your details are stored encrypted.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => sendCode()}
              disabled={
                busy ||
                !status?.configured ||
                (!hasSavedPassword && (!email.trim() || !password))
              }
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon size={15} className="animate-spin" aria-hidden />
                  Signing in
                </span>
              ) : (
                'Log in'
              )}
            </Button>

            {/* Only when this was opened by choice. There is nothing to back out
                of when the connection is the thing that needs fixing. */}
            {healthy && (
              <button
                type="button"
                onClick={() => {
                  setShowSignIn(false);
                  setPassword('');
                  setError('');
                  setNotice('');
                }}
                className="font-ninja text-sm text-ninja-muted hover:text-ninja-navy transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {connected && (
        <div>
          <p className="font-ninja text-xs font-semibold uppercase tracking-wide text-ninja-muted mb-2">
            What this connection does here
          </p>
          <div className="rounded-xl border border-ninja-border divide-y divide-ninja-border">
            {[
              {
                key: 'booked',
                title: "Today's bookings on the board",
                hint: 'Shows who MyStudio says is coming, for directors and senseis.',
              },
              {
                key: 'import',
                title: 'Roster import',
                hint: 'Lets a director pull this center\'s ninjas from MyStudio.',
              },
            ].map((row) => (
              <div key={row.key} className="flex items-center gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-ninja text-sm text-ninja-navy">{row.title}</p>
                  <p className="font-ninja text-xs text-ninja-muted">{row.hint}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={features[row.key] !== false}
                  aria-label={row.title}
                  onClick={() => setFeature(row.key, features[row.key] === false)}
                  className={`relative ml-auto w-12 h-7 rounded-full flex-shrink-0 transition-colors duration-200 ${
                    features[row.key] !== false ? 'bg-ninja-blue' : 'bg-ninja-border'
                  }`}
                >
                  <motion.span
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md ${
                      features[row.key] !== false ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kept, and kept working, because the sign-in above leans on two
          undocumented actions in MyStudio's login page. When those change this
          is the path that still connects a center. */}
      <details
        open={cookieOpen}
        onToggle={(e) => setCookieOpen(e.currentTarget.open)}
        className="rounded-xl border border-ninja-border"
      >
        <summary className="cursor-pointer select-none px-3 py-2 font-ninja text-sm text-ninja-navy">
          Paste a cookie instead
        </summary>
        <div className="px-3 pb-3 pt-1">
          <ol className="space-y-1.5 mb-3">
            {STEPS.map((text, i) => (
              <li key={text} className="flex gap-2.5 font-ninja text-xs text-ninja-muted">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-ninja-bg border border-ninja-border grid place-items-center text-[10px] font-semibold text-ninja-navy">
                  {i + 1}
                </span>
                {text}
              </li>
            ))}
          </ol>

          <label htmlFor="mystudio-cookie" className="sr-only">
            MyStudio cookie
          </label>
          <textarea
            id="mystudio-cookie"
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            rows={4}
            spellCheck={false}
            autoComplete="off"
            placeholder={"curl 'https://codeninjas.mystudio.io/...' \\\n  -H 'cookie: companyId=...; kc_refresh=...'"}
            className={`${FIELD} resize-none font-mono text-xs`}
            disabled={busy || !status?.configured}
          />
          <p className="font-ninja text-xs text-ninja-muted mt-1.5">
            Treated like a password: encrypted on the server, never shown again,
            and only used to read your class schedule.
          </p>
          <Button
            onClick={connect}
            className="mt-3"
            disabled={!cookie.trim() || busy || !status?.configured}
          >
            {connected ? 'Save new cookie' : 'Connect'}
          </Button>
        </div>
      </details>

      {notice && !error && (
        <p className="font-ninja text-sm text-ninja-navy">{notice}</p>
      )}

      {error && (
        <p role="alert" className="font-ninja text-sm text-ninja-red">
          {error}
        </p>
      )}

      {/* Housekeeping for the connection itself, kept together and kept away
          from the sign-in: forgetting a password is not a step in signing in. */}
      <div className="flex flex-wrap items-center gap-4">
        {hasSavedPassword && (
          <AnimatePresence mode="wait" initial={false}>
            {confirmingForget ? (
              <motion.div
                key="confirm-forget"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={forgetPassword}
                  disabled={busy}
                  className="font-ninja text-sm font-semibold rounded-lg px-3 py-2 bg-ninja-red text-white transition-colors hover:brightness-95 disabled:opacity-60"
                >
                  Forget password
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingForget(false)}
                  className="font-ninja text-sm text-ninja-muted hover:text-ninja-navy transition-colors"
                >
                  Keep it
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="ask-forget"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setConfirmingForget(true)}
                className="font-ninja text-sm text-ninja-muted hover:text-ninja-navy transition-colors"
              >
                Forget saved password
              </motion.button>
            )}
          </AnimatePresence>
        )}

        {connected && (
          <AnimatePresence mode="wait" initial={false}>
            {confirmingDisconnect ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={busy}
                  className="font-ninja text-sm font-semibold rounded-lg px-3 py-2 bg-ninja-red text-white transition-colors hover:brightness-95 disabled:opacity-60"
                >
                  Disconnect
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDisconnect(false)}
                  className="font-ninja text-sm text-ninja-muted hover:text-ninja-navy transition-colors"
                >
                  Keep it
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="ask"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setConfirmingDisconnect(true)}
                className="flex items-center gap-1.5 font-ninja text-sm text-ninja-muted hover:text-ninja-red transition-colors"
              >
                <Trash2Icon size={15} aria-hidden />
                Disconnect
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );

  const title = connected ? 'MyStudio connection' : 'Connect MyStudio';

  // Beside the page on desktop, a dialog below it. Same two-shell rule the task
  // editor follows, from the one shared media query.
  return isDesktop ? (
    <FloatingPanel isOpen={isOpen} onClose={onClose} title={title}>
      {body}
    </FloatingPanel>
  ) : (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {body}
    </Modal>
  );
}

// The row on the account page that opens the panel above.
//
// Directors only, and reachable whether or not they have Experimental on once
// their center is connected: the connection is the center's, and the screen
// that switches it off cannot be behind a preference belonging to one browser.
export function MyStudioRow({ status, onOpen, centerName, className = 'mt-3' }) {
  const connected = status?.connected;
  const expired = connected && status.status === 'expired';
  // The sign-in is good for a day and no longer, so the most useful thing this
  // row can say once it is connected is when that day ends. Silent when the
  // token cannot be read, rather than guessing.
  const hoursLeft = hoursUntil(status?.expiresAt);
  const runningOut = hoursLeft !== null && hoursLeft > 0 && hoursLeft <= 6;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${className} w-full flex items-center justify-between rounded-xl border border-ninja-border p-3 text-left transition-[transform,border-color] duration-150 ease-[var(--ease-out)] hover:border-ninja-blue/50 active:scale-[0.98]`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <img
          src="/logo/mystudio.png"
          alt=""
          width={36}
          height={36}
          className="w-9 h-9 rounded-xl flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-ninja-navy font-ninja font-semibold text-sm">MyStudio Integration</p>
          <p className="text-ninja-muted font-ninja text-xs truncate">
            {expired
              ? 'Session ran out. Sign in again to keep pulling.'
              : connected
                ? `${status.companyName || centerName || 'Connected'}. ${
                    status.expiresAt
                      ? `Runs out ${formatExpiry(status.expiresAt)}.`
                      : "Today's classes appear on the board."
                  }`
                : "Pull today's booked ninjas onto the board"}
          </p>
        </div>
      </div>
      <span
        aria-hidden
        className={`flex-shrink-0 ml-2 w-2 h-2 rounded-full ${
          expired || runningOut ? 'bg-amber-500' : connected ? 'bg-emerald-500' : 'bg-ninja-border'
        }`}
      />
    </button>
  );
}
