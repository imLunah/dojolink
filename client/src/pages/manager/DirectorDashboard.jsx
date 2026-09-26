import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Area, AreaChart as RechartsAreaChart, XAxis, YAxis } from 'recharts';
import {
  ChartNoAxesColumnIncreasingIcon as ReportsIcon,
  GiftIcon,
  BookOpenIcon as CurriculumIcon,
  MegaphoneIcon,
  ClipboardCheckIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  TabletSmartphoneIcon,
  TimerIcon,
  MilestoneIcon,
} from 'lucide-react';
import Layout from '../../components/layout/Layout';
import NotificationBell from '../../components/shared/NotificationBell';
import { ChartContainer, ChartTooltip } from '../../components/ui/chart';
import EventCalendar from '../../components/manager/EventCalendar';
import TasksQuickLink from '../../components/manager/TasksQuickLink';
import ExpectedToday from '../../components/manager/ExpectedToday';
import MyStudioReconnect from '../../components/manager/MyStudioReconnect';
import Modal from '../../components/ui/Modal';
import { api } from '../../api/client';
import { today, formatDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import { CARD, PANEL } from '../../lib/surfaces';
import { Skeleton } from '../../components/ui/Skeleton';
import useExpectedToday from '../../lib/useExpectedToday';
import useLiveRefresh from '../../lib/useLiveRefresh';

// Strong ease-out (Emil's design-eng default). The built-in easeOut is too
// weak to read as intentional; this matches the CSS --ease-out token.
const EASE = [0.23, 1, 0.32, 1];

// Count-up number. rAF-driven; eases out so it settles rather than snaps.
function CountUp({ value = 0, className }) {
  const [n, setN] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const from = ref.current;
    const to = value;
    if (from === to) { setN(to); return; }
    let raf;
    let start;
    const dur = 650;
    const step = (t) => {
      if (start === undefined) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else ref.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  // Tabular figures: proportional digits change width as the count ticks up, so
  // the text beside it visibly shuffles for the whole animation.
  return <span className={`tabular-nums ${className}`}>{n}</span>;
}

/* ------------------------------------------------------------ check-ins -- */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Calendar maths. setDate() is DST safe in a way that adding milliseconds is
// not, so every date shift goes through addDays rather than arithmetic on the
// timestamp.
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d) => { const x = startOfDay(d); return addDays(x, -x.getDay()); };
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
const sameDay = (a, b) => dayKey(a) === dayKey(b);

const within = (rows, span) =>
  span ? rows.filter((r) => r.date >= span.start && r.date <= span.end) : [];

// The API only returns days that had a check-in. Expand to every day from the
// first one on record through today, so the chart has an even x axis and quiet
// days read as real zeroes. Ranges are then sliced off the tail of this.
function buildDays(attendance) {
  const rows = attendance || [];
  if (rows.length === 0) return [];
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const [y, m, d] = rows[0].day.split('-').map(Number);
  const cursor = new Date(y, m - 1, d);
  const map = new Map(rows.map((r) => [r.day, r.count]));
  const out = [];
  while (cursor <= end) {
    const date = new Date(cursor);
    out.push({ date, count: map.get(dayKey(date)) || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// Calendar weeks starting Sunday, most recent `weeks` of them.
function toWeeks(dayRows, weeks = Infinity) {
  const buckets = new Map();
  for (const row of dayRows) {
    const start = new Date(row.date);
    start.setDate(start.getDate() - start.getDay());
    const k = dayKey(start);
    const b = buckets.get(k) || { date: start, count: 0 };
    b.count += row.count;
    buckets.set(k, b);
  }
  const all = [...buckets.values()].sort((a, b) => a.date - b.date);
  return weeks === Infinity ? all : all.slice(-weeks);
}

function toMonths(dayRows) {
  const buckets = new Map();
  for (const row of dayRows) {
    const start = new Date(row.date.getFullYear(), row.date.getMonth(), 1);
    const k = dayKey(start);
    const b = buckets.get(k) || { date: start, count: 0 };
    b.count += row.count;
    buckets.set(k, b);
  }
  return [...buckets.values()].sort((a, b) => a.date - b.date);
}

// `open` is the set of weekdays the center works. Day-by-day the curve plotted
// every closed Sunday as a zero, so a month read as a sawtooth diving to the
// floor once a week and the shape of the actual trading days was lost in it.
// Weeks and months are sums, so a zero there adds nothing and the filter is
// only worth applying to the day series.
const bucketBy = (dayRows, bucket, open) =>
  bucket === 'day'
    ? dayRows.filter((r) => !open || open.has(r.date.getDay()))
    : bucket === 'month'
      ? toMonths(dayRows)
      : toWeeks(dayRows);

// Average ninjas per occurrence of each weekday. Two things this deliberately
// does NOT do:
//   - divide by every calendar occurrence: a Tuesday-only center would look
//     "busiest" purely because there are more Tuesdays in range;
//   - count a day with no check-ins as a zero. No center opens Sunday, and
//     today is still in progress, so those are days that didn't happen, not
//     quiet days. Averaging them in dragged real weekdays down and printed the
//     current weekday as a dash on the week view.
// A weekday with no open days in range gets open: 0 and the row says "closed"
// rather than a number that isn't true.
// Weekdays the center has ever opened, taken from the whole record rather than
// the period on screen. The centers are closed Sundays, so a Sunday row sat at
// the top of the list on every range with nothing in it. A weekday that is
// normally worked stays listed even when the period on screen hasn't reached it
// yet, so the list doesn't reshuffle as the week fills in.
function openWeekdays(dayRows) {
  const seen = new Set();
  for (const row of dayRows) if (row.count > 0) seen.add(row.date.getDay());
  return seen;
}

function byWeekday(dayRows) {
  const acc = Array.from({ length: 7 }, () => ({ total: 0, open: 0 }));
  for (const row of dayRows) {
    if (row.count === 0) continue;
    const w = row.date.getDay();
    acc[w].total += row.count;
    acc[w].open += 1;
  }
  return acc.map((a, i) => ({
    index: i,
    name: WEEKDAYS[i],
    short: WEEKDAYS_SHORT[i],
    avg: a.open ? a.total / a.open : 0,
    open: a.open,
    total: a.total,
  }));
}

// Peak day, weekly pace, and the change against the matching window before.
// Shared by the card and the expanded view so the two can't drift apart.
// The caller picks both windows, so a partial period (this week, two days in)
// is compared against the same two days of the week before rather than against
// a full seven that would read as a collapse.
function summarize(inRange, prior = []) {
  const total = inRange.reduce((s, d) => s + d.count, 0);
  const peak = inRange.reduce((best, d) => (d.count > (best?.count ?? -1) ? d : best), null);
  const perWeek = inRange.length ? (total / inRange.length) * 7 : 0;
  const priorTotal = prior.reduce((s, d) => s + d.count, 0);
  // Needs an equally long prior window with something in it, else the number is
  // measuring missing history rather than a real change.
  const hasPrior = prior.length === inRange.length && priorTotal > 0;
  return {
    total,
    peak,
    perWeek,
    delta: hasPrior ? Math.round(((total - priorTotal) / priorTotal) * 100) : null,
  };
}

// The chart drew itself in a hardcoded blue, so it was the one surface that
// ignored the accent a user picked in Appearance. Reading the token keeps it in
// step with every other blue on the page. Recharts resolves this once per
// render, so it follows a live accent change like any other CSS variable would.
const ACCENT = 'rgb(var(--ninja-blue))';

// Every number on these charts is a sum of each day's ninjas, so a ninja who
// comes twice in a week counts twice. That is check-ins, not ninjas, and the
// labels say so: "Ninjas a week: 59" under "10 ninjas this week" read as
// attendance falling by four fifths.
const CHART_CONFIG = { count: { label: 'Check-ins', color: ACCENT } };

// Recharts hands the dot renderer every point; only the last one gets drawn, so
// the curve keeps its end marker without a dot on every reading.
function EndDot({ cx, cy, index, dataLength }) {
  if (index !== dataLength - 1 || cx == null || cy == null) return null;
  return (
    // Halo takes the card surface, not flat white — a white ring on the dark
    // card read as a bright speck rather than a cut-out.
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={ACCENT}
      strokeWidth={2.5}
      className="stroke-white dark:stroke-[#252c3e]"
    />
  );
}

function TrendTooltip({ active, payload, formatLabel }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-ninja-border bg-white px-2.5 py-1.5 shadow-lg">
      <span className="block font-ninja text-[11px] text-ninja-muted leading-tight">
        {formatLabel(point.date)}{point.partial ? ', so far' : ''}
      </span>
      <span className="block font-ninja text-sm font-bold text-ninja-navy leading-tight tabular-nums">
        {point.count} check-in{point.count === 1 ? '' : 's'}
      </span>
    </div>
  );
}

// Margins stand in for the old manual padding: they keep the end dot and the
// hover dot from clipping at the edges of the plot area.
const CHART_MARGIN = { top: 10, right: 8, bottom: 4, left: 8 };

// `partial` says the last point is a period still running: this week on a
// Tuesday, today at noon. Drawn solid it was a cliff, the line falling from a
// full week's level to two days' worth, and a director reads that as attendance
// collapsing. The run up to the last finished point stays solid and the step
// into the running one is dashed and lighter, so it reads as unfinished.
function AreaChart({ points, height = 120, gradientId, className = '', formatLabel = shortDate, partial = false }) {
  const data = useMemo(() => {
    const n = points.length;
    const split = partial && n > 1;
    return points.map((p, i) => ({
      ...p,
      solid: split && i === n - 1 ? null : p.count,
      tail: split && i >= n - 2 ? p.count : null,
      partial: partial && i === n - 1,
    }));
  }, [points, partial]);
  const split = partial && points.length > 1;

  if (points.length === 0) return <div className={className} style={{ height }} />;

  return (
    <ChartContainer
      config={CHART_CONFIG}
      className={`w-full ${className}`}
      style={{ height }}
    >
      {/* No accessibility layer: the chart sits inside a button (or a
          dialog that reads out the same numbers), and a focusable chart
          inside a button drew its own blue ring after a click. */}
      <RechartsAreaChart data={data} margin={CHART_MARGIN} accessibilityLayer={false}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-count)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--color-count)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* The callers print their own date row under the chart, so the axes are
            here only to scale the plot. */}
        <XAxis dataKey="date" hide />
        <YAxis hide domain={[0, (max) => Math.max(1, max)]} />
        <ChartTooltip
          cursor={{ stroke: 'rgb(var(--ninja-muted))', strokeWidth: 1, strokeDasharray: '3 3' }}
          content={<TrendTooltip formatLabel={formatLabel} />}
        />
        <Area
          type="monotone"
          dataKey="solid"
          stroke="var(--color-count)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={`url(#${gradientId})`}
          dot={split ? false : <EndDot dataLength={points.length} />}
          activeDot={{ r: 5, strokeWidth: 2.5, className: 'stroke-white dark:stroke-[#252c3e]' }}
          animationDuration={900}
        />
        {split && (
          <Area
            type="monotone"
            dataKey="tail"
            stroke="var(--color-count)"
            strokeOpacity={0.6}
            strokeWidth={2.5}
            strokeDasharray="4 5"
            strokeLinecap="round"
            fill={`url(#${gradientId})`}
            fillOpacity={0.4}
            dot={<EndDot dataLength={points.length} />}
            activeDot={{ r: 5, strokeWidth: 2.5, className: 'stroke-white dark:stroke-[#252c3e]' }}
            animationDuration={900}
          />
        )}
      </RechartsAreaChart>
    </ChartContainer>
  );
}

const shortDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fullDate = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const weekOf = (d) => `Week of ${shortDate(d)}`;
const monthOf = (d) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const monthShort = (d) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

const TOOLTIP_LABEL = { day: fullDate, week: weekOf, month: monthOf };

// Collapsed card: check-ins per week for the last 8 weeks. Whole card opens the
// expanded view.
const CARD_WEEKS = 8;

const CARD_CHART_H = 208;

// Label-left, number-right. The rail is only ~320px wide, so the expanded
// view's three-across tiles don't fit here.
function StatRow({ label, sub, value, tone = 'text-ninja-navy' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-ninja text-sm text-ninja-muted truncate">
        {label}
        {sub && <span className="block text-xs text-ninja-muted/70">{sub}</span>}
      </span>
      <span className={`font-ninja text-lg font-black tabular-nums flex-shrink-0 ${tone}`}>{value}</span>
    </div>
  );
}

function CheckInTrend({ dayRows, onExpand }) {
  const weeks = useMemo(() => toWeeks(dayRows, CARD_WEEKS), [dayRows]);
  // Same span the chart draws, so the numbers describe the curve above them.
  const stats = useMemo(() => {
    const days = CARD_WEEKS * 7;
    return summarize(dayRows.slice(-days), dayRows.slice(-(days * 2), -days));
  }, [dayRows]);

  if (weeks.length === 0) {
    // Composed empty state rather than a bare line of grey text: a flat baseline
    // where the curve will be, so the card reads as "nothing yet", not "broken".
    return (
      <div className="py-2">
        <div className="flex items-end" style={{ height: CARD_CHART_H }}>
          <div className="w-full border-b-2 border-dashed border-ninja-border" />
        </div>
        <p className="text-ninja-muted font-ninja text-sm mt-3 text-pretty">
          No check-ins on record yet. Once ninjas start checking in, their weekly
          count shows up here.
        </p>
      </div>
    );
  }
  const thisWeek = weeks[weeks.length - 1].count;
  const { peak, perWeek, delta, total } = stats;

  return (
    <>
      {/* Only the chart opens the expanded view. Wrapping the stats in the
          button too would make the whole card one "Expand check-ins" target.
          The header's View all pill is the labelled way in; this is the same
          door for anyone who reaches for the chart itself. */}
      <button
        onClick={onExpand}
        aria-label="Expand check-ins"
        className="block w-full text-left origin-center rounded-lg transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.99]"
      >
        <div className="mb-2">
          <CountUp value={thisWeek} className="font-ninja text-3xl font-black text-ninja-navy leading-none" />
          <span className="ml-2 font-ninja text-sm text-ninja-muted">
            check-in{thisWeek === 1 ? '' : 's'} so far this week
          </span>
        </div>
        <AreaChart points={weeks} height={CARD_CHART_H} gradientId="checkInCardFill" formatLabel={weekOf} partial />
        <div className="flex justify-between font-ninja text-[10px] text-ninja-muted mt-1">
          <span>{shortDate(weeks[0].date)}</span>
          <span>{shortDate(weeks[Math.floor(weeks.length / 2)].date)}</span>
          <span>This week so far</span>
        </div>
      </button>

      {/* The three numbers that used to need a trip through the modal. */}
      <div className="mt-4 pt-4 border-t border-ninja-border space-y-3">
        <StatRow
          label="Busiest day"
          sub={peak?.count ? shortDate(peak.date) : null}
          value={peak?.count ?? 0}
        />
        <StatRow label="Check-ins a week" value={Math.round(perWeek)} />
        {/* A centre needs 16 weeks on record before the comparison means
            anything, and none of them do yet. Until then this row carries the
            period total instead of sitting blank. The comparison is never
            estimated from a partial window: a half-empty one reads as a
            collapse that didn't happen. */}
        {delta === null ? (
          <StatRow label="Check-ins, 8 weeks" value={total} />
        ) : (
          <StatRow
            label="vs previous 8 weeks"
            value={`${delta > 0 ? '+' : ''}${delta}%`}
            tone={delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-ninja-red' : 'text-ninja-navy'}
          />
        )}
      </div>
    </>
  );
}

// Calendar periods, not rolling windows. "Week" used to mean the last seven
// days, so on a Monday the range ran Tue to Mon: the only Monday in it was
// today, still in progress, and the weekday breakdown printed a dash for it.
// A director reading "this week" means the week they are standing in.
//
// span() returns the inclusive day range. prior() returns the window the period
// is measured against: shifted a whole week for the week periods (so a partial
// week meets the same partial week before it) and the previous calendar month
// for the month one, clipped to the same number of days.
// pace: the middle stat reads as check-ins a week rather than a period total,
// which only says anything over a span longer than a few weeks.
const RANGES = [
  {
    key: 'thisWeek',
    label: 'This week',
    bucket: 'day',
    compare: 'vs the same days last week',
    span: (now) => ({ start: startOfWeek(now), end: startOfDay(now) }),
    prior: (s) => ({ start: addDays(s.start, -7), end: addDays(s.end, -7) }),
  },
  {
    key: 'lastWeek',
    label: 'Last week',
    bucket: 'day',
    compare: 'vs the week before',
    span: (now) => ({ start: addDays(startOfWeek(now), -7), end: addDays(startOfWeek(now), -1) }),
    prior: (s) => ({ start: addDays(s.start, -7), end: addDays(s.end, -7) }),
  },
  {
    key: 'lastMonth',
    label: 'Last month',
    bucket: 'day',
    compare: 'vs the month before',
    span: (now) => {
      const m = startOfMonth(addDays(startOfMonth(now), -1));
      return { start: m, end: endOfMonth(m) };
    },
    prior: (s) => {
      const p = startOfMonth(addDays(s.start, -1));
      return { start: p, end: addDays(p, daysBetween(s.start, s.end)) };
    },
  },
  {
    key: 'six',
    label: '6 months',
    bucket: 'week',
    pace: true,
    compare: 'vs the 6 months before',
    span: (now) => ({ start: addDays(startOfDay(now), -181), end: startOfDay(now) }),
    prior: (s) => ({ start: addDays(s.start, -182), end: addDays(s.end, -182) }),
  },
  {
    key: 'all',
    label: 'All time',
    bucket: 'month',
    pace: true,
    compare: null,
    span: (now, first) => ({ start: first ?? startOfDay(now), end: startOfDay(now) }),
    prior: null,
  },
];

const TAIL_LABEL = { day: 'Today so far', week: 'This week so far', month: 'This month so far' };

function CheckInDetail({ dayRows }) {
  // Opens on the week the director is standing in, unless it hasn't started
  // yet. Monday before the first check-in, "this week" is a blank chart and a
  // dead end, so the panel opens on the last finished week instead.
  const [rangeKey, setRangeKey] = useState(() => {
    const thisWeek = within(dayRows, RANGES[0].span(startOfDay(new Date())));
    return thisWeek.some((d) => d.count > 0) ? 'thisWeek' : 'lastWeek';
  });
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[0];

  const { inRange, series, weekdays, stats, span } = useMemo(() => {
    const now = startOfDay(new Date());
    const s = range.span(now, dayRows[0]?.date);
    const rows = within(dayRows, s);

    // The comparison drops today. A period still running would otherwise be
    // measured with a few hours of check-ins against a whole finished day, and
    // a director opening the dashboard at nine in the morning would be told the
    // week had collapsed. Complete days only; if there aren't any yet, there is
    // no comparison to make and the tile says so.
    const everOpen = openWeekdays(dayRows);
    const live = sameDay(s.end, now);
    const cmpSpan = live ? { start: s.start, end: addDays(s.end, -1) } : s;
    const cmp = summarize(
      live ? within(dayRows, cmpSpan) : rows,
      range.prior ? within(dayRows, range.prior(cmpSpan)) : [],
    );

    return {
      span: s,
      inRange: rows,
      series: bucketBy(rows, range.bucket, everOpen),
      weekdays: byWeekday(rows).filter((w) => everOpen.has(w.index)),
      stats: { ...summarize(rows), delta: cmp.delta },
    };
  }, [dayRows, range]);

  const { peak, perWeek, delta, total } = stats;

  const maxAvg = Math.max(0.001, ...weekdays.map((w) => w.avg));
  const ranked = [...weekdays].filter((w) => w.open > 0).sort((a, b) => b.avg - a.avg);
  const busiest = ranked[0];
  const quietest = ranked[ranked.length - 1];

  const axisLabel = (d) => (range.bucket === 'month' ? monthShort(d) : shortDate(d));
  // The period runs to today for the live ranges and to a real date for the
  // closed ones, so the last axis label says which.
  const tailLabel = sameDay(span.end, startOfDay(new Date()))
    ? TAIL_LABEL[range.bucket]
    : series.length
      ? axisLabel(series[series.length - 1].date)
      : '';

  return (
    <div className="space-y-5">
      {/* Range chips */}
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRangeKey(r.key)}
            aria-pressed={rangeKey === r.key}
            className={`font-ninja text-sm font-semibold px-3 py-1.5 rounded-full transition-[transform,background-color,color] duration-150 ease-[var(--ease-out)] active:scale-95 ${
              rangeKey === r.key
                ? 'bg-ninja-blue text-white'
                : 'bg-ninja-bg text-ninja-muted hover:text-ninja-navy'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* A closed period with nothing in it is a real answer, not a blank
          chart with three zeroes under it. */}
      {total === 0 ? (
        <p className="font-ninja text-sm text-ninja-muted py-6">
          No check-ins on record for {range.label.toLowerCase()}.
        </p>
      ) : (
        <>
          {/* Trend */}
          <div>
            <AreaChart
              key={rangeKey}
              points={series}
              height={170}
              gradientId="checkInDetailFill"
              formatLabel={TOOLTIP_LABEL[range.bucket]}
              partial={sameDay(span.end, startOfDay(new Date()))}
            />
            <div className="flex justify-between font-ninja text-[11px] text-ninja-muted mt-1">
              <span>{axisLabel(series[0].date)}</span>
              <span>{series.length > 2 ? axisLabel(series[Math.floor(series.length / 2)].date) : ''}</span>
              <span>{tailLabel}</span>
            </div>
          </div>

          {/* Headline stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-ninja-bg p-3">
              <span className="block text-xl font-black font-ninja text-ninja-navy leading-none tabular-nums">
                {peak?.count ?? 0}
              </span>
              <span className="font-ninja text-xs text-ninja-muted">
                busiest day{peak?.count ? ` · ${shortDate(peak.date)}` : ''}
              </span>
            </div>
            {/* Over a week or a month the pace figure was just the total wearing
                a different hat, and on a part-finished week it extrapolated two
                days into a full one. Short periods report what happened. */}
            <div className="rounded-xl bg-ninja-bg p-3">
              <span className="block text-xl font-black font-ninja text-ninja-navy leading-none tabular-nums">
                {range.pace ? Math.round(perWeek) : total}
              </span>
              <span className="font-ninja text-xs text-ninja-muted">
                {range.pace ? 'check-ins a week' : 'check-ins'}
              </span>
            </div>
            <div className="rounded-xl bg-ninja-bg p-3">
              {delta === null ? (
                <>
                  <span className="block text-xl font-black font-ninja text-ninja-muted leading-none">—</span>
                  <span className="font-ninja text-xs text-ninja-muted">no earlier data</span>
                </>
              ) : (
                <>
                  <span
                    className={`block text-xl font-black font-ninja leading-none tabular-nums ${
                      delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-ninja-red' : 'text-ninja-navy'
                    }`}
                  >
                    {delta > 0 ? '+' : ''}{delta}%
                  </span>
                  <span className="font-ninja text-xs text-ninja-muted">{range.compare}</span>
                </>
              )}
            </div>
          </div>

          {/* Busy days */}
          <div>
            <h3 className="font-ninja font-bold text-ninja-navy mb-2">Busiest days</h3>
            <div className="space-y-1.5">
              {weekdays.map((w) => (
                <div key={w.index} className="flex items-center gap-3">
                  <span className="font-ninja text-xs text-ninja-muted w-9 flex-shrink-0">{w.short}</span>
                  <div className="flex-1 h-5 rounded-md bg-ninja-bg overflow-hidden">
                    <motion.div
                      className={`h-full rounded-md ${w.index === busiest?.index ? 'bg-ninja-blue' : 'bg-ninja-blue/40'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(w.avg / maxAvg) * 100}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.04 * w.index }}
                    />
                  </div>
                  {/* Every row here is a day the center works, so a dash means
                      this period hasn't got one on record yet, not a day that
                      was quiet. Sundays never reach this list at all. */}
                  <span
                    className={`font-ninja text-xs w-10 text-right flex-shrink-0 tabular-nums ${
                      w.open ? 'font-bold text-ninja-navy' : 'text-ninja-muted'
                    }`}
                  >
                    {w.open ? w.avg.toFixed(1) : '—'}
                  </span>
                </div>
              ))}
            </div>
            <p className="font-ninja text-xs text-ninja-muted mt-2">
              Average ninjas on the days the center was open.
            </p>
          </div>

          {busiest && (
            <p className="font-ninja text-sm text-ninja-navy">
              <span className="font-bold">{busiest.name}</span> is your busiest day at{' '}
              {busiest.avg.toFixed(1)} ninjas on average
              {quietest && quietest.index !== busiest.index && (
                <>, <span className="font-bold">{quietest.name}</span> the quietest at {quietest.avg.toFixed(1)}</>
              )}
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- quick links -- */

// The bordered pill every card header uses for its way out. One definition so
// "View all" and "Full schedule" cannot drift apart.
const VIEW_ALL =
  'inline-flex items-center gap-1 rounded-lg border border-ninja-border px-2.5 py-1 ' +
  'font-ninja text-xs font-bold text-ninja-navy hover:border-ninja-blue/50 hover:text-ninja-blue ' +
  'transition-colors flex-shrink-0';

// Outlined icon buttons in a two-up grid, the MyStudio home's quick-links
// shape. Neutral surface, monochrome icon that picks up the accent on hover:
// buttons rather than tinted icon-chip tiles, so they read as doors and not as
// decoration. Tasks leads because it is the only one carrying something that
// can be late.
const QUICK_BTN =
  'group flex items-center gap-2.5 rounded-xl border border-ninja-border px-3 py-2.5 min-w-0 ' +
  'font-ninja text-sm font-bold text-ninja-navy hover:border-ninja-blue/50 hover:text-ninja-blue ' +
  'transition-colors duration-150';

const QUICK_ICON = 'w-4 h-4 flex-shrink-0 text-ninja-muted group-hover:text-ninja-blue transition-colors';

// Role-shaped: a sensei cannot open Events or Reports (both manager-only), and
// their board and task list live on their own routes.
const MANAGER_QUICK = [
  { label: "Today's Board", to: '/manager/dashboard',  Icon: ClipboardCheckIcon },
  { label: 'Events',        to: '/manager/events',     Icon: MegaphoneIcon },
  { label: 'Reports',       to: '/manager/reports',    Icon: ReportsIcon },
  { label: 'Curriculum',    to: '/curriculum-roadmap', Icon: CurriculumIcon },
  { label: "What's New",    to: '/changelog',          Icon: GiftIcon },
];

const SENSEI_QUICK = [
  { label: "Today's Board", to: '/sensei/dashboard',   Icon: ClipboardCheckIcon },
  { label: 'Curriculum',    to: '/curriculum-roadmap', Icon: CurriculumIcon },
  { label: "What's New",    to: '/changelog',          Icon: GiftIcon },
];

function QuickLinksCard({ isManager }) {
  const links = isManager ? MANAGER_QUICK : SENSEI_QUICK;
  return (
    <section className={`${CARD} p-5`} aria-labelledby="quicklinks-heading">
      <h2 id="quicklinks-heading" className="font-ninja font-bold text-ninja-navy text-lg mb-4">
        Quick links
      </h2>
      <nav aria-label="Quick links" className="grid grid-cols-2 gap-2.5">
        <TasksQuickLink
          className={QUICK_BTN}
          to={isManager ? '/manager/tasks' : '/sensei/tasks'}
          label={isManager ? 'Tasks' : 'My Tasks'}
        />
        {links.map((l) => (
          <Link key={l.to} to={l.to} className={QUICK_BTN}>
            <l.Icon className={QUICK_ICON} />
            <span className="truncate">{l.label}</span>
          </Link>
        ))}
        {/* Last and full width: the label is too long for half the rail, and
            both roles have an odd number of doors before it. */}
        <Link to="/feedback" className={`${QUICK_BTN} col-span-2`}>
          <MilestoneIcon className={QUICK_ICON} />
          <span className="truncate">Issues &amp; roadmap</span>
        </Link>
      </nav>
    </section>
  );
}

// The check-in kiosk, one tap from the dashboard, for directors at a center
// that has MyStudio set up (connected, or connected and in need of a new code,
// which the Kiosk page repairs). Tied to the integration rather than the
// experimental toggle: that setting is per browser, and an iPad home-screen app
// keeps its own, so the card went missing on the device the kiosk is for.
function KioskCard() {
  return (
    <Link to="/manager/kiosk" className={`${CARD} group flex items-center gap-3 p-4 hover:border-ninja-blue/50 transition-colors`}>
      <TabletSmartphoneIcon className="w-5 h-5 flex-shrink-0 text-ninja-muted group-hover:text-ninja-blue transition-colors" strokeWidth={1.9} aria-hidden />
      <span className="font-ninja font-bold text-ninja-navy text-lg group-hover:text-ninja-blue transition-colors">Check-in kiosk</span>
      <ChevronRightIcon className="ml-auto w-5 h-5 text-ninja-muted flex-shrink-0" aria-hidden />
    </Link>
  );
}

// IMPACT's Live Ninjas countdown, for anyone at a center whose director has
// connected IMPACT. Like the kiosk card, tied to the connection rather than
// the experimental toggle, so the device on the wall finds it.
function LiveNinjasCard() {
  return (
    <Link to="/live-ninjas" target="_blank" rel="noopener" className={`${CARD} group flex items-center gap-3 p-4 hover:border-ninja-blue/50 transition-colors`}>
      <TimerIcon className="w-5 h-5 flex-shrink-0 text-ninja-muted group-hover:text-ninja-blue transition-colors" strokeWidth={1.9} aria-hidden />
      <span className="font-ninja font-bold text-ninja-navy text-lg group-hover:text-ninja-blue transition-colors">Live ninjas</span>
      <ChevronRightIcon className="ml-auto w-5 h-5 text-ninja-muted flex-shrink-0" aria-hidden />
    </Link>
  );
}

/* ------------------------------------------------------- daily schedule -- */

// Today's classes from MyStudio with the booked ninjas listed under each, the
// same list and one-tap check-in the board's booked panel carries. A center
// that has not connected MyStudio sees the timetable blurred behind a prompt
// saying where to turn it on.

// The stand-in behind the blur. Invented names and belts on purpose: it is
// scenery for a card with nothing real to show, and it renders blurred and
// hidden from screen readers.
const PREVIEW_GROUPS = [
  {
    time: '4:00 PM',
    name: 'CREATE',
    rows: [['Mason Rivera', 'Yellow Belt'], ['Ava Chen', 'Orange Belt'], ['Liam Patel', 'Orange Belt']],
  },
  {
    time: '5:00 PM',
    name: '3D Printing Club',
    rows: [['Sofia Martinez', 'White Belt'], ['Noah Kim', 'White Belt'], ['Emma Johnson', 'Blue Belt']],
  },
];

function SchedulePreview() {
  return (
    <div aria-hidden className="space-y-2.5 blur-[5px] opacity-60 select-none pointer-events-none">
      {PREVIEW_GROUPS.map((group) => (
        <div key={group.time} className="rounded-xl border border-ninja-border overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-ninja-bg">
            <span className="font-ninja text-sm font-bold text-ninja-navy tabular-nums">{group.time}</span>
            <span className="font-ninja text-xs text-ninja-muted">{group.name}</span>
            <span className="ml-auto font-ninja text-xs text-ninja-muted tabular-nums">{group.rows.length}</span>
          </div>
          <ul className="divide-y divide-ninja-border">
            {group.rows.map(([name, belt]) => (
              <li key={name} className="flex items-center gap-2.5 px-3 py-2 font-ninja text-sm text-ninja-navy">
                <span>{name}</span>
                <span className="ml-auto text-xs text-ninja-muted">{belt}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// The timetable, behind frosted glass, with the way back in on top of it. Used
// for both ways the feed can be off: never connected, and a credential that
// ran out overnight. Showing the shape of what is missing says more than a
// line of grey text, and the repair happens here rather than three screens
// away in Account settings.
function ScheduleBlocked({ title, children }) {
  return (
    <div className="relative">
      <SchedulePreview />
      <div className="absolute inset-0 flex flex-col justify-center px-1">
        <div className={`${PANEL} p-3.5`}>
          <p className="font-ninja text-sm font-bold text-ninja-navy">{title}</p>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

function DailySchedule({ feed, date, onAdded, existingStudentIds, readOnly, canConnect }) {
  const data = feed.data;
  const settled = !feed.loading && !feed.error;
  const off = settled && (!data?.connected || data?.disabled);
  const expired = settled && data?.status === 'expired';

  return (
    <section className={`${CARD} p-5`} aria-labelledby="schedule-heading">
      <h2 id="schedule-heading" className="font-ninja font-bold text-ninja-navy text-lg flex items-center gap-2 min-w-0 mb-4">
        <CalendarDaysIcon className="w-5 h-5 text-ninja-muted flex-shrink-0" aria-hidden />
        <span className="truncate">Daily schedule</span>
      </h2>

      {off ? (
        <ScheduleBlocked title="MyStudio isn't connected">
          {canConnect ? (
            <Link
              to="/account?mystudio=1"
              className="font-ninja text-sm font-semibold text-ninja-blue hover:underline"
            >
              Connect it from Account settings
            </Link>
          ) : (
            <p className="font-ninja text-sm text-ninja-muted">
              A center director can connect it from Account settings.
            </p>
          )}
        </ScheduleBlocked>
      ) : expired ? (
        <ScheduleBlocked title="The MyStudio connection ran out">
          {canConnect ? (
            // Sign in right here. With a saved password the server renews
            // the session itself for 30 days, so this is a monthly errand.
            <MyStudioReconnect onConnected={() => feed.reload?.()} />
          ) : (
            <p className="font-ninja text-sm text-ninja-muted">
              A center director can sign in again to restore it.
            </p>
          )}
        </ScheduleBlocked>
      ) : (
        // Loading, errors and an empty day all speak for themselves inside the
        // shared list.
        <ExpectedToday
          feed={feed}
          date={date}
          onAdded={onAdded}
          existingStudentIds={existingStudentIds}
          readOnly={readOnly}
          bare
        />
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- page -- */

const fadeUp = (i = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: EASE, delay: 0.06 * i },
});

export default function DirectorDashboard() {
  const { user, isReadOnly, viewAs } = useAuth();
  // Senseis get this page too. What differs is what each card links to; the
  // check-in trend is safe for every staff role at the active center. An admin
  // in sensei view gets the sensei copy, same as the navs treat them.
  const isSenseiView = user?.role === 'admin' && viewAs === 'sensei';
  const isManager = ['manager', 'admin'].includes(user?.role) && !isSenseiView;
  const canWrite = isManager && !isReadOnly;
  const todayStr = today();
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState(null);
  const [trendOpen, setTrendOpen] = useState(false);
  const [assignments, setAssignments] = useState(null);

  const bookedFeed = useExpectedToday(todayStr);

  // Whether to offer the kiosk, read off the connection row itself. The booked
  // feed would answer it too, but only once MyStudio has been pulled, so the
  // card arrived seconds after everything around it.
  const [kioskOn, setKioskOn] = useState(false);
  useEffect(() => {
    if (!isManager) return undefined;
    let alive = true;
    api.get('/mystudio/status')
      .then((s) => { if (alive) setKioskOn(Boolean(s?.connected && s.features?.kiosk !== false)); })
      .catch(() => { if (alive) setKioskOn(false); });
    return () => { alive = false; };
  }, [isManager, user?.activeLocation?.id]);

  const [impactOn, setImpactOn] = useState(false);
  useEffect(() => {
    let alive = true;
    api.get('/impact/status')
      .then((s) => { if (alive) setImpactOn(Boolean(s?.connected)); })
      .catch(() => { if (alive) setImpactOn(false); });
    return () => { alive = false; };
  }, [user?.activeLocation?.id]);

  useEffect(() => {
    let alive = true;
    api.get('/reports/attendance?range=all')
      .catch(() => null)
      .then((att) => {
        if (!alive) return;
        setAttendance(att);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [user?.activeLocation?.id]);

  const fetchToday = useCallback(() => {
    let alive = true;
    api.get(`/daily?date=${todayStr}`)
      .catch(() => [])
      .then((rows) => { if (alive) setAssignments(rows || []); });
    return () => { alive = false; };
  }, [todayStr, user?.activeLocation?.id]);

  useEffect(fetchToday, [fetchToday]);

  // The front desk keeps checking ninjas in while this page is open, so the
  // today card follows the board rather than the moment the page loaded.
  useLiveRefresh(fetchToday);

  const dayRows = useMemo(() => buildDays(attendance?.attendance), [attendance]);

  const handleAdded = (created) => {
    setAssignments((prev) => [...(prev || []).filter((a) => a.id !== created.id), created]);
  };

  // "Sensei Alex" is a title on the board, not a first name. Same strip the
  // sensei board does, so the greeting says Alex rather than Sensei.
  const bareName = user?.role === 'sensei' && user?.displayName?.toLowerCase().startsWith('sensei ')
    ? user.displayName.slice(7)
    : user?.displayName;
  const firstName = bareName?.split(' ')[0] ?? '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Masthead. Deliberately NOT a card: it carries no data, and wrapping a
            page title in its own elevated surface was what turned this page into
            a stack of five identical boxes. A page title is allowed to sit on
            the page. */}
        <motion.header {...fadeUp(0)} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-ninja text-sm text-ninja-muted">{formatDate(todayStr)}</p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-black font-ninja text-ninja-navy tracking-tight text-balance">
              {greeting}{firstName && ', '}<span className="text-ninja-blue">{firstName}</span>
            </h1>
          </div>
          {/* Phones have no sidebar or top bar to carry the bell, and this is
              the page they land on. */}
          <div className="lg:hidden flex-shrink-0"><NotificationBell /></div>
        </motion.header>

        {/* MyStudio-home shape: a narrow rail of doors and today's timetable on
            the left, the numbers and the calendar carrying the width. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="space-y-6">
            <motion.div {...fadeUp(1)}>
              <QuickLinksCard isManager={isManager} />
            </motion.div>
            {isManager && kioskOn && (
              <motion.div {...fadeUp(2)}>
                <KioskCard />
              </motion.div>
            )}
            {impactOn && (
              <motion.div {...fadeUp(2)}>
                <LiveNinjasCard />
              </motion.div>
            )}
            <motion.div {...fadeUp(2)}>
              <DailySchedule
                feed={bookedFeed}
                date={todayStr}
                onAdded={handleAdded}
                existingStudentIds={new Set((assignments || []).map((a) => a.student_id))}
                readOnly={!canWrite}
                canConnect={isManager}
              />
            </motion.div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <motion.div {...fadeUp(1)}>
              {/* A director viewing a center they aren't assigned to gets it
                  read-only, same as a sensei. The server already refuses these
                  writes (requireOwnLocation); this stops us offering a control
                  whose only outcome is a 403. */}
              <EventCalendar canManage={canWrite} />
            </motion.div>

            <motion.div {...fadeUp(3)}>
              <section className={`${CARD} p-5`} aria-labelledby="checkins-heading">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 id="checkins-heading" className="font-ninja font-bold text-ninja-navy text-lg">Check-ins</h2>
                  {!loading && dayRows.length > 0 && (
                    <button type="button" onClick={() => setTrendOpen(true)} className={VIEW_ALL}>
                      View all
                      <ChevronRightIcon className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  )}
                </div>
                {loading ? (
                  // Same shape and height as the loaded card, so nothing
                  // shifts when the data lands.
                  <div aria-busy="true" aria-label="Loading check-ins">
                    <Skeleton className="h-8 w-40 mb-2" />
                    <Skeleton className="w-full rounded-lg" style={{ height: CARD_CHART_H }} />
                    <div className="flex justify-between mt-2">
                      <Skeleton className="h-2.5 w-10" />
                      <Skeleton className="h-2.5 w-10" />
                      <Skeleton className="h-2.5 w-14" />
                    </div>
                      <div className="mt-4 pt-4 border-t border-ninja-border space-y-3">
                        {[28, 24, 32].map((w, i) => (
                          <div key={i} className="flex items-baseline justify-between">
                            <Skeleton className="h-4" style={{ width: `${w}%` }} />
                            <Skeleton className="h-5 w-10" />
                          </div>
                        ))}
                      </div>
                  </div>
                ) : (
                  <CheckInTrend dayRows={dayRows} onExpand={() => setTrendOpen(true)} />
                )}
              </section>
            </motion.div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={trendOpen}
        onClose={() => setTrendOpen(false)}
        title="Check-ins"
        width="max-w-2xl"
      >
        <CheckInDetail dayRows={dayRows} />
      </Modal>
    </Layout>
  );
}
