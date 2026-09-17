import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SlidersHorizontalIcon } from 'lucide-react';
import { COLUMNS } from '../../lib/taskBoard';
import useRefuseNudge from '../../lib/useRefuseNudge';

const WIDTH = 36; // rem

// How the liquid travels. The head is thrown and settles; the tail lets go a
// beat later, which is what makes the two read as one thing pulling apart
// rather than two things fading.
const HEAD = { type: 'spring', bounce: 0.18, duration: 0.5 };
const TAIL = { duration: 0.34, ease: [0.4, 0, 1, 1] };

// Typing a task, as one line rather than a form.
//
// It is the board's quick add and the column's + button arriving in the same
// place: a field to say what the task is, and the columns underneath it as a
// row to say where it goes. The form behind it still exists for a card that
// needs a date and an owner, one press away.
//
// It grows out of whatever was pressed. A control the size of a full stop and
// a sheet the size of a paragraph have nothing in common to animate between,
// so what travels is neither: a drop of liquid leaves the control, carries the
// distance, spreads into the sheet's shape, and the glass sets over it. The
// board already melts a card into the bin this way — same union of blurred
// shapes cut back to a hard edge, which rounds every corner it is handed, so a
// small rectangle leaves as a bead and a large one arrives as a panel without
// a single radius being animated.
export default function TaskComposer({ isOpen, origin, column = 'todo', onSubmit, onClose, onMore }) {
  const reduce = useReducedMotion();
  const [text, setText] = useState('');
  const [col, setCol] = useState(column);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const [rect, setRect] = useState(null);
  const { nudging, hinting, refuse } = useRefuseNudge();

  // A composer holding typed words is not thrown away by a stray press. Empty,
  // it is a glance, and a glance closes.
  const dismiss = useRef(null);
  dismiss.current = () => { if (text.trim()) refuse(); else onClose(); };

  useEffect(() => {
    if (!isOpen) return;
    setText('');
    setCol(column);
  }, [isOpen, column]);

  // The sheet's own rect, so the drop knows what shape to end up as. Measured
  // rather than assumed: its height is whatever the row of columns wraps to.
  useLayoutEffect(() => {
    if (!isOpen) { setRect(null); return; }
    const el = boxRef.current;
    if (el) setRect(el.getBoundingClientRect());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), reduce ? 0 : 220);
    return () => clearTimeout(t);
  }, [isOpen, reduce]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); dismiss.current(); }
    };
    let startedOutside = false;
    const outside = (target) => {
      if (!boxRef.current || !target || typeof target.closest !== 'function') return false;
      return !boxRef.current.contains(target);
    };
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

  const submit = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSubmit(col, value);
    onClose();
  };

  // Where the drop starts: the control that was pressed, in screen
  // coordinates, expressed as the transform that would put the sheet's box on
  // top of it. Origin at the top left corner so the two rects line up exactly.
  const flip = origin && rect
    ? {
      x: origin.left - rect.left,
      y: origin.top - rect.top,
      scaleX: Math.max(origin.width, 8) / rect.width,
      scaleY: Math.max(origin.height, 8) / rect.height,
    }
    : { x: 0, y: 0, scaleX: 0.9, scaleY: 0.6 };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 pointer-events-none">
          {/* The liquid. Solid colour and no content, because it lives inside
              an SVG filter: a frosted surface cannot, since the filter becomes
              the backdrop its blur would sample. So the drop is the accent the
              control was wearing, and the glass sets over it on arrival. */}
          {!reduce && rect && (
            // The fade belongs to the layer, not to the drops inside it. The
            // threshold that welds them together works on alpha, so a drop
            // told to fade comes back through the filter at full strength
            // until it vanishes all at once.
            <motion.div
              className="fixed inset-0 pointer-events-none"
              style={{ filter: 'url(#composerGoo)' }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0, transition: { delay: 0.32, duration: 0.22 } }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              <motion.div
                className="fixed bg-ninja-blue"
                style={{
                  left: rect.left, top: rect.top, width: rect.width, height: rect.height,
                  borderRadius: 28, transformOrigin: '0 0',
                }}
                initial={flip}
                animate={{
                  x: 0, y: 0, scaleX: 1, scaleY: 1,
                  transition: {
                    x: HEAD, y: HEAD,
                    scaleX: HEAD,
                    // A touch behind its partner, so the drop stretches along
                    // the way and rounds out as it lands instead of arriving
                    // as a rectangle that grew.
                    scaleY: { ...HEAD, duration: 0.58 },
                  },
                }}
              />
              {/* What stays behind on the control and pinches off. The neck
                  only exists while the two are within a couple of standard
                  deviations of each other, so it forms and breaks on its own
                  as the head pulls away. */}
              {origin && (
                <motion.div
                  className="fixed bg-ninja-blue"
                  style={{
                    left: origin.left, top: origin.top, width: origin.width, height: origin.height,
                    borderRadius: 28, transformOrigin: '50% 50%',
                  }}
                  initial={{ scale: 1 }}
                  animate={{ scale: 0, transition: TAIL }}
                />
              )}
            </motion.div>
          )}

          <motion.div
            ref={boxRef}
            role="dialog"
            aria-modal="false"
            aria-label="Add a task"
            className={`panel-glass relative pointer-events-auto w-full max-w-[calc(100vw-2rem)] p-4 ${nudging ? 'panel-refuse' : ''}`}
            style={{ width: `${WIDTH}rem` }}
            // Opacity only on the way in: the drop is what moves, and this
            // box is measured on its first frame to tell the drop where it is
            // going. A scale here would hand it a rect 2% too small.
            initial={{ opacity: 0 }}
            animate={reduce
              ? { opacity: 1 }
              : { opacity: 1, transition: { delay: 0.3, duration: 0.22, ease: [0.23, 1, 0.32, 1] } }}
            exit={reduce
              ? { opacity: 0, transition: { duration: 0.12 } }
              : { opacity: 0, scale: 0.97, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
          >
            <motion.form
              onSubmit={submit}
              initial={reduce ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0, transition: { delay: reduce ? 0 : 0.38, duration: 0.2 } }}
            >
              {/* One line, the size of the thing you came here to say. */}
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What needs doing?"
                aria-label="What needs doing?"
                maxLength={200}
                className="w-full bg-transparent border-0 px-1.5 py-1 font-ninja text-xl font-bold text-ninja-navy placeholder:text-ninja-muted placeholder:font-normal focus:outline-none"
              />

              <div className="panel-edge h-px my-3" />

              {/* Where it goes. The columns as a row, because a task is going
                  into one of three places and a row of three is quicker to
                  read than a menu that hides two of them. */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {COLUMNS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCol(c.key)}
                    aria-pressed={col === c.key}
                    className={`px-3 py-1.5 rounded-full font-ninja text-sm font-bold transition-colors duration-150 ${
                      col === c.key
                        ? 'bg-ninja-blue text-white'
                        : 'text-ninja-muted hover:text-ninja-navy bg-white/60 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/10'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}

                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onMore(col, text.trim())}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-ninja text-sm font-bold text-ninja-muted hover:text-ninja-navy transition-colors"
                  >
                    <SlidersHorizontalIcon size={14} strokeWidth={2.25} />
                    Details
                  </button>
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    className="px-3.5 py-1.5 rounded-full bg-ninja-blue text-white font-ninja text-sm font-bold disabled:opacity-40 transition-[opacity,transform] duration-150 active:scale-95"
                  >
                    Add
                  </button>
                </div>
              </div>
            </motion.form>

            <AnimatePresence>
              {hinting && (
                <motion.p
                  role="status"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute inset-x-3 -bottom-9 rounded-xl bg-ninja-navy text-ninja-bg px-3 py-2 font-ninja text-xs font-bold text-center shadow-lg"
                >
                  Press Enter to add it, or Escape to throw it away.
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          <svg width="0" height="0" aria-hidden="true" className="absolute pointer-events-none">
            <defs>
              {/* Blur everything, then cut the result back to a hard edge. Two
                  shapes near each other stop being two shapes, and any corner
                  it is handed comes back rounded — which is the whole trick:
                  the bead and the sheet are the same rectangle at two sizes,
                  and the filter is what makes one of them a drop. */}
              <filter id="composerGoo" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="soft" />
                <feColorMatrix
                  in="soft"
                  type="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 15 -6.5"
                />
              </filter>
            </defs>
          </svg>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
