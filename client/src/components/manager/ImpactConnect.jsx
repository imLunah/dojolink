import { useState, useEffect } from 'react';
import { Trash2Icon, Loader2Icon } from 'lucide-react';
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

// IMPACT's own mark, the ninja head from sensei.codeninjas.com, redrawn in
// currentColor so it themes like every other glyph.
export function ImpactMark(props) {
  return (
    <svg viewBox="0 0 35.03 30.14" fill="currentColor" aria-hidden {...props}>
      <path d="M16.699,14.747,12.111,14.2a.256.256,0,0,0-.231.411,3.535,3.535,0,0,0,4.917.548.228.228,0,0,0-.1-.414Zm7.873.42a3.536,3.536,0,0,0,4.917-.554.256.256,0,0,0-.231-.417l-4.588.551a.228.228,0,0,0-.1.42Zm10.455-.1c0,8.324-6.418,15.07-14.333,15.07A14.591,14.591,0,0,1,6.515,17.372a5.552,5.552,0,0,1-3.839,3.592A.539.539,0,0,1,1.97,20.523c-.335-3.154,1.1-4.731,2.436-5.507a5.834,5.834,0,0,1-4.3-2.347.487.487,0,0,1,.174-.74c3.044-1.492,5.1-.585,6.3.432A14.552,14.552,0,0,1,20.693,0C28.609,0,35.027,6.747,35.027,15.07ZM28.28,25.814s-11.691,4.631-19-4.807c0,0,2.874,6.667,10.047,7.459a12.312,12.312,0,0,0,8.957-2.652Zm4.7-13.7a92.3,92.3,0,0,1-12.291.712h0a104.351,104.351,0,0,1-12.306-.74,11.831,11.831,0,0,0-.323,2.984h0a16.744,16.744,0,0,0,.332,2.959,120,120,0,0,1,12.3-.569h0c3.653,0,7.858.149,12.266.591h.037a11.8,11.8,0,0,0,.323-2.978h0a16.809,16.809,0,0,0-.335-2.962ZM31.937,9.322S29.063,2.652,21.89,1.863a12.312,12.312,0,0,0-8.96,2.652s11.7-4.625,19.007,4.8Z" />
    </svg>
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
        {/* A printed badge, so inline hex: the same navy tile in both themes. */}
        <span
          className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{ backgroundColor: '#0b1f3f', color: '#ffffff' }}
        >
          <ImpactMark width="22" height="19" />
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
