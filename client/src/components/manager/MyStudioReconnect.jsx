import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2Icon } from 'lucide-react';
import { api } from '../../api/client';
import Button from '../ui/Button';
import useMyStudioSignIn, { CODE_LENGTH } from '../../lib/useMyStudioSignIn';

// Picking the MyStudio connection back up without leaving the page it broke on.
//
// The schedule card used to say the connection had run out and link to Account
// settings, which is three screens away from the thing somebody was trying to
// read. The repair is small enough to do in place: press the button, MyStudio
// emails a code, paste it. Same calls the settings panel makes, through the
// same hook, so the two cannot drift.
//
// Only a director gets this. Starting a sign-in needs their MyStudio password
// and the routes behind it are manager-only, so a sensei is told who can fix it
// rather than handed a form that would 403.

const FIELD =
  'w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 ' +
  'font-ninja text-sm focus:outline-none focus:border-ninja-blue';

export default function MyStudioReconnect({ onConnected }) {
  // The feed says the credential has run out; it does not say whether there is
  // a password on file or a code already in flight. Only the broken state asks
  // for this, so it is one request on a card nobody wants to be looking at.
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    let alive = true;
    api.get('/mystudio/status')
      .then((next) => { if (alive) setStatus(next); })
      .catch((err) => { if (alive) setStatusError(err.message || 'Could not read the connection.'); });
    return () => { alive = false; };
  }, []);

  const signIn = useMyStudioSignIn({
    status,
    onChanged: setStatus,
    onDone: () => onConnected?.(),
  });
  const {
    step, email, setEmail, password, setPassword, code, setCode,
    busy, error, notice, savedEmail, hasSavedPassword, awaitingEmail,
    sendCode, cancelCode, verifyCode, canSend, canVerify, signInUnavailable,
  } = signIn;

  // Which form to draw depends on whether a password is on file, so drawing
  // one before the answer arrives means swapping it under somebody's cursor.
  if (!status && !statusError) {
    return (
      <p className="font-ninja text-sm text-ninja-muted flex items-center gap-2">
        <Loader2Icon size={14} className="animate-spin" aria-hidden />
        Checking the connection
      </p>
    );
  }

  if (statusError) {
    return (
      <p className="font-ninja text-sm text-ninja-muted">
        {statusError}
      </p>
    );
  }

  // The sign-in MyStudio offers is the thing that is down, which is not
  // something a code will fix. The settings panel keeps the cookie fallback.
  if (signInUnavailable) {
    return (
      <div>
        <p className="font-ninja text-sm text-ninja-navy">{error}</p>
        <Link
          to="/account?mystudio=1"
          className="inline-block mt-1.5 font-ninja text-sm font-semibold text-ninja-blue hover:underline"
        >
          Open MyStudio settings
        </Link>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <div>
        <p className="font-ninja text-sm text-ninja-navy">
          MyStudio emailed a six digit code to{' '}
          <span className="font-semibold">{email || awaitingEmail || savedEmail}</span>.
        </p>

        <label htmlFor="schedule-mystudio-code" className="sr-only">MyStudio code</label>
        <input
          id="schedule-mystudio-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') verifyCode(); }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          placeholder="123456"
          autoFocus
          disabled={busy}
          className={`${FIELD} mt-3 font-mono tracking-[0.4em] indent-[0.4em] text-center text-lg py-2.5`}
        />

        <Button onClick={verifyCode} className="w-full mt-2.5" disabled={!canVerify}>
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2Icon size={15} className="animate-spin" aria-hidden />
              Checking
            </span>
          ) : (
            'Reconnect'
          )}
        </Button>

        <div className="flex items-center justify-between mt-2.5">
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

        {error && <p role="alert" className="font-ninja text-sm text-ninja-red mt-2.5">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {hasSavedPassword ? (
        <p className="font-ninja text-sm text-ninja-muted">
          Your password is saved, so this only needs the code MyStudio emails you.
        </p>
      ) : (
        <div className="space-y-2">
          <label htmlFor="schedule-mystudio-email" className="sr-only">MyStudio email</label>
          <input
            id="schedule-mystudio-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder="Email"
            disabled={busy}
            className={FIELD}
          />
          <label htmlFor="schedule-mystudio-password" className="sr-only">MyStudio password</label>
          <input
            id="schedule-mystudio-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendCode(); }}
            autoComplete="current-password"
            placeholder="Password"
            disabled={busy}
            className={FIELD}
          />
        </div>
      )}

      <Button onClick={() => sendCode()} className="w-full mt-2.5" disabled={!canSend}>
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2Icon size={15} className="animate-spin" aria-hidden />
            Signing in
          </span>
        ) : (
          'Email me a code'
        )}
      </Button>

      {notice && !error && (
        <p className="font-ninja text-sm text-ninja-navy mt-2.5">{notice}</p>
      )}
      {error && <p role="alert" className="font-ninja text-sm text-ninja-red mt-2.5">{error}</p>}
    </div>
  );
}
