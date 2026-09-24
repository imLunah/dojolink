import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '../../../components/ui/chart';
import {
  Card, DeltaChip, ErrorLine, Loading, Metric, Table,
  addDays, comparable, localDate, plural, rangeLabel, shortDate, useReport, useReportFilters,
} from '../../../components/reports/ReportParts';

// The Classes tab: which programs and clubs the visits go to, so a director can
// see what is popular and what is not. A visit here is a ninja in one class on
// one day, so a ninja who did CREATE and Robotics on the same afternoon counts
// once in each, and these totals run higher than Visits on Overview.

const NO_CLASS = 'No class picked';

// The chart needs every line told apart at a glance, so it keeps its own
// colours rather than the program identity colours, three of which are blue.
const SERIES_COLORS = {
  CREATE: '#2563eb',
  'Robotics Academy': '#f59e0b',
  JR: '#7c3aed',
  'AI Academy': '#0d9488',
  'VR Coding': '#db2777',
  Clubs: '#16a34a',
  '': '#94a3b8',
};

const nameOf = (cls) => cls || NO_CLASS;

function perWeek(visits, ninjas, days) {
  if (!ninjas || !days) return null;
  return (visits / ninjas / (days / 7)).toFixed(1);
}

const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '0%');

function WeekTooltip({ active, payload, series, period }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const partial = p.week < period.from || addDays(p.week, 6) > period.to;
  return (
    <div className="rounded-lg border border-ninja-border bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-[11px] text-ninja-muted">Week of {shortDate(p.week)}{partial ? ', part of it' : ''}</p>
      {series.map((s) => (
        <p key={s.key} className="flex items-center gap-2 text-[13px] tabular-nums text-ninja-navy">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
          <span className="flex-1">{s.name}</span>
          <span className="font-semibold">{p[s.key] || 0}</span>
        </p>
      ))}
    </div>
  );
}

function WeeklyChart({ weekly, series, period }) {
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.name, color: s.color }]));
  return (
    <Card
      title="Visits each week, by class"
      className="xl:col-span-2"
      action={(
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-ninja-muted">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
            </span>
          ))}
        </div>
      )}
    >
      <ChartContainer config={config} className="w-full" style={{ height: 260 }}>
        <LineChart data={weekly} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey="week" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={24} tickMargin={10} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
          <ChartTooltip
            cursor={{ stroke: 'rgb(var(--ninja-muted))', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={<WeekTooltip series={series} period={period} />}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={`var(--color-${s.key})`}
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, className: 'stroke-white dark:stroke-[#252c3e]' }}
              animationDuration={700}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </Card>
  );
}

export default function ReportsClasses() {
  const { query } = useReportFilters();
  const { data, error } = useReport(`/reports/classes?${query}`);

  const view = useMemo(() => {
    if (!data) return null;
    const { period, programs, weekly, clubs } = data;
    const showPrev = comparable(period, data.dataSince);

    const rows = programs
      .filter((r) => r.cur > 0 || r.prev > 0 || r.enrolled > 0)
      .sort((a, b) => (a.cls === '') - (b.cls === '') || b.cur - a.cur || a.cls.localeCompare(b.cls));
    const classTotal = rows.reduce((s, r) => s + r.cur, 0);

    const clubRows = clubs
      ? clubs.filter((c) => c.sessions > 0 || c.prev > 0).sort((a, b) => b.cur - a.cur || a.name.localeCompare(b.name))
      : null;
    const club = weekly.filter((w) => w.cls === 'Clubs').reduce((s, w) => s + w.visits, 0);
    const clubPrev = clubRows ? clubRows.reduce((s, c) => s + c.prev, 0) : 0;
    const clubSessions = clubRows ? clubRows.reduce((s, c) => s + c.sessions, 0) : 0;

    // Series in table order, then clubs; one key per series so recharts has
    // a CSS-safe name for each colour.
    const present = new Set(weekly.map((w) => w.cls));
    const order = [...rows.map((r) => r.cls), 'Clubs'].filter((c) => present.has(c));
    const series = order.map((cls, i) => ({ key: `s${i}`, cls, name: nameOf(cls), color: SERIES_COLORS[cls] || '#64748b' }));
    const keyOf = new Map(series.map((s) => [s.cls, s.key]));
    const weeks = [];
    const start = weekStart(period.from);
    for (let w = start; w <= period.to; w = addDays(w, 7)) weeks.push({ week: w });
    const byWeek = new Map(weeks.map((w) => [w.week, w]));
    for (const w of weekly) {
      const row = byWeek.get(w.week);
      if (row) row[keyOf.get(w.cls)] = w.visits;
    }
    for (const row of weeks) for (const s of series) row[s.key] ||= 0;

    return { showPrev, rows, classTotal, clubRows, club, clubPrev, clubSessions, series, weeks };
  }, [data]);

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!data) return <Loading />;

  const { period } = data;
  const { showPrev, rows, classTotal, clubRows, series, weeks } = view;
  const compare = showPrev ? `vs ${rangeLabel(period.prevFrom, period.prevTo)}` : 'No earlier data to compare';
  const top = rows.find((r) => r.cls && r.cur > 0);
  const prevTotal = rows.reduce((s, r) => s + r.prev, 0);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric
          label="Class visits"
          value={classTotal}
          delta={<DeltaChip cur={classTotal} prev={prevTotal} show={showPrev} />}
          compare={compare}
        />
        <Metric
          label="Busiest program"
          value={top ? top.cls : '-'}
          compare={top ? `${pct(top.cur, classTotal)} of class visits` : 'No check-ins in this period'}
        />
        {clubRows && (
          <Metric
            label="Club visits"
            value={view.club}
            delta={<DeltaChip cur={view.club} prev={view.clubPrev} show={showPrev} />}
            compare={`over ${plural(view.clubSessions, 'club session')}`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Programs" sub="Who is enrolled, and who actually came" className="xl:col-span-2">
          <Table
            rowKey={(r) => nameOf(r.cls)}
            rows={rows}
            minWidth={720}
            empty="No check-ins in this period."
            columns={[
              { key: 'name', label: 'Program', render: (r) => <span className="font-medium">{nameOf(r.cls)}</span> },
              { key: 'enrolled', label: 'Enrolled', align: 'right', render: (r) => (r.cls ? r.enrolled : '') },
              { key: 'ninjas', label: 'Came', align: 'right' },
              { key: 'came', label: 'Share who came', align: 'right', render: (r) => (r.cls && r.enrolled ? pct(Math.min(r.ninjas, r.enrolled), r.enrolled) : '') },
              {
                key: 'cur',
                label: 'Visits',
                align: 'right',
                render: (r) => (
                  <span className="inline-flex items-center justify-end gap-2">
                    <DeltaChip cur={r.cur} prev={r.prev} show={showPrev} />
                    {r.cur}
                  </span>
                ),
              },
              { key: 'rate', label: 'Visits a week, per ninja', align: 'right', render: (r) => perWeek(r.cur, r.ninjas, period.days) ?? '0.0' },
              { key: 'share', label: 'Share of visits', align: 'right', render: (r) => pct(r.cur, classTotal) },
            ]}
          />
        </Card>

        {series.length > 0 && <WeeklyChart weekly={weeks} series={series} period={period} />}

        {clubRows && (
          <Card title="Clubs" className="xl:col-span-2">
            <Table
              rowKey={(r) => r.name}
              rows={clubRows}
              minWidth={640}
              empty="No clubs ran in this period."
              columns={[
                { key: 'name', label: 'Club', render: (r) => <span className="font-medium">{r.name}</span> },
                { key: 'sessions', label: 'Sessions run', align: 'right' },
                { key: 'ninjas', label: 'Ninjas', align: 'right' },
                {
                  key: 'cur',
                  label: 'Visits',
                  align: 'right',
                  render: (r) => (
                    <span className="inline-flex items-center justify-end gap-2">
                      <DeltaChip cur={r.cur} prev={r.prev} show={showPrev} />
                      {r.cur}
                    </span>
                  ),
                },
                { key: 'avg', label: 'Ninjas a session', align: 'right', render: (r) => (r.sessions ? (r.cur / r.sessions).toFixed(1) : '0.0') },
                { key: 'last', label: 'Last run', align: 'right', render: (r) => (r.last ? shortDate(r.last) : '') },
              ]}
            />
          </Card>
        )}
      </div>
    </>
  );
}

// The Monday on or before a date, matching Postgres date_trunc('week').
function weekStart(dateStr) {
  const dow = localDate(dateStr).getDay();
  return addDays(dateStr, -((dow + 6) % 7));
}
