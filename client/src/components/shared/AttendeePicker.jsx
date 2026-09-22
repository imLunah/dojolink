import { SearchIcon, CheckIcon } from 'lucide-react';
import NinjaAvatar from '../ui/NinjaAvatar';

// Marking who was in the room. This list existed three times — the session
// page, the log form, and the panel's inline editor — and the three had already
// drifted: all of them inherited the same dark-mode bug (a `hover:bg-blue-50`
// the dark override never reached, so the row under the pointer went white
// with near-white text on it), and fixing it meant fixing it three times.
//
// A ninja is a face and a name, not a line of text with a square beside it. The
// checkbox is a circle on the right where the eye ends up after reading the
// name, rather than a box on the left it has to pass on the way in.
//
// The selected row is a tint, not a solid block of accent. A register is mostly
// selected by the time it is finished, and twenty solid blue bars is a wall.

function Row({ student, checked, onToggle, dense }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onToggle(student.id)}
      className={`w-full flex items-center gap-3 rounded-xl text-left transition duration-150 ease-[var(--ease-out)] active:scale-[0.99] motion-reduce:transition-none ${
        dense ? 'px-2 py-1.5' : 'px-2.5 py-2'
      } ${checked ? 'bg-ninja-blue/[0.10]' : 'hover:bg-ninja-navy/[0.04] dark:hover:bg-white/[0.05]'}`}
    >
      <NinjaAvatar
        name={student.full_name}
        sticker={student.codeorg_sticker}
        className={dense ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-[11px]'}
      />
      <span className={`font-ninja flex-1 min-w-0 truncate ${dense ? 'text-xs' : 'text-sm'} ${
        checked ? 'font-bold text-ninja-navy' : 'font-semibold text-ninja-muted'
      }`}>
        {student.full_name}
      </span>
      {/* A transition, not a keyframe: names get tapped in bursts, and a
          keyframe restarts from zero each time instead of retargeting from
          wherever the last one got to. */}
      <span
        aria-hidden="true"
        className={`rounded-full flex-shrink-0 flex items-center justify-center border transition duration-150 ease-[var(--ease-out)] motion-reduce:transition-none ${
          dense ? 'w-4 h-4' : 'w-5 h-5'
        } ${checked ? 'bg-ninja-blue border-ninja-blue text-white' : 'border-ninja-border text-transparent'}`}
      >
        <CheckIcon
          size={dense ? 11 : 13}
          strokeWidth={3}
          className={`transition duration-150 ease-[var(--ease-out)] motion-reduce:transition-none ${
            checked ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          }`}
        />
      </span>
    </button>
  );
}

export default function AttendeePicker({
  students,
  selectedIds,
  onToggle,
  search,
  onSearchChange,
  dense = false,
  maxHeight = 'max-h-72',
}) {
  const filtered = students.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2.5">
      {/* The glyph lives inside the field, so a search box stops looking like
          every other text input on the page. */}
      <div className="relative">
        <SearchIcon
          size={dense ? 14 : 16}
          strokeWidth={2.25}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ninja-muted pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search ninjas"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-xl pl-9 pr-3 font-ninja focus:outline-none focus:border-ninja-blue transition-colors duration-150 ${
            dense ? 'py-2 text-xs' : 'py-2.5 text-sm'
          }`}
        />
      </div>

      {/* The list used to carry a border, a fill and its own padding, which put
          three edges between a name and the card it sits in and clipped the
          first row through the middle. It is a plain scrolling column now; the
          rows are the only things with a shape. */}
      <div className={`${maxHeight} overflow-y-auto overscroll-contain -mx-1 px-1 py-0.5`}>
        {filtered.map((s) => (
          <Row
            key={s.id}
            student={s}
            checked={selectedIds.has(s.id)}
            onToggle={onToggle}
            dense={dense}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-ninja-muted font-ninja text-sm text-center py-6">No ninjas found.</p>
        )}
      </div>
    </div>
  );
}
