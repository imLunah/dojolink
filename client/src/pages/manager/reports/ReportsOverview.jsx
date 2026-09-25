import { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '../../../components/ui/chart';
import {
  ACCENT, Card, CardLink, DeltaChip, Empty, ErrorLine, Loading, Meters, Metric, Sparkline, Table,
  WEEKDAY_NAMES, addDays, comparable, localDate, median, plural, rangeLabel, shortDate, useReport, useReportFilters,
} from '../../../components/reports/ReportParts';

// The Overview tab: the handful of numbers an owner asks about first, each
// against the same number of days just before, then how the visits ran across
// the period and which days carry the week. With every center selected it ends
// on the centers side by side, which nobody could answer before without
// switching three times.

const CHART_CONFIG = {
  cur: { label: 'This period', color: ACCENT },
  prev: { label: 'Period before', color: 'rgb(var(--ninja-muted))' },
};

// Sunday is closed everywhere, so it is not a zero on the chart.
const isOpenDay = (date) => localDate(date).getDay() !== 0;

function perWeek(visits, ninjas, days) {
  if (!ninjas || !days) return null;
  return (visits / ninjas / (days / 7)).toFixed(1);
}

function VisitsTooltip({ active, payload, showPrev }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-ninja-border bg-white px-3 py-2 shadow-lg">
      <p className="text-[11px] text-ninja-muted">{localDate(p.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
      <p className="text-sm font-semibold tabular-nums text-ninja-navy">{plural(p.cur, 'ninja')}</p>
      {showPrev && <p className="text-[11px] tabular-nums text-ninja-muted">{plural(p.prev, 'ninja')} on {shortDate(p.prevDate)}</p>}
    </div>
  );
}

function Legend({ showPrev }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ninja-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />This period
      </span>
      {showPrev && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-3.5 border-t-2 border-dashed border-ninja-muted/70" />Period before
        </span>
      )}
    </div>
  );
}

function VisitsChart({ data, showPrev, total, delta }) {
  return (
    <Card
      title="Ninjas each day"
      className="xl:col-span-2"
      action={<Legend showPrev={showPrev} />}
    >
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ninja-navy">{total}</span>
        <span className="text-[13px] text-ninja-muted">visits</span>
        {delta}
      </div>
      {data.length === 0 ? <Empty>No check-ins in this period.</Empty> : (
        <ChartContainer config={CHART_CONFIG} className="w-full" style={{ height: 260 }}>
          <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="reportVisitsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-cur)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--color-cur)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 4" />
            <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={32} tickMargin={10} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
            <ChartTooltip
              cursor={{ stroke: 'rgb(var(--ninja-muted))', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={<VisitsTooltip showPrev={showPrev} />}
            />
            {showPrev && (
              <Line
                type="monotone"
                dataKey="prev"
                stroke="var(--color-prev)"
                strokeOpacity={0.5}
                strokeWidth={1.75}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
                animationDuration={700}
              />
            )}
            <Area
              type="monotone"
              dataKey="cur"
              stroke="var(--color-cur)"
              strokeWidth={2.25}
              fill="url(#reportVisitsFill)"
              dot={false}
              activeDot={{ r: 4.5, strokeWidth: 2, className: 'stroke-white dark:stroke-[#252c3e]' }}
              animationDuration={700}
            />
          </ComposedChart>
        </ChartContainer>
      )}
    </Card>
  );
}

// Which weekdays carry the week: the usual number of ninjas on each open day,
// the median rather than the mean so one packed Saturday does not speak for
// the other seven.
function Weekdays({ rows }) {
  const max = Math.max(0, ...rows.map((r) => r.usual));
  return (
    <Card
      title="A usual day"
      sub="Ninjas on each weekday"
      footer={<CardLink to="/manager/reports/attendance">See the hours</CardLink>}
    >
      {rows.length === 0 ? <Empty>No check-ins in this period.</Empty> : (
        <Meters rows={rows.map((r) => ({ name: WEEKDAY_NAMES[r.day], count: r.usual }))} max={max} showPct={false} />
      )}
    </Card>
  );
}

function CenterTable({ rows, days }) {
  return (
    <Card title="Centers side by side" className="xl:col-span-3">
      <Table
        rowKey={(r) => r.id}
        rows={rows}
        minWidth={620}
        columns={[
          { key: 'name', label: 'Center', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'roster', label: 'On the roster', align: 'right' },
          { key: 'seen', label: 'Came', align: 'right' },
          { key: 'share', label: 'Share who came', align: 'right', render: (r) => (r.roster ? `${Math.round((r.seen / r.roster) * 100)}%` : '0%') },
          { key: 'visits', label: 'Visits', align: 'right' },
          { key: 'rate', label: 'Visits a week, per ninja', align: 'right', render: (r) => perWeek(r.visits, r.seen, days) ?? '0.0' },
        ]}
      />
    </Card>
  );
}

export default function ReportsOverview() {
  const { query } = useReportFilters();
  const { data, error } = useReport(`/reports/summary?${query}`);

  const view = useMemo(() => {
    if (!data) return null;
    const { period, daily, dataSince } = data;
    const byDay = new Map(daily.map((r) => [r.day, r.count]));
    const chart = [];
    for (let d = period.from; d <= period.to; d = addDays(d, 1)) {
      if (!isOpenDay(d)) continue;
      const prevDate = addDays(d, -period.days);
      chart.push({ date: d, cur: byDay.get(d) || 0, prev: byDay.get(prevDate) || 0, prevDate });
    }
    // A usual day per weekday counts only days the center had anyone in, so a
    // holiday closure does not drag the week down.
    const perDay = {};
    for (const r of daily) {
      if (r.day < period.from) continue;
      (perDay[localDate(r.day).getDay()] ||= []).push(r.count);
    }
    const weekdays = [1, 2, 3, 4, 5, 6].filter((d) => perDay[d]).map((d) => ({ day: d, usual: median(perDay[d]) }));
    // Weekly sums (six open days) make a steadier sparkline than a daily line.
    const weekly = [];
    for (let i = 0; i < chart.length; i += 6) weekly.push(chart.slice(i, i + 6).reduce((s, r) => s + r.cur, 0));
    return {
      showPrev: comparable(period, dataSince),
      chart,
      weekdays,
      weekly,
      hasVisits: daily.some((r) => r.day >= period.from),
    };
  }, [data]);

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!data) return <Loading />;

  const { kpis, period } = data;
  const { showPrev } = view;
  const compare = showPrev ? `vs ${rangeLabel(period.prevFrom, period.prevTo)}` : 'No earlier data to compare';
  const rate = perWeek(kpis.visits.cur, kpis.ninjasSeen.cur, period.days);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Ninjas who came"
          value={kpis.ninjasSeen.cur}
          delta={<DeltaChip {...kpis.ninjasSeen} show={showPrev} />}
          compare={`of ${kpis.roster} on the roster`}
          footer={<CardLink to="/manager/reports/students" />}
        />
        <Metric
          label="Visits"
          value={kpis.visits.cur}
          delta={<DeltaChip {...kpis.visits} show={showPrev} />}
          compare={rate ? `${rate} a week per ninja` : compare}
          spark={<Sparkline values={view.weekly} />}
          footer={<CardLink to="/manager/reports/attendance" />}
        />
        <Metric
          label="Belt-ups"
          value={kpis.beltUps.cur}
          delta={<DeltaChip {...kpis.beltUps} show={showPrev} />}
          compare={compare}
          footer={<CardLink to="/manager/reports/progress" />}
        />
        <Metric
          label="Not seen in 30+ days"
          value={kpis.inactive30}
          tone={kpis.inactive30 > 0 ? 'text-ninja-red' : undefined}
          compare="on the roster, no visit or club"
          footer={<CardLink to="/manager/reports/students" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <VisitsChart
          data={view.hasVisits ? view.chart : []}
          showPrev={showPrev}
          total={kpis.visits.cur}
          delta={<DeltaChip {...kpis.visits} show={showPrev} />}
        />
        <Weekdays rows={view.weekdays} />
        {data.perCenter && <CenterTable rows={data.perCenter} days={period.days} />}
      </div>
    </>
  );
}
