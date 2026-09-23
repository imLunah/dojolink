import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { api } from '../../api/client';
import { BELTS, PROGRAM_LOGOS } from '../../utils/beltConfig';
import BeltIcon from '../../components/ui/BeltIcon';
import { CARD } from '../../lib/surfaces';
import { authorName } from '../../lib/authors';
import { SkeletonCards } from '../../components/ui/Skeleton';

const BELT_COLOR = Object.fromEntries(BELTS.map(b => [b.name, b.color]));
const BELT_ORDER = BELTS.map(b => b.name);

const ENROLLMENT_COLORS = { CREATE: '#006ADD', 'Robotics Academy': '#7c3aed', 'AI Academy': '#0891b2', JR: '#16a34a', 'VR Coding': '#14b8a6' };

// The page is built the way a reporting surface in a component kit is: each
// section is one card holding a stack of tiles a shade off the card, so the
// rows read as objects you could pick up rather than lines ruled across a box.
// The tint is the page token, not bg-white, so it follows the theme and the
// dark overrides never have to fight it.
const TILE = 'rounded-xl border border-ninja-border bg-ninja-bg/60';

// White and Black disappear against a white or a slate card, so every swatch
// carries a neutral hairline drawn inside it. A shadow rather than a border,
// so it costs no width in a bar measured in percent.
const SWATCH_EDGE = 'inset 0 0 0 1px rgb(var(--ninja-border))';

// pg hands DATE columns back as UTC-midnight ISO strings. Read the calendar
// part and build a local date, or every evening lands on the day before.
function localDate(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shortDate(dateStr) {
  return localDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysSince(dateStr) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - localDate(dateStr)) / 86400000);
}

function initials(name) {
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// One surface for the headline numbers, split by hairlines, the way a metric
// strip is: four numbers are one reading, not four objects.
function StatStrip({ stats }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-ninja-border">
        {stats.map((s) => (
          <div key={s.label} className="bg-white px-5 py-4 sm:px-6 sm:py-5">
            <dt className="font-ninja text-[13px] text-ninja-muted">{s.label}</dt>
            <dd className={`mt-1 font-ninja font-bold text-3xl leading-tight tabular-nums tracking-tight ${s.tone || 'text-ninja-navy'}`}>
              {s.value}
            </dd>
            {s.sub && <dd className="mt-0.5 font-ninja text-xs text-ninja-muted">{s.sub}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}

// The card, and the tile at its head that names it. The head is a tile like
// the rows under it, so the whole section is one stack.
function Section({ title, value, unit, children, footer, className = '' }) {
  return (
    <section className={`${CARD} p-2 flex flex-col gap-1.5 min-w-0 ${className}`}>
      <header className={`${TILE} px-4 py-3.5`}>
        <h2 className="font-ninja text-[13px] text-ninja-muted">{title}</h2>
        {value != null && (
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <span className="font-ninja font-bold text-[28px] leading-tight text-ninja-navy tabular-nums tracking-tight">{value}</span>
            {unit && <span className="font-ninja text-[13px] text-ninja-muted">{unit}</span>}
          </p>
        )}
        {footer}
      </header>
      {children}
    </section>
  );
}

// How the whole divides, in one bar. Each segment is a share of the total, so
// the eye gets the split before it reads a single row.
function CompositionBar({ rows, total }) {
  if (total <= 0) return null;
  return (
    <div className="mt-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full" role="img"
      aria-label={rows.map((r) => `${r.name} ${r.count}`).join(', ')}>
      {rows.map((r) => (
        <motion.span
          key={r.name}
          title={`${r.name}: ${r.count}`}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{ backgroundColor: r.color, boxShadow: SWATCH_EDGE }}
          initial={{ width: 0 }}
          animate={{ width: `${(r.count / total) * 100}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </div>
  );
}

// A row of a distribution: identity, a bar against the busiest row, the count
// and its share. The bar's far end is the largest row, not the total, so the
// short rows are still readable as lengths.
function BarRow({ rank, art, name, count, pct, color, max, index }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3), ease: 'easeOut' }}
      className={`${TILE} flex items-center gap-3 px-3 py-2.5`}
    >
      {rank != null && <span className="w-3 shrink-0 text-right font-ninja text-[13px] text-ninja-muted tabular-nums">{rank}</span>}
      {art && <span className="shrink-0">{art}</span>}
      {/* Name and numbers on one line, the bar on its own line under them:
          sharing one line with a name squeezed the bar to a stub in a
          third-width card. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate font-ninja text-[13px] font-semibold text-ninja-navy" title={name}>{name}</span>
          <span className="shrink-0 font-ninja text-[13px] font-semibold text-ninja-navy tabular-nums">{count}</span>
          <span className="w-9 shrink-0 text-right font-ninja text-xs text-ninja-muted tabular-nums">{pct}%</span>
        </div>
        <span className="relative mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ninja-border/60">
          <motion.span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: color, boxShadow: SWATCH_EDGE }}
            initial={{ width: 0 }}
            animate={{ width: `${max > 0 ? Math.max((count / max) * 100, 2) : 0}%` }}
            transition={{ duration: 0.6, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
          />
        </span>
      </div>
    </motion.li>
  );
}

function EnrollmentChart({ data }) {
  const total = data.reduce((s, r) => s + r.count, 0);
  // Largest first: this is a ranking, and the top row is the headline.
  const rows = [...data].sort((a, b) => b.count - a.count).map((r) => ({
    name: r.program,
    count: r.count,
    pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
    color: ENROLLMENT_COLORS[r.program] || '#6b7280',
  }));
  const max = rows[0]?.count || 0;

  return (
    <Section
      title="Enrollment by program"
      value={total}
      unit={`enrollment${total === 1 ? '' : 's'} across ${plural(rows.length, 'program')}`}
      footer={<CompositionBar rows={rows} total={total} />}
    >
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-ninja-muted font-ninja text-sm">No enrollments yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <BarRow
              key={r.name}
              index={i}
              rank={i + 1}
              art={
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-ninja-border bg-white">
                  {PROGRAM_LOGOS[r.name]
                    ? <img src={PROGRAM_LOGOS[r.name]} alt="" className="h-5 w-5 object-contain" />
                    : <span className="font-ninja text-[11px] font-semibold text-ninja-navy">{initials(r.name)}</span>}
                </span>
              }
              name={r.name}
              count={r.count}
              pct={r.pct}
              color={r.color}
              max={max}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function BeltChart({ data }) {
  // Ladder order, not ranked: the belts are a sequence and the shape of the
  // roster along it is the point.
  const sorted = [...data].sort((a, b) => BELT_ORDER.indexOf(a.belt_level) - BELT_ORDER.indexOf(b.belt_level));
  const total = sorted.reduce((s, r) => s + r.count, 0);
  const rows = sorted.map((r) => ({
    name: r.belt_level,
    count: r.count,
    pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
    color: BELT_COLOR[r.belt_level] || '#e5e7eb',
  }));
  const max = Math.max(0, ...rows.map((r) => r.count));

  return (
    <Section
      title="CREATE belts"
      value={total}
      unit={`ninja${total === 1 ? '' : 's'} on the ladder`}
      footer={<CompositionBar rows={rows} total={total} />}
    >
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-ninja-muted font-ninja text-sm">No CREATE students yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <BarRow
              key={r.name}
              index={i}
              art={<BeltIcon belt={r.name} size={26} />}
              name={r.name}
              count={r.count}
              pct={r.pct}
              color={r.color}
              max={max}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function InactiveTable({ data, className }) {
  const never = data.filter((s) => !s.last_session).length;

  return (
    <Section
      title="No check-ins in 30 days"
      value={data.length}
      unit={never ? `ninja${data.length === 1 ? '' : 's'} · ${never} never checked in` : `ninja${data.length === 1 ? '' : 's'}`}
      className={className}
    >
      {data.length === 0 ? (
        <p className="px-3 py-4 text-ninja-muted font-ninja text-sm">All students active recently.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-1.5 max-h-80 overflow-y-auto">
          {data.map((s) => (
            <li key={s.id}>
              <Link
                to={`/manager/students/${s.id}`}
                className={`${TILE} flex items-center gap-3 px-3 py-2 transition-colors hover:bg-ninja-bg`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ninja-border/70 font-ninja text-[11px] font-semibold text-ninja-navy">
                  {initials(s.full_name)}
                </span>
                <span className="min-w-0 flex-1 truncate font-ninja text-[13px] font-semibold text-ninja-navy">{s.full_name}</span>
                <span className="shrink-0 font-ninja text-xs text-ninja-muted tabular-nums">
                  {s.last_session ? `${daysSince(s.last_session)}d ago` : 'Never'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function BeltLog({ data, className }) {
  // The query groups rows by student, not by date, so the newest belt could
  // land anywhere in the list.
  const rows = [...data].sort((a, b) => String(b.session_date).localeCompare(String(a.session_date)));
  return (
    <Section title="Belt advancements · last 30 days" value={rows.length} unit={`belt-up${rows.length === 1 ? '' : 's'}`} className={className}>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-ninja-muted font-ninja text-sm">No belt advancements recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 max-h-96 overflow-y-auto xl:max-h-none xl:flex-1 xl:min-h-0">
          {rows.map((row, i) => (
            <motion.li
              key={`${row.full_name}-${row.session_date}-${row.belt_level_at}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3), ease: 'easeOut' }}
              className={`${TILE} flex items-center gap-3 px-3 py-2`}
            >
              <BeltIcon belt={row.belt_level_at} size={28} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-ninja text-[13px] font-semibold text-ninja-navy truncate">{row.full_name}</p>
                <p className="font-ninja text-xs text-ninja-muted truncate">
                  {row.belt_level_at}{row.belt_sublevel_at ? ` · Level ${row.belt_sublevel_at}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-ninja text-[13px] text-ninja-navy tabular-nums">{shortDate(row.session_date)}</p>
                <p className="font-ninja text-xs text-ninja-muted truncate max-w-[9rem]">{authorName(row.sensei_name)}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// The centers are all in California; "today" is theirs, not the browser's.
function centerToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

function shiftDay(dateStr, by) {
  const d = localDate(dateStr);
  d.setDate(d.getDate() + by);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hourLabel(h) {
  const fmt = (x) => `${x % 12 === 0 ? 12 : x % 12}`;
  const suffix = (x) => (x % 24 < 12 ? 'AM' : 'PM');
  const end = h + 1;
  return suffix(h) === suffix(end)
    ? `${fmt(h)}-${fmt(end)} ${suffix(end)}`
    : `${fmt(h)} ${suffix(h)}-${fmt(end)} ${suffix(end)}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Sunday is closed at every center, so it is not offered. The opening hours
// themselves come back from the server with the data (CENTER_HOURS in
// routes/reports.js), so there is one copy of them.
const OPEN_WEEKDAYS = [1, 2, 3, 4, 5, 6];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_OPTIONS = [4, 8, 12];
const HOUR_BLUE = '#006ADD';

function median(values) {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return Math.round(v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2);
}

// Two buttons sharing one track, the pressed one lifted onto a tile.
function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-ninja-border bg-ninja-bg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-7 rounded-md px-2.5 font-ninja text-[13px] transition-colors ${
            value === o.value ? 'bg-white text-ninja-navy font-semibold shadow-sm' : 'text-ninja-muted hover:text-ninja-navy'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// One hour. The headline is how many ninjas were in the room at once, because
// that is what a sensei has to cover; arrivals sit underneath. Over a range of
// weeks the bar is solid to the typical day and pale out to the busiest, so the
// gap between the two is the part a schedule has to absorb.
function HourRow({ hour, peak, peakMax, arrivals, arrivalsMax, scale, pattern, index }) {
  const pctOf = (n) => (scale > 0 ? `${Math.max((n / scale) * 100, n > 0 ? 2 : 0)}%` : '0%');
  const ease = { duration: 0.6, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] };
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3), ease: 'easeOut' }}
      className={`${TILE} px-3 py-2.5`}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate font-ninja text-[13px] font-semibold text-ninja-navy">{hourLabel(hour)}</span>
        <span className="shrink-0 font-ninja text-[13px] text-ninja-muted">
          <span className="font-semibold text-ninja-navy tabular-nums">{peak}</span>
          {pattern ? <> at once, up to <span className="font-semibold text-ninja-navy tabular-nums">{peakMax}</span></> : ' at once'}
        </span>
      </div>
      <span className="relative mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ninja-border/60">
        {pattern && (
          <motion.span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: HOUR_BLUE, opacity: 0.3 }}
            initial={{ width: 0 }}
            animate={{ width: pctOf(peakMax) }}
            transition={ease}
          />
        )}
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: HOUR_BLUE }}
          initial={{ width: 0 }}
          animate={{ width: pctOf(peak) }}
          transition={ease}
        />
      </span>
      <p className="mt-1 font-ninja text-xs text-ninja-muted tabular-nums">
        {pattern ? `${arrivals} arrived, up to ${arrivalsMax}` : `${arrivals} arrived`}
      </p>
    </motion.li>
  );
}

// The load on the floor hour by hour, for staffing. "Typical day" is one
// weekday across several weeks, median and busiest, because walk-ins make any
// single day a poor guide to the next one. "One day" is a single date.
// Every hour the center is open gets a row, empty ones included, and a day the
// center had no check-ins at all is a closed day, not a zero.
function CheckinsByHour({ className }) {
  const today = centerToday();
  const [mode, setMode] = useState('typical');
  const [weekday, setWeekday] = useState(() => localDate(today).getDay() || 1);
  const [weeks, setWeeks] = useState(8);
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const query = mode === 'typical' ? `weekday=${weekday}&weeks=${weeks}` : `date=${date}`;
  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    api.get(`/reports/checkins-by-hour?${query}`)
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError(e?.message || 'Failed to load check-ins'); });
    return () => { live = false; };
  }, [query]);

  const pattern = mode === 'typical';
  const days = data?.days || [];
  const cells = new Map((data?.hours || []).map((r) => [`${r.day} ${r.hour}`, r]));
  const open = data?.open || null;
  const rows = open && days.length
    ? Array.from({ length: open[1] - open[0] }, (_, i) => open[0] + i).map((hour) => {
        const peaks = days.map((d) => cells.get(`${d} ${hour}`)?.peak || 0);
        const arrivals = days.map((d) => cells.get(`${d} ${hour}`)?.arrivals || 0);
        return {
          hour,
          peak: median(peaks),
          peakMax: Math.max(0, ...peaks),
          arrivals: median(arrivals),
          arrivalsMax: Math.max(0, ...arrivals),
        };
      })
    : [];
  const dayTotals = days.map((d) => (data?.hours || []).filter((r) => r.day === d).reduce((s, r) => s + r.arrivals, 0));
  const typicalTotal = median(dayTotals);
  const busiestTotal = Math.max(0, ...dayTotals);
  const scale = Math.max(0, ...rows.map((r) => r.peakMax));

  const dayName = localDate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const title = pattern ? `Check-ins by hour · ${WEEKDAY_NAMES[weekday]}s, last ${weeks} weeks` : `Check-ins by hour · ${dayName}`;
  const unit = !data ? undefined
    : pattern
      ? (days.length ? `ninjas on a typical ${WEEKDAY_NAMES[weekday]}, up to ${busiestTotal} · ${plural(days.length, 'day')}` : undefined)
      : `ninja${typicalTotal === 1 ? '' : 's'} checked in`;

  const stepBtn = 'flex h-8 w-8 items-center justify-center rounded-lg border border-ninja-border text-ninja-navy transition-colors hover:bg-ninja-bg disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <Section
      title={title}
      value={data && days.length ? typicalTotal : data && !pattern ? 0 : null}
      unit={unit}
      className={className}
      footer={
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Segmented
              label="View"
              value={mode}
              onChange={setMode}
              options={[{ value: 'typical', label: 'Typical day' }, { value: 'day', label: 'One day' }]}
            />
            {pattern ? (
              <>
                <Segmented
                  label="Weekday"
                  value={weekday}
                  onChange={setWeekday}
                  options={OPEN_WEEKDAYS.map((i) => ({ value: i, label: WEEKDAYS[i] }))}
                />
                <Segmented
                  label="Weeks"
                  value={weeks}
                  onChange={setWeeks}
                  options={WEEK_OPTIONS.map((n) => ({ value: n, label: `${n} wks` }))}
                />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" className={stepBtn} onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day">
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  aria-label="Day"
                  className="h-8 rounded-lg border border-ninja-border bg-white px-2 font-ninja text-[13px] text-ninja-navy"
                />
                <button type="button" className={stepBtn} onClick={() => setDate(shiftDay(date, 1))} disabled={date >= today} aria-label="Next day">
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <p className="mt-2 font-ninja text-xs text-ninja-muted">
            At once assumes each class runs an hour, since check-outs aren&apos;t recorded.
          </p>
        </>
      }
    >
      {error ? (
        <p className="px-3 py-4 text-ninja-red font-ninja text-sm">{error}</p>
      ) : !data ? (
        <SkeletonCards count={3} height={68} label="Loading check-ins" />
      ) : rows.length === 0 ? (
        <p className="px-3 py-4 text-ninja-muted font-ninja text-sm">
          {!open ? 'The center is closed on Sundays.'
            : pattern ? `No check-ins on ${WEEKDAY_NAMES[weekday]}s in the last ${weeks} weeks.` : 'No check-ins on this day.'}
        </p>
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r, i) => (
            <HourRow key={r.hour} index={i} scale={scale} pattern={pattern} {...r} />
          ))}
        </ul>
      )}
    </Section>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/reports/overview')
      .then(d => setData(d))
      .catch(e => setError(e?.message || 'Failed to load report data'))
      .finally(() => setLoading(false));
  }, []);

  const totalStudents = data?.totalStudents ?? data?.enrollment.reduce((s, r) => s + r.count, 0) ?? 0;
  const enrollments = data?.enrollment.reduce((s, r) => s + r.count, 0) ?? 0;
  const inactivePct = totalStudents > 0 && data ? Math.round((data.inactive.length / totalStudents) * 100) : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* A page title sits on the page, same as the dashboard's masthead. */}
        <header>
          <h1 className="text-3xl sm:text-4xl font-black font-ninja text-ninja-navy tracking-tight">Reports</h1>
          <p className="text-ninja-muted font-ninja text-sm mt-1">Enrollment and activity at this center</p>
        </header>

        {loading && <SkeletonCards count={6} label="Loading reports" />}
        {error && <p className="text-ninja-red font-ninja text-center py-12">{error}</p>}

        {data && (
          <>
            <StatStrip
              stats={[
                { label: 'Active ninjas', value: totalStudents },
                { label: 'Enrollments', value: enrollments, sub: `across ${plural(data.enrollment.length, 'program')}` },
                { label: 'Belt-ups', value: data.beltLog.length, sub: 'last 30 days' },
                {
                  label: 'Inactive',
                  value: data.inactive.length,
                  sub: `${inactivePct}% of ninjas, no check-in in 30 days`,
                  tone: data.inactive.length > 0 ? 'text-ninja-red' : undefined,
                },
              ]}
            />

            {/* Two across on a laptop, three on a wide screen with the belt log
                running the full height of the right column. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              <EnrollmentChart data={data.enrollment} />
              <BeltChart data={data.belts} />
              <InactiveTable data={data.inactive} className="xl:col-span-2" />
              {/* contain:size stops the log's length from setting the row
                  heights; it stretches to what its neighbours need and scrolls. */}
              <BeltLog
                data={data.beltLog}
                className="xl:col-start-3 xl:row-start-1 xl:row-span-2 xl:[contain:size]"
              />
              <CheckinsByHour className="lg:col-span-2 xl:col-span-3" />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
