import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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

function StatCard({ label, value, sub }) {
  return (
    <div className={`${CARD} p-4`}>
      <p className="text-ninja-muted font-ninja text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="font-ninja font-black text-3xl leading-none text-ninja-navy tabular-nums">{value}</p>
      {sub && <p className="text-ninja-muted font-ninja text-xs mt-1">{sub}</p>}
    </div>
  );
}

// Both distributions are horizontal bars, so the category sits on the Y axis
// and the count runs along X. The identity of a row is its artwork — a program
// logo, a belt icon — so the tick renders an <image> rather than a text label.
// That is the whole reason these are custom ticks: a plain Recharts category
// axis can only draw text.
const ROW_H = 34;
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
        <Bar dataKey="count" radius={[999, 999, 999, 999]} animationDuration={600} barSize={14}>
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
  const rows = data.map((r) => ({
    name: r.program,
    count: r.count,
    pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
    color: ENROLLMENT_COLORS[r.program] || '#6b7280',
  }));

  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-ninja-navy font-ninja font-bold text-base">Enrollment by Program</h3>
        <span className="font-ninja text-xs text-ninja-muted">{total} enrolled</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-ninja-muted font-ninja text-sm">No enrollments yet.</p>
      ) : (
        <DistributionBars rows={rows} unit="ninja" tickSrc={(name) => PROGRAM_LOGOS[name]} />
      )}
    </div>
  );
}

function BeltChart({ data }) {
  const sorted = [...data].sort((a, b) => BELT_ORDER.indexOf(a.belt_level) - BELT_ORDER.indexOf(b.belt_level));
  const total = sorted.reduce((s, r) => s + r.count, 0);
  const rows = sorted.map((r) => ({
    name: r.belt_level,
    count: r.count,
    color: BELT_COLOR[r.belt_level] || '#e5e7eb',
    // White on a white card needs an outline or the bar disappears.
    stroke: r.belt_level === 'White' ? '#d1d5db' : undefined,
  }));

  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-ninja-navy font-ninja font-bold text-base">Belt Distribution (CREATE)</h3>
        <span className="font-ninja text-xs text-ninja-muted">{total} ninja{total === 1 ? '' : 's'}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-ninja-muted font-ninja text-sm">No CREATE students yet.</p>
      ) : (
        <DistributionBars rows={rows} unit="ninja" tickSrc={(belt) => BELT_IMAGES[belt]} />
      )}
    </div>
  );
}


function InactiveTable({ data }) {
  return (
    <div className={`${CARD} p-5`}>
      <h3 className="text-ninja-navy font-ninja font-bold text-base mb-1">No Check-Ins (Last 30 Days)</h3>
      <p className="text-ninja-muted font-ninja text-xs mb-4">{data.length} student{data.length !== 1 ? 's' : ''}</p>
      {data.length === 0 ? (
        <p className="text-ninja-muted font-ninja text-sm">All students active recently.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {data.map(s => (
            <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-ninja-border last:border-0">
              <a href={`/manager/students/${s.id}`} className="font-ninja text-sm text-ninja-navy hover:text-ninja-blue transition-colors">
                {s.full_name}
              </a>
              <span className="font-ninja text-xs text-ninja-muted">
                {s.last_session ? `Last: ${formatDate(s.last_session)}` : 'Never logged'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BeltLog({ data }) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-ninja-navy font-ninja font-bold text-base">Belt Advancements</h3>
        <span className="font-ninja text-xs text-ninja-muted">Last 30 days</span>
      </div>
      {data.length === 0 ? (
        <p className="text-ninja-muted font-ninja text-sm">No belt advancements recorded yet.</p>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
          {data.map((row, i) => (
            <motion.div
              key={`${row.full_name}-${row.session_date}-${row.belt_level_at}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3), ease: 'easeOut' }}
              className="flex items-center gap-3 py-2 border-b border-ninja-border last:border-0"
            >
              <BeltIcon belt={row.belt_level_at} size={30} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-ninja text-sm text-ninja-navy truncate">{row.full_name}</p>
                <p className="font-ninja text-xs text-ninja-muted truncate">Earned {row.belt_level_at}{row.belt_sublevel_at ? ` · Lv ${row.belt_sublevel_at}` : ''}</p>
              </div>
              <span className="font-ninja text-xs text-ninja-muted text-right shrink-0">{formatDate(row.session_date)}<br />{authorName(row.sensei_name)}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-ninja-navy font-ninja font-bold text-2xl">Reports</h1>
          <p className="text-ninja-muted font-ninja text-sm mt-0.5">Enrollment and activity overview</p>
        </div>

        {loading && <SkeletonCards count={6} label="Loading reports" />}
        {error && <p className="text-ninja-red font-ninja text-center py-12">{error}</p>}

        {data && (
          <div className="space-y-5">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Students" value={totalStudents} />
              <StatCard label="Programs" value={data.enrollment.length} />
              <StatCard label="Belt-Ups 30d" value={data.beltLog.length} sub="recent advancements" />
              <StatCard label="Inactive 30d" value={data.inactive.length} sub="no check-in" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EnrollmentChart data={data.enrollment} />
              <BeltChart data={data.belts} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InactiveTable data={data.inactive} />
              <BeltLog data={data.beltLog} />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
