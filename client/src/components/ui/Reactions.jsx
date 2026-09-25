import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SmilePlusIcon } from 'lucide-react';
import LazyEmojiPicker from '../shared/LazyEmojiPicker';
import { authorName } from '../../lib/authors';

// Emoji reactions, shared by the club board and the progress log. Each surface
// owns its own request and its own table; what lives here is the way they look
// and behave, so the two cannot drift into being nearly the same thing.

// Three, not a shelf of them. The row is a shortcut for the reactions that get
// used without thinking; the picker is one button away for everything else, and
// a shorter row leaves each glyph enough room to be read at a glance.
const QUICK_REACTIONS = ['👍', '❤️', '🎉'];

// What a chip says on hover. Past three names it stops listing, because the
// point of the tooltip is "who", not a roster.
export function reactionTitle({ emoji, names }) {
  const list = (names || []).map(authorName);
  if (!list.length) return `Reacted with ${emoji}`;
  const shown = list.slice(0, 3).join(', ');
  const rest = list.length - 3;
  return `${rest > 0 ? `${shown} and ${rest} more` : shown} reacted with ${emoji}`;
}

// Applied before the request goes out. The server answers with the whole set,
// so this only has to be right for the moment between click and response.
export function toggleLocally(list, emoji) {
  const at = list.findIndex((r) => r.emoji === emoji);
  if (at === -1) return [...list, { emoji, count: 1, reacted: true, names: [] }];
  const chip = list[at];
  if (chip.reacted) {
    if (chip.count <= 1) return list.filter((_, i) => i !== at);
    return list.map((c, i) => (i === at ? { ...c, count: c.count - 1, reacted: false } : c));
  }
  return list.map((c, i) => (i === at ? { ...c, count: c.count + 1, reacted: true } : c));
}

// The "+" that opens the full picker. Its own popover rather than an ActionMenu
// because the panel is a 320px grid with its own chrome, and ActionMenu's shell
// would draw a second card around it. The reply bar borrows it with its own
// glyph and name, since there it types an emoji rather than reacting with one.
export function EmojiPickerButton({ onPick, label = 'More reactions', icon: Icon = SmilePlusIcon, onClosed }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (e) => { if (!wrapRef.current?.contains(e.target)) { setOpen(false); onClosed?.(); } };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors duration-150 hover:text-ninja-navy hover:bg-ninja-navy/[0.06] dark:hover:bg-white/10 ${
          open ? 'text-ninja-navy bg-ninja-navy/[0.06] dark:bg-white/10' : 'text-ninja-muted'
        }`}
      >
        <Icon size={20} strokeWidth={2} />
      </button>
      {open && (
        <div className="absolute z-30 top-full right-0 mt-1" role="dialog" aria-label="Pick an emoji">
          <LazyEmojiPicker onPick={onPick} onClose={() => { setOpen(false); onClosed?.(); }} />
        </div>
      )}
    </div>
  );
}

// The quick row plus the picker. Rendered inside a row's action strip so both
// arrive on the same gesture rather than as two separate things.
//
// The quick three are desktop only: three emoji, a picker and a menu do not fit
// beside a name and a timestamp on a phone, and touch shows them all at once
// with no hover to hide behind. The picker still reaches every emoji there, and
// existing chips stay tappable either way.
export function ReactionPicker({ onPick }) {
  return (
    <>
      <span className="hidden sm:flex items-center gap-0.5">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            title={`React with ${emoji}`}
            aria-label={`React with ${emoji}`}
            className="w-8 h-8 flex items-center justify-center rounded-md text-xl leading-none transition-[background-color,transform] duration-150 hover:bg-ninja-navy/[0.06] dark:hover:bg-white/10 hover:scale-110"
          >
            <span aria-hidden="true">{emoji}</span>
          </button>
        ))}
      </span>
      <EmojiPickerButton onPick={onPick} />
    </>
  );
}

// Who reacted, on hover. The browser's own `title` was already carrying the
// names, but it waits a second to appear and styles itself, so for something
// you point at to answer one question it may as well not be there. This is the
// same sentence, immediately.
//
// Portalled and viewport-fixed: chips sit inside scrollers with their own
// overflow (the log history, the club board), which would clip a popover
// positioned against the chip.
function NamesTooltip({ tip }) {
  if (!tip) return null;
  return createPortal(
    <div
      role="tooltip"
      className="fixed z-50 pointer-events-none max-w-[16rem] rounded-lg border border-ninja-border bg-white px-2.5 py-1.5 font-ninja text-xs text-ninja-navy shadow-lg dark:shadow-[0_12px_32px_rgb(0_0_0/0.45)]"
      style={{ top: tip.top, left: tip.left, transform: 'translate(-50%, -100%)' }}
    >
      {tip.text}
    </div>,
    document.body
  );
}

// The chips under a row. These are NOT hover-revealed: a reaction nobody can
// see until they point at it is not worth leaving.
export function ReactionChips({ reactions, canReact, onToggle, className = 'mt-2' }) {
  const [tip, setTip] = useState(null);

  // Clamped so a chip at either edge of the window still shows its names.
  const show = (e, chip) => {
    const r = e.currentTarget.getBoundingClientRect();
    const margin = 8;
    const half = 128; // half of max-w-[16rem]
    setTip({
      text: reactionTitle(chip),
      top: r.top - 6,
      left: Math.min(Math.max(r.left + r.width / 2, margin + half), window.innerWidth - margin - half),
    });
  };
  const hide = () => setTip(null);

  // A wheel scroll leaves the pointer on the chip while the chip moves out from
  // under a tooltip pinned to the viewport. Capture, so inner scrollers count.
  useEffect(() => {
    if (!tip) return;
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tip]);

  if (!reactions?.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {reactions.map((chip) => (
        // The hover lives on a wrapper, not the button: a chip is disabled for
        // anyone who may not react, and a disabled button fires no mouse
        // events, so read-only viewers would never see whose reaction it is.
        <span
          key={chip.emoji}
          className="inline-flex"
          onMouseEnter={(e) => show(e, chip)}
          onMouseLeave={hide}
        >
          <button
            type="button"
            disabled={!canReact}
            onClick={() => onToggle(chip.emoji)}
            onFocus={(e) => show(e, chip)}
            onBlur={hide}
            aria-label={reactionTitle(chip)}
            aria-pressed={chip.reacted}
            className={`flex items-center gap-1 h-6 pl-1.5 pr-2 rounded-full border font-ninja text-xs font-semibold tabular-nums transition-colors duration-150 disabled:cursor-default ${
              chip.reacted
                ? 'border-ninja-blue bg-ninja-blue/10 text-ninja-blue-ink'
                : 'border-ninja-border text-ninja-muted enabled:hover:border-ninja-blue enabled:hover:text-ninja-navy'
            }`}
          >
            <span className="text-sm leading-none" aria-hidden="true">{chip.emoji}</span>
            {chip.count}
          </button>
        </span>
      ))}
      <NamesTooltip tip={tip} />
    </div>
  );
}

// The strip the actions sit on. One raised surface rather than loose glyphs, so
// they read as a tool belonging to the row under the pointer.
//
// `surface` is the caller's to choose, because a strip has to differ from the
// card it sits on and the two boards sit on opposite ones. Default ninja-bg
// suits a white card: off-white in light, darker than the card in dark. On a
// card that is ALREADY ninja-bg it would disappear, so those pass bg-white,
// which the .dark override turns into the lighter #252c3e. Neither value is
// right in both places; that is why it is a prop and not a constant.
//
// A button marked `data-dismisses-strip` (StripButton's `dismissesStrip`) puts
// the strip away when pressed, even with the pointer still on the row: after
// Reply the row's job is the reply bar, and the strip hanging over it is noise.
// It comes back the next time the pointer enters the row.
export function RowActions({ children, className = '', surface = 'bg-ninja-bg' }) {
  const ref = useRef(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!dismissed) return;
    const row = ref.current?.closest('.group');
    if (!row) return;
    const back = () => setDismissed(false);
    row.addEventListener('pointerleave', back);
    return () => row.removeEventListener('pointerleave', back);
  }, [dismissed]);

  return (
    <div
      ref={ref}
      onClick={(e) => { if (e.target.closest?.('[data-dismisses-strip]')) setDismissed(true); }}
      className={`row-actions ${dismissed ? 'row-actions-dismissed' : ''} flex-shrink-0 flex items-center gap-0.5 rounded-lg border border-ninja-border ${surface} px-1 py-0.5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

// A plain glyph button sized to sit in a strip beside the reaction picker, so
// anything a row wants to offer matches it instead of approximating it.
export function StripButton({ icon: Icon, label, active = false, onClick, dismissesStrip = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-dismisses-strip={dismissesStrip || undefined}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors duration-150 hover:text-ninja-navy hover:bg-ninja-navy/[0.06] dark:hover:bg-white/10 ${
        active ? 'text-ninja-navy bg-ninja-navy/[0.06] dark:bg-white/10' : 'text-ninja-muted'
      }`}
    >
      <Icon size={19} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

// ActionMenu's trigger fills with ninja-bg on hover, which is what RowActions is
// made of, so inside the strip that fill lands invisible. Any ActionMenu placed
// in a strip takes this on its className.
export const IN_STRIP_MENU =
  '[&>button:hover]:bg-ninja-navy/[0.06] dark:[&>button:hover]:bg-white/10 ' +
  '[&>button[aria-expanded=true]]:bg-ninja-navy/[0.06] dark:[&>button[aria-expanded=true]]:bg-white/10';
