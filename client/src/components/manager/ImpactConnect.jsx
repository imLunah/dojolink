import { useState, useEffect } from 'react';
import { TimerIcon, Trash2Icon, Loader2Icon } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { api } from '../../api/client';

// Connecting a center to IMPACT, so the Live Ninjas board can read who is in
// the dojo. One email and password, no code: IMPACT's sign-in asks for none.
//
// The password is kept, encrypted, because IMPACT's own renewal only lasts a
// day, and a board nobody opened over the weekend would otherwise need signing
// in again every Monday. With it kept, the board signs itself back in.

const FIELD =
  'w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue';

export default function ImpactConnect({ isOpen, onClose, status, onChanged }) {
  const connected = status?.connected;
  const expired = connected && status.status === 'expired';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Each opening starts from the saved email, with nothing typed and no old
  // error left over.
  useEffect(() => {
    if (!isOpen) return;
    setEmail(status?.loginEmail || '');
    setPassword('');
    setError('');
    setConfirming(false);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const next = await api.post('/impact/connect', { email, password });
      setPassword('');
      onChanged(next);
    } catch (err) {
      setError(err.message || 'Could not sign in to IMPACT.');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError('');
    try {
      onChanged(await api.delete('/impact/connect'));
      setConfirming(false);
    } catch (err) {
      setError(err.message || 'Could not disconnect.');
    } finally {
      setBusy(false);
    }
  };

  const showForm = !connected || expired;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={connected ? 'IMPACT connection' : 'Connect IMPACT'}
      canDismiss={!password}
    >
      <div className="space-y-4 font-ninja">
        {connected && (
          <div className="text-sm">
            <p className="text-ninja-navy font-semibold">
              {expired ? 'The sign-in stopped working.' : `Connected to ${status.facilityName || 'this center'}.`}
            </p>
            {expired && status.lastError && <p className="text-ninja-muted mt-1">IMPACT said: {status.lastError}</p>}
            <p className="text-ninja-muted mt-1">
              Signed in as {status.loginEmail}
              {status.connectedByName ? `, set up by ${status.connectedByName}` : ''}.
            </p>
          </div>
        )}

        {showForm && (
          <form onSubmit={connect} className="space-y-3">
            <p className="text-sm text-ninja-muted">
              Use the email and password you sign in to sensei.codeninjas.com with.
            </p>
            <input
              type="email"
              autoComplete="username"
              placeholder="Email"
              aria-label="IMPACT email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={FIELD}
              required
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              aria-label="IMPACT password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD}
              required
            />
            <Button type="submit" disabled={busy || !password} className="w-full flex items-center justify-center gap-2">
              {busy && <Loader2Icon size={16} className="animate-spin" aria-hidden />}
              {expired ? 'Sign in again' : 'Connect'}
            </Button>
          </form>
        )}

        {error && <p className="text-sm text-ninja-red">{error}</p>}

        {connected && (
          <div className="pt-1">
            {confirming ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={busy}
                  className="text-sm font-semibold rounded-lg px-3 py-2 bg-ninja-red text-white transition-colors hover:brightness-95 disabled:opacity-60"
                >
                  Disconnect
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-sm text-ninja-muted hover:text-ninja-navy transition-colors"
                >
                  Keep it
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex items-center gap-1.5 text-sm text-ninja-muted hover:text-ninja-red transition-colors"
              >
                <Trash2Icon size={15} aria-hidden />
                Disconnect
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ImpactRow({ status, onOpen, className = 'mt-3' }) {
  const connected = status?.connected;
  const expired = connected && status.status === 'expired';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${className} w-full flex items-center justify-between rounded-xl border border-ninja-border p-3 text-left transition-[transform,border-color] duration-150 ease-[var(--ease-out)] hover:border-ninja-blue/50 active:scale-[0.98]`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-ninja-blue-ink bg-ninja-blue/10">
          <TimerIcon width="17" height="17" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-ninja-navy font-ninja font-semibold text-sm">IMPACT Integration</p>
          <p className="text-ninja-muted font-ninja text-xs truncate">
            {expired
              ? 'Sign-in stopped working. Sign in again.'
              : connected
                ? `${status.facilityName || 'Connected'}. Live Ninjas is on.`
                : 'Show the Live Ninjas countdown in DojoLink'}
          </p>
        </div>
      </div>
      <span
        aria-hidden
        className={`flex-shrink-0 ml-2 w-2 h-2 rounded-full ${
          expired ? 'bg-amber-500' : connected ? 'bg-emerald-500' : 'bg-ninja-border'
        }`}
      />
    </button>
  );
}
