import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import {
  ACCENT, Card, Empty, ErrorLine, Loading, Toggle, WEEKDAY_NAMES, WEEKDAY_SHORT,
  addDays, centerToday, hourLabel, hourShort, localDate, median, plural, useReport, useReportFilters,
} from '../../../components/reports/ReportParts';
import { Skeleton } from '../../../components/ui/Skeleton';

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
//
// Ninjas who came only for a club have no hour (clubs record a date, not a
// time), so they sit out of the hourly numbers and into the day's total, and
// the day counts as open even when nobody checked in on the board.
function summarize(data) {
  const club = new Map((data.clubOnly || []).map((r) => [r.day, r.count]));
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
    const allDays = [...new Set([...days, ...club.keys()])].filter((d) => localDate(d).getDay() === wd);
    const totals = allDays.map((d) => [...(byDay.get(d)?.values() || [])].reduce((s, r) => s + r.arrivals, 0) + (club.get(d) || 0));
    const clubs = allDays.map((d) => club.get(d) || 0);
    out[wd] = {
      days: days.length,
      hours,
      usualTotal: median(totals),
      busiestTotal: Math.max(0, ...totals),
      clubUsual: median(clubs),
      clubMax: Math.max(0, ...clubs),
    };
  }
  return out;
}

function HeatCell({ value, max, title }) {
  const t = max > 0 ? value / max : 0;
  return (
    <div
      title={title}
      className="flex h-10 items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums"
      style={{
        backgroundColor: value > 0 ? `rgb(var(--ninja-blue) / ${0.1 + t * 0.9})` : 'rgb(var(--ninja-border) / 0.45)',
        color: t > 0.55 ? '#ffffff' : 'rgb(var(--ninja-navy))',
      }}
    >
      {value}
    </div>
  );
}

// Weekdays down the side, open hours across. Saturday keeps different hours,
// so it gets its own header row rather than sitting under 3 PM as if 10 AM
// were the same slot.
function Heatmap({ stats, max }) {
  const block = (days, first) => {
    const open = stats[days[0]]?.hours.map((h) => h.hour) || [];
    return (
      <div className="grid grid-cols-[2.5rem_repeat(4,minmax(0,1fr))_4.5rem] items-center gap-1.5">
        <span />
        {open.map((h) => <span key={h} className="text-center text-[11px] text-ninja-muted">{hourShort(h)}</span>)}
        {first ? <span className="text-right text-[11px] text-ninja-muted">Median of</span> : <span />}
        {days.map((wd) => {
          const s = stats[wd];
          return [
            <span key={`${wd}-l`} className="text-[13px] font-medium text-ninja-navy">{WEEKDAY_SHORT[wd]}</span>,
            ...(s?.hours || []).map((h) => {
              const v = h.peak;
              return (
                <HeatCell
                  key={`${wd}-${h.hour}`}
                  value={s.days ? v : 0}
                  max={max}
                  title={s.days
                    ? `${WEEKDAY_NAMES[wd]} ${hourLabel(h.hour)}: usually ${v} in the room at once, up to ${h.peakMax}, over ${plural(s.days, 'day')}`
                    : `${WEEKDAY_NAMES[wd]}: no check-ins in this period`}
                />
              );
            }),
            <span key={`${wd}-n`} className="text-right text-xs tabular-nums text-ninja-muted">{plural(s?.days || 0, 'day')}</span>,
          ];
        })}
      </div>
    );
  };
  return (
    <div className="space-y-4">
      {block([1, 2, 3, 4, 5], true)}
      {block([6])}
    </div>
  );
}

function HeatmapCard({ data, error, title, sub }) {
  const stats = useMemo(() => (data ? summarize(data) : null), [data]);
  const max = stats
    ? Math.max(0, ...Object.values(stats).flatMap((s) => s.hours.map((h) => h.peak)))
    : 0;
  const any = stats && Object.values(stats).some((s) => s.days > 0);
  return (
    <Card title={title} sub={sub}>
      {error ? <ErrorLine>{error}</ErrorLine>
        : !stats ? <Skeleton className="h-64 rounded-xl" />
          : !any ? <Empty>No check-ins in this period.</Empty>
            : <Heatmap stats={stats} max={max} />}
    </Card>
  );
}

// One hour of the detail. Over a period the bar is solid to the usual day and
// pale out to the busiest, so the gap between them is the part a schedule has
// to absorb.
function HourStat({ hour, peak, peakMax, arrivals, arrivalsMax, scale, pattern, index }) {
  const pctOf = (n) => (scale > 0 ? `${Math.max((n / scale) * 100, n > 0 ? 2 : 0)}%` : '0%');
  const ease = { duration: 0.6, delay: Math.min(index * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] };
  return (
    <div className="min-w-0 py-4 xl:px-5 xl:first:pl-0 xl:last:pr-0">
      <p className="text-[13px] font-medium text-ninja-muted">{hourLabel(hour)}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-ninja-navy">{peak}</span>
        <span className="text-[13px] text-ninja-muted">at once{pattern ? `, up to ${peakMax}` : ''}</span>
      </p>
      <span className="relative mt-3 block h-2 overflow-hidden rounded-full bg-ninja-bg">
        {pattern && (
          <motion.span className="absolute inset-y-0 left-0 rounded-full" style={{ backgroundColor: ACCENT, opacity: 0.28 }}
            initial={{ width: 0 }} animate={{ width: pctOf(peakMax) }} transition={ease} />
        )}
        <motion.span className="absolute inset-y-0 left-0 rounded-full" style={{ backgroundColor: ACCENT }}
          initial={{ width: 0 }} animate={{ width: pctOf(peak) }} transition={ease} />
      </span>
      <p className="mt-2 text-xs tabular-nums text-ninja-muted">
        {pattern ? `${arrivals} arrived, up to ${arrivalsMax}` : `${arrivals} arrived`}
      </p>
    </div>
  );
}

const stepBtn = 'flex h-8 w-8 items-center justify-center rounded-lg border border-ninja-border bg-white text-ninja-navy transition-colors hover:bg-ninja-bg disabled:opacity-40 disabled:hover:bg-white';

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
  let summary = null;
  let loading = false;
  let error = '';
  let dayClub = 0;
  if (pattern) {
    error = periodData.error;
    loading = !stats && !error;
    const s = stats?.[weekday];
    if (s?.days) {
      rows = s.hours;
      summary = `Usually ${s.usualTotal} ninjas on a ${WEEKDAY_NAMES[weekday]}, up to ${s.busiestTotal}, over ${plural(s.days, 'day')}`;
      if (s.clubMax > 0) summary += `. Of those, ${s.clubUsual === s.clubMax ? s.clubMax : `${s.clubUsual} to ${s.clubMax}`} came only for a club`;
    }
  } else {
    error = one.error;
    loading = !one.data && !error;
    if (one.data) {
      const open = one.data.openHours[localDate(date).getDay()];
      const byHour = new Map(one.data.hours.map((r) => [r.hour, r]));
      if (open && one.data.days.length) {
        for (let h = open[0]; h < open[1]; h += 1) {
          const r = byHour.get(h);
          rows.push({ hour: h, peak: r?.peak || 0, peakMax: r?.peak || 0, arrivals: r?.arrivals || 0, arrivalsMax: r?.arrivals || 0 });
        }
      }
      const clubCount = (one.data.clubOnly || []).reduce((s, r) => s + r.count, 0);
      const board = one.data.hours.reduce((s, r) => s + r.arrivals, 0);
      summary = `${plural(board + clubCount, 'ninja')} came`;
      if (clubCount) summary += `, ${clubCount} of them only for a club`;
      dayClub = clubCount;
    }
  }
  const scale = Math.max(0, ...rows.map((r) => r.peakMax));
  const closedDay = !pattern && localDate(date).getDay() === 0;
  const dayName = localDate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <Card
      title="Hour by hour"
      sub={pattern ? `${WEEKDAY_NAMES[weekday]}s in this period` : dayName}
      action={<Toggle label="View" options={[{ value: 'typical', label: 'Usual day' }, { value: 'day', label: 'One day' }]} value={mode} onChange={setMode} />}
    >
      <div className="flex flex-wrap items-center gap-2">
        {centerPicker}
        {pattern ? (
          <Toggle label="Weekday" options={OPEN_WEEKDAYS.map((i) => ({ value: i, label: WEEKDAY_SHORT[i] }))} value={weekday} onChange={setWeekday} />
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
              className="h-8 rounded-lg border border-ninja-border bg-white px-2 text-[13px] text-ninja-navy"
            />
            <button type="button" className={stepBtn} onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day">
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {summary && <p className="mt-4 text-sm font-medium text-ninja-navy">{summary}</p>}
      <div className="mt-1">
        {error ? <ErrorLine>{error}</ErrorLine>
          : loading ? <Skeleton className="mt-3 h-28 rounded-xl" />
            : closedDay ? <Empty>The center is closed on Sundays.</Empty>
              : rows.length === 0 ? <Empty>{pattern ? `No check-ins on ${WEEKDAY_NAMES[weekday]}s in this period.` : dayClub ? 'Everyone this day came only for a club, and clubs have no time recorded.' : 'No check-ins on this day.'}</Empty>
                : (
                  <div className="grid gap-x-8 divide-y divide-ninja-border sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:gap-x-0 xl:divide-x">
                    {rows.map((r, i) => <HourStat key={r.hour} index={i} scale={scale} pattern={pattern} {...r} />)}
                  </div>
                )}
      </div>
    </Card>
  );
}

function SingleCenter({ query, centerId }) {
  const periodData = useReport(`/reports/checkins-by-hour?${query}`);
  return (
    <>
      <HeatmapCard
        data={periodData.data}
        error={periodData.error}
        title="When the room is full"
        sub="Ninjas in the room at once on a usual day"
      />
      <HourDetail periodData={periodData} centerId={centerId} />
    </>
  );
}

function CenterHeatmap({ query, center }) {
  const { data, error } = useReport(`/reports/checkins-by-hour?${queryFor(query, center.id)}`);
  return <HeatmapCard data={data} error={error} title={center.name} />;
}

function AllCenters({ query, centers }) {
  const [picked, setPicked] = useState(centers[0]?.id);
  const periodData = useReport(picked ? `/reports/checkins-by-hour?${queryFor(query, picked)}` : null);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {centers.map((c) => <CenterHeatmap key={c.id} query={query} center={c} />)}
      </div>
      <HourDetail
        key={picked}
        periodData={periodData}
        centerId={picked}
        centerPicker={centers.length > 1 && (
          <Toggle label="Center" options={centers.map((c) => ({ value: c.id, label: c.name }))} value={picked} onChange={setPicked} />
        )}
      />
    </>
  );
}

export default function ReportsAttendance() {
  const { query, center, centers } = useReportFilters();
  if (!center) return <Loading />;
  return center === 'all'
    ? <AllCenters query={query} centers={centers} />
    : <SingleCenter key={center} query={query} centerId={center} />;
}
