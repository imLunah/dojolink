import { useState } from 'react';
import { CARD } from '../../lib/surfaces';
import { DELETION_REASONS } from '../../lib/deletionReasons';

// The delete-my-account card, shared by the staff and parent settings pages.
// A reason (one of five, chips), an optional line of detail, then whatever
// the caller needs typed to be sure it is really them (`fields`), and a
// button that turns into an inline confirm — never window.confirm. The
// caller does the request in `onDelete(values)` and what happens after.
//
// `intro` says what goes, in the caller's words; `fields` is
// [{ id, label, type, autoComplete, placeholder, transform }].

const FIELD = 'w-full px-4 py-3 rounded-xl bg-ninja-bg border border-ninja-border text-ninja-navy font-ninja text-sm focus:border-ninja-blue focus:outline-none transition-colors';
const LABEL = 'block text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide mb-1.5';

export default function DeleteAccountCard({ intro, fields, onDelete }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.id, ''])));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = reason && fields.every((f) => values[f.id].trim());

  const go = async () => {
    setError('');
    setBusy(true);
    try {
      await onDelete({ reason, details: details.trim(), ...values });
    } catch (err) {
      setError(err?.message || 'Could not delete your account. Please try again.');
      setConfirming(false);
      setBusy(false);
    }
  };

  return (
    <div className={`${CARD} p-6 space-y-5`}>
      <div>
        <p className="font-ninja font-bold text-ninja-navy">Delete my account</p>
        <p className="mt-1 font-ninja text-sm text-ninja-muted leading-relaxed">{intro}</p>
      </div>

      <div>
        <p className={LABEL}>Why are you leaving?</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
          {DELETION_REASONS.map((r) => {
            const on = reason === r.value;
            return (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setReason(r.value)}
                className={`px-3.5 py-2 rounded-full font-ninja font-bold text-[13px] border transition-colors ${
                  on ? 'bg-ninja-navy border-ninja-navy text-white' : 'border-ninja-border text-ninja-navy hover:border-ninja-navy/50'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="del-details" className={LABEL}>Anything you'd like to add <span className="normal-case font-normal tracking-normal">(optional)</span></label>
        <textarea
          id="del-details"
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 500))}
          rows={2}
          className={`${FIELD} resize-none`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.id}>
            <label htmlFor={`del-${f.id}`} className={LABEL}>{f.label}</label>
            <input
              id={`del-${f.id}`}
              type={f.type || 'text'}
              value={values[f.id]}
              onChange={(e) => setValues((v) => ({ ...v, [f.id]: f.transform ? f.transform(e.target.value) : e.target.value }))}
              autoComplete={f.autoComplete || 'off'}
              placeholder={f.placeholder}
              className={FIELD}
            />
          </div>
        ))}
      </div>

      {error && <p className="font-ninja text-sm text-ninja-red" role="alert">{error}</p>}

      {!confirming ? (
        <button
          type="button"
          disabled={!ready}
          onClick={() => setConfirming(true)}
          className="w-full py-3.5 rounded-xl border border-ninja-red text-ninja-red font-ninja font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          Delete my account
        </button>
      ) : (
        <div className="rounded-xl border border-ninja-red/40 bg-red-50/60 p-4 space-y-3">
          <p className="font-ninja text-sm text-ninja-navy font-bold">This can't be undone. Delete everything?</p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={go}
              className="flex-1 py-3 rounded-xl bg-ninja-red text-white font-ninja font-bold text-sm hover:bg-ninja-red/90 transition-colors disabled:opacity-60"
            >
              {busy ? 'Deleting…' : 'Yes, delete my account'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="px-5 py-3 rounded-xl border border-ninja-border text-ninja-navy font-ninja font-semibold text-sm hover:border-ninja-blue/60 transition-colors"
            >
              Keep it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
