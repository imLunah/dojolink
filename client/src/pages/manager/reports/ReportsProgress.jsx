import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '../../../components/ui/chart';
import BeltIcon from '../../../components/ui/BeltIcon';
import { authorName } from '../../../lib/authors';
import {
  ACCENT, Card, ErrorLine, Loading, Metric, NinjaCell, Table,
  addDays, plural, shortDate, useReport, useReportFilters,
} from '../../../components/reports/ReportParts';

// The Progress tab: are ninjas moving up, and who is doing the teaching.
//
// The sensei table is a workload picture, not a league table. A sensei on the
// JR table logs shorter, simpler sessions than one on a Brown belt, so it is
// sorted by name and nothing on it is ranked or coloured good or bad.

function WeekTooltip({ active, payload, noun }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-ninja-border bg-white px-3 py-2 shadow-lg">
      <p className="text-[11px] text-ninja-muted">Week of {shortDate(p.week)}{p.partial ? ', part of it' : ''}</p>
      <p className="text-sm font-semibold tabular-nums text-ninja-navy">{plural(p.value, noun)}</p>
    </div>
  );
}

// Weeks the period only partly covers are drawn pale, so a three-day first
// week does not read as a slump.
function WeeklyBars({ title, rows, field, noun }) {
  const data = rows.map((r) => ({ week: r.week, value: r[field], partial: r.partial }));
  const total = data.reduce((s, r) => s + r.value, 0);
  return (
    <Card title={title}>
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ninja-navy">{total}</span>
        <span className="text-[13px] text-ninja-muted">{noun}{total === 1 ? '' : 's'}</span>
      </div>
      <ChartContainer config={{ value: { label: title, color: ACCENT } }} className="w-full" style={{ height: 200 }}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey="week" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={16} tickMargin={10} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
          <ChartTooltip cursor={{ fill: 'rgb(var(--ninja-border) / 0.35)' }} content={<WeekTooltip noun={noun} />} />
          <Bar dataKey="value" radius={[6, 6, 6, 6]} maxBarSize={32} animationDuration={600}>
            {data.map((d) => <Cell key={d.week} fill="var(--color-value)" fillOpacity={d.partial ? 0.3 : 1} />)}
          </Bar>
        </BarChart>
      </ChartContainer>
    </Card>
  );
}

export default function ReportsProgress() {
  const { query } = useReportFilters();
  const { data, error } = useReport(`/reports/progress?${query}`);

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!data) return <Loading />;

  const { period } = data;
  const weeks = data.weekly.map((w) => ({
    ...w,
    partial: w.week < period.from || addDays(w.week, 6) > period.to,
  }));
  const sessions = weeks.reduce((s, w) => s + w.sessions, 0);
  const ninjasMoved = new Set(data.beltUps.map((b) => b.student_id)).size;
  const multi = data.beltUps.some((b) => b.centers);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Belt-ups" value={data.beltUps.length} compare={ninjasMoved !== data.beltUps.length ? `by ${plural(ninjasMoved, 'ninja')}` : null} />
        <Metric label="Sessions logged" value={sessions} />
        <Metric label="Senseis who logged" value={data.senseis.length} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WeeklyBars title="Sessions logged each week" rows={weeks} field="sessions" noun="session" />
        <WeeklyBars title="Belt-ups each week" rows={weeks} field="belt_ups" noun="belt-up" />
        <Card title="Belt-ups" sub="Newest first">
          <Table
            rowKey={(r) => `${r.student_id}-${r.program}-${r.belt}`}
            rows={data.beltUps}
            maxHeight={420}
            minWidth={460}
            empty="No belt-ups in this period."
            columns={[
              { key: 'ninja', label: 'Ninja', render: (r) => <NinjaCell id={r.student_id} name={r.full_name} sub={multi ? r.centers : null} /> },
              {
                key: 'belt',
                label: 'Belt',
                render: (r) => (
                  <span className="flex items-center gap-2">
                    <BeltIcon belt={r.belt} size={20} />
                    {r.belt}{r.program !== 'CREATE' ? ` · ${r.program}` : ''}
                  </span>
                ),
              },
              { key: 'day', label: 'Date', align: 'right', render: (r) => shortDate(r.day) },
              { key: 'sensei', label: 'Sensei', className: 'text-ninja-muted', render: (r) => authorName(r.sensei_name) },
            ]}
          />
        </Card>
        <Card title="Sessions logged by sensei">
          <Table
            rowKey={(r) => r.sensei_id ?? 'deleted'}
            rows={data.senseis}
            maxHeight={420}
            empty="No sessions logged in this period."
            columns={[
              { key: 'name', label: 'Sensei', render: (r) => <span className="font-medium">{authorName(r.display_name)}</span> },
              { key: 'sessions', label: 'Sessions', align: 'right' },
              { key: 'ninjas', label: 'Ninjas', align: 'right' },
              { key: 'days', label: 'Days', align: 'right' },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
