import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api/client';
import { CARD } from '../../lib/surfaces';

// The pieces every Reports tab is built from, so the four tabs read as one
// report rather than four pages that happen to share a URL.

export const ACCENT = 'rgb(var(--ninja-blue))';

// Each section is one card holding a stack of tiles a shade off the card, so
// the rows read as objects rather than lines ruled across a box. The tint is
// the page token, not bg-white, so it follows the theme and the dark overrides
// never have to fight it.
export const TILE = 'rounded-xl border border-ninja-border bg-ninja-bg/60';

// White and Black disappear against a white or a slate card, so every swatch
// carries a neutral hairline drawn inside it. A shadow rather than a border,
// so it costs no width in a bar measured in percent.
export const SWATCH_EDGE = 'inset 0 0 0 1px rgb(var(--ninja-border))';

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The centers are all in California; "today" is theirs, not the browser's.
export function centerToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

// pg hands DATE columns back as UTC-midnight ISO strings. Read the calendar
// part and build a local date, or every evening lands on the day before.
export function localDate(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr, by) {
  const d = localDate(dateStr);
  d.setDate(d.getDate() + by);
  return isoDate(d);
}

export function shortDate(dateStr) {
  return localDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function rangeLabel(from, to) {
  return from === to ? shortDate(from) : `${shortDate(from)} to ${shortDate(to)}`;
}

export function daysSince(dateStr) {
  return Math.round((localDate(centerToday()) - localDate(dateStr)) / 86400000);
}

export function hourLabel(h) {
  const fmt = (x) => `${x % 12 === 0 ? 12 : x % 12}`;
  const suffix = (x) => (x % 24 < 12 ? 'AM' : 'PM');
  const end = h + 1;
  return suffix(h) === suffix(end)
    ? `${fmt(h)}-${fmt(end)} ${suffix(end)}`
    : `${fmt(h)} ${suffix(h)}-${fmt(end)} ${suffix(end)}`;
}

export function hourShort(h) {
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}

export function median(values) {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return Math.round(v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2);
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// What the Reports layout hands its tabs: the filters, as values and as the
// query string every report route takes.
export function useReportFilters() {
  return useOutletContext();
}

// GET a report and hold it. A change of path or filters drops the old answer
// first, so a tab never shows last period's numbers under this period's title.
export function useReport(path) {
  const [state, setState] = useState({ data: null, error: '' });
  useEffect(() => {
    if (!path) return undefined;
    let live = true;
    setState({ data: null, error: '' });
    api.get(path)
      .then((data) => { if (live) setState({ data, error: '' }); })
      .catch((e) => { if (live) setState({ data: null, error: e?.message || 'Failed to load this report' }); });
    return () => { live = false; };
  }, [path]);
  return state;
}

// A comparison with the previous period is only honest when that whole period
// happened while the center was using DojoLink.
export function comparable(period, dataSince) {
  return !!period && !!dataSince && period.prevFrom >= dataSince;
}

// Change against the previous period, as a word a person reads rather than a
// badge. `goodWhenDown` flips the colour for counts nobody wants to grow.
export function Delta({ cur, prev, show = true, goodWhenDown = false }) {
  if (!show || prev == null) return <span className="text-ninja-muted" title="No earlier data to compare with">No comparison yet</span>;
  if (prev === 0) return <span className="text-ninja-muted">{cur === 0 ? 'Same as before' : 'None before'}</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <span className="text-ninja-muted">Same as before</span>;
  const up = pct > 0;
  const good = up !== goodWhenDown;
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-ninja-red'}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
      {Math.abs(pct)}%
      <span className="sr-only">{up ? 'up' : 'down'} from {prev}</span>
    </span>
  );
}

// The number row at the top of a tab. One surface split by hairlines, the way
// a metric strip is: four numbers are one reading, not four objects.
export function KpiStrip({ items }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <dl className={`grid grid-cols-2 gap-px bg-ninja-border ${items.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {items.map((k) => (
          <div key={k.label} className="bg-white px-5 py-4 sm:px-6 sm:py-5 min-w-0">
            <dt className="font-ninja text-[13px] text-ninja-muted">{k.label}</dt>
            <dd className={`mt-1 font-ninja font-bold text-3xl leading-tight tabular-nums tracking-tight ${k.tone || 'text-ninja-navy'}`}>
              {k.value}
            </dd>
            {(k.delta || k.sub) && (
              <dd className="mt-1 flex flex-wrap items-center gap-x-1.5 font-ninja text-xs text-ninja-muted">
                {k.delta}
                {k.sub && <span className="min-w-0">{k.sub}</span>}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}

// The card, and the tile at its head that names it. The head is a tile like
// the rows under it, so the whole section is one stack.
export function Section({ title, value, unit, children, footer, action, className = '' }) {
  return (
    <section className={`${CARD} p-2 flex flex-col gap-1.5 min-w-0 ${className}`}>
      <header className={`${TILE} px-4 py-3.5`}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-ninja text-[13px] text-ninja-muted">{title}</h2>
            {value != null && (
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-ninja font-bold text-[28px] leading-tight text-ninja-navy tabular-nums tracking-tight">{value}</span>
                {unit && <span className="font-ninja text-[13px] text-ninja-muted">{unit}</span>}
              </p>
            )}
          </div>
          {action}
        </div>
        {footer}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children }) {
  return <p className="px-3 py-4 text-ninja-muted font-ninja text-sm">{children}</p>;
}

export function ErrorLine({ children }) {
  return <p className="px-3 py-4 text-ninja-red font-ninja text-sm">{children}</p>;
}

// How the whole divides, in one bar. Each segment is a share of the total, so
// the eye gets the split before it reads a single row.
export function CompositionBar({ rows, total }) {
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
export function BarRow({ rank, art, name, count, pct, color, max, index }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3), ease: 'easeOut' }}
      className={`${TILE} flex items-center gap-3 px-3 py-2.5`}
    >
      {rank != null && <span className="w-3 shrink-0 text-right font-ninja text-[13px] text-ninja-muted tabular-nums">{rank}</span>}
      {art && <span className="shrink-0">{art}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate font-ninja text-[13px] font-semibold text-ninja-navy" title={name}>{name}</span>
          <span className="shrink-0 font-ninja text-[13px] font-semibold text-ninja-navy tabular-nums">{count}</span>
          {pct != null && <span className="w-9 shrink-0 text-right font-ninja text-xs text-ninja-muted tabular-nums">{pct}%</span>}
        </div>
        <span className="relative mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ninja-border/60">
          <motion.span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: color, boxShadow: SWATCH_EDGE }}
            initial={{ width: 0 }}
            animate={{ width: `${max > 0 ? Math.max((count / max) * 100, count > 0 ? 2 : 0) : 0}%` }}
            transition={{ duration: 0.6, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
          />
        </span>
      </div>
    </motion.li>
  );
}

// A ninja's initials in a square, for list rows.
export function Initials({ name }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ninja-border/70 font-ninja text-[11px] font-semibold text-ninja-navy">
      {initials(name)}
    </span>
  );
}
