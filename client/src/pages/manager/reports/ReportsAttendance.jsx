import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import Segmented from '../../../components/ui/Segmented';
import { SkeletonCards } from '../../../components/ui/Skeleton';
import {
  ACCENT, TILE, Empty, ErrorLine, Section, WEEKDAY_NAMES, WEEKDAY_SHORT,
  addDays, centerToday, hourLabel, hourShort, localDate, median, plural, useReport, useReportFilters,
} from '../../../components/reports/ReportParts';

// The Attendance tab is for staffing. Its unit is the hour, and its headline
// number is how many ninjas were in the room at once, because that is what a
// sensei has to cover. Arrivals alone undersell it: a 3:40 arrival is still at
// a table at 4:30.
//
// "At once" needs one building, so with every center selected the heatmaps
// come one per center, and the hour detail asks which.

const OPEN_WEEKDAYS = [1, 2, 3, 4, 5, 6];

function queryFor(query, centerId) {
  const q = new URLSearchParams(query);
  q.set('center', String(centerId));
  return q.toString();
}

// Per weekday and hour: the usual and busiest at-once count and arrivals, over
// the days that weekday had anyone in. A weekday with no check-ins at all in
// the period is a closed day and has no stats, not zeros.
function summarize(data) {
  const byDay = new Map();
  for (const r of data.hours) {
    if (!byDay.has(r.day)) byDay.set(r.day, new Map());
    byDay.get(r.day).set(r.hour, r);
  }
  const out = {};
  for (const wd of OPEN_WEEKDAYS) {
    const open = data.openHours[wd];
    const days = data.days.filter((d) => localDate(d).getDay() === wd);
    if (!open) continue;
    const hours = [];
    for (let h = open[0]; h < open[1]; h += 1) {
      const peaks = days.map((d) => byDay.get(d)?.get(h)?.peak || 0);
      const arrivals = days.map((d) => byDay.get(d)?.get(h)?.arrivals || 0);
      hours.push({
        hour: h,
        peak: median(peaks),
        peakMax: Math.max(0, ...peaks),
        arrivals: median(arrivals),
        arrivalsMax: Math.max(0, ...arrivals),
      });
    }
    const totals = days.map((d) => [...(byDay.get(d)?.values() || [])].reduce((s, r) => s + r.arrivals, 0));
    out[wd] = { days: days.length, hours, usualTotal: median(totals), busiestTotal: Math.max(0, ...totals) };
  }
  return out;
}

function HeatCell({ value, max, title }) {
  const t = max > 0 ? value / max : 0;
  const strong = t > 0.55;
  return (
    <div
      title={title}
      className="flex h-11 items-center justify-center rounded-lg font-ninja text-sm font-bold tabular-nums"
      style={{
        backgroundColor: value > 0 ? `rgb(var(--ninja-blue) / ${0.1 + t * 0.85})` : 'rgb(var(--ninja-border) / 0.45)',
        color: strong ? '#ffffff' : 'rgb(var(--ninja-navy))',
      }}
    >
      {value}
    </div>
  );
}

// Weekdays down the side, open hours across. Saturday keeps different hours,
// so it gets its own header row rather than sitting under 3 PM as if 10 AM
// were the same slot.
function Heatmap({ stats, metric, max }) {
  const block = (days) => {
    const open = stats[days[0]]?.hours.map((h) => h.hour) || [];
    return (
      <div className="grid grid-cols-[2.75rem_repeat(4,minmax(0,1fr))_3.5rem] items-center gap-1.5">
        <span />
        {open.map((h) => (
          <span key={h} className="text-center font-ninja text-[11px] text-ninja-muted">{hourShort(h)}</span>
        ))}
        <span className="text-right font-ninja text-[11px] text-ninja-muted">Days</span>
        {days.map((wd) => {
          const s = stats[wd];
          return [
            <span key={`${wd}-l`} className="font-ninja text-[13px] font-semibold text-ninja-navy">{WEEKDAY_SHORT[wd]}</span>,
            ...(s?.hours || []).map((h) => {
              const v = metric === 'peak' ? h.peak : h.arrivals;
              const top = metric === 'peak' ? h.peakMax : h.arrivalsMax;
              const noun = metric === 'peak' ? 'in the room at once' : 'arrived';
              return (
                <HeatCell
                  key={`${wd}-${h.hour}`}
                  value={s.days ? v : 0}
                  max={max}
                  title={s.days
                    ? `${WEEKDAY_NAMES[wd]} ${hourLabel(h.hour)}: usually ${v} ${noun}, up to ${top}, over ${plural(s.days, 'day')}`
                    : `${WEEKDAY_NAMES[wd]}: no check-ins in this period`}
                />
              );
            }),
            <span key={`${wd}-n`} className="text-right font-ninja text-xs text-ninja-muted tabular-nums">{s?.days || 0}</span>,
          ];
        })}
      </div>
    );
  };
  return (
    <div className="space-y-4">
      {block([1, 2, 3, 4, 5])}
      {block([6])}
    </div>
  );
}

function HeatmapCard({ data, error, title, metric, onMetric, layoutId }) {
  const stats = useMemo(() => (data ? summarize(data) : null), [data]);
  const max = stats
    ? Math.max(0, ...Object.values(stats).flatMap((s) => s.hours.map((h) => (metric === 'peak' ? h.peak : h.arrivals))))
    : 0;
  const any = stats && Object.values(stats).some((s) => s.days > 0);
  return (
    <Section
      title={title}
      action={onMetric && (
        <Segmented
          size="sm"
          label="Heatmap shows"
          layoutId={layoutId}
          value={metric}
          onChange={onMetric}
          options={[{ value: 'peak', label: 'At once' }, { value: 'arrivals', label: 'Arrivals' }]}
        />
      )}
    >
      <div className={`${TILE} p-3 sm:p-4`}>
        {error ? <ErrorLine>{error}</ErrorLine>
          : !stats ? <SkeletonCards count={2} height={60} cols="grid-cols-1" label="Loading attendance" />
            : !any ? <Empty>No check-ins in this period.</Empty>
              : <Heatmap stats={stats} metric={metric} max={max} />}
      </div>
    </Section>
  );
}

// One hour of the detail list. Over a period the bar is solid to the usual day
// and pale out to the busiest, so the gap between them is the part a schedule
// has to absorb.
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
            style={{ backgroundColor: ACCENT, opacity: 0.3 }}
            initial={{ width: 0 }}
            animate={{ width: pctOf(peakMax) }}
            transition={ease}
          />
        )}
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: ACCENT }}
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

const stepBtn = 'flex h-8 w-8 items-center justify-center rounded-lg border border-ninja-border text-ninja-navy transition-colors hover:bg-ninja-bg disabled:opacity-40 disabled:hover:bg-transparent';

// The hour-by-hour detail: one weekday over the period, or a single date.
function HourDetail({ periodData, centerId, centerPicker }) {
  const today = centerToday();
  const [mode, setMode] = useState('typical');
  const [weekday, setWeekday] = useState(() => localDate(today).getDay() || 1);
  const [date, setDate] = useState(today);
  const one = useReport(mode === 'day' ? `/reports/checkins-by-hour?center=${centerId}&date=${date}` : null);
  const stats = useMemo(() => (periodData.data ? summarize(periodData.data) : null), [periodData.data]);

  const pattern = mode === 'typical';
  let rows = [];
  let headline = null;
  let unit;
  let loading = false;
  let error = '';
  if (pattern) {
    error = periodData.error;
    loading = !stats && !error;
    const s = stats?.[weekday];
    if (s?.days) {
      rows = s.hours;
      headline = s.usualTotal;
      unit = `ninjas on a usual ${WEEKDAY_NAMES[weekday]}, up to ${s.busiestTotal} · ${plural(s.days, 'day')}`;
    }
  } else {
    error = one.error;
    loading = !one.data && !error;
    if (one.data) {
      const open = one.data.openHours[localDate(date).getDay()];
      const byHour = new Map(one.data.hours.map((r) => [r.hour, r]));
      if (open && one.data.days.length) {
        rows = [];
        for (let h = open[0]; h < open[1]; h += 1) {
          const r = byHour.get(h);
          rows.push({ hour: h, peak: r?.peak || 0, peakMax: r?.peak || 0, arrivals: r?.arrivals || 0, arrivalsMax: r?.arrivals || 0 });
        }
      }
      headline = one.data.hours.reduce((s, r) => s + r.arrivals, 0);
      unit = `ninja${headline === 1 ? '' : 's'} checked in`;
    }
  }
  const scale = Math.max(0, ...rows.map((r) => r.peakMax));
  const closedDay = !pattern && localDate(date).getDay() === 0;
  const dayName = localDate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <Section
      title={pattern ? `Hour by hour · ${WEEKDAY_NAMES[weekday]}s in this period` : `Hour by hour · ${dayName}`}
      value={headline}
      unit={unit}
      footer={
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {centerPicker}
            <Segmented
              size="sm"
              label="View"
              layoutId="hour-detail-mode"
              value={mode}
              onChange={setMode}
              options={[{ value: 'typical', label: 'Usual day' }, { value: 'day', label: 'One day' }]}
            />
            {pattern ? (
              <Segmented
                size="sm"
                label="Weekday"
                layoutId="hour-detail-weekday"
                value={weekday}
                onChange={setWeekday}
                options={OPEN_WEEKDAYS.map((i) => ({ value: i, label: WEEKDAY_SHORT[i] }))}
              />
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" className={stepBtn} onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
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
                <button type="button" className={stepBtn} onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day">
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
      {error ? <ErrorLine>{error}</ErrorLine>
        : loading ? <SkeletonCards count={3} height={68} label="Loading check-ins" />
          : closedDay ? <Empty>The center is closed on Sundays.</Empty>
            : rows.length === 0 ? <Empty>{pattern ? `No check-ins on ${WEEKDAY_NAMES[weekday]}s in this period.` : 'No check-ins on this day.'}</Empty>
              : (
                <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
                  {rows.map((r, i) => (
                    <HourRow key={r.hour} index={i} scale={scale} pattern={pattern} {...r} />
                  ))}
                </ul>
              )}
    </Section>
  );
}

function SingleCenter({ query, centerId }) {
  const periodData = useReport(`/reports/checkins-by-hour?${query}`);
  const [metric, setMetric] = useState('peak');
  return (
    <>
      <HeatmapCard
        data={periodData.data}
        error={periodData.error}
        title="When the room is full"
        metric={metric}
        onMetric={setMetric}
        layoutId="heat-metric"
      />
      <HourDetail periodData={periodData} centerId={centerId} />
    </>
  );
}

function CenterHeatmap({ query, center, metric }) {
  const { data, error } = useReport(`/reports/checkins-by-hour?${queryFor(query, center.id)}`);
  return <HeatmapCard data={data} error={error} title={center.name} metric={metric} />;
}

function AllCenters({ query, centers }) {
  const [metric, setMetric] = useState('peak');
  const [picked, setPicked] = useState(centers[0]?.id);
  const periodData = useReport(picked ? `/reports/checkins-by-hour?${queryFor(query, picked)}` : null);
  return (
    <>
      <div className="flex justify-end">
        <Segmented
          size="sm"
          label="Heatmaps show"
          layoutId="heat-metric-all"
          value={metric}
          onChange={setMetric}
          options={[{ value: 'peak', label: 'At once' }, { value: 'arrivals', label: 'Arrivals' }]}
        />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {centers.map((c) => <CenterHeatmap key={c.id} query={query} center={c} metric={metric} />)}
      </div>
      <HourDetail
        key={picked}
        periodData={periodData}
        centerId={picked}
        centerPicker={centers.length > 1 && (
          <Segmented
            size="sm"
            label="Center"
            layoutId="hour-detail-center"
            value={picked}
            onChange={setPicked}
            options={centers.map((c) => ({ value: c.id, label: c.name }))}
          />
        )}
      />
    </>
  );
}

export default function ReportsAttendance() {
  const { query, center, centers } = useReportFilters();
  return center === 'all'
    ? <AllCenters query={query} centers={centers} />
    : <SingleCenter key={center} query={query} centerId={center} />;
}
