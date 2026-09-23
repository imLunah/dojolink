import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '../../../components/ui/chart';
import { SkeletonCards } from '../../../components/ui/Skeleton';
import {
  ACCENT, TILE, BarRow, Delta, Empty, ErrorLine, KpiStrip, Section, WEEKDAY_NAMES,
  addDays, comparable, localDate, median, plural, shortDate, useReport, useReportFilters,
} from '../../../components/reports/ReportParts';

// The Overview tab: the handful of numbers an owner asks about first, each
// against the period before, then how the visits ran across the period and
// which days carry the week. With every center selected it ends on the centers
// side by side, which is the question nobody could answer before without
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
    <div className="rounded-lg border border-ninja-border bg-white px-2.5 py-1.5 shadow-lg font-ninja">
      <p className="text-[11px] text-ninja-muted">{localDate(p.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
      <p className="text-sm font-bold text-ninja-navy tabular-nums">{plural(p.cur, 'ninja')}</p>
      {showPrev && (
        <p className="text-[11px] text-ninja-muted tabular-nums">
          {plural(p.prev, 'ninja')} on {shortDate(p.prevDate)}
        </p>
      )}
    </div>
  );
}

function VisitsChart({ data, showPrev, days }) {
  return (
    <Section
      title="Ninjas each day"
      className="lg:col-span-2"
      footer={
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-ninja text-xs text-ninja-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: ACCENT }} />This period
          </span>
          {showPrev && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0 w-4 border-t-2 border-dashed border-ninja-muted/60" />The {plural(days, 'day')} before
            </span>
          )}
        </div>
      }
    >
      <div className={`${TILE} px-2 pt-3 pb-1`}>
        {data.length === 0 ? <Empty>No check-ins in this period.</Empty> : (
          <ChartContainer config={CHART_CONFIG} className="w-full" style={{ height: 300 }}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
                tickMargin={8}
              />
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
                  strokeOpacity={0.45}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                  animationDuration={700}
                />
              )}
              <Line
                type="monotone"
                dataKey="cur"
                stroke="var(--color-cur)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, className: 'stroke-white dark:stroke-[#252c3e]' }}
                animationDuration={700}
              />
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </Section>
  );
}

// Which weekdays carry the week: the usual number of ninjas on each open day,
// the median rather than the mean so one packed Saturday does not speak for
// the other seven.
function Weekdays({ rows }) {
  const max = Math.max(0, ...rows.map((r) => r.usual));
  return (
    <Section title="A usual day, by weekday">
      <ul className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <BarRow
            key={r.day}
            index={i}
            name={WEEKDAY_NAMES[r.day]}
            count={r.usual}
            color={ACCENT}
            max={max}
          />
        ))}
      </ul>
    </Section>
  );
}

function CenterTable({ rows, days }) {
  return (
    <Section title="Centers side by side" className="lg:col-span-3">
      <div className={`${TILE} overflow-x-auto`}>
        <table className="w-full min-w-[560px] font-ninja text-[13px]">
          <thead>
            <tr className="text-left text-xs text-ninja-muted">
              <th className="px-4 py-2.5 font-semibold">Center</th>
              <th className="px-4 py-2.5 font-semibold text-right">On the roster</th>
              <th className="px-4 py-2.5 font-semibold text-right">Came</th>
              <th className="px-4 py-2.5 font-semibold text-right">Share who came</th>
              <th className="px-4 py-2.5 font-semibold text-right">Visits</th>
              <th className="px-4 py-2.5 font-semibold text-right">Visits a week, per ninja</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-ninja-border text-ninja-navy tabular-nums">
                <td className="px-4 py-2.5 font-semibold">{r.name}</td>
                <td className="px-4 py-2.5 text-right">{r.roster}</td>
                <td className="px-4 py-2.5 text-right">{r.seen}</td>
                <td className="px-4 py-2.5 text-right">{r.roster ? `${Math.round((r.seen / r.roster) * 100)}%` : '0%'}</td>
                <td className="px-4 py-2.5 text-right">{r.visits}</td>
                <td className="px-4 py-2.5 text-right">{perWeek(r.visits, r.seen, days) ?? '0.0'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export default function ReportsOverview() {
  const { query } = useReportFilters();
  const { data, error } = useReport(`/reports/summary?${query}`);

  const view = useMemo(() => {
    if (!data) return null;
    const { period, daily, dataSince } = data;
    const showPrev = comparable(period, dataSince);
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
    const weekdays = [1, 2, 3, 4, 5, 6]
      .filter((d) => perDay[d])
      .map((d) => ({ day: d, usual: median(perDay[d]) }));
    return { showPrev, chart, weekdays, hasVisits: daily.some((r) => r.day >= period.from) };
  }, [data]);

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!data) return <SkeletonCards count={6} label="Loading overview" />;

  const { kpis, period } = data;
  const { showPrev } = view;
  const rate = perWeek(kpis.visits.cur, kpis.ninjasSeen.cur, period.days);

  return (
    <>
      <KpiStrip
        items={[
          {
            label: 'Ninjas who came',
            value: kpis.ninjasSeen.cur,
            delta: <Delta {...kpis.ninjasSeen} show={showPrev} />,
            sub: `of ${kpis.roster} on the roster`,
          },
          {
            label: 'Visits',
            value: kpis.visits.cur,
            delta: <Delta {...kpis.visits} show={showPrev} />,
            sub: rate ? `${rate} a week per ninja` : null,
          },
          {
            label: 'Belt-ups',
            value: kpis.beltUps.cur,
            delta: <Delta {...kpis.beltUps} show={showPrev} />,
          },
          {
            label: 'Stopped coming',
            value: kpis.lapsed,
            tone: kpis.lapsed > 0 ? 'text-ninja-red' : undefined,
            sub: `came the ${plural(period.days, 'day')} before, not since`,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <VisitsChart data={view.hasVisits ? view.chart : []} showPrev={showPrev} days={period.days} />
        {view.weekdays.length > 0
          ? <Weekdays rows={view.weekdays} />
          : <Section title="A usual day, by weekday"><Empty>No check-ins in this period.</Empty></Section>}
        {data.perCenter && <CenterTable rows={data.perCenter} days={period.days} />}
      </div>
    </>
  );
}
