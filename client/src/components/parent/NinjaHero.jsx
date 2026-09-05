import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { Hero } from './ParentUI';
import BeltIcon from '../ui/BeltIcon';
import { ninjaSrc } from '../../utils/ninjas';

// The top of a ninja's profile: the child, at size, standing in their own
// banner.
//
// The page used to open on a line of text and go straight into cards, which
// told a parent nothing a list could not. This says who the ninja is before
// anything is read — their belt is the colour of the sash, their programs and
// their session count are the biggest numbers on the screen, and the art is
// the franchise's own 3D ninja rather than an avatar we invented.
//
// It is also the one place in the portal that plays back. The ninja follows
// the pointer a little, and tapping it makes it cheer. Nothing depends on
// either: both are decoration for a page a seven year old looks at over a
// parent's shoulder.
//
// `tone` is the ninja's skin tone, set per student by staff. Unset falls back
// to medium inside `ninjaSrc`, which is the tone the app shipped when there
// was only one, so a ninja nobody has touched is drawn exactly as before.


// A number that counts up to itself once, on arrival. Small enough to be worth
// it: the hero's three numbers are the only thing on the page a parent came to
// read, and a number that lands rather than appears is read rather than
// skimmed. Reduced motion gets the answer immediately.
function Counter({ value, className }) {
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? value : 0);
  useEffect(() => {
    if (still) { setShown(value); return; }
    const controls = animate(0, value, {
      duration: Math.min(0.9, 0.25 + value * 0.02),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, still]);
  return <span className={className}>{shown}</span>;
}

function Stat({ value, label, lead, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`min-w-0 ${className}`}
    >
      <div className="flex items-center gap-1.5">
        {lead}
        {typeof value === 'number'
          ? <Counter value={value} className="font-ninja font-extrabold text-[26px] lg:text-[30px] leading-none tracking-[-0.02em]" />
          : <span className="font-ninja font-extrabold text-[26px] lg:text-[30px] leading-none tracking-[-0.02em] truncate">{value}</span>}
      </div>
      <p className="font-ninja text-[11.5px] font-bold uppercase tracking-[0.08em] opacity-75 mt-1.5 truncate">{label}</p>
    </motion.div>
  );
}

export default function NinjaHero({ program, name, eyebrow, belt, level, tone, programCount, sessionCount, right, className = '' }) {
  const still = useReducedMotion();
  const [cheering, setCheering] = useState(false);
  const wrap = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Pointer parallax. Motion values rather than state: this runs on every
  // pointer move and a setState there would re-render the whole banner, chart
  // and all, sixty times a second.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 90, damping: 18, mass: 0.4 });
  const sy = useSpring(py, { stiffness: 90, damping: 18, mass: 0.4 });
  const ninjaX = useTransform(sx, (v) => v * 20);
  const ninjaY = useTransform(sy, (v) => v * 10);
  // The counter-drift that went with these belonged to the belt stickers,
  // which now live in the sticker book on the profile.

  const onMove = (e) => {
    if (still || e.pointerType === 'touch') return;
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { px.set(0); py.set(0); };

  const cheer = () => {
    setCheering(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCheering(false), 1500);
  };

  const first = String(name || '').trim().split(' ')[0] || 'this ninja';
  const beltLabel = belt ? `${belt}${level ? ` · level ${level}` : ''}` : null;

  return (
    <Hero program={program} size="page" className={className}>
      <div ref={wrap} onPointerMove={onMove} onPointerLeave={onLeave} className="relative">
        {/* The belt's spot art used to drift here, behind the ninja. It came
            off: on a Black belt it was one IMPACT sticker alone in the sky,
            decoration with nothing behind it. The same pictures now mean
            something a page down, in the sticker book, where they are the
            ones this ninja earned. `BeltStickers` still dresses the CREATE
            course banner, which is a belt's own page. */}

        {/* Above the ninja rather than beside it: the banner's corner is the
            only spot that stays clear of the art at every width, and the
            button carries its own surface so sitting over a raised arm reads
            as a control on top of a picture rather than a collision.
            
            At lg it sits 56px OUTSIDE the content column, in the banner's own
            margin. Anchored to the column it overlapped the ninja's box by a
            few pixels and read as pinned to the art; out here it is clear of
            it (the ninja's box ends at the column edge less its own 24px) and
            still close enough to belong to the banner rather than to the far
            corner of a wide screen. Phones keep the corner: there is no
            margin to move into. */}
        {right && <div className="absolute top-0 right-0 z-10 lg:right-[-56px]">{right}</div>}

        {/* The words reserve their own room with padding rather than sharing a
            flex row with the ninja: the cheer pose is a wider picture than the
            wave, so a ninja that took part in the layout would shove the name
            sideways every time somebody tapped it. */}
        <div className="min-h-[172px] sm:min-h-[196px] lg:min-h-[300px] pr-[124px] sm:pr-[208px] lg:pr-[300px]">
          <div className="min-w-0 h-full min-h-[inherit] flex flex-col justify-between gap-6">
            <div className="flex items-start justify-between gap-3">
              <motion.div
                className="min-w-0"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                {eyebrow && <p className="font-ninja text-[12px] font-extrabold uppercase tracking-[0.08em] opacity-85 truncate">{eyebrow}</p>}
                <h1 className="font-ninja font-extrabold text-[29px] sm:text-[44px] lg:text-[54px] leading-[0.95] tracking-[-0.03em] mt-1.5 break-words">
                  {name}
                </h1>
              </motion.div>
            </div>

            <div className="flex items-end gap-5 sm:gap-9">
              <Stat value={sessionCount} label="Sessions" delay={0.1} />
              {/* Two stats is all a phone fits before the labels start
                  truncating, and the programs are named in full in the
                  Courses section a scroll below. */}
              <Stat value={programCount} label={programCount === 1 ? 'Program' : 'Programs'} delay={0.16} className="hidden sm:block" />
              {beltLabel && (
                <Stat
                  value={belt}
                  label={level ? `Level ${level}` : 'Belt'}
                  delay={0.22}
                  lead={<BeltIcon belt={belt} size={28} className="flex-shrink-0 -ml-0.5" />}
                />
              )}
            </div>
          </div>

          {/* The ninja stands just clear of the banner's bottom edge rather
              than flush with it: the art is cropped to its own alpha, so the
              feet ARE the last row of the file and landing them on the edge
              reads as a character cut off rather than one standing there.
              Hidden below sm, where the name needs the width more than the
              banner needs art. */}
          <motion.button
            type="button"
            onClick={cheer}
            aria-label={`Make ${first} cheer`}
            className="absolute right-[-2.5rem] sm:right-[-1rem] lg:right-6 bottom-[-5rem] sm:bottom-[-6.5rem] lg:bottom-[-11rem] focus-visible:outline-none"
            style={{ x: ninjaX, y: ninjaY }}
            initial={still ? false : { opacity: 0, y: 40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 20, delay: 0.08 }}
            whileTap={still ? undefined : { scale: 0.96 }}
          >
            <motion.span
              className="block"
              animate={cheering && !still ? { y: [0, -26, 0], rotate: [0, -4, 0] } : { y: 0, rotate: 0 }}
              transition={cheering ? { duration: 0.55, ease: [0.34, 1.4, 0.64, 1] } : { duration: 0.2 }}
            >
              <img
                src={ninjaSrc(belt, cheering ? 'cheer' : 'wave', tone)}
                alt=""
                draggable={false}
                className="block h-[240px] sm:h-[320px] lg:h-[500px] w-auto select-none pointer-events-none drop-shadow-[0_18px_28px_rgba(4,10,24,0.45)]"
              />
            </motion.span>
            {/* Both poses are fetched up front: swapping to a file the browser
                has never seen leaves a frame of nothing in the middle of the
                jump, which reads as the ninja vanishing. */}
            <img src={ninjaSrc(belt, 'cheer', tone)} alt="" aria-hidden className="absolute w-px h-px opacity-0 pointer-events-none" />
          </motion.button>
        </div>
      </div>
    </Hero>
  );
}
