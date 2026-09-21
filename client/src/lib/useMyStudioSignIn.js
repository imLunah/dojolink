import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

// Signing in to MyStudio, which is two steps because MyStudio emails a six
// digit code between them.
//
// A hook rather than state inside the settings panel that first had it: the
// dashboard's schedule card asks for the same three calls when the connection
// has run out, and two copies of an auth flow drift. The rules worth having in
// one place are the quiet ones — an empty password on the code step means
// "finish the sign-in already in flight" rather than "blank credential", the
// half-finished sign-in lives on the server so it survives leaving the page to
// go and read the email, and backing out has to clear it there too.
//
// The markup belongs to the caller. A settings panel with room says all of
// this in prose; a card overlay says it in a sentence and one field.

// MyStudio's passcode is six digits, and a field should not accept a seventh.
export const CODE_LENGTH = 6;

export default function useMyStudioSignIn({ status, onChanged, onDone, active = true }) {
  // 'signin' collects an email and password, 'code' collects the six digits.
  const [step, setStep] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // The sign-in itself is broken rather than the credential, so the caller can
  // put its fallback in front of someone instead of behind a disclosure.
  const [signInUnavailable, setSignInUnavailable] = useState(false);

  const savedEmail = status?.loginEmail || '';
  const hasSavedPassword = Boolean(status?.hasSavedPassword);
  // A sign-in already waiting on its code, remembered by the server.
  const awaitingCode = Boolean(status?.awaitingCode);
  const awaitingEmail = status?.awaitingCodeEmail || '';

  // Resume where the sign-in actually is, not where it started.
  useEffect(() => {
    if (!active) return;
    if (awaitingCode) {
      setStep('code');
      setEmail((prev) => prev || awaitingEmail || savedEmail || '');
    } else {
      setStep('signin');
      setEmail((prev) => prev || savedEmail || '');
    }
  }, [active, awaitingCode, awaitingEmail, savedEmail]);

  const handleAuthError = useCallback((err, fallback) => {
    if (err?.data?.signInUnavailable) setSignInUnavailable(true);
    setError(err?.message || fallback);
  }, []);

  // Asks MyStudio to email the code. With a password on file the body is empty
  // and the server uses what it has.
  const sendCode = useCallback(
    async ({ resend = false } = {}) => {
      if (busy) return;
      setBusy(true);
      setError('');
      setNotice('');
      try {
        const body = hasSavedPassword && !password ? {} : { email: email.trim(), password };
        const path = resend ? '/mystudio/login/resend' : '/mystudio/login/start';
        const res = await api.post(path, body);
        setStep('code');
        // Tell the page a sign-in is in flight, so leaving to read the email
        // and coming back lands on the code box.
        onChanged?.({
          ...(status || {}),
          awaitingCode: true,
          awaitingCodeEmail: res.email || email || savedEmail,
        });
        setNotice(`We asked MyStudio to email a code to ${res.email || email || savedEmail}.`);
      } catch (err) {
        handleAuthError(err, 'Could not start the sign-in.');
      } finally {
        setBusy(false);
      }
    },
    [busy, email, password, hasSavedPassword, savedEmail, status, onChanged, handleAuthError]
  );

  // Backing out. Clears the half-finished sign-in on the server too, so this
  // does not keep reopening on a code that is no longer wanted.
  const cancelCode = useCallback(async () => {
    setStep('signin');
    setCode('');
    setError('');
    setNotice('');
    try {
      await api.delete('/mystudio/login/pending');
    } catch {
      // The entry expires on its own; failing to clear it early is not worth
      // reporting to someone who just pressed Back.
    }
    onChanged?.({ ...(status || {}), awaitingCode: false, awaitingCodeEmail: null });
  }, [status, onChanged]);

  const verifyCode = useCallback(async () => {
    if (busy || !code.trim()) return;
    setBusy(true);
    setError('');
    try {
      // Only what was actually typed. An empty password here is not a blank
      // credential, it is "use the sign-in you already have in flight".
      const body = { code: code.trim() };
      if (password) {
        body.email = email.trim();
        body.password = password;
      }
      const next = await api.post('/mystudio/login/verify', body);
      setPassword('');
      setCode('');
      onChanged?.(next);
      onDone?.(next);
    } catch (err) {
      handleAuthError(err, 'That code did not work.');
    } finally {
      setBusy(false);
    }
  }, [busy, code, email, password, onChanged, onDone, handleAuthError]);

  // Everything a closed surface should not keep. Step and email stay: where
  // the flow is up to belongs to the server, and the email is not a secret.
  const reset = useCallback(() => {
    setPassword('');
    setCode('');
    setError('');
    setNotice('');
    setBusy(false);
    setSignInUnavailable(false);
  }, []);

  return {
    step,
    email,
    setEmail,
    password,
    setPassword,
    code,
    // Digits only, and never more than six: the field used to take a fat
    // fingered seventh invisibly and spend an attempt saying so.
    setCode: useCallback(
      (value) => setCode(String(value).replace(/\D/g, '').slice(0, CODE_LENGTH)),
      []
    ),
    busy,
    error,
    setError,
    notice,
    setNotice,
    signInUnavailable,
    setSignInUnavailable,
    sendCode,
    cancelCode,
    verifyCode,
    reset,
    savedEmail,
    hasSavedPassword,
    awaitingEmail,
    // Enough typed to ask for a code, and a whole code to send.
    canSend: !busy && Boolean(status?.configured) && (hasSavedPassword || (email.trim() && password)),
    canVerify: !busy && code.length === CODE_LENGTH,
  };
}
