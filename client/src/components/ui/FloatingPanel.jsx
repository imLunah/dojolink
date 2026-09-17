import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import useRefuseNudge from '../../lib/useRefuseNudge';

// Spring rather than a curve, because a panel arriving is a physical thing and
// a spring settles the way one does. No bounce: nothing threw it, so overshoot
// would be decoration. It grows a little rather than travelling, which is what
// a sheet that belongs to the whole page does; leaving is the same path, run
// shorter.
const ENTER = { type: 'spring', bounce: 0, duration: 0.42 };
const LEAVE = { duration: 0.2, ease: [0.4, 0, 1, 1] };

// A sheet that opens over the middle of the page and leaves the page visible
// through it. Modal's sibling, not its replacement: a dialog is for a question
// that has to be answered before anything else can happen, and opening a task
// is not that.
//
// Which is why there is no backdrop and no focus trap. Both belong to a modal
// dialog, and wearing them here would make a panel that only looks
// non-blocking — `aria-modal="false"` says the rest of the page is still live,
// and it has to be true. Escape closes it and focus moves in on open and back
// to the card on close, because those are courtesies, not walls.
//
// It used to arrive docked along the right edge, where it read as a second
// region of the page rather than something laid on top of it. Centred and
// frosted, with the board still legible around and through it, it is obviously
// one thing in front of the work — and the middle of the screen is where you
// are already looking.
export default function FloatingPanel({
  isOpen,
  onClose,
  title,
  children,
  width = 'max-w-[26rem]',
  // A panel holding something unsaved refuses to be dismissed by a stray
  // press. The buttons inside it still close it — those are deliberate.
  canDismiss = true,
  guardHint = 'There are unsaved changes.',
  refuseSignal = 0,
}) {
  const panelRef = useRef(null);
  const returnFocusTo = useRef(null);
  const reduce = useReducedMotion();
  const { nudging, hinting, refuse } = useRefuseNudge(refuseSignal);

  // Held in a ref so the listeners below never need re-binding when either
  // changes, and so they always read the current answer rather than the one
  // that was true when the panel opened.
  const dismiss = useRef(null);
  dismiss.current = () => { if (canDismiss) onClose(); else refuse(); };

  useEffect(() => {
    if (!isOpen) return;

    // Anything the panel put on top of the page counts as part of the panel.
    // The note editor's link popover is portalled to the body so it can escape
    // the panel's scrollbox, which meant typing a URL into it landed outside
    // the panel and closed the whole thing mid-sentence.
    const outside = (target) => {
      if (!panelRef.current || !target || typeof target.closest !== 'function') return false;
      if (panelRef.current.contains(target)) return false;
      return !target.closest('[data-panel-layer]');
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); dismiss.current(); }
    };

    // A press anywhere else closes it. With no backdrop to click there is
    // nothing to catch that press, so the document is asked instead.
    //
    // It has to start AND end outside. Judging it on the press alone meant a
    // selection dragged out of the note, or a pointer that slipped off the
    // edge on its way to a button, read as leaving — and the panel went,
    // taking the sentence with it.
    let startedOutside = false;
    const onPointerDown = (e) => { startedOutside = outside(e.target); };
    const onPointerUp = (e) => {
      if (startedOutside && outside(e.target)) dismiss.current();
      startedOutside = false;
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    returnFocusTo.current = document.activeElement;
    // The panel itself, not its first field. A dialog that has to be dealt with
    // can put the cursor in a box; a panel that opened beside what you were
    // reading should not start typing at you.
    panelRef.current?.focus();
    return () => {
      const el = returnFocusTo.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
    };
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 pointer-events-none"
        >
        <motion.aside
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={typeof title === 'string' ? title : undefined}
          tabIndex={-1}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          exit={reduce
            ? { opacity: 0, transition: { duration: 0.18 } }
            : { opacity: 0, scale: 0.97, transition: LEAVE }}
          transition={reduce ? { duration: 0.2 } : ENTER}
          className={`pointer-events-auto w-full ${width} max-h-full focus:outline-none`}
        >
          <div className={`panel-glass relative max-h-full flex flex-col ${nudging ? 'panel-refuse' : ''}`}>
            <div className="panel-edge flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3.5">
              <h2 className="font-ninja text-lg font-bold text-ninja-navy truncate tracking-[-0.01em]">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center text-ninja-muted hover:text-ninja-navy hover:bg-white dark:hover:bg-white/10 transition-colors flex-shrink-0 active:scale-95"
              >
                <XIcon size={17} strokeWidth={2.25} />
              </button>
            </div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="flex-1 min-h-0 overflow-y-auto px-4 pb-4"
            >
              {children}
            </motion.div>

            {/* Why the press did nothing. It sits over the foot of the panel
                rather than pushing the form around, and leaves on its own. */}
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
        </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
