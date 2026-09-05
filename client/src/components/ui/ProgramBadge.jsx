import { PROGRAM_LOGOS } from '../../utils/beltConfig';
import BeltIcon, { beltIconSrc } from './BeltIcon';
import { GraduationCapIcon } from 'lucide-react';

// Program class tags keep their OWN fixed identity colors — they do NOT follow
// the theme accent: JR = purple, Robotics + AI + CREATE = blue. No pill box —
// just the logo + colored name.
const PROGRAM_COLORS = {
  'CREATE':           { text: 'text-blue-600 dark:text-blue-300' },
  'Robotics Academy': { text: 'text-blue-600 dark:text-blue-300' },
  'AI Academy':       { text: 'text-blue-600 dark:text-blue-300' },
  'JR':               { text: 'text-purple-600 dark:text-purple-300' },
  'VR Coding':        { text: 'text-teal-600 dark:text-teal-300' },
};

const SIZE = {
  xs: { pad: 'text-xs gap-1',    img: 'w-4 h-4' },
  sm: { pad: 'text-sm gap-1.5',  img: 'w-5 h-5' },
  md: { pad: 'text-base gap-2',  img: 'w-6 h-6' },
};

const AVATAR = {
  xs: { cls: 'w-7 h-7', px: 28 },
  sm: { cls: 'w-11 h-11', px: 44 },
  md: { cls: 'w-14 h-14', px: 56 },
};

// Resolve the symbol image for a class: CREATE uses the ninja's belt icon when
// a belt is known; everything else uses the program logo.
const symbolSrc = (program, belt) => {
  if (program === 'CREATE' && belt) return beltIconSrc(belt);
  return (program && PROGRAM_LOGOS[program]) || null;
};

// Split layouts for multi-class avatars — one combined image, each class
// clipped to its own segment (2 = halves, 3 = half + quadrants, 4 = quadrants).
const SPLIT_CLIPS = {
  2: ['inset(0 51% 0 0)', 'inset(0 0 0 51%)'],
  3: ['inset(0 51% 0 0)', 'inset(0 0 51% 51%)', 'inset(51% 0 0 51%)'],
  4: ['inset(0 51% 51% 0)', 'inset(0 0 51% 51%)', 'inset(51% 51% 0 0)', 'inset(51% 0 0 51%)'],
};

// Bare transparent class symbol (no circle/frame). Pass `items`
// ([{ program, belt }]) for a ninja in multiple classes — the symbols are
// split-combined into ONE avatar instead of a row of icons. Falls back to a
// neutral "class" glyph when no program is set.
export function ProgramAvatar({ program, belt, items, size = 'md' }) {
  const s = AVATAR[size] || AVATAR.md;

  const multi = (items || []).filter((it) => symbolSrc(it.program, it.belt));
  if (multi.length > 1) {
    const shown = multi.slice(0, 4);
    return (
      <div title={shown.map((it) => it.program).join(' · ')} className={`${s.cls} relative flex-shrink-0`}>
        {shown.map((it, idx) => (
          <img
            key={it.program}
            src={symbolSrc(it.program, it.belt)}
            alt={it.program}
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ clipPath: SPLIT_CLIPS[shown.length][idx] }}
          />
        ))}
      </div>
    );
  }

  const single = multi[0] || { program, belt };
  if (single.program === 'CREATE' && single.belt) {
    return <BeltIcon belt={single.belt} size={s.px} className="flex-shrink-0" />;
  }
  const logo = single.program ? PROGRAM_LOGOS[single.program] : null;
  if (logo) {
    return (
      <img
        src={logo}
        alt={single.program}
        title={single.program}
        draggable={false}
        className={`${s.cls} object-contain flex-shrink-0`}
      />
    );
  }
  return (
    <div title="Class not set" className={`${s.cls} flex-shrink-0 flex items-center justify-center text-ninja-muted`}>
      <GraduationCapIcon className="w-2/3 h-2/3" />
    </div>
  );
}

export default function ProgramBadge({ program, size = 'sm' }) {
  if (!program) return null;
  const c = PROGRAM_COLORS[program] || { text: 'text-ninja-muted' };
  const logo = PROGRAM_LOGOS[program];
  const s = SIZE[size] || SIZE.sm;

  return (
    <span className={`inline-flex items-center font-ninja font-bold ${s.pad} ${c.text}`}>
      {logo && <img src={logo} alt="" className={`${s.img} object-contain flex-shrink-0`} />}
      {program}
    </span>
  );
}
