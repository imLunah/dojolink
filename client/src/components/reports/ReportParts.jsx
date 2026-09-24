import { useEffect, useId, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { Line, LineChart } from 'recharts';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { ChartContainer } from '../ui/chart';
import { Skeleton } from '../ui/Skeleton';
import { api } from '../../api/client';
import { REPORT_CARD } from '../../lib/surfaces';
import CountUp from '../reactbits/CountUp';

// The pieces every Reports tab is built from. Reports is styled as an analytics
// tool rather than as the rest of DojoLink: system type instead of Nunito, flat
// white cards with a header, a body and an optional "See details" footer, big
// quiet numbers, and tables where the rest of the app would stack tiles.

// The whole section sets this on its root. The app face is rounded and warm,
// which is right for a check-in board and wrong for a page of numbers.
export const REPORT_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const ACCENT = 'rgb(var(--ninja-blue))';

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

// Change against the previous period, as coloured text. `goodWhenDown` flips the colour for
// counts nobody wants to grow. Null when there is nothing honest to show.
export function DeltaChip({ cur, prev, show = true, goodWhenDown = false }) {
  if (!show || prev == null || prev === 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct > 0;
  const flat = pct === 0;
  const good = up !== goodWhenDown;
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon;
  // Plain coloured text and an arrow: no chip, no tinted box, no outline.
  const tone = flat ? 'text-ninja-muted' : good ? 'text-emerald-600 dark:text-emerald-400' : 'text-ninja-red';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${tone}`}>
      {!flat && <Icon className="h-3 w-3" strokeWidth={2.6} aria-hidden="true" />}
      {flat ? '0%' : `${Math.abs(pct)}%`}
      <span className="sr-only">{flat ? 'no change' : `${up ? 'up' : 'down'} from ${prev}`}</span>
    </span>
  );
}

// A link out of a card to the tab that has the detail, keeping the filters.
export function CardLink({ to, children = 'See details' }) {
  const { search } = useLocation();
  return (
    <Link
      to={{ pathname: to, search }}
      className="flex items-center justify-center gap-1.5 rounded-b-2xl border-t border-ninja-border py-3 text-[13px] font-medium text-ninja-navy transition-colors hover:bg-ninja-bg/70"
    >
      {children}
      <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

// A card: a titled header, a body, and optionally a footer link.
export function Card({ title, sub, action, footer, children, className = '', bodyClass = '' }) {
  return (
    <section className={`${REPORT_CARD} flex min-w-0 flex-col ${className}`}>
      {(title || action) && (
        <header className="flex items-start gap-3 px-5 pt-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-ninja-navy">{title}</h3>
            {sub && <p className="mt-0.5 text-[13px] text-ninja-muted">{sub}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={`flex-1 px-5 pb-5 pt-4 ${bodyClass}`}>{children}</div>
      {footer}
    </section>
  );
}

// A small line of one series, for a metric card. Not interactive.
export function Sparkline({ values }) {
  if (!values || values.length < 2) return null;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ChartContainer config={{ v: { label: 'Trend', color: ACCENT } }} className="w-full" style={{ height: 44 }}>
      <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke="var(--color-v)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}

// One headline number: label, value, how it moved, and against what.
export function Metric({ label, value, delta, compare, tone, spark, footer }) {
  return (
    <section className={`${REPORT_CARD} flex min-w-0 flex-col`}>
      <div className="flex flex-1 gap-3 px-5 pb-5 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ninja-muted">{label}</p>
          {/* A number counts up to itself once, as the card comes into view, so
              the eye lands on the figures rather than on the labels. */}
          <p className={`mt-2 text-[32px] font-semibold leading-none tracking-tight tabular-nums ${tone || 'text-ninja-navy'}`}>
            {typeof value === 'number' ? <CountUp to={value} duration={0.5} /> : value}
          </p>
          {(delta || compare) && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ninja-muted">
              {delta}
              {compare && <span>{compare}</span>}
            </p>
          )}
        </div>
        {spark && <div className="w-24 shrink-0 self-end">{spark}</div>}
      </div>
      {footer}
    </section>
  );
}

// Two to four exclusive choices on one track, the chosen one lifted onto a
// white chip. Same shape as the section's tabs, so the page has one control.
export function Toggle({ options, value, onChange, label }) {
  const id = useId();
  const at = options.findIndex((o) => o.value === value);
  const onKey = (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    onChange(options[(at + step + options.length) % options.length].value);
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className="inline-flex max-w-full overflow-x-auto no-scrollbar rounded-lg border border-ninja-border bg-ninja-bg p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`relative shrink-0 rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors ${on ? 'text-ninja-navy' : 'text-ninja-muted hover:text-ninja-navy'}`}
          >
            {on && (
              <motion.span
                layoutId={`toggle-${id}`}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-md border border-ninja-border bg-white shadow-sm"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Empty({ children }) {
  return <p className="py-6 text-center text-sm text-ninja-muted">{children}</p>;
}

export function ErrorLine({ children }) {
  return <p className="py-6 text-center text-sm text-ninja-red">{children}</p>;
}

// A labelled bar: name and count on a line, a bar under it measured against
// the longest row so short rows still read as lengths.
export function Meters({ rows, max, showPct = true }) {
  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.name}>
          <div className="flex items-center gap-2 text-[13px]">
            {r.art && <span className="shrink-0">{r.art}</span>}
            <span className="min-w-0 flex-1 truncate font-medium text-ninja-navy" title={r.name}>{r.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ninja-navy">{r.count}</span>
            {showPct && r.pct != null && <span className="w-9 shrink-0 text-right text-xs tabular-nums text-ninja-muted">{r.pct}%</span>}
          </div>
          <span className="relative mt-1.5 block h-2 overflow-hidden rounded-full bg-ninja-bg">
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ backgroundColor: r.color || ACCENT, boxShadow: r.color ? SWATCH_EDGE : undefined }}
              initial={{ width: 0 }}
              animate={{ width: `${max > 0 ? Math.max((r.count / max) * 100, r.count > 0 ? 2 : 0) : 0}%` }}
              transition={{ duration: 0.6, delay: Math.min(i * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

// How the whole divides, in one bar. Each segment is a share of the total.
export function CompositionBar({ rows, total }) {
  if (total <= 0) return null;
  return (
    <div className="mb-5 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img"
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

// A plain data table: a tinted header row with rounded ends and hairline rows.
// `columns` is [{ key, label, align, render, className }].
export function Table({ columns, rows, rowKey, empty, maxHeight, minWidth = 420 }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="-mx-1 overflow-auto px-1" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full text-[13px]" style={{ minWidth }}>
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`bg-ninja-bg px-3 py-2.5 text-xs font-medium text-ninja-muted first:rounded-l-lg last:rounded-r-lg ${c.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-ninja-border/70 last:border-0">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-3 text-ninja-navy ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.className || ''}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A ninja's initials and name, linking to their profile.
export function NinjaCell({ id, name, sub }) {
  return (
    <Link to={`/manager/students/${id}`} className="group flex min-w-0 items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ninja-bg text-[11px] font-semibold text-ninja-navy">
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ninja-navy group-hover:underline">{name}</span>
        {sub && <span className="block truncate text-xs text-ninja-muted">{sub}</span>}
      </span>
    </Link>
  );
}

// The loading outline: card-shaped blocks from the shared Skeleton, so the
// page does not jump when the numbers land.
export function Loading({ rows = 2 }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading report" className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
    </div>
  );
}
