import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckIcon, LockKeyholeIcon } from 'lucide-react';
import ParentLayout from '../../components/layout/ParentLayout';
import { useParentPortal } from '../../context/ParentPortalContext';
import { Hero, PinnedHero, PageSheet, BackChip } from '../../components/parent/ParentUI';
import { RarityChip, StickerZoom, useLockedShake, useStickerZoom } from '../../components/parent/StickerCollection';
import { CREATE_STICKERS } from '../../lib/createStickers';
import { wholeBook } from '../../lib/stickerBook';
import { useCurriculum } from '../../context/CurriculumContext';
import { stickerPercentile, useStickerCohort, useStickerRarity } from '../../lib/stickerRarity';
import { SkeletonProfile } from '../../components/ui/Skeleton';
import { Tilt } from '../../components/ui/Tilt';
import { CARD, FLAT } from '../../lib/surfaces';
import { fmtDay } from '../../lib/parentProgress';

// Three numbers a parent cannot read off the rest of the page, each one led
// by the sticker that earned it.
//
// No card under any of them, and nothing left-aligned. They went through a
// dark gradient tile, a flat white box, a block of tint and back to white,
// and every one of those was a container drawn around three short pieces of
// text because a number on a page felt like it needed one. It does not: the
// sheet is already a surface, and what separates one record from the next is
// the space between them.
//
// Centred, because with no box to sit in the left edge was the only thing
// holding a record together and it was holding the caption and the sticker on
// two different axes. A stack down one centre line is its own alignment. It
// also puts these in the same posture as the collection below, where every
// sticker already stands over its own caption.
//
// What is left is the sticker, the number, and two lines. The sticker is the
// biggest thing in the row on purpose: it is the reward, the page is a
// sticker book, and every version where it was smaller than the type had the
// parent reading a statistic instead of looking at their kid's artwork.
//
// The only colour besides the artwork is the number, which takes one of the
// four tint inks from index.css rather than a value invented here, so it is a
// colour this app already uses and it answers to dark mode. `tint-ink-only`
// is that palette with the panel it normally comes with switched off.
//
// `rest` is the angle the sticker is stuck on at. Hand-set and different on
// each, for the same reason BeltStickers hand-places its cluster: three
// identical angles read as printing, and these are meant to read as vinyl.

const RECORDS = [
  { key: 'percentile', title: 'Ahead of the dojo', tint: 'blue', rest: -7 },
  { key: 'latest', title: 'Most recent sticker', tint: 'amber', rest: 6 },
  { key: 'collection', title: 'Collection complete', tint: 'lilac', rest: -4 },
];

// The sticker, at the size that makes it the thing you look at first.
//
// It stood on a drawn plinth for a version, then a pair of bars before that,
// and both were scaffolding holding up something too small to hold itself up.
// A record's artwork does not need a base to be looked at, it needs to be
// big. What grounds it now is what grounds a sticker anywhere else in this
// app: the angle it is stuck on at, the shadow it drops, and the turn it
// takes under the pointer.
function RecordSticker({ art, rest }) {
  return (
    <Tilt amount={13} rest={rest} scale={1.05} className="inline-flex">
      <img
        src={art}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-[152px] w-[152px] select-none object-contain drop-shadow-[0_16px_16px_rgb(6_13_26/0.18)] sm:h-[176px] sm:w-[176px]"
      />
    </Tilt>
  );
}

// `headline` carries a sticker's name where the others carry a number, so it
// drops to a size a two-word title and a four-word one can both live at. The
// card around it does not change: a shelf where one tile suddenly took a
// different shape would read as three unrelated things.
//
// It takes a second step down for the long ones. The IMPACT badges are named,
// not numbered, and they run from "GPS" to "Comment, Like and Subscribe": at
// one size the short names look lost and the long ones get clipped
// mid-sentence, which on the "most recent" card means a parent is shown half
// the name of the thing their kid just earned.
//
// The number and the plinth are bottom-aligned, so they stand on one floor
// instead of hanging from the top edge with a gap underneath.
const LONG_TITLE = 22;

function RecordCard({ record, value, caption, art, headline = false, flat, index = 0 }) {
  const long = headline && String(value).length > LONG_TITLE;
  return (
    <motion.article
      className={`tint-${record.tint} tint-ink-only flex min-w-[240px] flex-1 flex-col items-center px-2 text-center sm:min-w-[262px]`}
      initial={flat ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.06 * index }}
    >
      {art && <RecordSticker art={art} rest={record.rest} />}
      <p
        className={`mt-3 font-ninja font-extrabold tracking-[-0.02em] ${headline ? (long ? 'line-clamp-3 text-[17px] leading-[1.2]' : 'line-clamp-2 text-[22px] leading-[1.15]') : 'text-[42px] leading-[0.9]'}`}
        style={{ color: 'var(--tint-ink)' }}
      >
        {value}
      </p>
      <p className="mt-2.5 font-ninja text-[14.5px] font-extrabold text-ninja-navy">{record.title}</p>
      <p className="mt-1 font-ninja text-[12px] font-bold text-ninja-muted">{caption}</p>
    </motion.article>
  );
}

function AwardSticker({ item, isEarned, onOpen, flat, rarity }) {
  const { controls, shake } = useLockedShake();

  return (
    <motion.div animate={controls} className="flex min-w-0">
      <button
        type="button"
        onClick={() => (isEarned ? onOpen(item) : shake())}
        aria-label={`${item.title}${rarity ? `, ${rarity.label}` : ''}, ${isEarned ? 'earned' : `locked, ${item.requirement}`}`}
        className="group flex w-full min-w-0 flex-col items-center rounded-[22px] px-2 pb-4 pt-3 text-center transition-[transform,background-color] duration-150 hover:bg-ninja-blue/[0.035] active:scale-[0.97]"
      >
        <span className="relative flex h-[136px] w-full items-center justify-center sm:h-[150px]">
          <span
            aria-hidden="true"
            className={`absolute h-[112px] w-[112px] rounded-full transition-[transform,opacity] duration-200 group-hover:scale-[1.04] sm:h-[124px] sm:w-[124px] ${isEarned ? 'opacity-100' : 'opacity-45'}`}
            style={{ background: isEarned ? 'radial-gradient(circle, rgb(var(--ninja-blue) / 0.12), transparent 68%)' : 'radial-gradient(circle, rgb(var(--ninja-navy) / 0.06), transparent 68%)' }}
          />
          {/* Lazy: this page is the whole book, and a parent arriving on it
              sees a dozen badges before they scroll. Everything above stays
              eager. */}
          <motion.img
            layoutId={flat ? undefined : `sticker-art-${item.id}`}
            src={item.src}
            alt=""
            aria-hidden="true"
            draggable={false}
            loading="lazy"
            decoding="async"
            className={`relative h-[118px] w-[118px] select-none object-contain sm:h-[132px] sm:w-[132px] ${isEarned ? 'drop-shadow-[0_15px_13px_rgb(6_13_26/0.18)]' : 'grayscale opacity-25'}`}
          />
          <span aria-hidden="true" className={`absolute right-[12%] top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-white shadow-sm ${isEarned ? 'bg-emerald-500' : 'bg-ninja-navy/45'}`}>
            {isEarned ? <CheckIcon size={14} strokeWidth={3.2} /> : <LockKeyholeIcon size={13} strokeWidth={2.8} />}
          </span>
        </span>
        <span className={`mt-1 block max-w-full font-ninja text-[14px] font-extrabold leading-tight ${isEarned ? 'text-ninja-navy' : 'text-ninja-navy/50'}`}>{item.title}</span>
        {/* WHAT IS LEFT TO DO, or the day it was done. This used to print
            "Level 7" under every badge, which was a coordinate in CREATE's
            belt ladder — a taxonomy three quarters of this book does not
            share, and one the shelves no longer sort by. An earned sticker
            says when, where the log knows; a locked one says how far in. */}
        <span className={`mt-1 block font-ninja text-[11.5px] font-bold ${isEarned ? 'text-emerald-600' : 'text-ninja-muted'}`}>
          {isEarned ? (item.earnedOn ? fmtDay(item.earnedOn) : 'Earned') : item.requirement}
        </span>
        <span className="mt-2"><RarityChip rarity={rarity} size="sm" /></span>
      </button>
    </motion.div>
  );
}

export default function ParentStickerBook() {
  const { id } = useParams();
  const { students, setActiveId, detailFor, loadDetail, detailLoading } = useParentPortal();
  const flat = useReducedMotion();
  const rarity = useStickerRarity();
  const cohort = useStickerCohort();
  const { zoomed, open, close } = useStickerZoom();

  const target = Number(id);
  const child = (students || []).find((s) => s.id === target) || null;
  const detail = detailFor(target);

  useEffect(() => {
    if (child) setActiveId(child.id);
  }, [child?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (child) loadDetail(child.id); }, [child?.id, loadDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const programs = detail?.programs || child?.programs || [];
  const createEnrollment = programs.find((p) => p.program === 'CREATE');
  const belt = createEnrollment?.belt_level || null;
  const level = createEnrollment?.belt_sublevel || null;
  const first = child?.full_name?.split(' ')[0] || 'this ninja';

  // EVERY log, not CREATE's. A module sticker is earned out of JR, Robotics
  // and AI sessions, and this page filtering them out is what made it a
  // CREATE-only book.
  const logs = useMemo(() => detail?.session_logs || [], [detail]);
  const { curriculum, subPrograms } = useCurriculum() || {};
  const book = useMemo(
    () => wholeBook({ belt, level, logs, curriculum, subPrograms }),
    [belt, level, logs, curriculum, subPrograms]);

  // ONE SHELF PER PROGRAM, which is the only division this book can honestly
  // draw. It was one shelf per BELT — nine of them, White through Black —
  // and that is a CREATE coordinate system: there is no belt to file a VEX GO
  // module under, and a Robotics ninja opening the book found nine headings
  // naming a ladder they are not on.
  const sections = book.shelves;


  if (students === null || (child && !detail && detailLoading)) {
    return <ParentLayout><SkeletonProfile label="Loading the sticker book" /></ParentLayout>;
  }
  if (!child) {
    return (
      <ParentLayout>
        <div className={`${FLAT} p-8 text-center`}>
          <p className="font-ninja font-bold text-ninja-navy">That ninja is not on this account.</p>
        </div>
      </ParentLayout>
    );
  }

  const total = book.total;
  const earned = book.earned.length;
  const pct = Math.round((earned / total) * 100);
  const latest = book.recent(1)[0] || null;
  const remaining = total - earned;

  // The percentile needs the roster, which arrives after the page does and may
  // never arrive at all. Its card is dropped rather than shown as a dash: a
  // shelf of two solid numbers beats three where one is an apology.
  // The CREATE count, not the whole book's. The roster behind this is a
  // histogram of where CREATE ninjas stand on the belt ladder, so ranking a
  // count that includes 38 module stickers against it would be comparing two
  // different quantities and printing the result as a position.
  const percentile = stickerPercentile(cohort, book.createEarned);

  // The card shows the scarcest sticker in the book so far rather than the
  // newest one, which the card beside it is already showing. It is also the
  // honest illustration of the number: the stickers few ninjas hold are the
  // ones putting this one ahead. Safe to reach for `rarity` here, because the
  // roster that makes a percentile measurable is the roster that makes the
  // tiers measurable.
  const rarest = book.earned.reduce(
    (best, item) => (rarity?.[item.id] && (!best || rarity[item.id].share < rarity[best.id].share) ? item : best), null);

  const recordValues = {
    percentile: percentile == null ? null : {
      value: `${percentile}%`,
      caption: percentile === 0
        ? 'Every sticker from here moves this'
        : `More stickers than ${percentile}% of CREATE ninjas`,
      art: (rarest || latest || CREATE_STICKERS[0]).src,
    },
    latest: {
      value: latest ? latest.title : 'Not yet',
      // The day, or nothing. It used to name the belt when the log had no
      // date, which is a label this book no longer sorts by.
      caption: latest?.earnedOn ? fmtDay(latest.earnedOn) : latest ? 'Earned' : 'The first one is waiting',
      art: latest?.src || CREATE_STICKERS[0].src,
      headline: true,
    },
    collection: {
      value: `${pct}%`,
      caption: remaining ? `${remaining} sticker${remaining === 1 ? '' : 's'} left to collect` : 'Every sticker collected',
      art: CREATE_STICKERS.at(-1).src,
    },
  };
  const records = RECORDS.filter((record) => recordValues[record.key]);

  return (
    <ParentLayout>
      <div className="relative">
        <PinnedHero>
          {/* The banner keeps CREATE's colour because that is the house
              gradient the portal's own pages wear, but it no longer SAYS
              CREATE: the book is every program's now, and an eyebrow reading
              "CREATE · Ivy" over a shelf of Robotics stickers is a claim
              about the page that the page does not honour. */}
          <Hero program="CREATE" size="page" className="!mt-0">
            <div className="mb-8 lg:mb-6"><BackChip to={`/parent/students/${target}`} label="Back to profile" /></div>
            <p className="font-ninja text-[12px] font-extrabold uppercase tracking-[0.08em] opacity-85 truncate">{child.full_name}</p>
            <h1 className="font-ninja font-extrabold text-[34px] lg:text-[42px] leading-none mt-1.5 tracking-[-0.02em]">Sticker book</h1>

            {/* The bar is the one number a parent came for, drawn rather than
                written. It fills on arrival, from nothing, so the length is read
                as a distance travelled instead of a static stripe. */}
            <div className="mt-4 max-w-[360px]">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/25">
                <motion.div
                  className="h-full rounded-full bg-white"
                  initial={flat ? false : { width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                />
              </div>
              <p className="font-ninja text-[11.5px] font-extrabold uppercase tracking-[0.08em] opacity-80 mt-2">
                {pct}% complete
              </p>
            </div>
          </Hero>
        </PinnedHero>

        <PageSheet>
          <section aria-labelledby="records-heading">
            <h2 id="records-heading" className="font-ninja text-[24px] font-extrabold tracking-[-0.02em] text-ninja-navy">Personal records</h2>

            {/* `overflow-x` makes this a clipping box on BOTH axes, so the
                padding has to clear the tallest thing that leaves an
                element's border box: a 176px sticker's shadow, and the same
                sticker scaled up under the pointer. Too little and the art
                gets a straight edge cut across it mid-hover. */}
            <div className="-mx-4 mt-4 flex gap-7 overflow-x-auto px-4 pb-7 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:gap-9 sm:px-6 lg:-mx-2 lg:px-2">
              {records.map((record, i) => (
                <RecordCard key={record.key} record={record} flat={flat} index={i} {...recordValues[record.key]} />
              ))}
            </div>
          </section>

          <section aria-labelledby="awards-heading" className={`${CARD} mt-7 overflow-hidden px-3 py-5 sm:px-5 sm:py-6 lg:mt-9`}>
            <div className="flex items-end justify-between gap-4 px-1 sm:px-2">
              <div>
                <p className="font-ninja text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-ninja-blue">The collection</p>
                <h2 id="awards-heading" className="mt-1 font-ninja text-[24px] font-extrabold tracking-[-0.02em] text-ninja-navy">Every sticker</h2>
                <p className="mt-1 font-ninja text-[12.5px] text-ninja-muted">One for every level of CREATE, and one for every module of the rest.</p>
              </div>
              <p className="flex-shrink-0 font-ninja text-[13px] font-extrabold text-ninja-blue">{earned} of {total}</p>
            </div>

            {/* One shelf per program. Four short shelves read better than one
                run of 81, and the program is the thing a parent can place a
                sticker by without knowing a curriculum. */}
            {sections.map((section) => (
              <section key={section.program} aria-labelledby={`shelf-${section.program}`} className="mt-6 first:mt-5">
                <div className="flex items-baseline justify-between gap-3 px-1 sm:px-2">
                  <h3 id={`shelf-${section.program}`} className="font-ninja text-[17px] font-extrabold tracking-[-0.01em] text-ninja-navy">
                    {section.program}
                  </h3>
                  <p className={`flex-shrink-0 font-ninja text-[12px] font-extrabold ${section.earned === section.total ? 'text-emerald-600' : 'text-ninja-muted'}`}>
                    {section.earned} of {section.total}
                  </p>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-x-1 gap-y-3 sm:grid-cols-3 sm:gap-x-2 lg:grid-cols-4 xl:gap-x-4">
                  {section.stickers.map((item) => (
                    <AwardSticker
                      key={item.id}
                      item={item}
                      isEarned={item.earned}
                      onOpen={open}
                      flat={flat}
                      rarity={rarity?.[item.id]}
                    />
                  ))}
                </div>
              </section>
            ))}
          </section>
        </PageSheet>
      </div>

      <AnimatePresence>
        {zoomed && (
          <StickerZoom
            key={zoomed.id}
            item={zoomed}
            isEarned={book.earnedIds.has(zoomed.id)}
            childName={first}
            onClose={close}
            flat={flat}
            rarity={rarity?.[zoomed.id]}
            requirement={zoomed.requirement}
            detail={zoomed.detail}
          />
        )}
      </AnimatePresence>
    </ParentLayout>
  );
}
