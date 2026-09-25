import { useState, useRef, useEffect, useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { MoreHorizontalIcon } from 'lucide-react';

// A row's actions behind one glyph. Two icons sitting on every row compete with
// the row's own content; a single "..." asks nothing of the reader until they
// want something. It stays quiet by being muted and small, NOT by being faded:
// muted at half opacity lands around 2.3:1 on a dark card, which is under the
// 3:1 a control has to clear to be findable at all.
//
// `children` is a render prop so the consumer can swap the panel's contents for
// its own confirm step without the menu closing underneath it.
// `trigger` replaces the "..." glyph when the thing being pressed is itself the
// subject of the menu (a class icon opening the list of classes).
export default function ActionMenu({ children, label = 'Actions', align = 'right', className = '', onClosed, trigger, triggerClassName, triggerStyle }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const reduce = useReducedMotion();
  const panelId = useId();

  // `onClosed` lets the consumer drop any step it pushed into the panel, so
  // reopening the menu starts at the actions rather than mid-confirm.
  const close = ({ restoreFocus = true } = {}) => {
    setOpen(false);
    onClosed?.();
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = panelRef.current?.querySelectorAll('[role="menuitem"]');
      if (!items?.length) return;
      e.preventDefault();
      const list = Array.from(items);
      const at = list.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? at + 1 : at - 1;
      list[(next + list.length) % list.length].focus();
    };
    // Pointerdown, not click: a click listener fires before React's onClick on
    // an item inside the panel has run in some browsers.
    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      close({ restoreFocus: false });
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  // Keyboard users land on the first action instead of nowhere.
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector('[role="menuitem"]');
    first?.focus();
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        style={triggerStyle}
        className={triggerClassName ?? `p-1.5 rounded-full transition-colors duration-150 hover:text-ninja-navy hover:bg-ninja-bg ${
          open ? 'text-ninja-navy bg-ninja-bg' : 'text-ninja-muted'
        }`}
      >
        {trigger ?? <MoreHorizontalIcon size={18} strokeWidth={2.25} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label={label}
            // Scales out of the trigger it hangs from, not out of its own middle.
            style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -2 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -2 }}
            transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
            // Frosted glass, wherever the menu opens: the surface asking the
            // question outranks whatever it opened over, and what is behind it
            // should be colour rather than words. bg-white and the shadows stay
            // as the ground the glass rule paints over, and as the fallback if
            // backdrop-filter is unavailable.
            className={`absolute z-20 top-full mt-1 min-w-[9.5rem] p-1 rounded-xl bg-white border border-ninja-border shadow-lg dark:shadow-[0_12px_32px_rgb(0_0_0/0.45)] glass-panel glass-frost ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {typeof children === 'function' ? children({ close }) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// One row of the menu. Danger only colours the text until hover, so a
// destructive option is identifiable before the pointer lands on it.
export function MenuItem({ icon: Icon, children, onSelect, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg font-ninja text-sm text-left transition-colors duration-150 disabled:opacity-50 ${
        danger
          ? 'text-ninja-red hover:bg-red-50 dark:hover:bg-red-500/10'
          : 'text-ninja-navy hover:bg-ninja-bg'
      }`}
    >
      {Icon && <Icon size={15} strokeWidth={1.75} className="flex-shrink-0 opacity-70" aria-hidden="true" />}
      {children}
    </button>
  );
}
