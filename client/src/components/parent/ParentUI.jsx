import { createContext, useContext, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { CheckIcon, ChevronRightIcon, StarIcon } from 'lucide-react';
import { FLAT } from '../../lib/surfaces';
import { BELTS, PROGRAM_LOGOS, PROGRAM_BANNERS } from '../../utils/beltConfig';
import { Tilt } from '../ui/Tilt';
import { beltStickers } from '../../lib/createCurriculum';
import { PROGRAM_GRADIENTS } from '../../lib/programTheme';
import BeltIcon from '../ui/BeltIcon';
import useIsDesktop from '../../lib/useIsDesktop';

// The parent portal's small vocabulary, in one file so the pages read the same.
//
// The page is flat and the softness lives inside the cards: a white card with
// a hairline (FLAT), a hero in the program's own colour or art, tinted lists,
// and grouped rows with hairline separators. Program identity is pinned —
// CREATE and Robotics blue, JR purple — and never follows the theme accent.
// Secondary text is heavier rather than lighter, so it stays legible on a tint.

// Large title with a small line above it. On a phone it is the page's header;
// on desktop it is the title row, with the switcher beside it.
export function PageTitle({ eyebrow, title, right, className = '' }) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="text-ninja-muted font-ninja text-[13px] v2 truncate">{eyebrow}</p>}
        <h1 className="text-ninja-navy font-ninja font-extrabold text-[30px] sm:text-[34px] leading-[1.05] tracking-[-0.025em] truncate">{title}</h1>
      </div>
      {right && <div className="flex-shrink-0 pb-1">{right}</div>}
    </div>
  );
}

// The banner. A program's own art where it has some (Robotics, AI), else the
// program's pinned gradient. `size` 'card' sits inside a course or child card;
// 'page' is the top of a course opened on its own.
//
// Everything on a hero is white: the art is dark by construction (banners are
// overlaid, gradients are deep), so nothing here reads the belt colour to
// choose an ink.
export function Hero({ program, size = 'card', className = '', style = {}, children }) {
  const banner = PROGRAM_BANNERS[program];
  const gradient = PROGRAM_GRADIENTS[program] || PROGRAM_GRADIENTS.CREATE;
  // A page hero is the top of the screen at EVERY width now: it starts at the
  // very top, edge to edge, square along the top so no page shows at the
  // corners, and rounded only along the bottom. On desktop it used to be a
  // card sitting in the content column with page showing all around it, which
  // made the biggest thing on the page look like the smallest.
  //
  // Breaking out of that column is done with container units, not viewport
  // ones: `main` is already `container-type: inline-size`, so `100cqw` is the
  // width beside the nav and `calc(50% - 50cqw)` is the walk back out to its
  // left edge. `100vw` would reach under the sidebar and past the scrollbar.
  // The words do NOT go with it — they stay in an inner box the same width as
  // the content column, so the title still lines up with the cards below it
  // instead of drifting off to the far left of a wide screen. At lg that box
  // carries the hero's vertical padding rather than the banner doing it, so
  // the box is exactly as tall as the banner: art hung off it with `inset-y-0`
  // then spans the full height, and `right: calc(50% - 50cqw)` walks it back
  // out to the banner's own edge. Both halves of the gap, from one anchor.
  // 'block' is the same hero as a card on the page rather than at the top of
  // it: the page's own radius and the page hero's breathing room, but no
  // bleed to the screen edges.
  const pad = size === 'page'
    ? '-mx-4 sm:-mx-6 -mt-5 rounded-t-none rounded-b-[34px] px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 lg:mr-0 lg:ml-[calc(50%-50cqw)] lg:w-[100cqw] lg:-mt-7 lg:rounded-b-[40px] lg:p-0'
    : size === 'block'
      ? 'rounded-[22px] px-5 py-5 lg:rounded-[26px] lg:px-7 lg:py-6'
      : 'p-4 rounded-[18px]';
  // The banner art is an <img> zoomed 4%, not a background: the files carry
  // a hard band a few pixels wide along their edges, and the zoom crops it
  // off at every aspect ratio. Art and scrim sit at z -1 inside the hero's
  // own stacking context, so the children paint over them without a wrapper
  // (ChildCard lays the hero out as a flex of its direct children).
  return (
    <div className={`relative overflow-hidden text-white ${pad} ${className}`} style={{ background: gradient, isolation: 'isolate', ...style }}>
      {banner && (
        <>
          <img
            src={banner}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.04)', pointerEvents: 'none', zIndex: -1 }}
          />
          <div
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgb(6 13 26 / 0.72) 0%, rgb(6 13 26 / 0.45) 55%, rgb(6 13 26 / 0.25) 100%)', pointerEvents: 'none', zIndex: -1 }}
          />
        </>
      )}
      {size === 'page'
        ? <div className="lg:relative lg:max-w-6xl lg:mx-auto lg:px-6 lg:pt-14 lg:pb-12">{children}</div>
        : children}
    </div>
  );
}

// A page hero that stays where it is while the page rides up over it.
//
// The banner used to scroll away like any other block, which made the biggest
// thing on the page the first thing to leave it. Now the banner is the layer
// UNDERNEATH: it holds its place at the top of the screen and the rest of the
// page, carried on a `PageSheet`, slides up and covers it. Blue behind, page
// in front, and the lit edge between them says which is which.
//
// It renders as two siblings rather than a wrapper, and that is the whole
// trick: a sticky box can only travel inside its own parent, so a wrapper
// sized to the banner would pin it for nothing — it would be stuck to a box
// it already fills. The pinned box has to be a child of the tall thing, the
// page itself, which is why this goes straight inside the page's root element
// with the sheet as its sibling and nothing in between.
//
// The banner does not sit perfectly still while it is being covered: it
// drifts up at about a third of the page's speed and dims as it goes, the way
// a thing further off moves less and sits in more shadow. The drift is always
// slower than the sheet's, so the sheet's edge never uncovers the banner's
// bottom. Reduced motion gets the layering and none of the drift: the pinning
// is a fact about the page, the parallax is decoration.
//
// The zero-height mark before it carries the hero's own negative top margin,
// so it reads the banner's place on the page from a box that never moves —
// asking a pinned element where it is only ever gets the answer "the top".
// The hero it wraps should be handed `!mt-0` to give that margin up.
// How far the sheet has ridden over the banner, 0 to 1, shared by the pair so
// the sheet's edge can light up on the way in without measuring the page a
// second time.
const Covered = createContext(null);

export function PinnedHero({ children }) {
  const still = useReducedMotion();
  const mark = useRef(null);
  const box = useRef(null);
  const span = useRef({ top: 0, height: 0 });
  const covered = useMotionValue(0);
  const { scrollY } = useScroll();

  const settle = (y) => {
    const { top, height } = span.current;
    covered.set(height ? Math.min(Math.max((y - top) / height, 0), 1) : 0);
  };

  useEffect(() => {
    const el = box.current;
    if (!el || !mark.current) return undefined;
    // The refs are re-read on every call and checked, not captured once.
    //
    // A ResizeObserver fires when the thing it watches is REMOVED, and React
    // detaches refs on unmount immediately while this effect's cleanup — the
    // disconnect below — is deferred until after the next paint. So leaving a
    // page with a pinned banner left a window in which the observer ran with
    // both refs already null, and the read threw: "Cannot read properties of
    // null (reading 'getBoundingClientRect')", once for every such page you
    // navigated away from.
    const read = () => {
      const seen = box.current;
      const at = mark.current;
      if (!seen || !at) return;
      span.current = { top: at.getBoundingClientRect().top + window.scrollY, height: seen.offsetHeight };
      settle(window.scrollY);
    };
    read();
    // The banner's height moves with the width it is given and with the art
    // inside it, so it is watched rather than measured once on arrival.
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener('resize', read);
    return () => { ro.disconnect(); window.removeEventListener('resize', read); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMotionValueEvent(scrollY, 'change', settle);

  const y = useTransform(covered, (p) => -p * span.current.height * 0.32);
  const filter = useTransform(covered, (p) => `brightness(${1 - p * 0.34})`);

  return (
    <Covered.Provider value={covered}>
      <div ref={mark} aria-hidden className="h-0 -mt-5 lg:-mt-7" />
      <div ref={box} className="sticky top-0 z-0">
        <motion.div style={still ? undefined : { y, filter }}>{children}</motion.div>
      </div>
    </Covered.Provider>
  );
}

// The page, on a sheet that rides over the pinned banner.
//
// It is the page's own colour, so at rest it is invisible: the sheet's top
// edge sits exactly where the banner ends and page-on-page shows nothing. It
// only appears once it is over the blue.
//
// It bleeds to the edges of the content region the way a page hero does, for
// the same reason and by the same means (container units, not viewport ones),
// then puts the content column back inside itself so nothing below it moves.
//
// THE CORNERS. The sheet's top corners are cut the other way — scooped out
// rather than rounded off — and they are cut to exactly the radius the
// banner's bottom corners are rounded to. That one fact is what makes the
// join seamless: the scoop is the precise complement of the banner's corner,
// so wherever the sheet's edge happens to be, the blue above it still ends in
// a proper rounded corner. Two corners rounded the SAME way, which is what
// this was first, leave a lens of daylight between them that opens and closes
// as you scroll — the banner's curve falling away from the sheet's, with the
// page showing through the gap. There is no radius, matching or otherwise,
// that fixes that; the corner has to be cut the other way.
//
// The scoop is a radial gradient rather than a border radius because CSS
// rounds corners off and has no way to round one in. The circle sits at the
// corner box's top inner corner, page colour outside it and nothing inside,
// which paints the sliver the banner's corner vacates and leaves the corner
// itself clear.
//
// THE RIM. The sheet's edge is glass, the same material as the phone's nav
// capsule and the clear cards: a band the width of `--rim` along the whole
// silhouette, straight run and scooped corners alike, that is clear where it
// meets the banner and dissolves into paper by its inner edge. It bends what
// is behind it (#glassRim, a lens rather than a ripple) and lifts its
// saturation, which is what makes glass look lit rather than grey, with a
// one-pixel white lip along its outer edge where the light catches the bevel.
// The sheet's own paper starts a rim's width below its top so there is
// something behind the band to bend, and the paper of the silhouette is drawn
// with the same band cut out of it. One element, one filter, for the whole
// ribbon: as three pieces the filter clamped at each piece's own edge and
// left a seam where the corner met the run.
const SHEET = 'rgb(var(--ninja-bg))';
const BAND_OUTER = 'var(--lip)';
const BAND_INNER = 'calc(var(--lip) + var(--rim))';
// Corner boxes are a lip wide and a lip plus a rim tall, so the ring can run
// down past the sheet's top to meet the straight band at its full width.
const CORNER_L = `left top / var(--lip) calc(var(--lip) + var(--rim)) no-repeat`;
const CORNER_R = `right top / var(--lip) calc(var(--lip) + var(--rim)) no-repeat`;
const RUN = `var(--lip) 100% / calc(100% - 2 * var(--lip)) var(--rim) no-repeat`;

// The paper: the silhouette with the band cut out of it.
const PAPER = [
  `radial-gradient(circle at 100% 0%, transparent calc(${BAND_INNER} - 0.5px), ${SHEET} ${BAND_INNER}) ${CORNER_L}`,
  `radial-gradient(circle at 0% 0%, transparent calc(${BAND_INNER} - 0.5px), ${SHEET} ${BAND_INNER}) ${CORNER_R}`,
  // A shallow strip of the sheet itself, so the straight run of the edge has
  // something to cast from. It sits under the sheet's own top padding.
  `linear-gradient(${SHEET}, ${SHEET}) left bottom / 100% 12px no-repeat`,
].join(', ');

// The glass: a white lip on the outer edge, near-clear behind it, and solid
// paper by the inner edge — solid, not nearly, because the paper's shadow is
// cast from just under that edge and anything short of opaque there shows
// its hard top as a line.
const glassStops = (at) => `transparent calc(${at} - 0.5px), rgb(255 255 255 / 0.9) ${at}, rgb(255 255 255 / 0.9) calc(${at} + 1px), rgb(255 255 255 / 0.25) calc(${at} + 1.5px), ${SHEET} calc(${BAND_INNER} - 0.5px), transparent ${BAND_INNER}`;
const GLASS = [
  `radial-gradient(circle at 100% 0%, ${glassStops(BAND_OUTER)}) ${CORNER_L}`,
  `radial-gradient(circle at 0% 0%, ${glassStops(BAND_OUTER)}) ${CORNER_R}`,
  `linear-gradient(rgb(255 255 255 / 0.9) 0, rgb(255 255 255 / 0.9) 1px, rgb(255 255 255 / 0.25) 1.5px, ${SHEET} 100%) ${RUN}`,
].join(', ');
// Where the glass IS. The backdrop filter covers the element's whole box;
// this is what keeps it to the ribbon.
const ringMask = (at) => `transparent calc(${at} - 0.5px), #000 ${at}, #000 calc(${BAND_INNER} - 0.5px), transparent ${BAND_INNER}`;
const GLASS_MASK = [
  `radial-gradient(circle at 100% 0%, ${ringMask(BAND_OUTER)}) ${CORNER_L}`,
  `radial-gradient(circle at 0% 0%, ${ringMask(BAND_OUTER)}) ${CORNER_R}`,
  `linear-gradient(#000, #000) ${RUN}`,
].join(', ');

// `corner` follows whatever the banner above does. The ninja's profile banner
// rounds its bottom, so the sheet scoops to match; the home billboard is
// square on all four corners on purpose — it is a poster, not a header — and
// a scoop there would bite a curve out of artwork that has none.
export function PageSheet({ corner = 'rounded', className = '', children }) {
  const zero = useMotionValue(0);
  const covered = useContext(Covered) || zero;
  // The shadow is the sheet's edge lifting off the banner, so it belongs to
  // the moment the sheet starts to ride and not to the page at rest, where it
  // would only smudge the banner's bottom edge with grey. It is a drop-shadow
  // on the paper rather than a box-shadow on the sheet because a box-shadow
  // follows the box, which is square across the top: it would cut a hard
  // corner over the blue exactly where the corner is supposed to be seamless.
  // A drop-shadow follows what is actually painted, scooped corners included.
  // It is cast from the paper's edge, which is the band's inner edge, so it
  // is seen through the glass and bent with everything else behind it.
  const lift = useTransform(covered, (p) => `drop-shadow(0 -12px 16px rgba(6, 13, 26, ${(Math.min(p * 8, 1) * 0.4).toFixed(3)}))`);
  // The glass arrives with the shadow. At rest the band sits over the page's
  // own colour, and a lit rim on nothing is a stripe.
  const shine = useTransform(covered, (p) => Math.min(p * 8, 1));

  return (
    <div
      className={`relative z-10 -mx-4 sm:-mx-6 lg:ml-[calc(50%-50cqw)] lg:mr-0 lg:w-[100cqw] pt-4 lg:pt-5 ${corner === 'square' ? '[--lip:0px]' : '[--lip:34px] lg:[--lip:40px]'} [--rim:12px] lg:[--rim:14px] ${className}`}
      style={{ background: `linear-gradient(to bottom, transparent var(--rim), ${SHEET} var(--rim))` }}
    >
      {/* The edge: paper, glass and shadow, drawn as one shape. Clipped on
          three sides so the shadow only ever falls upward, onto the banner —
          never out past the sheet's own width and never down onto the page.
          The radius follows the banner's, 34 then 40. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 overflow-hidden"
        style={{ top: 'calc(-1 * (var(--lip) + 40px))', height: 'calc(var(--lip) + 40px + var(--rim) + 12px)' }}
      >
        <motion.div
          className="absolute inset-x-0 bottom-0"
          style={{ height: 'calc(var(--lip) + var(--rim) + 12px)', background: PAPER, filter: lift }}
        />
        <motion.div
          className="absolute inset-x-0 bottom-3"
          style={{
            height: 'calc(var(--lip) + var(--rim))',
            background: GLASS,
            // The shorthand, not mask-image: the layers carry a position, a
            // size and a repeat, and the longhand takes none of those — it
            // rejects the whole value and the filter runs over the entire
            // box, blurring the banner forty pixels up.
            WebkitMask: GLASS_MASK,
            mask: GLASS_MASK,
            backdropFilter: 'url(#glassRim) blur(2px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(2px) saturate(1.8)',
            opacity: shine,
          }}
        />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">{children}</div>
    </div>
  );
}

// The belt's own spot art, scattered across its banner the way the poster
// scatters it beside the ninjas: small white-rimmed stickers saying what the
// belt is about before a word is read.
//
// The slots are FIXED, not random. A scatter that reshuffles on every render
// makes the banner twitch as you walk the road, and a seeded random still has
// to be tuned to miss the words — so they are simply placed, once, in the
// empty band between the title on the left and the belt art on the right.
// Sizes and tilts vary because a grid of identical squares reads as a toolbar
// rather than as stickers dropped on a page.
//
// The band is shaped around the belt art, which moves with the window: its
// left edge sits far out on a wide screen but reaches in to about 60% of this
// box at 1024px, and it reaches FURTHEST at mid height, where the ninja's
// bandana juts out past the head. So the rightmost slot is also the highest
// one, up where the circle has curved away again, and the low slots stay
// left. Tuned against the narrowest desktop; a wide one just has more air.
//
// Belts that ship fewer stickers use fewer slots; the metal belts and Black
// have none and render nothing at all.
const STICKER_SLOTS = [
  { left: '32%', top: '40%', size: 48, rot: -11 },
  { left: '39%', top: '4%',  size: 44, rot: 9 },
  { left: '46%', top: '46%', size: 40, rot: -7 },
  { left: '51%', top: '12%', size: 50, rot: 13 },
  { left: '59%', top: '1%',  size: 42, rot: -6 },
];

// A phone has one gap and it is small: above the title, left of the belt,
// right of the back chip. Two stickers fit there and a third crowds it, so
// the belt's remaining art simply is not shown at this width.
//
// Both sit HIGH, because the belt is a circle centred in the banner and it is
// at its widest across the middle: a slot that clears it at 390px is touching
// it at 320px. Up near the top edge the circle has barely started, so the
// right-hand slot can sit further across than the mid-band would allow.
const STICKER_SLOTS_SM = [
  { left: '30%', top: '8%', size: 34, rot: -10 },
  { left: '52%', top: '3%', size: 30, rot: 9 },
];

export function BeltStickers({ belt }) {
  const desktop = useIsDesktop();
  const slots = desktop ? STICKER_SLOTS : STICKER_SLOTS_SM;
  const art = beltStickers(belt);
  if (!art.length) return null;
  return (
    // Absolute and inset, so the slots measure against the hero's own content
    // box and the whole cluster sits in the same layer as the belt art: above
    // the gradient, under every word. It comes after the belt in the markup,
    // so the stickers land in front of it rather than behind.
    <span
      aria-hidden
      className="pointer-events-none"
      style={{ position: 'absolute', inset: 0, zIndex: -1 }}
    >
      {art.slice(0, slots.length).map((src, i, all) => {
        // Spread whatever a belt has across the WHOLE band rather than
        // filling from the left: Red ships two stickers and Yellow three, and
        // taking the first slots each time left them huddled by the title
        // with a hole where the rest of the cluster should be.
        const last = slots.length - 1;
        const s = slots[all.length > 1
          ? Math.round((i * last) / (all.length - 1))
          : Math.round(last / 2)];
        return (
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute', left: s.left, top: s.top,
              width: s.size, height: s.size,
              transform: `rotate(${s.rot}deg)`,
              filter: 'drop-shadow(0 6px 12px rgb(6 13 26 / 0.45))',
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </span>
  );
}

// The badge on the right of a hero: the belt for CREATE, the program's logo
// for everything else. Both sit on the banner as they are, no disc and no
// ring: the art is the emblem.
export function Emblem({ program, belt, size = 64, tilt = false }) {
  const logo = PROGRAM_LOGOS[program];
  const art = (program === 'CREATE' && belt)
    ? <BeltIcon belt={belt} size={size} className="flex-shrink-0" />
    : logo
      ? <img src={logo} alt="" className="object-contain flex-shrink-0 drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)]" style={{ width: size, height: size }} />
      : null;
  if (!art) return null;
  // Same opt-in as LevelMedal: the emblem is the course's own art sitting on
  // the banner, so it turns under the pointer like the medals and the level
  // shots do. It is the belt itself for CREATE, which is why the tilt wraps
  // the emblem rather than the image inside it.
  if (!tilt) return art;
  return <Tilt amount={12} scale={1.06} className="inline-flex flex-shrink-0">{art}</Tilt>;
}

// The 40px program logo that leads a card header.
export function ProgramMark({ program, size = 40 }) {
  const logo = PROGRAM_LOGOS[program];
  return (
    <span className="inline-flex items-center justify-center rounded-[12px] flex-shrink-0 bg-ninja-bg border border-ninja-border" style={{ width: size, height: size }}>
      {logo ? <img src={logo} alt="" className="object-contain" style={{ width: size - 10, height: size - 10 }} /> : <span className="font-ninja font-black text-ninja-navy text-sm">{String(program || '?')[0]}</span>}
    </span>
  );
}

// The belt road: all thirteen belts in a row, the current one grown well past
// the others with the connectors behind it lit — the trail walked so far —
// and the ones ahead dimmed. No ring around the current belt: the size and
// the trail are the marker. `onHero` draws its labels and connectors in white
// for use on a blue banner; otherwise navy on white.
//
// It is a scroller on phones ONLY. Below lg the columns are a fixed width and
// the row is `max-content`, so thirteen belts run off the side and the road
// swipes (mouse users drag it: the scrollbar is hidden and a wheel is
// vertical, so without the drag only a trackpad could move it). At lg all
// thirteen are on screen at once and there is nothing to scroll.
//
// What stretches at lg is the CONNECTOR, between a floor of 34px and a
// ceiling of 64px, and that floor is the whole of what keeps the road
// breathing. Work it out and the connector's own length IS the gap between
// two resting belts: the column is 68px, the belt inside it is 30px, and the
// connector pulls 19px into the column at each end, so the arithmetic cancels
// to exactly the connector. Without a floor it collapsed to 8px on a narrow
// banner, and the grown belt — 58px in a 46px column at the time — actually
// overlapped its neighbour rather than merely crowding it.
//
// The ceiling matters at the other end: uncapped, thirteen belts spread
// across a wide banner into a long thin rule with beads on it.
//
// The 19px pull is what makes the line reach the belts instead of stopping at
// the column's edge, which had the road reading as thirteen separate dashes.
// Behind, not through: the belts are lifted with z-10, so where the line runs
// under the grown one it simply disappears.
//
// It stays `overflow-x-auto` at every width. Below lg it is a real scroller;
// at lg it only becomes one on a narrow desktop where 836px of road will not
// fit, and scrolling there beats spilling out of the banner.
export function BeltRoad({ current, selected, onSelect, onHero = false, compact = false, fit = false, className = '' }) {
  const idx = BELTS.findIndex((b) => b.name === current);
  // `current` is where the ninja actually IS — it lights the trail and decides
  // what is dimmed ahead. `selected` is only what is being LOOKED at, and it
  // is what grows. They are the same belt until somebody taps another one.
  const sel = BELTS.findIndex((b) => b.name === (selected || current));
  // The belts grew for the desktop banner, where the road has 1100px to live
  // in. A phone has a third of that and the road is a scroller, so it keeps
  // the smaller pair: at 30/58 on a 390px screen the current belt swallowed
  // its neighbours and the labels ran together. Asked in JS because these
  // numbers are inline styles and a spring target, not classes.
  const desktop = useIsDesktop();
  // `fit` is the phone road that has to hold all thirteen belts inside a
  // 390px screen without scrolling: smaller belts, tighter columns, and no
  // names under them (six characters at this pitch would collide, and the
  // page's own title already says which belt is open). Above lg it is the
  // desktop road unchanged, so one instance covers both.
  const tight = fit && !desktop;
  const icon = compact ? 22 : desktop ? 30 : tight ? 19 : 24;
  const cur = compact ? 36 : desktop ? 58 : tight ? 32 : 40;
  const line = onHero ? 'rgb(255 255 255 / 0.35)' : 'rgb(var(--ninja-navy) / 0.15)';
  const trail = onHero ? 'rgb(255 255 255 / 0.85)' : 'rgb(var(--ninja-navy) / 0.45)';
  const scroller = useRef(null);
  const drag = useRef(null);
  // Where the road is wider than its box, start it with the current belt in
  // view rather than always at White. Sets scrollLeft directly so the page
  // itself does not move.
  useEffect(() => {
    const el = scroller.current;
    if (!el || sel < 0 || el.scrollWidth <= el.clientWidth) return;
    const col = compact ? 40 : 50;
    const centre = sel * col + col / 2;
    el.scrollLeft = Math.max(0, centre - el.clientWidth / 2);
  }, [sel, compact]);
  const endDrag = () => { drag.current = null; };
  return (
    <div
      ref={scroller}
      onPointerDown={(e) => {
        const el = scroller.current;
        // Nothing to drag where the road already fits, which is every
        // desktop: without this the whole banner answers a press with a
        // grabbing cursor and then does not move.
        if (e.pointerType !== 'mouse' || !el || el.scrollWidth <= el.clientWidth) return;
        drag.current = { x: e.clientX, left: el.scrollLeft };
        scroller.current.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current || !scroller.current) return;
        scroller.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing lg:cursor-default lg:active:cursor-default select-none -mx-1 px-1 ${className}`}
      aria-label="Belt road" role={onSelect ? 'group' : 'img'}>
      <div className="flex items-start min-w-max pr-3 lg:pr-0">
        {BELTS.map((b, i) => {
          const state = idx < 0 ? 'ahead' : i < idx ? 'earned' : i === idx ? 'current' : 'ahead';
          const size = i === sel ? cur : icon;
          return (
            <div key={b.name} className="flex items-start">
              <Cell belt={b.name} onSelect={onSelect} isSel={i === sel} compact={compact} tight={tight}>
                {/* The icon springs between the two sizes rather than cutting
                    to them: the row's own height is pinned to the big size, so
                    the belts either side hold still while one grows. */}
                <span className="relative z-10 flex items-center justify-center" style={{ height: cur }}>
                  <motion.span
                    className="block"
                    initial={false}
                    animate={{ width: size, height: size }}
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                  >
                    <BeltIcon belt={b.name} style={{ width: '100%', height: '100%' }} dimmed={state === 'ahead'} />
                  </motion.span>
                </span>
                {!tight && (
                  <span className={`font-ninja mt-1 leading-none whitespace-nowrap ${compact ? 'text-[9px]' : 'text-[10px]'} ${i === sel ? 'font-extrabold' : 'font-bold'} ${onHero ? (state === 'ahead' ? 'text-white/45' : 'text-white') : (state === 'ahead' ? 'text-ninja-muted/60' : 'text-ninja-navy')}`}>
                    {b.name}
                  </span>
                )}
              </Cell>
              {/* At lg the CONNECTOR is what stretches, never the column:
                  give the columns the slack and each belt floats in the
                  middle of a wide empty cell with a stub of a dash pinned to
                  one side. The negative margins are what let the line reach
                  under the belts rather than stopping at the column's edge —
                  they are wider at lg because the gap either side of a belt
                  inside its column is wider there. */}
              {i < BELTS.length - 1 && (
                <span aria-hidden className={`block flex-shrink-0 lg:-mx-[19px] lg:flex-1 lg:min-w-[34px] lg:max-w-[64px] ${tight ? '-mx-[9px]' : '-mx-[11px]'}`} style={{ width: compact || tight ? 6 : 8, height: 2, background: i < idx ? trail : line, marginTop: cur / 2 - 1 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One belt's column. A plain div where the road is a picture, a button where
// it is a control — the same box either way, because a road that changed shape
// when it became clickable would read as two components.
function Cell({ belt, onSelect, isSel, compact, tight, children }) {
  // Wider at lg so the grown belt (58px) sits inside its own cell with room
  // to spare instead of bulging out over the two beside it. `tight` is the
  // phone road that fits: 34px columns, which with the connectors' negative
  // margins puts thirteen belts inside about 300px.
  const box = `flex flex-col items-center flex-shrink-0 ${compact ? 'w-10' : tight ? 'w-[34px] lg:w-[68px]' : 'w-[50px] lg:w-[68px]'}`;
  if (!onSelect) return <div className={box}>{children}</div>;
  return (
    <button
      type="button"
      onClick={() => onSelect(belt)}
      aria-pressed={isSel}
      aria-label={`Show the ${belt} belt`}
      className={`${box} rounded-xl py-0.5 -my-0.5 transition-opacity ${isSel ? '' : 'opacity-80 hover:opacity-100'}`}
    >
      {children}
    </button>
  );
}

// The medal a level is actually awarded with: one per belt colour, numbered,
// White 1 through Black 1. These are the original transparent artwork out of
// the franchise asset set rather than crops off a printed poster, so they are
// clean at the edges and sharp well past the size anything draws them. Only
// CREATE has them — the Degrees belts (Bronze, Silver, Platinum, Gold) are not
// in the IMPACT set, and neither is any other program, so `LevelMedal` returns
// null rather than guessing and the caller falls back to whatever it drew
// before. `ahead` dims a level the ninja has not reached, the same 25% and
// grayscale the belt road uses for belts still to come, so one visual rule
// covers both ladders.
//
// The files are the rosette and its two ribbon tails, and NOT the mint-and-teal
// ribbon that sits above the badge. That ribbon is undamaged, intentional art
// — the word LEVEL is printed over it on the poster — but on its own it reads
// as a medal somebody cut in half, which is exactly how it was reported. It is
// gone from every file. Below the star the same ribbon runs behind the badge
// and comes out as the tails, so nothing else is lost.
//
// Taking it off is fiddlier than a crop: the ribbon is wider than the star's
// top point, so its two teal corners stand up either side like ears and
// survive any crop that keeps the point. Do NOT re-cut these without erasing
// the ribbon rather than cropping to it.
const MEDAL_BELTS = new Set(['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black']);

export function hasLevelMedal(belt, level) {
  return MEDAL_BELTS.has(belt) && Number.isFinite(Number(level));
}

// `tilt` hands the medal to the shared 3D treatment: it turns under the
// pointer and lifts, like a medal being looked at rather than a picture of
// one. It is opt-in because the medal also appears at 18px inside a level
// pill, where a tilt would be a wobble on a control. The wrapper is a span so
// the medal stays valid inside a Row's own span, and it takes the caller's
// className: put layout (display, margins) on the caller's side of it.
export function LevelMedal({ belt, level, size = 40, ahead = false, tilt = false, className = '' }) {
  if (!hasLevelMedal(belt, level)) return null;
  const art = (
    <img
      src={`/levels/${belt.toLowerCase()}-${Number(level)}.png`}
      alt={`Level ${level}`}
      draggable={false}
      style={{ width: size, height: 'auto' }}
      className={`object-contain flex-shrink-0 ${ahead ? 'opacity-25 grayscale' : ''} ${tilt ? '' : className}`}
    />
  );
  if (!tilt) return art;
  return (
    <Tilt as={motion.span} amount={14} scale={1.07} className={`inline-flex flex-shrink-0 ${className}`}>
      {art}
    </Tilt>
  );
}

// Level pills (and kit pills, via `label`). `states` is levelStates() from parentProgress: done levels
// carry the medal that level is awarded with, the current one is solid, the
// ones ahead are quiet. On a hero the solid pill is white; on a card it is the
// CREATE blue. The solid fill slides between pills rather than blinking, so
// the eye follows the choice. `layoutId` must be unique per instance on screen.
//
// `belt` is what turns the done marker into the real medal, the same artwork
// the All levels list leads its rows with, so one earned level looks the same
// in both places. Without it (kit pills, and any program outside CREATE) there
// is no medal to draw and the check plus the number stand in.
//
// A pill showing its medal shows NOTHING ELSE: the medal has the level number
// printed on it, and a pill that draws both says the same thing twice. That
// leaves the button with no text, so the accessible name is set by hand and
// the medal stays hidden from screen readers.
export function LevelPills({ states, value, onChange, belt, onHero = false, layoutId = 'level-pill', className = '' }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} role="tablist" aria-label="Levels">
      {states.map((s) => {
        const selected = s.level === value;
        const medal = s.state === 'done' && hasLevelMedal(belt, s.level);
        const ink = onHero
          ? (selected ? 'text-[#0c3d99]' : s.state === 'done' ? 'text-white' : 'text-white/80')
          : (selected ? 'text-white' : s.state === 'done' ? 'text-ninja-navy' : 'text-ninja-muted');
        const rest = onHero
          ? (s.state === 'done' ? 'bg-white/30 border border-white/40' : 'bg-white/15 border border-white/25')
          : 'bg-ninja-bg border border-ninja-border';
        return (
          <button key={s.level} type="button" role="tab" aria-selected={selected} onClick={() => onChange?.(s.level)}
            aria-label={s.label ?? `Level ${s.level}`}
            className={`relative inline-flex items-center justify-center gap-1 h-9 min-w-[44px] rounded-[12px] font-ninja font-extrabold text-[13px] transition-colors duration-150 active:scale-95 ${medal ? 'px-2.5' : 'px-3.5'} ${selected ? '' : rest} ${ink}`}>
            {selected && (
              <motion.span layoutId={layoutId} transition={{ type: 'spring', stiffness: 480, damping: 36 }} aria-hidden
                className={`absolute inset-0 rounded-[12px] ${onHero ? '' : 'bg-ninja-blue'}`}
                // Inline on the hero: `.dark .bg-white` would turn the pill dark on the blue.
                style={onHero ? { background: '#ffffff' } : undefined} />
            )}
            <span className="relative z-10 inline-flex items-center gap-1">
              {medal ? (
                <span aria-hidden className="-my-1 inline-flex"><LevelMedal belt={belt} level={s.level} size={24} /></span>
              ) : (
                <>
                  {s.state === 'done' && <CheckIcon size={12} strokeWidth={3.2} aria-hidden />}
                  {s.label ?? s.level}
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// A grouped list. Optional eyebrow title and an action on the right. `tint`
// makes it a tinted card ('green', 'blue', 'lilac', 'amber') whose rows sit
// on a white inset.
// `bare` drops the card chrome and keeps the eyebrow and the rows. It is for a
// Group that is ALREADY inside a card: a white bordered box on a white
// bordered card is the pane-inside-a-pane the surfaces file warns about, and
// on screen it is two hairlines a few pixels apart around the same colour. The
// rows keep their own dividers, which is what actually says "list".
export function Group({ title, action, tint, bare = false, children, className = '' }) {
  return (
    <section className={`${bare ? '' : tint ? `tint-${tint} rounded-[22px]` : FLAT} overflow-hidden ${className}`}>
      {(title || action) && (
        <div className={`flex items-baseline justify-between px-4 pb-1 ${bare ? 'pt-0' : 'pt-3.5'}`}>
          {title && <p className={`font-ninja text-[11px] font-extrabold uppercase tracking-[0.08em] ${tint ? '' : 'text-ninja-muted'}`} style={tint ? { color: 'var(--tint-ink)' } : undefined}>{title}</p>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// One row of a Group. `lead` is a small square or dot on the left; `to` or
// `onClick` makes the row a link with a chevron.
// `chevron` says what the row does with the tap, because the arrow is the only
// thing on it that can: 'right' goes somewhere (the default, and what a link
// has always drawn), 'down' opens the row in place and turns to point at what
// it opened, and null is a row that happens to be clickable without either
// being true.
export function Row({ lead, title, subtitle, trailing, to, onClick, dim = false, first = false, inset = false, active = false, chevron = 'right', expanded = false }) {
  const inner = (
    <>
      {lead && <span className="flex-shrink-0">{lead}</span>}
      <span className="min-w-0 flex-1">
        <span className={`block font-ninja font-extrabold text-[15px] truncate ${dim ? 'text-ninja-navy/60' : 'text-ninja-navy'}`}>{title}</span>
        {subtitle && <span className="block font-ninja text-[12.5px] text-ninja-muted v2 truncate">{subtitle}</span>}
      </span>
      {trailing}
      {(to || onClick) && chevron && (
        <ChevronRightIcon
          size={16}
          aria-hidden
          className={`text-ninja-muted/60 flex-shrink-0 transition-transform duration-200 ${chevron === 'down' ? (expanded ? 'rotate-[-90deg]' : 'rotate-90') : ''}`}
        />
      )}
    </>
  );
  const cls = `flex items-center gap-3 px-4 py-3 ${first ? '' : 'border-t border-ninja-navy/[0.08]'} ${inset ? 'tint-inset' : ''} ${active ? 'bg-ninja-blue/[0.06]' : ''} ${to || onClick ? 'hover:bg-ninja-navy/[0.03] active:bg-ninja-navy/[0.06] transition-colors' : ''}`;
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} w-full text-left`}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

// The little square that leads a row: a number, an initial, a glyph.
export function Tile({ children, tint = 'rgb(var(--ninja-blue) / 0.12)', color, size = 30 }) {
  return (
    <span className="inline-flex items-center justify-center rounded-[9px] font-ninja font-extrabold text-[13px]"
      style={{ width: size, height: size, background: tint, color: color || 'rgb(var(--ninja-blue-ink))' }}>
      {children}
    </span>
  );
}

// The bullet on a project row: done, working on it, not yet, or the
// Adventure's star.
export function StatusDot({ status, adventure = false }) {
  if (status === 'done') {
    return <span className="w-[26px] h-[26px] rounded-full bg-green-500 inline-flex items-center justify-center"><CheckIcon size={13} className="text-white" strokeWidth={3.2} aria-hidden /></span>;
  }
  if (status === 'working') {
    return <span className="w-[26px] h-[26px] rounded-full border-[2.5px] border-ninja-blue inline-flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-ninja-blue" /></span>;
  }
  if (adventure) {
    return <span className="w-[26px] h-[26px] rounded-full border-2 border-ninja-navy/20 inline-flex items-center justify-center"><StarIcon size={12} className="text-ninja-navy/40" aria-hidden /></span>;
  }
  return <span className="w-[26px] h-[26px] rounded-full border-2 border-ninja-navy/20 inline-block" />;
}

// The status word at the end of a row.
export function StatusText({ status }) {
  const map = {
    done: ['Completed', '#15803d'],
    Completed: ['Completed', '#15803d'],
    working: ['Working on', 'rgb(var(--ninja-blue-ink))'],
    'Working On': ['Working on', 'rgb(var(--ninja-blue-ink))'],
    Started: ['Started', 'rgb(var(--ninja-blue-ink))'],
    club: ['Club', '#7e22ce'],
  };
  const [text, color] = map[status] || [status, 'rgb(var(--ninja-muted))'];
  return <span className="font-ninja text-[12px] font-extrabold flex-shrink-0" style={{ color }}>{text}</span>;
}

// A quiet link with a chevron: "Full profile ›", "All 24 sessions ›".
//
// `onHero` is the same link sitting on a banner. Everything on a hero is
// white (the art is dark by construction), and the blue ink it carries on
// paper disappears into the gradient.
export function MoreLink({ to, children, onHero = false, className = '' }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-0.5 font-ninja text-[13px] font-extrabold hover:underline ${onHero ? 'text-white' : 'text-ninja-blue-ink'} ${className}`}>
      {children}
      <ChevronRightIcon size={15} strokeWidth={2.6} aria-hidden />
    </Link>
  );
}

// A round back button for the top of a page hero.
export function BackChip({ to, label = 'Back' }) {
  return (
    <Link to={to} aria-label={label}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/20 border border-white/35 text-white">
      <ChevronRightIcon size={18} strokeWidth={2.6} className="rotate-180" aria-hidden />
    </Link>
  );
}
