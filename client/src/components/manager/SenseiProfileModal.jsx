import { useState, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ModalPortal from '../ui/ModalPortal';
import StaffBadge from '../shared/StaffBadge';
import { formatDate } from '../../utils/dateUtils';

// Strip markdown syntax for compact one/two-line previews where rendered
// formatting would break the line-clamp.
function stripMarkdown(text = '') {
  return text
    .replace(/[*_`#>]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

// The staff profile is a desk: the ID card in front, and a sheet of paper
// tucked behind it carrying their progress logs. Selecting the paper brings
// it forward to read; selecting the card brings the card back. Nothing else
// is in the modal, because everything the old sections said is printed on
// one of the two objects.
//
// The paper is a physical object like the card: inline hex throughout, one
// look in both themes, because .dark .bg-white would turn a Tailwind-painted
// sheet slate.

const PAPER_W = 280;
const PAPER_H = 416;

// The desk's offsets — where the paper tucks, where the badge peeks — are
// tuned against this stage. Every other size scales the WHOLE desk instead of
// re-deriving any offset, so the composition is identical at every width and
// nothing can fall off a phone's edge. Desktops scale UP as far as the
// viewport's height allows (the badge is CSS-scaled inside anyway, so this
// costs nothing in sharpness); DESK_MAX_SCALE stops a big monitor turning
// the card into a poster.
const DESK_W = 400;
const DESK_H = 480;
const DESK_MAX_SCALE = 1.75;
// The widest the painted desk actually gets, measured across both views:
// card in front the ink spans about -117..+175 of the stage's centre, paper
// in front about -172..+140. Sizing against this instead of the stage lets a
// phone spend its width on the objects rather than the stage's empty margin;
// the stage itself may hang past the wrap, so the scroller clips x.
const DESK_FIT_W = 360;
// The overlay's padding plus a breath, kept clear above and below the panel.
const DESK_BREATH_H = 48;

const spring = { type: 'spring', damping: 26, stiffness: 260 };

function PaperSheet({ logs }) {
  return (
    <div
      className="flex flex-col font-ninja"
      style={{
        width: PAPER_W,
        height: PAPER_H,
        background: '#fdfdf8',
        color: '#1a2e4a',
        borderRadius: 10,
        boxShadow: '0 24px 48px -18px rgba(10, 20, 40, 0.4)',
        padding: '18px 18px 14px',
      }}
    >
      <div className="flex items-baseline justify-between" style={{ borderBottom: '1.5px solid rgba(26,46,74,0.15)', paddingBottom: 8 }}>
        <span className="font-black" style={{ fontSize: 15 }}>Progress Logs</span>
        <span className="font-bold" style={{ fontSize: 12, color: '#506690' }}>{logs.length}</span>
      </div>
      {logs.length === 0 ? (
        <p className="text-center" style={{ fontSize: 13, color: '#506690', marginTop: 48 }}>No progress logs yet.</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ marginTop: 4, scrollbarWidth: 'thin', scrollbarColor: 'rgba(26,46,74,0.25) transparent' }}>
          {logs.map((log, i) => (
            <div key={log.id} style={{ padding: '10px 0', borderBottom: i < logs.length - 1 ? '1px solid rgba(26,46,74,0.08)' : 'none' }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold" style={{ fontSize: 13 }}>{log.student_name}</span>
                <span className="flex-shrink-0" style={{ fontSize: 11, color: '#506690' }}>{formatDate(log.session_date)}</span>
              </div>
              {log.belt_level_at && (
                <p className="font-bold" style={{ fontSize: 11, color: '#006add', marginTop: 1 }}>
                  {log.belt_level_at}{log.belt_sublevel_at ? ` · Level ${log.belt_sublevel_at}` : ''}
                </p>
              )}
              {log.notes && (
                <p className="line-clamp-2" style={{ fontSize: 12, color: '#506690', lineHeight: 1.5, marginTop: 2 }}>
                  {stripMarkdown(log.notes)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SenseiProfileModal({
  isOpen, onClose, sensei, logs = [],
  isManager, isReadOnly, onEditLogin, onResetLogin, onRemove, onManageCenters, centers = [],
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // 'card' or 'logs': which of the two objects is in front.
  const [view, setView] = useState('card');
  const touchStartY = useRef(null);

  // Fit the fixed-size desk to the room the modal actually has: never wider
  // than the panel, never taller than what the viewport leaves after the
  // hint and the buttons.
  const deskWrapRef = useRef(null);
  const [deskScale, setDeskScale] = useState(1);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = deskWrapRef.current;
    if (!el) return;
    const fit = () => {
      // Everything in the panel that is not the desk (hint, buttons, shell
      // padding) is scale-independent, so it can be measured instead of
      // guessed: panel content height minus the desk's own box.
      const scroller = el.closest('[data-desk-scroller]');
      const chrome = scroller ? scroller.scrollHeight - el.offsetHeight : 150;
      // The panel itself is capped at 90vh, so the desk must fit the smaller
      // of that cap and the viewport minus the overlay's padding.
      const room = Math.min(window.innerHeight - DESK_BREATH_H, window.innerHeight * 0.9) - chrome - 8;
      setDeskScale(Math.min(
        DESK_MAX_SCALE,
        el.clientWidth / DESK_FIT_W,
        room / DESK_H,
      ));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [isOpen]);

  const isCD = sensei?.role === 'manager';
  const showActions = isManager && !isReadOnly;
  const heroBtn = 'px-3 py-1.5 rounded-lg text-xs font-ninja font-semibold transition-colors';

  const centerNames = (sensei?.location_ids || [])
    .map((id) => centers.find((c) => c.id === id)?.name)
    .filter(Boolean);

  const handleClose = () => {
    setConfirmingRemove(false);
    setView('card');
    onClose();
  };

  // Swipe-down-to-dismiss: only tracked from the header area
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    if (e.changedTouches[0].clientY - touchStartY.current > 80) handleClose();
    touchStartY.current = null;
  };

  const joinYear = sensei?.created_at
    ? new Date(sensei.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  const cardInFront = view === 'card';

  // Portalled to <body> like every other dialog: rendered in place it sits
  // inside the app shell's stacking context, and floating chrome portalled
  // above the shell (the admin pill) paints over the scrim regardless of z.
  return (
    <ModalPortal>
    <AnimatePresence>
      {isOpen && sensei && (
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      >
        {/* The panel is transparent and nearly viewport-wide, so it must NOT
            swallow clicks — visually its empty area IS the scrim. The two desk
            objects and the action row stop propagation themselves; everything
            else falls through to the overlay and closes. The card's drag can't
            leak here: the badge stage takes pointer capture, so its click
            fires inside the object and is stopped with it. */}
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="w-full sm:max-w-md lg:max-w-3xl flex flex-col"
          style={{ maxHeight: '90vh' }}
        >
         <div data-desk-scroller className="overflow-y-auto overflow-x-hidden flex-1 min-h-0">
          <div
            className="relative px-1 sm:px-4 pt-8 pb-4"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Large-tap drag handle — also closes on tap */}
            <button
              onClick={handleClose}
              className="absolute top-0 left-0 right-0 h-8 sm:hidden flex items-center justify-center z-10"
              aria-label="Close"
            >
              <span className="block w-10 h-1 rounded-full bg-white/40" />
            </button>

            {/* The desk. Touch stops here so handling either object can never
                read as the swipe-down-to-dismiss. The outer div is the fitted
                footprint; the inner one is always 400x480 and scales to it. */}
            <div
              ref={deskWrapRef}
              className="relative mx-auto"
              style={{ height: DESK_H * deskScale, maxWidth: DESK_W * DESK_MAX_SCALE }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
             <div
              className="absolute left-1/2"
              style={{ width: DESK_W, height: DESK_H, marginLeft: -DESK_W / 2, transform: `scale(${deskScale})`, transformOrigin: 'top center' }}
             >
              {/* The paper, tucked behind the card until selected. */}
              <motion.div
                className="absolute left-1/2 top-1/2"
                initial={false}
                animate={cardInFront
                  ? { x: -PAPER_W / 2 + 44, y: -PAPER_H / 2 - 6, rotate: 7, scale: 0.8 }
                  : { x: -PAPER_W / 2, y: -PAPER_H / 2 + 8, rotate: 0, scale: 1 }}
                transition={spring}
                style={{ zIndex: cardInFront ? 1 : 2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ pointerEvents: cardInFront ? 'none' : 'auto' }}>
                  <PaperSheet logs={logs} />
                </div>
                {cardInFront && (
                  <button
                    type="button"
                    onClick={() => setView('logs')}
                    className="absolute inset-0 rounded-lg"
                    aria-label={`Read the progress logs (${logs.length})`}
                  />
                )}
              </motion.div>

              {/* The badge. */}
              {/* Centring is baked into margins (badge stage at scale 0.62 is
                  234x347) so both animation states are plain numbers — framer
                  cannot tween a percentage into a calc(), it snaps. */}
              <motion.div
                className="absolute left-1/2 top-1/2"
                initial={false}
                animate={cardInFront
                  ? { x: 0, y: 0, rotate: 0, scale: 1 }
                  : { x: -108, y: 10, rotate: -9, scale: 0.55 }}
                transition={spring}
                style={{ zIndex: cardInFront ? 2 : 1, marginLeft: -117, marginTop: -173 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ pointerEvents: cardInFront ? 'auto' : 'none' }}>
                  <StaffBadge
                    name={sensei.display_name}
                    username={sensei.username}
                    avatar={sensei.profile_pic_url}
                    role={sensei.role === 'manager' ? 'Center Director' : 'Sensei'}
                    center={centerNames[0]}
                    scale={0.62}
                    details={[
                      { label: 'Joined', value: joinYear },
                      { label: 'Logs', value: logs.length },
                    ]}
                  />
                </div>
                {!cardInFront && (
                  <button
                    type="button"
                    onClick={() => setView('card')}
                    className="absolute inset-0"
                    aria-label="Bring the card back"
                  />
                )}
              </motion.div>
             </div>
            </div>

            <p className="font-ninja text-xs text-center mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {cardInFront
                ? 'Drag the card to turn it over. The paper behind it holds their logs.'
                : 'Tap the card to bring it back.'}
            </p>

            {showActions && (
              <div className="flex flex-wrap justify-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                <button className={`${heroBtn} bg-white/10 hover:bg-white/20 text-white`} onClick={() => { handleClose(); onResetLogin(); }}>
                  Reset Login
                </button>
                {onManageCenters && centers.length > 1 && (
                  <button className={`${heroBtn} bg-white/10 hover:bg-white/20 text-white`} onClick={() => { handleClose(); onManageCenters(); }}>
                    Manage Centers
                  </button>
                )}
                {!isCD && (
                  confirmingRemove ? (
                    <>
                      <button className={`${heroBtn} bg-ninja-red hover:opacity-90 text-white`} onClick={() => { onRemove(); handleClose(); }}>Confirm Remove</button>
                      <button className={`${heroBtn} bg-white/10 hover:bg-white/20 text-white`} onClick={() => setConfirmingRemove(false)}>Cancel</button>
                    </>
                  ) : (
                    <button className={`${heroBtn} bg-ninja-red/20 hover:bg-ninja-red/30 text-red-300`} onClick={() => setConfirmingRemove(true)}>Remove</button>
                  )
                )}
              </div>
            )}
          </div>
         </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
    </ModalPortal>
  );
}
