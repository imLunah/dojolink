import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { MoreHorizontalIcon } from 'lucide-react';
import { Liquid } from 'liquid-gooey';

// Gap between the trigger and the panel. Under the goo's blur that is close
// enough for the two to stay joined by a neck, so the menu reads as a drop
// hanging off the button rather than a box placed near it.
const GOO_GAP = 6;

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
// `step` names the page the render prop is showing ('actions', 'confirm').
// When it changes the new page slides in over the old one; going back to the
// first page slides the other way.
//
// The plain "..." menu is liquid (liquid-gooey): a drop of the panel's own
// colour swells under the trigger and the panel buds off it, joined by a neck.
// The surface is the goo, so the panel element itself stays transparent. A
// custom trigger keeps the plain frosted panel: a drop spreading out of a
// labelled pill or a class icon has no round shape to leave from.
export default function ActionMenu({ children, label = 'Actions', align = 'right', className = '', onClosed, trigger, triggerClassName, triggerStyle, step }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const reduce = useReducedMotion();
  const panelId = useId();
  const gooey = !trigger && !triggerClassName;

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

  // The page a menu opens on is "home"; any other step is further in, and
  // slides in from the right. Remembered per opening.
  const homeStep = useRef(step);
  const prevStep = useRef(step);
  const [dir, setDir] = useState(1);
  if (!open) homeStep.current = step;
  if (prevStep.current !== step) {
    const nextDir = step === homeStep.current ? -1 : 1;
    if (nextDir !== dir) setDir(nextDir);
    prevStep.current = step;
  }

  // The pressed item leaves with the page it was on, so focus would fall to
  // the body. Hand it to the first control on the page that arrived.
  useEffect(() => {
    if (!open) return;
    // The leaving page is still mounted while it slides out, so find the
    // arriving one by name.
    const current = panelRef.current?.querySelector(`[data-step="${CSS.escape(String(step ?? 'only'))}"]`);
    if (!current || current.contains(document.activeElement)) return;
    current.querySelector('button:not([disabled])')?.focus();
  }, [step, open]);

  // The drop under the trigger is the trigger's own size and corner.
  const [triggerBox, setTriggerBox] = useState({ w: 30, h: 30, r: 9999 });
  useLayoutEffect(() => {
    if (!open || !gooey || !triggerRef.current) return;
    const el = triggerRef.current;
    const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    setTriggerBox({ w: el.offsetWidth, h: el.offsetHeight, r });
  }, [open, gooey]);

  const pages = (
    <AnimatePresence initial={false} mode="popLayout" custom={dir}>
      <motion.div
        key={step ?? 'only'}
        data-step={step ?? 'only'}
        custom={dir}
        variants={{
          enter: (d) => (reduce ? { opacity: 0 } : { x: d * 48, opacity: 0 }),
          center: { x: 0, opacity: 1 },
          exit: (d) => (reduce ? { opacity: 0 } : { x: d * -48, opacity: 0 }),
        }}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      >
        {typeof children === 'function' ? children({ close }) : children}
      </motion.div>
    </AnimatePresence>
  );

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
        // Above the goo, which is painted behind it while the menu is open.
        className={triggerClassName ?? `relative z-[21] p-1.5 rounded-full transition-colors duration-150 hover:text-ninja-navy hover:bg-ninja-bg ${
          open ? 'text-ninja-navy bg-ninja-bg' : 'text-ninja-muted'
        }`}
      >
        {trigger ?? <MoreHorizontalIcon size={18} strokeWidth={2.25} />}
      </button>

      <AnimatePresence>
        {open && gooey && (
          <Liquid
            key="goo"
            blur={7}
            contrast={20}
            fill="var(--menu-surface)"
            shadow="0 0 0 1px rgba(15,23,42,0.07), 0 12px 28px rgba(15,23,42,0.16)"
            // Only the panel takes pointers; the rest of this box sits over
            // the trigger and must let it be pressed to close.
            className={`z-20 top-0 flex flex-col pointer-events-none ${
              align === 'right' ? 'right-0 items-end' : 'left-0 items-start'
            }`}
            // Liquid writes position: relative inline; the menu has to float.
            style={{ position: 'absolute', gap: GOO_GAP }}
          >
            <Liquid.Item observe>
              <motion.div
                aria-hidden="true"
                style={{ width: triggerBox.w, height: triggerBox.h, borderRadius: triggerBox.r }}
                initial={reduce ? false : { scale: 0.3 }}
                animate={{ scale: 1 }}
                exit={reduce ? { opacity: 0 } : { scale: 0.3, transition: { duration: 0.18, delay: 0.08, ease: [0.4, 0, 1, 1] } }}
                transition={{ type: 'spring', stiffness: 520, damping: 46 }}
              />
            </Liquid.Item>
            {/* Critically damped: the library's default size spring rings for
                half a second after every resize, which on a menu whose
                buttons were just pressed reads as the panel shaking. The
                droplet lead is cut down for the same reason. Both open
                springs above are damped to settle without overshoot too. */}
            <Liquid.Item morph={{ shape: true, contentBlur: 0, bounce: 0, speed: 1.3, advanced: { travel: 10, roundness: 0.5 } }}>
              <motion.div
                ref={panelRef}
                id={panelId}
                role="menu"
                aria-label={label}
                // Buds out of the drop under the trigger, so it grows from the
                // corner nearest it rather than from its own middle.
                style={{ transformOrigin: align === 'right' ? 'top right' : 'top left', borderRadius: 12 }}
                initial={reduce ? { opacity: 0 } : { scale: 0.2, y: -(triggerBox.h * 0.6) }}
                animate={reduce ? { opacity: 1 } : { scale: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { scale: 0.2, y: -(triggerBox.h * 0.6), transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                transition={{ type: 'spring', stiffness: 420, damping: 41 }}
                className="pointer-events-auto relative overflow-hidden min-w-[9.5rem] p-1"
              >
                {/* The words fade, never the surface: the goo is the surface. */}
                <motion.div
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.16, delay: reduce ? 0 : 0.06 } }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                >
                  {pages}
                </motion.div>
              </motion.div>
            </Liquid.Item>
          </Liquid>
        )}
        {open && !gooey && (
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
            {pages}
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
