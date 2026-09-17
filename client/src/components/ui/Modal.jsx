import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import useRefuseNudge from '../../lib/useRefuseNudge';

// Elements a keyboard can land on. Used to keep Tab inside the dialog.
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Dialogs can nest (a calendar dialog opening a day-detail dialog), so the
// scroll lock is counted — the inner one closing must not unlock the page
// while the outer one is still up.
let scrollLocks = 0;

export default function Modal({
  isOpen, onClose, title, children, subheader, width = 'max-w-lg',
  // A dialog holding something unsaved declines to be dismissed by a press on
  // the backdrop or a stray Escape. Its own buttons still close it.
  canDismiss = true,
  guardHint = 'There are unsaved changes.',
  refuseSignal = 0,
}) {
  const panelRef = useRef(null);
  const returnFocusTo = useRef(null);
  const { nudging, hinting, refuse } = useRefuseNudge(refuseSignal);
  const dismiss = useRef(null);
  dismiss.current = () => { if (canDismiss) onClose(); else refuse(); };

  useEffect(() => {
    if (!isOpen) return;
    scrollLocks += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Escape to close, and Tab cycles within the dialog rather than walking the
  // page behind it. Listener is on the document so it works no matter where
  // focus currently sits.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); dismiss.current(); return; }
      if (e.key !== 'Tab') return;
      const items = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      // Focus escaped the panel (or never entered it) — pull it back in.
      if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Move focus in on open and hand it back to whatever opened the dialog on
  // close, so keyboard users don't get dropped at the top of the page.
  useEffect(() => {
    if (!isOpen) return;
    returnFocusTo.current = document.activeElement;
    const first = panelRef.current?.querySelector(FOCUSABLE);
    (first ?? panelRef.current)?.focus();
    return () => {
      const el = returnFocusTo.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      // The page behind a dialog goes soft as well as dark. Dimming alone
      // leaves it legible, and a page you can still read behind the thing
      // asking you a question is a page still competing with it.
      className="modal-backdrop fixed inset-0 z-[100] flex flex-col bg-ninja-bg sm:bg-black/40 sm:backdrop-blur-[3px] sm:items-center sm:justify-center sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss.current(); }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={`modal-panel relative w-full flex-1 flex flex-col overflow-hidden focus:outline-none sm:flex-none sm:max-h-[90dvh] sm:rounded-2xl sm:bg-ninja-bg sm:shadow-xl sm:border sm:border-ninja-border ${width} ${nudging ? 'panel-refuse' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Desktop header with × */}
        <div className="hidden sm:flex flex-shrink-0 items-center justify-between p-4 border-b border-ninja-border">
          <h2 className="text-xl font-bold font-ninja text-ninja-navy">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ninja-muted hover:text-ninja-navy transition-colors text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        {/* Mobile title row (no × — Done button at bottom is the close).
            The heading renders twice across breakpoints, so the accessible
            name comes from aria-label rather than pointing at one of them:
            aria-labelledby would go empty on whichever is display:none. */}
        <div className="flex-shrink-0 px-4 pt-4 pb-2 sm:hidden">
          <h2 className="text-xl font-bold font-ninja text-ninja-navy">{title}</h2>
        </div>
        {subheader && (
          <div className="flex-shrink-0 px-4 pt-1 pb-2">
            {subheader}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 pt-2">
          {children}
        </div>
        <div className="flex-shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2 border-t border-ninja-border sm:hidden">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-ninja-bg text-ninja-navy font-ninja font-semibold text-sm"
          >
            Done
          </button>
        </div>

        {/* Why the press did nothing, over the foot of the dialog. */}
        <AnimatePresence>
          {hinting && (
            <motion.p
              role="status"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="absolute inset-x-3 bottom-3 rounded-xl bg-ninja-navy text-ninja-bg px-3 py-2 font-ninja text-xs font-bold text-center shadow-lg"
            >
              {guardHint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>,
    document.body
  );
}
