import { useState } from 'react';
import { CheckIcon, HandHeartIcon } from 'lucide-react';
import { api } from '../../api/client';
import ActionMenu, { MenuItem } from '../ui/ActionMenu';
import { SUPPORT_INK, SUPPORT_REASONS, supportLabel, supportShort } from '../../lib/support';

// The "Needs extra support" control, one component for both places a sensei
// sets it: the student profile (a labelled button) and a card on Today's
// Board (a glyph, lit when the ninja is marked). Picking a reason sets the
// mark, "Remove" clears it. Read-only viewers see the state and nothing else.
//
// `onChange` gets the new reason (or null) once the server has saved it.
export default function SupportMark({ studentId, reason, onChange, readOnly = false, compact = false }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const marked = Boolean(reason);

  const save = async (next, close) => {
    if (next === reason) { close(); return; }
    setSaving(true);
    setError('');
    try {
      const { support } = await api.put(`/students/${studentId}/support`, { reason: next });
      onChange?.(support?.reason ?? null);
      close();
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const glyph = (
    <HandHeartIcon
      size={compact ? 18 : 16}
      strokeWidth={2}
      aria-hidden="true"
      style={marked ? { color: SUPPORT_INK } : undefined}
    />
  );

  const label = marked ? `Needs extra support: ${supportLabel(reason)}` : 'Mark as needing extra support';

  if (readOnly) {
    if (!marked) return null;
    return compact ? (
      <span title={label} aria-label={label} role="img" className="inline-flex p-1">{glyph}</span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-ninja text-sm font-semibold" style={{ color: SUPPORT_INK, backgroundColor: 'rgb(225 29 72 / 0.08)' }}>
        {glyph}Extra support: {supportShort(reason)}
      </span>
    );
  }

  const trigger = compact ? glyph : (
    <>
      {glyph}
      <span>{marked ? `Extra support: ${supportShort(reason)}` : 'Needs extra support'}</span>
    </>
  );

  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <ActionMenu
        label={label}
        align="right"
        onClosed={() => setError('')}
        trigger={trigger}
        triggerClassName={compact
          ? `p-1 rounded-full transition-colors duration-150 hover:bg-ninja-bg ${marked ? '' : 'text-ninja-muted hover:text-ninja-navy'}`
          : `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-ninja text-sm font-semibold transition-colors ${
            marked ? '' : 'border border-ninja-border text-ninja-navy hover:bg-ninja-bg'
          }`}
        {...(!compact && marked ? { triggerStyle: { color: SUPPORT_INK, backgroundColor: 'rgb(225 29 72 / 0.08)' } } : {})}
      >
        {({ close }) => (
          <div className="min-w-[14rem]">
            <p className="px-2.5 pt-1.5 pb-1 font-ninja text-[11px] font-bold uppercase tracking-wide text-ninja-muted">
              Needs extra support
            </p>
            {SUPPORT_REASONS.map((r) => (
              <MenuItem key={r.value} disabled={saving} onSelect={() => save(r.value, close)}>
                <span className="flex-1">{r.label}</span>
                {reason === r.value && <CheckIcon size={15} strokeWidth={2.25} className="text-ninja-blue" aria-label="Current reason" />}
              </MenuItem>
            ))}
            {marked && (
              <div className="mt-1 border-t border-ninja-border pt-1">
                <MenuItem danger disabled={saving} onSelect={() => save(null, close)}>Remove the mark</MenuItem>
              </div>
            )}
            {error && <p className="px-2.5 py-1.5 font-ninja text-xs text-ninja-red">{error}</p>}
          </div>
        )}
      </ActionMenu>
    </span>
  );
}
