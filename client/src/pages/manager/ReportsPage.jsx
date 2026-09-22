import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from 'recharts';
import Layout from '../../components/layout/Layout';
import { ChartContainer, ChartTooltip } from '../../components/ui/chart';
import { api } from '../../api/client';
import { BELTS, PROGRAM_LOGOS } from '../../utils/beltConfig';
import { formatDate } from '../../utils/dateUtils';
import BeltIcon, { beltIconSrc } from '../../components/ui/BeltIcon';
import { CARD } from '../../lib/surfaces';
import { authorName } from '../../lib/authors';
import { SkeletonCards } from '../../components/ui/Skeleton';

const BELT_COLOR = Object.fromEntries(BELTS.map(b => [b.name, b.color]));
const BELT_TEXT = Object.fromEntries(BELTS.map(b => [b.name, b.textColor]));
const BELT_ORDER = BELTS.map(b => b.name);

const ENROLLMENT_COLORS = { CREATE: '#006ADD', 'Robotics Academy': '#7c3aed', 'AI Academy': '#0891b2', JR: '#16a34a', 'VR Coding': '#14b8a6' };

// Same files BeltIcon serves. An SVG <image> inside the chart can't mount a
// React component, so the axis ticks need the path itself.
const BELT_IMAGES = Object.fromEntries(BELT_ORDER.map((name) => [name, beltIconSrc(name)]));

// One surface for the headline numbers, split by hairlines. Four separate
// cards made four boxes that each held a single number, which is most of what
// made this page read as blocky. Nothing here is a control, so nothing needs its
// own edge.
function StatStrip({ stats }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-ninja-border">
        {stats.map((s) => (
          <div key={s.label} className="bg-white px-5 py-5 sm:px-6">
            <dt className="font-ninja text-sm text-ninja-muted">{s.label}</dt>
            <dd className={`mt-1.5 font-ninja font-black text-3xl sm:text-4xl leading-none tabular-nums tracking-tight ${s.tone || 'text-ninja-navy'}`}>
              {s.value}
            </dd>
            {s.sub && <dd className="mt-2 font-ninja text-xs text-ninja-muted">{s.sub}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}

function Section({ title, description, className = '', children }) {
  return (
    <section className={`${CARD} p-5 sm:p-6 flex flex-col min-w-0 ${className}`}>
      <header className="mb-5">
        <h2 className="text-ninja-navy font-ninja font-bold text-base leading-tight">{title}</h2>
        {description && <p className="mt-1 font-ninja text-sm text-ninja-muted">{description}</p>}
      </header>
      {children}
    </section>
  );
}

// Both distributions are horizontal bars, so the category sits on the Y axis
// and the count runs along X. The identity of a row is its artwork — a program
// logo, a belt icon — so the tick renders an <image> rather than a text label.
// That is the whole reason these are custom ticks: a plain Recharts category
// axis can only draw text.
const ROW_H = 38;
const TICK_FONT = '12px Nunito, sans-serif';
const ICON_W = 22;      // artwork box
const ICON_GAP = 6;
const LABEL_GAP = 10;   // breathing room between the label and the bar
const PAD_L = 2;        // keeps the artwork off the very edge of the plot
const AXIS_MIN = 96;
const AXIS_MAX = 190;

// A left axis hands its tick `x = axisLine - tickSize - tickMargin`, and those
// default to 6 and 2. Content laid out from the tick's own x was landing eight
// pixels left of the band, which clipped the left edge off every program logo.
// Zeroing both makes the tick x the axis line exactly, so -axisW is the band's
// left edge and the arithmetic below is true rather than nearly true.
// (tickLine={false} does NOT zero tickSize — it only stops the line drawing.)
const TICK_SIZE = 0;
const TICK_MARGIN = 0;

// The axis band was a fixed 96px, so "Robotics Academy" overflowed it and ran
// underneath its own bar. Measure the labels instead: the band is only ever as
// wide as the longest one actually needs.
let measureCtx = null;
function textWidth(text) {
  if (typeof document === 'undefined') return String(text).length * 6.6;
  measureCtx ||= document.createElement('canvas').getContext('2d');
  measureCtx.font = TICK_FONT;
  return measureCtx.measureText(String(text)).width;
}

function axisWidthFor(rows, tickLabel, hasIcons) {
  const widest = rows.reduce((w, r) => Math.max(w, textWidth(tickLabel(r.name))), 0);
  const lead = hasIcons ? ICON_W + ICON_GAP : 0;
  return Math.min(AXIS_MAX, Math.max(AXIS_MIN, Math.ceil(PAD_L + lead + widest + LABEL_GAP)));
}

// Trims to fit rather than letting the label run over the bars. Only bites for
// a name longer than AXIS_MAX allows; the full text stays in the tooltip.
function ellipsize(text, room) {
  if (textWidth(text) <= room) return text;
  let out = text;
  while (out.length > 1 && textWidth(`${out}…`) > room) out = out.slice(0, -1);
  return `${out}…`;
}

function ImageTick({ x, y, payload, src, label, axisW }) {
  const full = label(payload.value);
  const lead = src ? ICON_W + ICON_GAP : 0;
  const room = axisW - PAD_L - lead - LABEL_GAP;
  // Laid out rightward from the band's left edge, which the zeroed tickSize and
  // tickMargin above make exactly `x - axisW`.
  const left = -axisW + PAD_L;
  return (
    <g transform={`translate(${x},${y})`}>
      {src && <image href={src} x={left} y={-11} width={ICON_W} height={ICON_W} preserveAspectRatio="xMidYMid meet" />}
      <text
        x={left + lead}
        y={0}
        dy="0.32em"
        className="fill-ninja-navy font-ninja"
        fontSize={12}
      >
        {ellipsize(full, room)}
        <title>{full}</title>
      </text>
    </g>
  );
}

function CountTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-ninja-border bg-white px-2.5 py-1.5 shadow-lg">
      <span className="block font-ninja text-[11px] text-ninja-muted leading-tight">{row.name}</span>
      <span className="block font-ninja text-sm font-bold text-ninja-navy leading-tight tabular-nums">
        {row.count} {unit}{row.count === 1 ? '' : 's'}
        {row.pct != null && <span className="text-ninja-muted font-normal"> · {row.pct}%</span>}
      </span>
    </div>
  );
}

// Bars carry per-row colours (a belt is its belt colour, a program its brand
// colour), which Recharts takes as a <Cell> per datum rather than one series
// colour.
function DistributionBars({ rows, unit, tickSrc, tickLabel = (v) => v }) {
  const height = Math.max(ROW_H * rows.length, ROW_H);
  // Measured every render on purpose: it is a handful of canvas measureText
  // calls, and memoising it would key off callers' inline arrows and never hit.
  const axisW = axisWidthFor(rows, tickLabel, rows.some((r) => tickSrc(r.name)));
  // Left margin stays 0: the YAxis already reserves the band and the tick draws
  // itself back into it, so adding it here as well would indent the plot by
  // twice the label width.
  return (
    <ChartContainer config={{ count: { label: unit } }} className="w-full" style={{ height }}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
        barCategoryGap="22%"
      >
        <XAxis type="number" hide domain={[0, (max) => Math.max(1, max)]} />
        <YAxis
          type="category"
          dataKey="name"
          width={axisW}
          axisLine={false}
          tickLine={false}
          tickSize={TICK_SIZE}
          tickMargin={TICK_MARGIN}
          tick={(props) => (
            <ImageTick {...props} axisW={axisW} src={tickSrc(props.payload.value)} label={tickLabel} />
          )}
        />
        <ChartTooltip
          cursor={{ fill: 'rgb(var(--ninja-muted) / 0.08)' }}
          content={<CountTooltip unit={unit} />}
        />
        {/* The track gives every bar the same far end, so a short bar reads as
            a share of the busiest row instead of floating in blank space. */}
        <Bar
          dataKey="count"
          radius={[999, 999, 999, 999]}
          animationDuration={600}
          barSize={12}
          background={{ fill: 'rgb(var(--ninja-muted) / 0.1)', radius: 999 }}
        >
          {rows.map((row) => (
            <Cell key={row.name} fill={row.color} stroke={row.stroke || 'none'} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            offset={8}
            className="fill-ninja-navy font-ninja"
            fontSize={12}
            fontWeight={700}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function EnrollmentChart({ data }) {
  const total = data.reduce((s, r) => s + r.count, 0);
  // Largest first: the eye reads the top row as the headline.
  const rows = [...data].sort((a, b) => b.count - a.count).map((r) => ({
    name: r.program,
    count: r.count,
    pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
    color: ENROLLMENT_COLORS[r.program] || '#6b7280',
  }));

  return (
    <Section title="Enrollment by program" description={`${total} enrollment${total === 1 ? '' : 's'} across ${rows.length} program${rows.length === 1 ? '' : 's'}`}>
      {rows.length === 0 ? (
        <p className="text-ninja-muted font-ninja text-sm">No enrollments yet.</p>
      ) : (
        <DistributionBars rows={rows} unit="ninja" tickSrc={(name) => PROGRAM_LOGOS[name]} />
      )}
    </Section>
  );
}

function BeltChart({ data }) {
  const sorted = [...data].sort((a, b) => BELT_ORDER.indexOf(a.belt_level) - BELT_ORDER.indexOf(b.belt_level));
  const total = sorted.reduce((s, r) => s + r.count, 0);
  const rows = sorted.map((r) => ({
    name: r.belt_level,
    count: r.count,
    pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
    color: BELT_COLOR[r.belt_level] || '#e5e7eb',
    // White on a white card needs an outline or the bar disappears.
    stroke: r.belt_level === 'White' ? '#d1d5db' : undefined,
  }));

  return (
    <Section title="CREATE belts" description={`${total} ninja${total === 1 ? '' : 's'} on the ladder`}>
      {rows.length === 0 ? (
        <p className="text-ninja-muted font-ninja text-sm">No CREATE students yet.</p>
      ) : (
        <DistributionBars rows={rows} unit="ninja" tickSrc={(belt) => BELT_IMAGES[belt]} />
      )}
    </Section>
  );
}

// Days since a YYYY-MM-DD, counted in local calendar days (a pg DATE arrives as
// UTC midnight, so raw milliseconds would be off by one every evening).
function daysSince(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - then) / 86400000);
}

function InactiveTable({ data, className }) {
  const never = data.filter((s) => !s.last_session).length;
  const description = data.length === 0
    ? 'Everyone has checked in recently'
    : `${data.length} ninja${data.length === 1 ? '' : 's'}${never ? ` · ${never} never checked in` : ''}`;

  return (
    <Section title="No check-ins in 30 days" description={description} className={className}>
      {data.length === 0 ? (
        <p className="text-ninja-muted font-ninja text-sm">All students active recently.</p>
      ) : (
        // Two columns once there is room: a list of names is short and wide
        // screens were spending most of this card on empty space.
        <ul className="grid sm:grid-cols-2 gap-x-6 max-h-80 overflow-y-auto -mx-2 pr-1">
          {data.map((s) => (
            <li key={s.id}>
              <Link
                to={`/manager/students/${s.id}`}
                className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-2 hover:bg-ninja-bg transition-colors"
              >
                <span className="font-ninja text-sm text-ninja-navy truncate">{s.full_name}</span>
                <span className="font-ninja text-xs text-ninja-muted shrink-0 tabular-nums">
                  {s.last_session ? `${daysSince(s.last_session)} days ago` : 'Never'}
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
  // The query hands rows back grouped by student, not by date, so the newest
  // belt could land anywhere in the list.
  const rows = [...data].sort((a, b) => String(b.session_date).localeCompare(String(a.session_date)));
  return (
    <Section title="Belt advancements" description="Last 30 days, newest first" className={className}>
      {rows.length === 0 ? (
        <p className="text-ninja-muted font-ninja text-sm">No belt advancements recorded yet.</p>
      ) : (
        <ul className="-mx-2 max-h-96 overflow-y-auto pr-1 xl:max-h-none xl:flex-1 xl:min-h-0">
          {rows.map((row, i) => (
            <motion.li
              key={`${row.full_name}-${row.session_date}-${row.belt_level_at}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3), ease: 'easeOut' }}
              className="flex items-center gap-3 rounded-lg px-2 py-2.5"
            >
              <BeltIcon belt={row.belt_level_at} size={32} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-ninja text-sm font-semibold text-ninja-navy truncate">{row.full_name}</p>
                <p className="font-ninja text-xs text-ninja-muted truncate">
                  {row.belt_level_at}{row.belt_sublevel_at ? ` · Level ${row.belt_sublevel_at}` : ''} · {authorName(row.sensei_name)}
                </p>
              </div>
              <span className="font-ninja text-xs text-ninja-muted shrink-0 tabular-nums">{formatDate(row.session_date)}</span>
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
                { label: 'Enrollments', value: enrollments, sub: `across ${data.enrollment.length} program${data.enrollment.length === 1 ? '' : 's'}` },
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
