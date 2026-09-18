import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CornerDownLeftIcon, SlidersHorizontalIcon } from 'lucide-react';
import { COLUMNS } from '../../lib/taskBoard';
import useRefuseNudge from '../../lib/useRefuseNudge';

const WIDTH = 36; // rem

const EASE_OUT = [0.23, 1, 0.32, 1];
const EASE_IN = [0.4, 0, 1, 1];

// Typing a task, as one line rather than a form.
//
// It is the board's quick add and the column's + button arriving in the same
// place: a field to say what the task is, and the columns underneath it as a
// row to say where it goes. The form behind it still exists for a card that
// needs a date and an owner, one press away.
//
// It opens where it is going to be, the way Spotlight does. Nothing travels
// from the control that was pressed: the sheet settles up out of a slightly
// smaller copy of itself while the glass thickens out of the board, and the
// cursor is already in the field.
export default function TaskComposer({ isOpen, column = 'todo', onSubmit, onClose, onMore }) {
  const reduce = useReducedMotion();
  const [text, setText] = useState('');
  const [col, setCol] = useState(column);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
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

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen]);

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

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 pointer-events-none">
          {/* The glass does not fade: a surface below full opacity stops
              sampling the board behind it, so it would arrive clear and frost
              over at the end. It thickens instead, through --glass, and only
              the words on it fade. */}
          <motion.div
            ref={boxRef}
            role="dialog"
            aria-modal="false"
            aria-label="Add a task"
            className={`panel-glass glass-ramp relative pointer-events-auto w-full max-w-[calc(100vw-2rem)] p-4 ${nudging ? 'panel-refuse' : ''}`}
            style={{ width: `${WIDTH}rem` }}
            initial={reduce ? false : { '--glass': 0, scale: 0.96 }}
            animate={{ '--glass': 1, scale: 1, transition: { duration: 0.22, ease: EASE_OUT } }}
            exit={reduce
              ? { '--glass': 0, transition: { duration: 0.1 } }
              : { '--glass': 0, scale: 0.98, transition: { duration: 0.14, ease: EASE_IN } }}
          >
            <motion.form
              onSubmit={submit}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.04, duration: 0.16, ease: EASE_OUT } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
            >
              {/* One line, the size of the thing you came here to say. */}
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What needs doing?"
                aria-label="What needs doing?"
                maxLength={200}
                // dark:hover kept transparent by hand: the dark-mode blanket
                // input rule only spares ghost fields while the pointer is
                // elsewhere, so without this the field grows a box the moment
                // it is hovered — on a frosted sheet, a patch of solid colour
                // behind the words.
                className="w-full bg-transparent dark:hover:bg-transparent border-0 px-1.5 py-1 font-ninja text-xl font-bold text-ninja-navy placeholder:text-ninja-muted placeholder:font-normal focus:outline-none"
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
                  {/* The key, named. Quick add is for getting a sentence onto
                      the board without moving your hands, so the control shows
                      the key that does it, as the glyph and the word together,
                      and nobody has to recognise the symbol. It is still a
                      button, for the times a pointer is already where it is. */}
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    aria-label="Add task"
                    title="Add task (Enter)"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-ninja text-sm font-bold bg-ninja-blue text-white disabled:opacity-40 transition-[opacity,transform] duration-150 active:scale-95"
                  >
                    <CornerDownLeftIcon size={14} strokeWidth={2.5} />
                    Enter
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

        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
