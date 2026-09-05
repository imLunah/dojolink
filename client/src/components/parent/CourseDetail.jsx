import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BugIcon, Globe2Icon, GraduationCapIcon, TrophyIcon, WrenchIcon } from 'lucide-react';
import { Hero, PinnedHero, PageSheet, Emblem, BeltRoad, BeltStickers, LevelPills, LevelMedal, hasLevelMedal, Group, Row, Tile, StatusDot, StatusText, BackChip } from './ParentUI';
import { BELTS, getLevels } from '../../utils/beltConfig';
import { levelProjects, levelStates, levelTitle, realSessions, trackModel, fmtDay } from '../../lib/parentProgress';
import { lessonStickersFor } from '../../lib/lessonStickers';
import { levelInfo, beltInfo, levelShot } from '../../lib/createCurriculum';
import { stickerProgress } from '../../lib/stickerProgress';
import StickerCollection from './StickerCollection';
import { programStickers } from '../../lib/stickerBook';
import { Tilt } from '../ui/Tilt';
import { KIT_SHORT } from '../../lib/programTheme';
import { useCurriculum } from '../../context/CurriculumContext';
import BeltIcon from '../ui/BeltIcon';

// One course, opened from a child's profile.
//
// This used to be its own Courses section with a grid of art cards in front of
// it. The grid was a menu of five things a parent already sees on the profile,
// so the section came off and the profile's own program cards became the way
// in: /parent/students/:id/courses/:program. The page itself is unchanged —
// what changed is only where it is reached from, and where Back goes.
//
// CREATE is the star. It leads with a hero in the CREATE blue (the belt shows
// as its icon, not as the banner's colour), the level pills, the chosen
// level's real projects from the curriculum with what the log says about each,
// and the other levels. Programs without belts are tracks of modules (kits for
// Robotics), read off the curriculum and the log by trackModel: the same hero
// in their own art, the tracks as pills, the open track's modules, and the
// other tracks.

const EASE_OUT = [0.23, 1, 0.32, 1];

// The curriculum's own visual vocabulary. Only Build, Solve and
// Adventure/Project are tracked as completable rows today; Discover and
// Explore are included so the mapping stays whole if those stages become
// first-class rows later.
const PROJECT_KIND = {
  Discover: { Icon: Globe2Icon, color: '#293f98' },
  Build: { Icon: WrenchIcon, color: '#9138a3' },
  Explore: { Icon: GraduationCapIcon, color: '#319bc4' },
  Solve: { Icon: BugIcon, color: '#ef3e43' },
  Adventure: { Icon: TrophyIcon, color: '#4fc390' },
  Project: { Icon: TrophyIcon, color: '#4fc390' },
};

function ProjectKindIcon({ kind, status }) {
  const { Icon, color } = PROJECT_KIND[kind] || PROJECT_KIND.Project;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-opacity ${status === 'todo' ? 'opacity-[0.55]' : ''}`}
      style={{ backgroundColor: color }}
    >
      <Icon size={17} strokeWidth={2.7} className="text-white" />
    </span>
  );
}

function useTrackModel(enrollment, logs) {
  const { curriculum, subPrograms } = useCurriculum();
  return useMemo(() => (enrollment.program === 'CREATE' ? null : trackModel({ program: enrollment.program, enrollment, logs, curriculum, subPrograms, shortNames: KIT_SHORT })), [enrollment, logs, curriculum, subPrograms]);
}


function ProjectRow({ p, first }) {
  const adventure = p.kind === 'Adventure';
  const sub = adventure
    ? (p.status === 'todo' ? 'Adventure · unlocks last' : `Adventure${p.date ? ` · ${fmtDay(p.date)}` : ''}`)
    : `${p.kind}${p.date ? ` · ${p.status === 'done' ? 'done' : 'last'} ${fmtDay(p.date)}` : ''}`;
  return (
    <Row first={first} inset lead={<ProjectKindIcon kind={p.kind} status={p.status} />} dim={p.status === 'todo'}
      title={p.name} subtitle={sub} trailing={p.status !== 'todo' ? <StatusText status={p.status} /> : null} />
  );
}

function CreateDetail({ enrollment, logs, childName, backTo }) {
  const belt = enrollment.belt_level;
  const currentLevel = Number(enrollment.belt_sublevel) || (getLevels(belt)[0] ?? 1);
  const beltIdx = BELTS.findIndex((b) => b.name === belt);
  const pos = getLevels(belt).indexOf(currentLevel) + 1;

  // The belt being READ, which starts as the belt being worn. Tapping the road
  // walks the page to another belt's curriculum without pretending the ninja
  // moved: `belt` still lights the road's trail and still writes the summary
  // line, `viewBelt` decides which levels and projects are on screen.
  const [viewBelt, setViewBelt] = useState(belt);
  const [level, setLevel] = useState(currentLevel);
  const [dir, setDir] = useState(1);
  useEffect(() => { setViewBelt(belt); setLevel(currentLevel); }, [enrollment.id, belt, currentLevel]);

  const viewIdx = BELTS.findIndex((b) => b.name === viewBelt);
  const onBelt = viewBelt === belt;
  const earned = viewIdx >= 0 && beltIdx >= 0 && viewIdx < beltIdx;
  const levels = getLevels(viewBelt);
  const next = viewIdx >= 0 ? BELTS[viewIdx + 1]?.name : null;

  // A belt behind the ninja is finished top to bottom; one ahead has not been
  // opened at all. Only the belt actually being worn has a level part way in,
  // which is the one case levelStates was written for.
  const states = useMemo(
    () => levelStates(viewBelt, onBelt ? currentLevel : earned ? Infinity : -1),
    [viewBelt, onBelt, earned, currentLevel]);
  const projects = useMemo(() => levelProjects(viewBelt, level, logs), [viewBelt, level, logs]);
  const done = projects.filter((p) => p.status === 'done').length;
  const sessions = realSessions(logs);
  const levelState = states.find((s) => s.level === level)?.state;
  const started = useMemo(() => {
    const ds = sessions.filter((l) => l.belt_level_at === viewBelt && Number(l.belt_sublevel_at) === Number(level)).map((l) => String(l.session_date).split('T')[0]).sort();
    return ds[0] || null;
  }, [sessions, viewBelt, level]);

  const pick = (lv) => { setDir(lv > level ? 1 : -1); setLevel(lv); };
  const pickBelt = (name) => {
    if (name === viewBelt) return;
    const i = BELTS.findIndex((b) => b.name === name);
    setDir(i > viewIdx ? 1 : -1);
    setViewBelt(name);
    setLevel(name === belt ? currentLevel : (getLevels(name)[0] ?? 1));
  };

  // The poster's own words for this belt and level, where we have them.
  const info = levelInfo(viewBelt, level);
  const belted = beltInfo(viewBelt);
  const concepts = (info?.sets || []).map((st) => st.explore).filter(Boolean);
  const shot = levelShot(viewBelt, level);
  const lastLevel = levels.length ? levels[levels.length - 1] : null;
  const earnedStickerIds = useMemo(
    () => stickerProgress({ belt, level: currentLevel, logs }).earnedIds,
    [belt, currentLevel, logs]);

  const summary = onBelt
    ? [`Level ${currentLevel}`, levels.length ? `${pos} of ${levels.length}` : null, belted?.language, next ? `earns ${next}` : null, sessions.length ? `${sessions.length} session${sessions.length === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')
    : [earned ? 'Earned' : 'Ahead', levels.length ? `${levels.length} level${levels.length === 1 ? '' : 's'}` : null, belted?.language, next ? `earns ${next}` : null].filter(Boolean).join(' · ');

  if (!belt) {
    return (
      <div className="space-y-4">
        <Hero program="CREATE" size="page">
          {backTo && <div className="mb-10 lg:mb-6"><BackChip to={backTo} label="Back to profile" /></div>}
          <p className="font-ninja text-[12px] font-extrabold opacity-85">CREATE · {childName}</p>
          <p className="font-ninja font-extrabold text-[32px] leading-tight mt-1">White belt ahead</p>
          <p className="font-ninja text-[13px] opacity-85 mt-1">The belt road starts with the first logged session.</p>
        </Hero>
      </div>
    );
  }

  return (
    <div className="relative">
      <PinnedHero>
        <Hero program="CREATE" size="page" className="!mt-0">
          {/* The belt IS the hero's art on every width. Desktop: it is scenery,
              and scenery has to stay legible as the thing it is. Blown up to
              twice the banner it stopped being a belt at all — the frame filled
              with the mask band and two eyes, which reads as shapes rather than
              as a ninja, and the hard arc of the ring cut a line across the
              middle of the banner that nothing in the design had asked for.

              So: 1.3x the banner's height, hung 3rem past its right edge
              (`calc(50% - 50cqw)` is the walk from this box out to that edge).
              Big enough to be cropped, small enough that the piece in frame is
              still recognisably the belt.

              The art is at FULL strength — no opacity at all. The fade is
              entirely the MASK: weight in the top right corner, dissolving
              toward the bottom left, which is exactly where the words and the
              belt road are. So the art never has an edge that crosses content,
              and the dimmed belts at the end of the road are never asked to
              hold their own against the brightest part of a picture. A flat
              opacity was tried at several values and each one did the same two
              things wrong: it drained the belt's colour, which is the one thing
              the art is there to say, and it still left the ring's outline
              drawn straight through the road. The stops are late on purpose —
              solid for the first 55% and not gone until 96% — so most of what
              is on screen is the belt at its true colour and only the tail of
              it thins out over the words.

              One belt is not the sticker sheet's own: `belt-white-lg.png` is
              the BLUE belt with its ring recoloured white, because the sheet's
              white belt carries a black outer stroke so it stays visible on
              white paper. Right for a sticker, wrong on a blue banner, and the
              other twelve carry no such stroke. The small `belt-white.png`
              keeps its outline — it is drawn on white cards all over the staff
              side, where without one there would be nothing to see.

              `large` asks for the 1280px copy, because the banner paints one
              at around 650 CSS px — some 1300 device pixels on a retina screen
              — and the everyday 256px file upscaled that far looks like a bad
              JPEG. The nine belts that have one get it; the metallic four have
              no transparent source art yet and fall back to the small file.
              They are NOT blurred to cover for it: blur took the one thing a
              metal belt has to say — its colour — and stirred it into the
              gradient. Soft and coloured beats smooth and grey.

              Phone: a bit smaller and centered, so the pills row underneath
              still breathes. Both sit behind the ink either way — the hero's
              isolation lets a negative z sit above the gradient but under
              everything written. */}
          <span
            aria-hidden
            className="hidden lg:block absolute inset-y-[-15%] right-[calc(50%-50cqw-3rem)] aspect-square pointer-events-none"
            style={{
              zIndex: -1,
              maskImage: 'linear-gradient(to bottom left, #000 55%, transparent 96%)',
              WebkitMaskImage: 'linear-gradient(to bottom left, #000 55%, transparent 96%)',
            }}
          >
            <BeltIcon belt={viewBelt} large style={{ width: '100%', height: '100%' }} />
          </span>
          <span
            aria-hidden
            className="lg:hidden absolute top-1/2 -translate-y-1/2 right-[-2rem] h-[72%] aspect-square pointer-events-none"
            style={{ zIndex: -1 }}
          >
            <BeltIcon belt={viewBelt} large style={{ width: '100%', height: '100%' }} />
          </span>
          {/* The belt's own poster stickers, after the belt art so they land in
              front of it rather than behind. */}
          <BeltStickers belt={viewBelt} />
          {backTo && <div className="mb-10 lg:mb-6"><BackChip to={backTo} label="Back to profile" /></div>}
          <div className="flex items-center lg:items-start justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              <div className="min-w-0">
                <p className="font-ninja text-[12px] font-extrabold opacity-85 truncate">CREATE · {childName}</p>
                <p className="font-ninja font-extrabold text-[36px] lg:text-[32px] leading-none mt-1 tracking-[-0.015em]">{viewBelt} belt</p>
                <p className="font-ninja text-[13px] opacity-85 mt-2 truncate">{summary}</p>
              </div>
            </div>
          </div>
          {/* No clearance for the art any more: it is faded into the gradient
              now, so the road crosses it instead of stopping short of it.
            
              One road at every width. The phone used to get a row of level
              pills here instead, which answered a different question than the
              banner was asking: the title says which BELT is open, and the
              pills moved the level. Levels are still picked from the All levels
              list below, where they have room for their names and dates, and
              the road now says where the ninja is on the whole ladder from the
              first screen — which is the thing a parent opens this page for. */}
          <BeltRoad current={belt} selected={viewBelt} onSelect={pickBelt} onHero fit className="mt-5" />
        </Hero>
      </PinnedHero>

      <PageSheet>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${viewBelt}-${level}`}
                initial={{ opacity: 0, x: 10 * dir }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 * dir }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
              >
                <Group tint={levelState === 'current' ? 'green' : levelState === 'done' ? 'blue' : undefined}>
                  {/* The game itself, straight off the wall poster, tilted into
                      the corner like a photo dropped on the card.

                      It was a full-bleed banner first and that was the wrong
                      shape twice over: stretched to the card's width it upscaled
                      a 424px file past 1.6x, and no aspect ratio fixes that — a
                      wide strip of one screenshot is not a picture of a game, it
                      is a crop of a wrench. Held at its own size and turned a few
                      degrees it stays sharp, it reads as an object rather than a
                      header, and it sits with the rest of the bento instead of
                      fighting it. The card clips whatever hangs over the edge. */}
                  <div>
                    {/* A row, not an overlay: the picture is a flex item, so the
                        header grows to hold ALL of it. Floated into the corner it
                        was clipped by whatever height the words happened to need,
                        which is how you end up showing two thirds of a game. The
                        tilt is a transform, so it costs no layout — only the four
                        corners drift, and the card has room for them. */}
                    <div className="flex items-start gap-3 pl-4 pr-4 pt-3.5 pb-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-ninja text-[11px] font-extrabold uppercase tracking-[0.08em]" style={levelState ? { color: 'var(--tint-ink)' } : undefined}>
                        Level {level}{levelState === 'current' ? ' · now' : levelState === 'done' ? ' · done' : ' · ahead'}
                      </p>
                      {/* The poster's name for the level. Only when we have none
                          does it fall back to the old guess made from the level's
                          last project. */}
                      {(info?.topic || levelTitle(viewBelt, level) !== `Level ${level}`) && (
                        <p className="font-ninja font-extrabold text-[20px] text-ninja-navy leading-tight mt-0.5">
                          {info?.topic || levelTitle(viewBelt, level)}
                        </p>
                      )}
                      <p className="font-ninja text-[12.5px] v2 text-ninja-muted mt-0.5">
                        {[`${done} of ${projects.length} projects`, started ? `started ${fmtDay(started)}` : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {/* The 3 degree rest angle is what pins it to the card like
                        a photo; the pointer turns it off that angle rather than
                        from square, so it never looks straightened. */}
                    {shot && (
                      <Tilt
                        rest={3}
                        amount={9}
                        glare
                        className="relative flex-shrink-0 w-[132px] sm:w-[176px] mt-0.5 rounded-[10px] ring-1 ring-black/10 shadow-[0_12px_28px_-12px_rgb(6_13_26_/_0.5)]"
                      >
                        <img
                          src={shot}
                          alt=""
                          aria-hidden="true"
                          draggable={false}
                          className="w-full select-none rounded-[10px]"
                        />
                      </Tilt>
                    )}
                    </div>
                    {/* What the ninja actually builds at the end of the level. It
                        is the one sentence a parent can read and picture. */}
                    {info?.quest && (
                      <p className="font-ninja text-[13.5px] leading-relaxed text-ninja-navy/85 px-4 pb-3 -mt-1">{info.quest}</p>
                    )}
                  </div>
                  <div className={`mx-3 mb-3 rounded-[14px] overflow-hidden ${levelState ? 'border border-ninja-navy/[0.06]' : ''}`}>
                    {projects.map((p, i) => <ProjectRow key={p.name} p={p} first={i === 0} />)}
                    {projects.length === 0 && <p className="px-4 py-3 font-ninja text-sm text-ninja-muted">No projects listed for this level yet.</p>}
                  </div>
                  {/* The concepts the level teaches, which is the EXPLORE half of
                      each build/explore/solve set. The project rows say what gets
                      made; this says what it was for. */}
                  {concepts.length > 0 && (
                    <div className="px-4 pb-4 -mt-1">
                      <p className="font-ninja text-[11px] font-extrabold uppercase tracking-[0.08em] text-ninja-muted">Concepts</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {concepts.map((c) => (
                          <span key={c} className="font-ninja text-[12px] font-bold rounded-lg px-2.5 py-1 bg-ninja-navy/[0.05] text-ninja-navy/80">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* A belt that closes a pair ends with a Mastery Mission. It
                      belongs on the last level, where it actually happens. */}
                  {belted?.mastery && level === lastLevel && (
                    <div className="mx-3 mb-3 rounded-[14px] px-4 py-3" style={{ background: 'rgb(var(--ninja-blue) / 0.07)' }}>
                      <p className="font-ninja text-[11px] font-extrabold uppercase tracking-[0.08em] text-ninja-blue">Mastery mission</p>
                      <p className="font-ninja text-[13px] leading-relaxed text-ninja-navy/85 mt-1">{belted.mastery}</p>
                    </div>
                  )}
                </Group>
              </motion.div>
            </AnimatePresence>

            <div className="space-y-4">
              <Group title={onBelt ? 'All levels' : `${viewBelt} levels`}>
                {states.map((s, i) => {
                  const finished = sessions.filter((l) => l.belt_level_at === viewBelt && Number(l.belt_sublevel_at) === s.level && l.status_at === 'Completed').map((l) => String(l.session_date).split('T')[0]).sort();
                  const lastDone = finished[finished.length - 1] || null;
                  return (
                    <Row key={s.level} first={i === 0} onClick={() => pick(s.level)} active={s.level === level} dim={s.state === 'ahead'}
                      lead={hasLevelMedal(viewBelt, s.level)
                        ? <LevelMedal belt={viewBelt} level={s.level} ahead={s.state === 'ahead'} tilt />
                        : <Tile tint={s.state === 'done' ? 'rgb(34 197 94 / 0.14)' : s.state === 'current' ? 'rgb(var(--ninja-blue) / 0.14)' : 'rgb(var(--ninja-navy) / 0.06)'} color={s.state === 'done' ? '#15803d' : s.state === 'current' ? undefined : 'rgb(var(--ninja-muted))'}>{s.level}</Tile>}
                      title={`Level ${s.level}`}
                      subtitle={[`${s.projectCount} project${s.projectCount === 1 ? '' : 's'}`, s.state === 'current' ? 'now' : s.state === 'done' && lastDone ? `done ${fmtDay(lastDone)}` : null].filter(Boolean).join(' · ')}
                    />
                  );
                })}
              </Group>
            </div>
          </div>

          <StickerCollection
            belt={viewBelt}
            earnedIds={earnedStickerIds}
            earnedTotal={earnedStickerIds.size}
            childName={childName}
          />
        </div>
      </PageSheet>
    </div>
  );
}

// One lesson of the open module: its badge, its title, and whether it is done.
//
// A module is three to twenty-four lessons, each one an afternoon a sensei
// logs by name, and each one carries its own achievement badge. Those are the
// finest thing DojoLink actually knows happened, and they used to be visible
// only to staff.
//
// The lessons are always shown, earned or not. A locked badge with the lesson
// it is waiting on is what makes the list a map of what is coming rather than
// a receipt for what is done, which is the whole reason a ninja opens it.
function LessonRow({ l, badge }) {
  return (
    <li className="flex items-center gap-3 py-2 px-4">
      {/* Robotics awards its badge at the module, not the lesson, so its
          lessons have no art to show. They get the same tick every other
          list in the portal uses rather than a blank where a picture
          would be. */}
      {badge ? (
        <img src={badge.src} alt="" aria-hidden draggable={false} loading="lazy"
          className={`h-8 w-8 flex-shrink-0 object-contain ${l.done ? '' : 'grayscale opacity-30'}`} />
      ) : (
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
          <StatusDot status={l.done ? 'done' : 'todo'} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-ninja text-[13.5px] font-bold ${l.done ? 'text-ninja-navy' : 'text-ninja-navy/55'}`}>{l.title}</span>
        <span className={`block font-ninja text-[11.5px] ${l.done ? 'font-bold text-emerald-600' : 'text-ninja-muted'}`}>
          {l.done ? (l.date ? fmtDay(l.date) : 'Done') : 'Not yet'}
        </span>
      </span>
    </li>
  );
}

// A module's achievement sticker in a list row, earned in colour and waiting
// in grey — the same 25% and grayscale LevelMedal and the belt road use, so
// one rule covers every ladder in the portal. Decoration in the strict sense:
// the module's name is right next to it, so it is hidden from screen readers
// rather than given an alt text invented for it.
function ModuleBadge({ sticker, earned, size = 40 }) {
  return (
    <img src={sticker.src} alt="" aria-hidden draggable={false} loading="lazy" decoding="async"
      style={{ width: size, height: size }}
      className={`object-contain flex-shrink-0 ${earned ? '' : 'opacity-25 grayscale'}`} />
  );
}

// A map key made of names, without inventing a separator no name may contain.
const nameKey = (...parts) => JSON.stringify(parts);

// The page for a program of tracks and modules, shaped the way CREATE's is:
// the module being READ fills the left card with its lessons, and the right
// column is the ladder of all modules to pick from. It used to be one card
// with every module stacked inside it and the lessons folded behind a
// chevron, which answered "what is in this kit" but hid the one thing a
// parent opens the page for — what the ninja is doing NOW and what it earns.
//
// Each module row wears its own achievement sticker, earned in colour and
// waiting in grey, which is also why the sticker book that used to sit under
// the list is gone: every achievement it showed is now on the module it
// belongs to, capstone on the row and lesson badges on the open module's own
// list. The whole-collection view lives in the sticker book page, where a
// collection belongs.
function TrackDetail({ enrollment, logs, childName, backTo }) {
  const p = enrollment.program;
  const { curriculum, subPrograms } = useCurriculum();
  const model = useTrackModel(enrollment, logs);
  const { tracks, current, multi, unit } = model;
  const [openIdx, setOpenIdx] = useState(current ? current.index : 1);
  const [dir, setDir] = useState(1);
  useEffect(() => { setOpenIdx(current ? current.index : 1); }, [enrollment.id, current?.index]);
  const open = tracks.find((t) => t.index === openIdx) || current;
  const pick = (i) => { setDir(i > openIdx ? 1 : -1); setOpenIdx(i); };
  const pills = tracks.map((t) => ({ level: t.index, label: t.short, state: t.state }));
  const started = current?.sessions > 0;

  // The badge for each lesson, looked up by the module and lesson it belongs
  // to. The art is built once for the whole program rather than per row: it is
  // the same drawing every time and the seat arithmetic behind it belongs in
  // one place (lib/lessonStickers.js), not in a list item.
  const art = useMemo(() => {
    const by = new Map();
    for (const sticker of lessonStickersFor({ program: p, curriculum, subPrograms })) {
      by.set(nameKey(sticker.moduleName, sticker.lessonName), sticker);
    }
    return by;
  }, [p, curriculum, subPrograms]);

  // Each module's own achievement, keyed by the kit and module it caps, with
  // `earned` already decided by the one shared definition (stickerBook asks
  // moduleStickerProgress). The row and the open card both read this map, so
  // a badge cannot be grey on the ladder and coloured on the card.
  const capstones = useMemo(() => {
    const by = new Map();
    for (const sticker of programStickers({ programs: p, logs, curriculum, subPrograms })) {
      if (sticker.kind !== 'module') continue;
      by.set(nameKey(sticker.subProgram || sticker.program, sticker.moduleName), sticker);
    }
    return by;
  }, [p, logs, curriculum, subPrograms]);

  // WHICH MODULE IS OPEN — the one on the left card, the way CREATE keeps one
  // level open. The one the ninja is working on opens itself, because that is
  // the module they came to look at.
  const [moduleName, setModuleName] = useState(null);
  useEffect(() => {
    setModuleName(open?.working?.name || open?.modules[0]?.name || null);
  }, [enrollment.id, open?.name, open?.working?.name]);
  const selected = open?.modules.find((m) => m.name === moduleName) || open?.working || open?.modules[0] || null;
  const pickModule = (m) => {
    setDir(m.index > (selected?.index || 0) ? 1 : -1);
    setModuleName(m.name);
  };

  const cap = selected && open ? capstones.get(nameKey(open.name, selected.name)) : null;
  const stateSuffix = selected ? (selected.status === 'working' ? ' · now' : selected.status === 'done' ? ' · done' : ' · ahead') : '';
  const selectedSub = selected ? [
    selected.lessons.length ? `${selected.lessonsDone} of ${selected.lessons.length} lesson${selected.lessons.length === 1 ? '' : 's'}` : null,
    selected.status === 'done' && selected.date ? `done ${fmtDay(selected.date)}` : null,
    selected.status === 'working' && selected.date ? `working on it · ${fmtDay(selected.date)}` : null,
  ].filter(Boolean).join(' · ') : '';

  const meta = multi
    ? (current ? `${unit} ${current.index} of ${tracks.length} · ${current.name}` : 'Just getting started')
    : (current?.working ? `Module ${current.working.index} of ${current.modules.length} · ${current.working.name}` : started ? `${current.sessions} session${current.sessions === 1 ? '' : 's'}` : 'Just getting started');

  return (
    <div className="relative">
      <PinnedHero>
        <Hero program={p} size="page" className="!mt-0">
          {backTo && <div className="mb-10 lg:mb-6"><BackChip to={backTo} label="Back to profile" /></div>}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="hidden lg:block font-ninja text-[12px] font-extrabold opacity-85 truncate">{p} · {childName}</p>
              <p className="font-ninja font-extrabold text-[36px] lg:text-[32px] leading-[1.02] mt-1 tracking-[-0.015em]">{p}</p>
              <p className="font-ninja text-[13px] opacity-85 mt-2 truncate">{meta}</p>
            </div>
            <Emblem program={p} size={104} tilt />
          </div>
          {multi && (
            <>
              <div className="hidden lg:block mt-5"><LevelPills states={pills} value={openIdx} onChange={pick} onHero layoutId="track-pill-desktop" /></div>
              <div className="lg:hidden mt-4"><LevelPills states={pills} value={openIdx} onChange={pick} onHero layoutId="track-pill-mobile" /></div>
            </>
          )}
        </Hero>
      </PinnedHero>

      <PageSheet>
        <div className="space-y-4">
          {open && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={`${open.index}-${selected?.name || 'none'}`}
                  initial={{ opacity: 0, x: 10 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 * dir }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}>
                  <Group tint={selected?.status === 'working' ? 'green' : selected?.status === 'done' ? 'blue' : undefined}>
                    <div className="flex items-start gap-3 pl-4 pr-4 pt-3.5 pb-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-ninja text-[11px] font-extrabold uppercase tracking-[0.08em]" style={selected && selected.status !== 'todo' ? { color: 'var(--tint-ink)' } : { color: 'rgb(var(--ninja-muted))' }}>
                          {[multi ? open.name : null, selected ? selected.name : 'Modules'].filter(Boolean).join(' · ')}{stateSuffix}
                        </p>
                        {/* The achievement's own name for the module, the way
                            CREATE prints the poster's name for a level. A
                            module without a sticker has no second name to
                            print and skips the line. */}
                        {cap?.title && (
                          <p className="font-ninja font-extrabold text-[20px] text-ninja-navy leading-tight mt-0.5">{cap.title}</p>
                        )}
                        {selectedSub && <p className="font-ninja text-[12.5px] v2 text-ninja-muted mt-0.5">{selectedSub}</p>}
                      </div>
                      {/* The module's achievement, big, in the corner CREATE
                          keeps the level's screenshot: coloured once every
                          lesson below it is done, grey while it waits. The 3
                          degree rest angle pins it to the card like a photo. */}
                      {cap && (
                        <Tilt rest={3} amount={9} className="flex-shrink-0 mt-0.5">
                          <img src={cap.src} alt="" aria-hidden draggable={false}
                            className={`h-[84px] w-[84px] sm:h-[104px] sm:w-[104px] select-none object-contain ${cap.earned ? 'drop-shadow-[0_12px_16px_rgb(6_13_26_/_0.25)]' : 'opacity-30 grayscale'}`} />
                        </Tilt>
                      )}
                    </div>
                    <div className={`mx-3 mb-3 rounded-[14px] overflow-hidden ${selected ? 'border border-ninja-navy/[0.06]' : ''}`}>
                      {selected && selected.lessons.length > 0 && (
                        <ul className="tint-inset">
                          {selected.lessons.map((l) => (
                            <LessonRow key={l.name} l={l} badge={art.get(nameKey(selected.name, l.name))} />
                          ))}
                        </ul>
                      )}
                      {selected && selected.lessons.length === 0 && (
                        <p className="px-4 py-3 font-ninja text-sm text-ninja-muted tint-inset">No lessons listed for this module yet.</p>
                      )}
                      {!selected && (
                        <p className="px-4 py-3 font-ninja text-sm text-ninja-muted tint-inset">No modules listed for this {unit.toLowerCase()} yet.</p>
                      )}
                    </div>
                  </Group>
                </motion.div>
              </AnimatePresence>

              <Group title="All modules">
                {open.modules.map((m, i) => {
                  const sticker = capstones.get(nameKey(open.name, m.name));
                  return (
                    <Row key={m.name} first={i === 0} onClick={() => pickModule(m)} active={selected?.name === m.name} dim={m.status === 'todo'}
                      // The module's own achievement, not its number: earned in
                      // colour, waiting in grey. A module with no sticker falls
                      // back to the numbered tile, the same as a kit with no art.
                      lead={sticker
                        ? <ModuleBadge sticker={sticker} earned={sticker.earned} />
                        : <Tile tint={m.status === 'done' ? 'rgb(34 197 94 / 0.14)' : m.status === 'working' ? 'rgb(var(--ninja-blue) / 0.14)' : 'rgb(var(--ninja-navy) / 0.06)'} color={m.status === 'done' ? '#15803d' : m.status === 'working' ? undefined : 'rgb(var(--ninja-muted))'}>{m.index}</Tile>}
                      title={m.name}
                      subtitle={[
                        m.lessons.length ? `${m.lessonsDone} of ${m.lessons.length} lesson${m.lessons.length === 1 ? '' : 's'}` : null,
                        m.status === 'working' ? 'now' : m.status === 'done' && m.date ? `done ${fmtDay(m.date)}` : null,
                      ].filter(Boolean).join(' · ') || null}
                    />
                  );
                })}
                {open.modules.length === 0 && <p className="px-4 py-3 font-ninja text-sm text-ninja-muted">No modules listed for this {unit.toLowerCase()} yet.</p>}
              </Group>
            </div>
          )}
        </div>
      </PageSheet>
    </div>
  );
}

export default function CourseDetail({ enrollment, logs, childName, backTo }) {
  return enrollment.program === 'CREATE'
    ? <CreateDetail enrollment={enrollment} logs={logs} childName={childName} backTo={backTo} />
    : <TrackDetail enrollment={enrollment} logs={logs} childName={childName} backTo={backTo} />;
}
