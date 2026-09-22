import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
      <span className="shrink-0">{art}</span>
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
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
