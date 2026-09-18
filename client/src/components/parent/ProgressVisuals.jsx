import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRightIcon } from 'lucide-react';
import { BELTS, PROGRAM_LOGOS, PROGRAM_BANNERS, getLevels } from '../../utils/beltConfig';
import { PROGRAM_GRADIENTS, PROGRAM_BAR_COLORS, JR_CODING_MODULES, SNAP_CIRCUITS_TOTAL, KIT_ORDER, KIT_SHORT, KIT_TOTALS } from '../../lib/programTheme';
import BeltIcon from '../ui/BeltIcon';
import { Hero, BeltRoad, PageTitle, LevelMedal, hasLevelMedal } from './ParentUI';
import { useCurriculum } from '../../context/CurriculumContext';
import { formatDate } from '../../utils/dateUtils';
import { CARD } from '../../lib/surfaces';

// Program colours, kit and module vocab live in lib/programTheme so the parent
// portal's own pages read the same values.


function abbrevModule(name) {
  return name
    .replace(/^Module (\d+)$/, 'M$1')
    .replace(/^([A-Z]+) (\d+)$/, '$1$2')
    .replace(/^(\d+)\..+$/, '$1');
}

function toMonthKey(dateStr) {
  if (!dateStr) return '';
  const s = typeof dateStr === 'string' ? dateStr : new Date(dateStr).toISOString();
  return s.substring(0, 7);
}

// ─── Animation variants ───────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const dotContainerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.35 } },
};

const dotVariants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 18 } },
};

const nodeVariants = {
  hidden: { opacity: 0, scale: 0.3 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 16 } },
};

// ─── Opening a course ─────────────────────────────────────────────────────────

// The way into a course, and the reason the Courses section could come off the
// nav: the card that DESCRIBES a program is the card that opens it.
//
// The whole card is the target, because a parent should not have to hunt for a
// small control on a card that is already about one thing. The chevron sits by
// the title, the same place the CREATE card puts it, rather than repeating as
// a separate footer action. The link carries the sentence as its accessible
// name so nothing is lost to a screen reader.
function CourseShell({ href, program, children }) {
  const shell = 'block rounded-2xl overflow-hidden border border-ninja-border shadow-sm';
  return (
    <motion.div variants={cardVariants} initial="hidden" animate="show">
      {href
        ? <Link to={href} aria-label={`Open the ${program} course`} className={`${shell} group transition-shadow hover:shadow-md focus-visible:outline-none`}>{children}</Link>
        : <div className={shell}>{children}</div>}
    </motion.div>
  );
}

// The belt journey's door. It has no white body to put a footer row in, and
// anything added BELOW the words pushes the belt road down the banner, so the
// door is a chevron on the title's own line: it costs the block no height, and
// the title is the thing a parent would reach for anyway.
function Title({ href, className = '', children }) {
  // The type and the spacing both live on the OUTER element, so the link and
  // the plain heading occupy the same box to the pixel — a margin on the inner
  // span would be a flex item's margin and would push the chevron off the
  // text's own centre line.
  const type = `font-ninja font-extrabold ${className}`;
  if (!href) return <p className={type}>{children}</p>;
  return (
    <Link to={href} className={`group inline-flex items-center gap-1.5 max-w-full ${type}`}>
      <span className="truncate">{children}</span>
      <ChevronRightIcon
        size={24}
        strokeWidth={3}
        aria-hidden
        className="flex-shrink-0 opacity-60 transition-all group-hover:opacity-100 group-hover:translate-x-0.5"
      />
    </Link>
  );
}

// ─── Program card banner ──────────────────────────────────────────────────────

function ProgramCardBanner({ program, lastDate, sessions, href }) {
  const gradient = PROGRAM_GRADIENTS[program];
  const logo = PROGRAM_LOGOS[program];
  const banner = PROGRAM_BANNERS[program];

  return (
    <div style={{ background: gradient, padding: '20px', display: 'flex', alignItems: 'center', gap: 16, position: 'relative', overflow: 'hidden' }}>
      {/* Real banner art where the program has it. The gradient stays underneath
          rather than being replaced: the art arcs across its top edge, so the
          corners are transparent and need something to sit on. */}
      {banner && (
        <img
          src={banner}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 30%', pointerEvents: 'none',
            // Zoomed 4%: the art carries a hard band along its edges.
            transform: 'scale(1.04)',
          }}
        />
      )}
      <motion.div
        style={{ flex: 1, minWidth: 0, position: 'relative' }}
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      >
        <p style={{
          color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.13em', marginBottom: 4,
          fontFamily: 'Nunito, sans-serif',
        }}>
          Code Ninjas
        </p>
        <h2 style={{
          color: 'white', fontWeight: 800, fontSize: 21, lineHeight: 1.1,
          marginBottom: (lastDate || sessions !== undefined) ? 5 : 0,
          fontFamily: 'Nunito, sans-serif', display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span>{program}</span>
          {href && <ChevronRightIcon size={21} strokeWidth={3} aria-hidden className="flex-shrink-0 opacity-60 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />}
        </h2>
        {lastDate && (
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Nunito, sans-serif' }}>
            Last: {formatDate(lastDate)}
          </p>
        )}
        {sessions !== undefined && (
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Nunito, sans-serif' }}>
            {sessions} session{sessions !== 1 ? 's' : ''}
          </p>
        )}
      </motion.div>
      {logo && (
        <motion.img
          src={logo}
          alt={program}
          initial={{ opacity: 0, scale: 0.7, x: 16 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
          style={{
            width: 76, height: 76,
            objectFit: 'contain',
            flexShrink: 0,
            position: 'relative',
            filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))',
          }}
        />
      )}
    </div>
  );
}

// ─── Animated progress bar ────────────────────────────────────────────────────

function ProgressBar({ pct, color, delay = 0.3, label, value }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between text-xs font-ninja text-ninja-muted mb-1.5">
        <span>{label}</span>
        <motion.span
          className="font-bold text-ninja-navy"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.1 }}
        >
          {value}
        </motion.span>
      </div>
      <div className="h-3 bg-ninja-bg rounded-full overflow-hidden border border-ninja-border">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay }}
        />
      </div>
    </div>
  );
}

// ─── Activity bar chart ───────────────────────────────────────────────────────

function ActivityChart({ logs }) {
  // Roadmap bulk-completions are stored as logs for curriculum tracking, but are NOT sessions —
  // exclude them from the activity chart and the session count.
  const sessions = logs.filter((l) => !l.from_roadmap);
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      count: 0,
    });
  }
  sessions.forEach((log) => {
    const bucket = months.find((m) => m.key === toMonthKey(log.session_date));
    if (bucket) bucket.count++;
  });

  const max = Math.max(...months.map((m) => m.count), 1);
  const BAR_H = 56;

  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-ninja-navy font-ninja font-bold text-lg">Activity</h2>
        <span className="text-ninja-blue font-ninja font-bold text-sm">{sessions.length} total sessions</span>
      </div>

      <div className="flex items-end gap-2">
        {months.map((m, i) => (
          <div key={m.key} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <div className="w-full flex items-end justify-center" style={{ height: `${BAR_H}px` }}>
              <motion.div
                className="w-full rounded-t-lg"
                style={{ backgroundColor: m.count === 0 ? '#e2e8f0' : '#006ADD' }}
                initial={{ height: 0 }}
                animate={{ height: m.count === 0 ? '3px' : `${Math.max((m.count / max) * BAR_H, 8)}px` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 + 0.15 }}
              />
            </div>
            <span className="text-xs font-ninja text-ninja-muted">{m.label}</span>
            <span className="text-xs font-ninja font-bold text-ninja-navy h-4">
              {m.count > 0 ? m.count : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Belt journey (CREATE only) ───────────────────────────────────────────────

// The same hero the CREATE course opens with, so a parent meets one picture of
// the belt road and not two. It used to be its own gradient card with a
// "Current Belt" eyebrow, a 76px belt beside the words, a hand-rolled ladder
// and a sublevel bar — a second design for the one thing the portal already
// draws. Everything here now comes from ParentUI: the hero, its banner art and
// the road itself.
function BeltJourney({ enrollment, childName, href }) {
  const belt = enrollment.belt_level;
  const levels = belt ? getLevels(belt) : [];
  const level = Number(enrollment.belt_sublevel) || levels[0] || null;
  const pos = level != null ? levels.indexOf(level) + 1 : 0;
  const eyebrow = `CREATE${childName ? ` · ${childName}` : ''}`;

  if (!belt) {
    return (
      <Hero program="CREATE" size="block">
        <p className="font-ninja text-[12px] font-extrabold opacity-85">{eyebrow}</p>
        <Title href={href} className="text-[32px] leading-tight mt-1">White belt ahead</Title>
        <p className="font-ninja text-[13px] opacity-85 mt-1">The belt road starts with the first logged session.</p>
      </Hero>
    );
  }

  return (
    <Hero program="CREATE" size="block">
      {/* The belt is the hero's art: square, pinned to the right and cut off
          by the hero's own overflow, sitting above the gradient but under
          every word (the hero isolates, so a negative z can do that). */}
      <span
        aria-hidden
        className="hidden lg:block absolute inset-y-[-3%] right-[-3.5rem] aspect-square pointer-events-none"
        style={{
          zIndex: -1,
          maskImage: 'linear-gradient(to bottom left, #000 55%, transparent 96%)',
          WebkitMaskImage: 'linear-gradient(to bottom left, #000 55%, transparent 96%)',
        }}
      >
        <BeltIcon belt={belt} large style={{ width: '100%', height: '100%' }} />
      </span>

      {/* On a phone the belt is anchored to the WORDS, not to the hero, and
          the bleed is lopsided on purpose: it runs far past the top and the
          right so it sits INTO the corner and leaves by two edges, and stops
          just short of the road below. Centering it on the hero laid it over
          the road, where the belts ahead are dimmed and had nothing to be dim
          against; bleeding it evenly left it hanging off one edge in the
          middle of the banner, which read as a disc somebody had misplaced.
          Corner art is cropped art, so the more it leaves the frame the less
          it looks stranded. */}
      <div className="relative min-w-0">
        <span
          aria-hidden
          className="lg:hidden absolute -top-14 -bottom-5 right-[-3rem] aspect-square pointer-events-none"
          style={{
            zIndex: -1,
            maskImage: 'linear-gradient(to bottom left, #000 55%, transparent 96%)',
            WebkitMaskImage: 'linear-gradient(to bottom left, #000 55%, transparent 96%)',
          }}
        >
          <BeltIcon belt={belt} large style={{ width: '100%', height: '100%' }} />
        </span>
        {/* The medal sits BESIDE the whole block, not under the title, and
            that is a layout decision rather than a taste one: this hero's job
            is to hold the belt road, and the road's position in it must not
            drift. Stacked under the summary the medal added its own 60-odd
            pixels and the door added 30 more, and the road — the one thing on
            the card a parent looks for — slid down the banner. Alongside, the
            medal is shorter than the three lines it stands next to, so it
            costs the block nothing and the road stays where it has always
            been. Same reason the door is a chevron on the title's own line
            and not a chip beneath it.

            The level's own medal off the IMPACT poster. The belt behind the
            hero says which belt; this says how far into it, in the art the
            centre already hangs on its wall. The nine CREATE belts have one;
            the Degrees belts do not, and LevelMedal draws nothing rather than
            borrowing a neighbour's. */}
        <div className="flex items-center gap-3.5 min-w-0">
          {level != null && hasLevelMedal(belt, level) && (
            <div className="hidden lg:block">
              <LevelMedal belt={belt} level={level} size={58} tilt className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-ninja text-[12px] font-extrabold opacity-85 truncate">{eyebrow}</p>
            <Title href={href} className="text-[36px] lg:text-[32px] leading-none mt-1 tracking-[-0.015em]">{belt} belt</Title>
            <p className="font-ninja text-[13px] opacity-85 mt-2 truncate">
              {[level != null ? `Level ${level}` : null, levels.length ? `${pos} of ${levels.length}` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </div>

      {/* Shown at every width here, unlike the course page: there the level
          pills take the phone's room and the card below redraws the road, and
          on this page the road is the whole of what the hero is for.

          The right margin is the belt art's own room. On desktop the art is a
          square as tall as the hero, hung 3.5rem off the right edge, so it
          eats roughly 10rem of the content box — and the road, which now
          stretches to fill whatever it is given, stretched straight into the
          ninja's face. The number is per-hero because the art's width tracks
          that hero's height; this one is the shorter of the two. On a phone
          there is nothing to clear: the art is up in the corner above the
          road by then. */}
      <BeltRoad current={belt} onHero className="mt-7 lg:mt-5 lg:mr-[10.5rem]" />
    </Hero>
  );
}

// ─── Module explorer ─────────────────────────────────────────────────────────

function ModuleGrid({ modules, visited, accentColor, dotDelay = 0 }) {
  if (!modules.length) return null;
  const visitedCount = modules.filter((m) => visited.has(m.module)).length;
  const color = accentColor || '#006ADD';

  return (
    <div>
      <motion.div
        className="flex flex-wrap gap-1.5 mb-1"
        variants={dotContainerVariants}
        initial="hidden"
        animate="show"
      >
        {modules.map((m) => {
          const done = visited.has(m.module);
          return (
            <motion.div
              key={m.module}
              title={m.module}
              variants={dotVariants}
              className="px-2.5 py-1 rounded-lg text-xs font-ninja font-bold border"
              style={done
                ? { backgroundColor: color, color: 'white', borderColor: color }
                : { backgroundColor: '#f8fafc', color: '#94a3b8', borderColor: '#e2e8f0' }
              }
            >
              {abbrevModule(m.module)}
            </motion.div>
          );
        })}
      </motion.div>
      <p className="text-ninja-muted font-ninja text-xs mt-1">
        {visitedCount} of {modules.length} modules explored
      </p>
    </div>
  );
}

// ─── Animated kit path ────────────────────────────────────────────────────────

function KitPath({ kitOrder, kitShort, currentKitIndex, barColor }) {
  return (
    <div className="overflow-x-auto no-scrollbar mb-5" style={{ margin: '0 -4px 20px', padding: '4px' }}>
      <div className="flex items-start" style={{ minWidth: 'max-content' }}>
        {kitOrder.map((kit, i) => {
          const reached = i <= currentKitIndex;
          const isCurrent = i === currentKitIndex;
          return (
            <div key={kit} className="flex items-start">
              {i > 0 && (
                <motion.div
                  style={{
                    width: '24px', height: '3px', borderRadius: '2px',
                    backgroundColor: reached ? barColor : '#e2e8f0',
                    flexShrink: 0, marginTop: '13px',
                  }}
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut', delay: i * 0.12 + 0.2 }}
                />
              )}
              <div className="flex flex-col items-center" style={{ gap: '5px' }}>
                <motion.div
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: isCurrent ? barColor : reached ? '#c4b5fd' : '#e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  variants={nodeVariants}
                  initial="hidden"
                  animate="show"
                  transition={{ delay: i * 0.12 + 0.15 }}
                >
                  <span style={{ color: reached ? 'white' : '#cbd5e1', fontSize: '12px', fontWeight: 700 }}>
                    {i + 1}
                  </span>
                </motion.div>
                <span style={{
                  fontSize: '12px', fontFamily: 'Nunito, sans-serif',
                  fontWeight: isCurrent ? 700 : 400,
                  color: isCurrent ? barColor : reached ? '#506690' : '#cbd5e1',
                  whiteSpace: 'nowrap',
                }}>
                  {kitShort[kit]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModuleProgress({ program, enrollment, logs, href }) {
  const { curriculum: CURRICULUM } = useCurriculum();
  const totalSessions = logs.filter((l) => !l.from_roadmap).length;
  const lastDate = enrollment?.last_session_date;
  const barColor = PROGRAM_BAR_COLORS[program] || '#006ADD';

  // ── AI Academy ───────────────────────────────────────────────────────────────
  if (program === 'AI Academy') {
    const currentModule = enrollment?.last_module_name;
    const aiCurriculum = CURRICULUM['AI Academy'] || [];
    const moduleEntry = aiCurriculum.find((m) => m.module === currentModule);
    const totalLessons = moduleEntry?.lessons.length ?? 0;
    const visitedLessons = currentModule
      ? new Set(
          logs.filter((l) => l.module_name === currentModule).map((l) => l.lesson_name).filter(Boolean)
        ).size
      : 0;
    const pct = totalLessons > 0 ? Math.round((visitedLessons / totalLessons) * 100) : 0;
    const visitedModules = new Set(logs.map((l) => l.module_name).filter(Boolean));

    return (
      <CourseShell href={href} program={program}>
        <ProgramCardBanner program="AI Academy" lastDate={lastDate} href={href} />
        <div className="bg-white p-5">
          {currentModule ? (
            <>
              <motion.div
                className="flex items-center gap-3 mb-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.35 }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-ninja-navy font-ninja font-bold text-xl">{currentModule}</p>
                  <p className="text-ninja-muted font-ninja text-sm mt-0.5">
                    Lesson {visitedLessons} of {totalLessons}
                  </p>
                </div>
              </motion.div>
              <ProgressBar pct={pct} color={barColor} delay={0.3} label="Module progress" value={`${pct}%`} />
            </>
          ) : (
            <p className="text-ninja-muted font-ninja text-sm italic mb-4">No modules started yet.</p>
          )}

          <p className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide mb-2">
            Module Path
          </p>
          <ModuleGrid modules={aiCurriculum} visited={visitedModules} accentColor={barColor} />
        </div>
      </CourseShell>
    );
  }

  // ── JR ───────────────────────────────────────────────────────────────────────
  if (program === 'JR') {
    const jrCodingLogs = logs.filter((l) => l.sub_program === 'JR Coding');
    const jrCodingHighestIdx = Math.max(-1, ...jrCodingLogs
      .map((l) => JR_CODING_MODULES.indexOf(l.module_name)).filter((i) => i >= 0));
    const jrCodingDone = jrCodingHighestIdx + 1;
    const jrCodingPct = jrCodingDone > 0 ? Math.round((jrCodingDone / JR_CODING_MODULES.length) * 100) : 0;

    const snapLogs = logs.filter((l) => l.sub_program === 'Snap Circuits');
    const snapNums = snapLogs.map((l) => { const m = l.lesson_name?.match(/Project\s+(\d+)/i); return m ? parseInt(m[1], 10) : 0; });
    const snapHighest = snapNums.length > 0 ? Math.max(0, ...snapNums) : 0;
    const snapPct = snapHighest > 0 ? Math.min(100, Math.round((snapHighest / SNAP_CIRCUITS_TOTAL) * 100)) : 0;

    const hasJrCoding = jrCodingLogs.length > 0;
    const hasSnap = snapLogs.length > 0;

    return (
      <CourseShell href={href} program={program}>
        <ProgramCardBanner program="JR" lastDate={lastDate} sessions={totalSessions} href={href} />
        <div className="bg-white p-5 space-y-5">
          {hasJrCoding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide">JR Coding</p>
                <span className="text-ninja-navy font-ninja text-xs font-bold">
                  {jrCodingDone > 0 ? `Module ${jrCodingDone} of ${JR_CODING_MODULES.length}` : 'Not started'}
                </span>
              </div>
              <ProgressBar pct={jrCodingPct} color={barColor} delay={0.3} label="Progress" value={`${jrCodingPct}%`} />
              <motion.div
                className="flex flex-wrap gap-1.5"
                variants={dotContainerVariants}
                initial="hidden"
                animate="show"
              >
                {JR_CODING_MODULES.map((mod, i) => {
                  const done = i < jrCodingDone;
                  const isCurrent = i === jrCodingHighestIdx;
                  return (
                    <motion.div
                      key={mod}
                      title={mod}
                      variants={dotVariants}
                      className="px-2 py-0.5 rounded-lg text-xs font-ninja font-bold border"
                      style={done
                        ? isCurrent
                          ? { backgroundColor: '#16a34a', color: 'white', borderColor: '#16a34a' }
                          : { backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' }
                        : { backgroundColor: '#f8fafc', color: '#94a3b8', borderColor: '#e2e8f0' }
                      }
                    >
                      M{i + 1}
                    </motion.div>
                  );
                })}
              </motion.div>
              <p className="text-ninja-muted font-ninja text-xs mt-1.5">
                {jrCodingDone} of {JR_CODING_MODULES.length} modules complete
                {jrCodingDone > 0 && jrCodingHighestIdx > 0 ? ' (includes all prior modules)' : ''}
              </p>
            </motion.div>
          )}

          {hasSnap && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: hasJrCoding ? 0.25 : 0.15 }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide">Snap Circuits</p>
                <span className="text-ninja-navy font-ninja text-xs font-bold">
                  {snapHighest > 0 ? `Project ${snapHighest} of ${SNAP_CIRCUITS_TOTAL}` : 'Not started'}
                </span>
              </div>
              <ProgressBar pct={snapPct} color={barColor} delay={hasJrCoding ? 0.45 : 0.3} label="Progress" value={`${snapPct}%`} />
              <p className="text-ninja-muted font-ninja text-xs mt-1">
                {snapHighest} of {SNAP_CIRCUITS_TOTAL} projects complete
              </p>
            </motion.div>
          )}

          {!hasJrCoding && !hasSnap && (
            <p className="text-ninja-muted font-ninja text-sm italic">No sessions logged yet.</p>
          )}
        </div>
      </CourseShell>
    );
  }

  // ── Robotics Academy ─────────────────────────────────────────────────────────
  if (program === 'Robotics Academy') {
    const currentKit = enrollment?.last_sub_program;
    const currentKitIndex = currentKit ? KIT_ORDER.indexOf(currentKit) : -1;
    const totalModules = currentKit ? (KIT_TOTALS[currentKit] ?? 0) : 0;
    const visitedModules = currentKit
      ? new Set(logs.filter((l) => l.sub_program === currentKit).map((l) => l.module_name).filter(Boolean)).size
      : 0;
    const pct = totalModules > 0 ? Math.round((visitedModules / totalModules) * 100) : 0;
    const currentKitModules = currentKit ? (CURRICULUM[currentKit] || []) : [];
    const visitedModuleNames = currentKit
      ? new Set(logs.filter((l) => l.sub_program === currentKit).map((l) => l.module_name).filter(Boolean))
      : new Set();

    return (
      <CourseShell href={href} program={program}>
        <ProgramCardBanner program="Robotics Academy" lastDate={lastDate} href={href} />
        <div className="bg-white p-5">
          {currentKit ? (
            <>
              <motion.div
                className="mb-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.35 }}
              >
                <p className="text-ninja-navy font-ninja font-bold text-xl">{currentKit}</p>
                <p className="text-ninja-muted font-ninja text-sm mt-0.5">
                  Module {visitedModules} of {totalModules}
                </p>
              </motion.div>
              <ProgressBar pct={pct} color={barColor} delay={0.3} label="Kit progress" value={`${pct}%`} />
            </>
          ) : (
            <p className="text-ninja-muted font-ninja text-sm italic mb-4">No kit started yet.</p>
          )}

          <p className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide mb-2">
            Kit Path
          </p>
          <KitPath
            kitOrder={KIT_ORDER}
            kitShort={KIT_SHORT}
            currentKitIndex={currentKitIndex}
            barColor={barColor}
          />

          {currentKit && (
            <>
              <p className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide mb-2">
                Module Path
              </p>
              <ModuleGrid modules={currentKitModules} visited={visitedModuleNames} accentColor={barColor} />
            </>
          )}
        </div>
      </CourseShell>
    );
  }

  // ── Fallback ─────────────────────────────────────────────────────────────────
  const pct = enrollment?.percent_complete ?? 0;
  const modules = CURRICULUM[program] || [];
  const visited = new Set(logs.map((l) => l.module_name).filter(Boolean));

  // The banner is not a decoration Robotics and AI happen to get: every
  // program has its own lockup off the Canva sheet, and a card that opened
  // with a heading in navy while its neighbours opened with art read as the
  // one program nobody had finished. VR Coding lands here, and it arrives with
  // its own logo on its own gradient.
  return (
    <CourseShell href={href} program={program}>
      <ProgramCardBanner program={program} lastDate={lastDate} sessions={totalSessions} href={href} />
      <div className="bg-white p-5">
        <ProgressBar pct={pct} color={barColor} delay={0.2} label="Progress" value={`${pct}%`} />
        <ModuleGrid modules={modules} visited={visited} accentColor={barColor} />
        {modules.length === 0 && totalSessions === 0 && (
          <p className="text-ninja-muted font-ninja text-sm italic">No sessions logged yet.</p>
        )}
      </div>
    </CourseShell>
  );
}

// ─── Entry point ──────────────────────────────────────────────────────────────

// Activity, then Courses. `courseHref` is what turns the second half into a
// section rather than a read-out: given one, every card opens the course it
// describes. Without it the cards are exactly what they were.
export default function ProgressVisuals({ programs, sessionLogs, childName, courseHref }) {
  const create = programs.find((p) => p.program === 'CREATE');
  const others = programs.filter((p) => p.program !== 'CREATE');
  const href = (name) => (courseHref ? courseHref(name) : null);
  const count = programs.length;

  return (
    <div className="space-y-4 lg:space-y-5">
      <ActivityChart logs={sessionLogs} />

      <div className="space-y-3">
        <PageTitle
          title="Courses"
          eyebrow={[childName, `${count} program${count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
          className="pt-2"
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:items-start">
          {create && (
            <div className="xl:col-span-2">
              <BeltJourney enrollment={create} childName={childName} href={href('CREATE')} />
            </div>
          )}
          {others.map((p) => (
            <ModuleProgress
              key={p.program}
              program={p.program}
              enrollment={p}
              logs={sessionLogs.filter((l) => l.program === p.program)}
              href={href(p.program)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
