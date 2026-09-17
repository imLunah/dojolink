import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CornerDownLeftIcon, SlidersHorizontalIcon } from 'lucide-react';
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
          {/* The liquid, and it has no colour. What the filter is handed is
              alpha — plain opaque shapes — and what it gives back is a pane:
              a breath of white so the board reads through it, one bright line
              tracing the whole welded outline, and a darker line under that
              for thickness. Glass flowing into the shape of the sheet, rather
              than a coloured thing arriving and turning into one. */}
          {!reduce && rect && (
            // The fade belongs to the layer, not to the drops inside it. The
            // threshold that welds them together works on alpha, so a drop
            // told to fade comes back through the filter at full strength
            // until it vanishes all at once.
            <motion.div
              className="fixed inset-0 z-10 pointer-events-none"
              style={{ filter: 'url(#composerGooGlass)' }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0, transition: { delay: 0.32, duration: 0.22 } }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              <motion.div
                className="fixed bg-ninja-bg"
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
                  className="fixed bg-ninja-bg"
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

          {/* The sheet travels with the drop rather than fading in behind
              it. Fading was the seam: a surface at less than full opacity is
              its own backdrop root, so the frost had nothing to sample and the
              sheet arrived clear, then turned to glass all at once when the
              animation ended. Carrying it along under the liquid means the
              material is right from the first frame, and what the drop hands
              over to is already there.

              Two passes: the first is unmeasured and hidden, purely so the box
              can be asked how big it is; the key swaps in the animated one
              once the answer is known. The hidden pass is laid out and
              measured inside the same frame, so it is never painted. */}
          <motion.div
            key={rect ? 'placed' : 'measuring'}
            ref={boxRef}
            role="dialog"
            aria-modal="false"
            aria-label="Add a task"
            className={`panel-glass relative pointer-events-auto w-full max-w-[calc(100vw-2rem)] p-4 ${nudging ? 'panel-refuse' : ''}`}
            style={{
              width: `${WIDTH}rem`,
              transformOrigin: '0 0',
              visibility: rect || reduce ? 'visible' : 'hidden',
            }}
            initial={reduce || !rect ? false : flip}
            animate={reduce ? {} : {
              x: 0, y: 0, scaleX: 1, scaleY: 1,
              transition: {
                x: HEAD, y: HEAD,
                scaleX: HEAD,
                scaleY: { ...HEAD, duration: 0.58 },
              },
            }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
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
                  {/* The key, not the word. Quick add is for getting a
                      sentence onto the board without moving your hands, so the
                      control says which key does it rather than asking to be
                      aimed at. It is still a button, for the times a pointer
                      is already where it is. */}
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    aria-label="Add task"
                    title="Add task (Enter)"
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-ninja-blue text-white disabled:opacity-40 transition-[opacity,transform] duration-150 active:scale-95"
                  >
                    <CornerDownLeftIcon size={16} strokeWidth={2.5} />
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
              {/* Blur the alpha, then cut it back to a hard edge. Two shapes
                  near each other stop being two shapes, and any corner it is
                  handed comes back rounded — which is the whole trick: the
                  bead and the sheet are the same rectangle at two sizes, and
                  the filter is what makes one of them a drop.

                  What goes in is the sheet's own colour, so the drop is a
                  piece of the panel rather than a tinted stand-in for it, and
                  when it fades there is nothing to cross over to: the sheet
                  underneath is already the same thing in the same place.
                  Lifted from the card that melts into the bin, which had to
                  solve exactly this.

                  The intercept puts the threshold at half alpha (7.5/15), so
                  the silhouette comes back the size of the box that produced
                  it. Slopes that cross lower inflate every shape a few pixels,
                  and this one has to land exactly on the sheet. */}
              <filter id="composerGooGlass" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="soft" />
                <feColorMatrix
                  in="soft"
                  type="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 15 -7.5"
                  result="body"
                />
                {/* The union's own outline, taken off its alpha, minus an
                    eroded copy of itself: a ~2px line around the whole welded
                    shape, neck included, and a darker one under it for
                    thickness. One rim around both lobes is what says single
                    object. */}
                <feColorMatrix
                  in="body"
                  type="matrix"
                  values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
                  result="shape"
                />
                <feMorphology in="shape" operator="erode" radius="1.5" result="inner" />
                <feComposite in="shape" in2="inner" operator="out" result="rimA" />
                <feOffset in="rimA" dy="1.5" result="rimLoA" />
                <feFlood floodColor="#0f172a" floodOpacity="0.38" result="loC" />
                <feComposite in="loC" in2="rimLoA" operator="in" result="rimLo" />
                {/* Matched to the edge the settled sheet wears (a hairline at
                    ~0.09 white over its own shadow), not the bright outline a
                    goo filter wants to draw. Brighter and the drop reads as a
                    stroked cartoon shape rather than the panel in motion. */}
                <feFlood floodColor="#ffffff" floodOpacity="0.2" result="hiC" />
                <feComposite in="hiC" in2="rimA" operator="in" result="rimHi" />
                <feMerge>
                  <feMergeNode in="body" />
                  <feMergeNode in="rimLo" />
                  <feMergeNode in="rimHi" />
                </feMerge>
              </filter>
            </defs>
          </svg>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
