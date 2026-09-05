import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { CheckIcon, ChevronRightIcon, LockKeyholeIcon, SparklesIcon, XIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CREATE_STICKERS, stickerRequirement, stickersForBelt } from '../../lib/createStickers';
import { wholeBook } from '../../lib/stickerBook';
import { useCurriculum } from '../../context/CurriculumContext';
import { useStickerRarity } from '../../lib/stickerRarity';
import { levelInfo } from '../../lib/createCurriculum';
import { Group } from './ParentUI';
import { fmtDay } from '../../lib/parentProgress';
import ModalPortal from '../ui/ModalPortal';
import { Tilt, TiltLayer } from '../ui/Tilt';

// The IMPACT level badges as a sticker album, one per level of the belt.
//
// The artwork is a physical thing: die-cut, white-rimmed, the kind of sticker
// that ends up on a water bottle. So the cards behave like one, through the
// shared `ui/Tilt` primitive: the card tilts under the pointer, the sticker
// floats above it on its own Z plane, and a light catches the surface where
// the pointer is, the same way it would on vinyl. Tilt carries the rules that
// keep that safe next to a layout animation; read its header before changing
// any of it.
//
// Clicking a sticker zooms it. The image is one element with a shared
// `layoutId`, so framer flies the actual sticker off the card and into the
// dialog rather than cross-fading a copy of it. The dialog panel fades without
// scaling, because a scaling ancestor distorts the child mid-flight.
//
// Everything here is decoration until it isn't: with prefers-reduced-motion
// the tilt, the float and the flight are all skipped and the dialog simply
// appears.
//
// Each sticker also wears how rare it is — Common through Legendary, worked
// out from the share of the dojo who have earned it (lib/stickerRarity). It is
// the one thing on a sticker that is not about this ninja, and it is on the
// locked ones too: "Legendary" is a better reason to go and get a sticker than
// the level number that unlocks it. Rarity is allowed to be absent (a small
// roster, a failed request), and every surface below renders without it.

const TILT = 13;
const SPRING = { type: 'spring', stiffness: 320, damping: 26, mass: 0.5 };

// The poster's own words for the level a sticker belongs to: its name
// ("Nested Block Statements!") and the open build at the end of it.
//
// This is what the dialog says instead of a blurb. Every sticker used to carry
// a hand-written sentence about what the ninja did to earn it. Those went with
// the invented titles they were written for: the badge now stands for the
// level, not for one in-game action nobody here can see, so the level's own
// poster copy is the description that is actually true of it.
function stickerLevel(item) {
  const info = levelInfo(item.belt, item.level);
  return info ? { topic: info.topic, quest: info.quest } : null;
}

// Opening a sticker is the same act in the album and in the book, down to
// handing focus back to the sticker that was clicked, so both call this.
// A locked sticker does not open. Clicking one shakes it the way a padlock
// shakes when it is pulled: a short horizontal rattle, over in half a second,
// no dialog. The card already prints what would unlock it, so there is
// nothing behind the lock worth opening, and a dialog that says "not yours
// yet" is a worse answer than the object refusing to move.
//
// Only `x` is animated. The card's tilt owns `rotate`, `rotateX`, `rotateY`
// and `scale` as motion values on the same element, and animating one of
// those from here would fight the spring holding it.
export function useLockedShake() {
  const controls = useAnimationControls();
  const still = useReducedMotion();
  const shake = useCallback(() => {
    if (still) return;
    controls.start({
      x: [0, -7, 6, -4.5, 3, -1.5, 0],
      transition: { duration: 0.42, ease: 'easeInOut' },
    });
  }, [controls, still]);
  return { controls, shake };
}

// The rarity word, in the tier's own colour. `size` is the only thing that
// changes between the album card and the smaller book sticker, so the two
// cannot drift apart in wording or colour.
export function RarityChip({ rarity, size = 'md' }) {
  if (!rarity) return null;
  const small = size === 'sm';
  return (
    <span
      className={`inline-flex items-center rounded-full font-ninja font-extrabold uppercase leading-none tracking-[0.07em] ${rarity.chip} ${small ? 'px-1.5 py-[3px] text-[9px]' : 'px-2 py-[4px] text-[10px]'}`}
    >
      {rarity.label}
    </span>
  );
}

export function useStickerZoom() {
  const [zoomed, setZoomed] = useState(null);
  const opener = useRef(null);

  const open = useCallback((item) => {
    opener.current = document.activeElement;
    setZoomed(item);
  }, []);

  // Focus goes back to the sticker that opened the dialog, not the top of the
  // page, once it has flown home.
  const close = useCallback(() => {
    setZoomed(null);
    const el = opener.current;
    if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
  }, []);

  return { zoomed, open, close };
}

// `requirement` is the line a LOCKED card shows, and it is a prop so this card
// can serve a set that is not CREATE. The module stickers say "6 of 10
// lessons", which is a better answer than any static sentence and is only
// knowable by the caller; CREATE's own "Complete White Belt Level 1" stays the
// default so nothing at that call site had to change.
export function StickerCard({ item, isEarned, onOpen, flat, rarity, requirement, earnedLabel }) {
  const locked = requirement || stickerRequirement(item);
  const { controls, shake } = useLockedShake();
  return (
    <motion.div animate={controls} className="flex">
    <Tilt
      as={motion.button}
      amount={TILT}
      glare={isEarned}
      disabled={flat}
      type="button"
      onClick={() => (isEarned ? onOpen(item) : shake())}
      aria-label={`${item.title}${rarity ? `, ${rarity.label}` : ''}, ${isEarned ? 'earned' : `locked, ${locked}`}`}
      style={{ background: isEarned ? 'rgb(var(--ninja-blue) / 0.045)' : 'rgb(var(--ninja-navy) / 0.025)' }}
      // A rarity chip is one more line, and the card reserves the height for
      // it only once it has one: rarity can fail to load, and a card holding
      // an empty row for a label that never arrives is worse than no label.
      className={`group relative flex w-full ${rarity ? 'min-h-[206px]' : 'min-h-[184px]'} flex-col items-center rounded-[18px] border border-ninja-navy/[0.07] px-3 pb-3 pt-4 text-center transition-shadow duration-200 hover:shadow-[0_22px_36px_-20px_rgb(6_13_26_/_0.55)] active:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ninja-blue/60`}
    >
      <div className="relative flex h-[88px] w-full items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
        {/* The rarest sticker in the book gets a light of its own, and only
            once it is actually on the page: a gold halo behind grayscale art
            reads as a bug rather than a prize. */}
        {isEarned && rarity?.key === 'legendary' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-[76px] w-[76px] rounded-full blur-[18px]"
            style={{ background: 'rgb(245 158 11 / 0.38)' }}
          />
        )}
        <TiltLayer depth={64} as={motion.span} className="inline-flex">
          <motion.img
            layoutId={flat ? undefined : `sticker-art-${item.id}`}
            src={item.src}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={`h-[82px] w-[82px] select-none object-contain ${isEarned ? 'drop-shadow-[0_8px_9px_rgb(6_13_26_/_0.16)]' : 'grayscale opacity-25'}`}
          />
        </TiltLayer>
        <TiltLayer
          depth={34}
          as={motion.span}
          aria-hidden="true"
          className={`absolute right-0 top-0 inline-flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm ${isEarned ? 'bg-emerald-500' : 'bg-ninja-navy/55'}`}
        >
          {isEarned
            ? <CheckIcon size={15} strokeWidth={3.2} />
            : <LockKeyholeIcon size={14} strokeWidth={2.6} />}
        </TiltLayer>
      </div>
      {rarity && (
        <TiltLayer depth={26} as={motion.span} className="mt-2 inline-flex">
          <RarityChip rarity={rarity} />
        </TiltLayer>
      )}
      <TiltLayer depth={18} as={motion.p} className={`${rarity ? 'mt-1.5' : 'mt-2'} font-ninja text-[13.5px] font-extrabold leading-tight ${isEarned ? 'text-ninja-navy' : 'text-ninja-navy/55'}`}>
        {item.title}
      </TiltLayer>
      <p className={`mt-1 font-ninja text-[11px] leading-snug ${isEarned ? 'font-bold text-emerald-600' : 'text-ninja-muted'}`}>
        {isEarned ? (earnedLabel || 'Earned') : locked}
      </p>
    </Tilt>
    </motion.div>
  );
}

// Only an earned sticker opens this now (a locked one rattles instead), but
// the locked half stays: it is one line, and it is the honest thing to show
// if another surface ever opens a sticker that has not been earned.
export function StickerZoom({ item, isEarned, onClose, flat, rarity, requirement, detail }) {
  const closeRef = useRef(null);
  const locked = requirement || stickerRequirement(item);
  // CREATE stickers describe themselves out of the belt curriculum. A module
  // sticker has no level behind it, so its caller hands the block in instead.
  const level = detail !== undefined ? detail : stickerLevel(item);

  // Escape closes, and Tab stays inside: the sticker album behind this is a
  // long grid of buttons, and a dialog you can tab out of leaves a keyboard
  // clicking things it cannot see. The panel holds one button, so the trap is
  // just "keep it here" rather than the cycle Modal.jsx runs.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        closeRef.current?.focus();
        return;
      }
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKeyDown);
    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = scroll;
    };
  }, [onClose]);

  return (
    <ModalPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-ninja-navy/50 p-4 backdrop-blur-[3px]"
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={item.title}
          // Opacity only. A panel that scales would drag the sticker's
          // shared-element flight out of shape on the way in.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="relative w-full max-w-[400px] rounded-[26px] bg-white p-6 pt-8 text-center shadow-[0_30px_70px_-20px_rgb(6_13_26_/_0.5)]"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ninja-muted transition-colors hover:bg-ninja-navy/[0.06] hover:text-ninja-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ninja-blue/60"
          >
            <XIcon size={18} strokeWidth={2.6} />
          </button>

          <motion.img
            layoutId={flat ? undefined : `sticker-art-${item.id}`}
            initial={flat ? { scale: 0.7, opacity: 0 } : undefined}
            animate={flat ? { scale: 1, opacity: 1 } : undefined}
            transition={SPRING}
            src={item.src}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={`mx-auto h-[172px] w-[172px] select-none object-contain ${isEarned ? 'drop-shadow-[0_18px_22px_rgb(6_13_26_/_0.22)]' : 'grayscale opacity-30'}`}
          />

          <h3 className="mt-4 font-ninja text-[21px] font-extrabold leading-tight text-ninja-navy">{item.title}</h3>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-ninja text-[11.5px] font-extrabold ${isEarned ? 'bg-emerald-500/12 text-emerald-600' : 'bg-ninja-navy/[0.06] text-ninja-muted'}`}>
              {isEarned ? <CheckIcon size={13} strokeWidth={3.2} /> : <LockKeyholeIcon size={12} strokeWidth={2.6} />}
              {isEarned ? 'Earned' : 'Not earned yet'}
            </span>
            <RarityChip rarity={rarity} />
          </div>

          {/* A locked sticker says what would unlock it. An earned one says
              nothing here at all: the chips above already said "Earned", and
              the level block below carries the only description we can stand
              behind. A sentence in this slot would have to be invented, which
              is the mistake this whole set replaced. */}
          {!isEarned && (
            <p className="mx-auto mt-3 max-w-[34ch] text-balance font-ninja text-[14px] leading-relaxed text-ninja-navy/85">
              {locked}
            </p>
          )}

          {/* The number behind the word, because "Legendary" on its own is a
              label someone could have picked. A share, never a headcount: how
              many ninjas are on the roster is the centers' business, not
              something to print on a sticker. It is a footnote to the copy,
              not a line above it. */}
          {rarity && (
            <p className="mt-2 font-ninja text-[12px] text-ninja-muted">
              {/* The cohort is named because it is not the whole dojo: a JR
                  sticker is measured against JR ninjas only, and "of ninjas"
                  would quietly claim a comparison nobody ran. */}
              {rarity.percent}% of {rarity.cohort ? `${rarity.cohort} ninjas` : 'ninjas'} have earned this sticker.
            </p>
          )}

          {level && (
            <div className="mt-4 rounded-[16px] px-4 py-3 text-left" style={{ background: 'rgb(var(--ninja-blue) / 0.06)' }}>
              <p className="font-ninja text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-ninja-blue">
                {/* CREATE names the belt and level; a set with neither hands
                    its own label in. Without this the module stickers printed
                    "undefined belt · Level undefined". */}
                {level.label || `${item.belt} belt · Level ${item.level}`}
              </p>
              <p className="mt-1 font-ninja text-[12.5px] font-bold text-ninja-navy/80">{level.topic}</p>
              {/* The quest is the level's own open build, printed off the
                  poster. Not every level has one (Yellow 4 and the Brown pixel
                  art levels close on a mastery mission instead), so it is only
                  drawn where the curriculum actually has the words. */}
              {level.quest && (
                <p className="mt-1.5 font-ninja text-[12px] leading-relaxed text-ninja-navy/70">{level.quest}</p>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}

// The sticker book: the newest stickers, stuck on a page.
//
// It lives on the ninja's profile, where the belt's spot art used to float
// loose on the banner. That art was decoration with nothing behind it (one
// IMPACT sticker on a Black belt, in the middle of the sky); the same
// pictures mean something once they are the ones this ninja earned, in the
// order they earned them. The belt they are on keeps its own album on the
// CREATE course, and the whole book is one tap away through the link at the
// bottom.
//
// Each sticker sits at its own small angle, the way a sticker ends up on a
// page, and turns off that angle under the pointer rather than from square.
// The angles are fixed per position, not random per render, so a sticker
// does not jump every time the page re-renders.
const BOOK_ANGLES = [-6, 4, -3, 7, -5];
const BOOK_COUNT = 5;

function BookSticker({ item, angle, onOpen, flat, rarity }) {
  const { controls, shake } = useLockedShake();
  return (
    <motion.div animate={controls} className="flex w-[31%] sm:w-[18.5%]">
      <button
        type="button"
        onClick={() => (item.earned ? onOpen(item) : shake())}
        aria-label={`${item.title}${rarity ? `, ${rarity.label}` : ''}, ${item.earned ? 'earned' : `locked, ${stickerRequirement(item)}`}`}
        className="group flex w-full flex-col items-center gap-1.5 rounded-[14px] px-1 pb-2 pt-1 text-center transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ninja-blue/60"
      >
        <Tilt
          as={motion.span}
          amount={14}
          scale={1.08}
          rest={angle}
          disabled={flat}
          className="inline-flex"
        >
          <img
            src={item.src}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={`h-[68px] w-[68px] select-none object-contain ${item.earned ? 'drop-shadow-[0_8px_10px_rgb(6_13_26_/_0.18)]' : 'grayscale opacity-25'}`}
          />
        </Tilt>
        <RarityChip rarity={rarity} size="sm" />
        <span className={`font-ninja text-[11.5px] font-extrabold leading-tight ${item.earned ? 'text-ninja-navy' : 'text-ninja-navy/55'}`}>
          {item.title}
        </span>
        {/* The date where the log has one, and nothing where it does not.
            It used to name the belt instead, which was a CREATE label under a
            book that now holds four programs, and a ninja imported at Green
            belt earned their White stickers before DojoLink ever saw them —
            so there is nothing honest to put there. The non-breaking space
            holds the line so a dated sticker and an undated one are the same
            height on the shelf. */}
        <span className="font-ninja text-[10.5px] leading-tight text-ninja-muted">
          {item.earned ? (item.earnedOn ? fmtDay(item.earnedOn) : '\u00a0') : item.requirement}
        </span>
      </button>
    </motion.div>
  );
}

// The book on a ninja's profile: the last few stickers they earned, out of
// every program's set rather than CREATE's alone. `logs` is ALL of their
// sessions now, not the CREATE ones — the module stickers are earned out of
// JR, Robotics and AI logs and filtering those out upstream is what used to
// make this card CREATE-only.
export function StickerBook({ belt, level, logs, href, className = '' }) {
  const flat = useReducedMotion();
  const rarity = useStickerRarity();
  const { curriculum, subPrograms } = useCurriculum() || {};
  const { zoomed, open, close } = useStickerZoom();
  const book = useMemo(
    () => wholeBook({ belt, level, logs, curriculum, subPrograms }),
    [belt, level, logs, curriculum, subPrograms]);
  const recent = useMemo(() => book.recent(BOOK_COUNT), [book]);
  const empty = recent.length === 0;
  // Nothing earned yet is not an empty state to apologise for: it is the
  // first sticker, shown as the thing to go and get.
  const shown = empty ? [book.next].filter(Boolean) : recent;

  return (
    <Group className={`relative ${className}`}>
      <div className="flex items-start justify-between gap-4 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-ninja-navy">
            <SparklesIcon size={17} strokeWidth={2.5} aria-hidden />
            <h2 className="font-ninja text-[17px] font-extrabold">Sticker book</h2>
          </div>
          <p className="mt-1 font-ninja text-[12.5px] text-ninja-muted">
            {empty
              ? 'The first one is waiting.'
              : `Newest first. Tap one to open it.`}
          </p>
        </div>
        <div className="flex-shrink-0 whitespace-nowrap pt-0.5 font-ninja text-[12px] font-extrabold text-ninja-blue">
          {book.earned.length} of {book.total} earned
        </div>
      </div>

      <div className="mx-3 mb-3 rounded-[18px] px-2 pb-3 pt-4 sm:mx-4" style={{ background: 'rgb(var(--ninja-blue) / 0.05)' }}>
        {/* Flex rather than a grid so a book holding one sticker centres it
            instead of pinning it to a column and leaving four empty. Three
            across on a phone, five on a desktop, whatever the count. */}
        <div className="flex flex-wrap justify-center gap-1">
          {shown.map((item, i) => (
            <BookSticker key={item.id} item={item} angle={BOOK_ANGLES[i % BOOK_ANGLES.length]} onOpen={open} flat={flat} rarity={rarity?.[item.id]} />
          ))}
        </div>
      </div>

      {href && (
        <Link
          to={href}
          className="flex items-center justify-center gap-1 border-t border-ninja-navy/[0.08] px-4 py-3 font-ninja text-[12.5px] font-extrabold text-ninja-blue transition-colors hover:bg-ninja-blue/[0.04]"
        >
          See all {book.total} stickers
          <ChevronRightIcon size={15} strokeWidth={3} aria-hidden />
        </Link>
      )}

      <AnimatePresence>
        {zoomed && (
          <StickerZoom
            key={zoomed.id}
            item={zoomed}
            isEarned={!!zoomed.earned}
            onClose={close}
            flat={flat}
            rarity={rarity?.[zoomed.id]}
            requirement={zoomed.requirement}
            detail={zoomed.detail}
          />
        )}
      </AnimatePresence>
    </Group>
  );
}

// The album on a belt's own page: the stickers for the belt the page is
// showing, and no others.
//
// It used to carry its own row of belt pills, which made two controls for one
// question — the belt road at the top of the page already says which belt you
// are looking at, and the two could disagree (open a Black belt page, find
// White's stickers under it). The road is the control; this follows it. A
// Degrees belt has no sticker art at all, so the card does not render rather
// than standing there empty.
// The course page's full grid of a belt's stickers.
//
// No link out to the sticker book from here. The book is one tap away on the
// profile, from the card that summarises it, and this page is already showing
// the stickers — a row at the bottom of a grid of stickers offering to go and
// see the stickers is a door back into the room you are standing in.
export default function StickerCollection({ belt, earnedIds, earnedTotal, childName }) {
  const { zoomed, open, close } = useStickerZoom();
  const flat = useReducedMotion();
  const rarity = useStickerRarity();

  const stickers = stickersForBelt(belt);
  if (!stickers.length) return null;

  const earnedHere = stickers.filter((item) => earnedIds.has(item.id)).length;

  return (
    <Group className="relative">
      <div className="flex items-start justify-between gap-4 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-ninja-navy">
            <SparklesIcon size={17} strokeWidth={2.5} aria-hidden />
            <h2 className="font-ninja text-[17px] font-extrabold">{belt} belt stickers</h2>
          </div>
          <p className="mt-1 font-ninja text-[12.5px] text-ninja-muted">
            {earnedTotal} of {CREATE_STICKERS.length} earned across CREATE. Tap one to open it.
          </p>
        </div>
        <div className="flex-shrink-0 whitespace-nowrap pt-0.5 font-ninja text-[12px] font-extrabold text-ninja-blue">
          {earnedHere} of {stickers.length} earned
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-3 pb-3 sm:grid-cols-3 sm:px-4 lg:grid-cols-5">
        {stickers.map((item) => (
          <StickerCard
            key={item.id}
            item={item}
            isEarned={earnedIds.has(item.id)}
            onOpen={open}
            flat={flat}
            rarity={rarity?.[item.id]}
          />
        ))}
      </div>

      <AnimatePresence>
        {zoomed && (
          <StickerZoom
            key={zoomed.id}
            item={zoomed}
            isEarned={earnedIds.has(zoomed.id)}
            onClose={close}
            flat={flat}
            rarity={rarity?.[zoomed.id]}
          />
        )}
      </AnimatePresence>
    </Group>
  );
}
