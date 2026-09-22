import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2Icon, CheckIcon, ChevronDownIcon } from 'lucide-react';
import { PANEL } from '../../lib/surfaces';

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function TaskAssigneePicker({
  people = [],
  selectedIds = [],
  center = false,
  centerName = 'The whole center',
  onChange,
  compact = false,
  label = 'Assigned to',
}) {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(selectedIds.map(Number)), [selectedIds]);
  const selectedPeople = people.filter((person) => selected.has(person.id));
  const summary = center
    ? centerName
    : selectedPeople.length === 0
      ? 'Nobody yet'
      : selectedPeople.map((person) => person.display_name.split(/\s+/)[0]).join(', ');

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => {
      if ((event.type === 'pointerdown' || event.type === 'click') && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('click', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('click', dismiss);
    };
  }, [open]);

  const chooseCenter = () => onChange({ assigneeIds: [], assigneeCenter: !center });
  const choosePerson = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange({ assigneeIds: [...next], assigneeCenter: false });
  };

  const row = (person) => {
    const checked = selected.has(person.id) && !center;
    return (
      <button
        key={person.id}
        type="button"
        role="option"
        aria-selected={checked}
        onClick={() => choosePerson(person.id)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-ninja text-sm font-semibold text-ninja-navy hover:bg-ninja-bg active:scale-[0.98] transition-[background-color,transform] duration-150"
      >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ninja-bg text-[10px] font-black text-ninja-muted">
          {initials(person.display_name)}
        </span>
        <span className="min-w-0 flex-1 truncate">{person.display_name}</span>
        <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-ninja-blue bg-ninja-blue text-white' : 'border-ninja-border'}`}>
          {checked && <CheckIcon size={11} strokeWidth={3} aria-hidden="true" />}
        </span>
      </button>
    );
  };

  const directors = people.filter((person) => person.role !== 'sensei');
  const senseis = people.filter((person) => person.role === 'sensei');

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={compact
          ? 'flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-1 -mx-2 font-ninja text-xs text-ninja-muted hover:border-ninja-border hover:text-ninja-navy transition-colors'
          : 'flex w-full items-center justify-between gap-2 rounded-xl bg-white border border-ninja-border px-3 py-2.5 font-ninja text-sm text-ninja-navy hover:border-ninja-blue transition-colors'}
      >
        <span className="truncate">{summary}</span>
        <ChevronDownIcon size={14} strokeWidth={2.25} className="flex-shrink-0 text-ninja-muted" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          className={`absolute left-0 top-[calc(100%+0.35rem)] z-40 max-h-72 w-64 overflow-y-auto p-1.5 ${PANEL}`}
        >
          <button
            type="button"
            role="option"
            aria-selected={center}
            onClick={chooseCenter}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-ninja text-sm font-semibold text-ninja-navy hover:bg-ninja-bg active:scale-[0.98] transition-[background-color,transform] duration-150"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ninja-bg text-ninja-muted">
              <Building2Icon size={14} strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 truncate">{centerName}</span>
            <span className={`flex h-4 w-4 items-center justify-center rounded border ${center ? 'border-ninja-blue bg-ninja-blue text-white' : 'border-ninja-border'}`}>
              {center && <CheckIcon size={11} strokeWidth={3} aria-hidden="true" />}
            </span>
          </button>

          {directors.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-2 font-ninja text-[10px] font-extrabold uppercase tracking-[0.08em] text-ninja-muted">Center Directors</p>
              {directors.map(row)}
            </>
          )}
          {senseis.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-2 font-ninja text-[10px] font-extrabold uppercase tracking-[0.08em] text-ninja-muted">Senseis</p>
              {senseis.map(row)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
