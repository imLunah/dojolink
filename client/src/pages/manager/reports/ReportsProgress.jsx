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
// The sensei table is ranked, most sessions logged first (clubs run break a
// tie), and the top three wear a medal. The owner asked for the ranking.

// Gold, silver, bronze: a disc with its place on it, printed in fixed ink so
// it reads the same in both themes.
const MEDALS = [
  { face: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)', ink: '#78350f', name: 'First' },
  { face: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 55%, #64748b 100%)', ink: '#1e293b', name: 'Second' },
  { face: 'linear-gradient(135deg, #fed7aa 0%, #c2703d 55%, #7c3f1d 100%)', ink: '#431407', name: 'Third' },
];

function RankMedal({ place }) {
  const m = MEDALS[place];
  if (!m) return <span className="inline-block w-6 shrink-0" aria-hidden="true" />;
  return (
    <span
      className="rank-medal inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-sm"
      style={{ background: m.face, color: m.ink, '--glint-delay': `${place * 0.25}s` }}
      role="img"
      aria-label={`${m.name} place`}
    >
      {place + 1}
    </span>
  );
}

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
  // Most sessions first, clubs run breaking a tie. A tie on both shares the
  // place, so two senseis level at the top both wear gold.
  const ranked = [...data.senseis]
    .sort((a, b) => b.sessions - a.sessions || b.clubs - a.clubs
      || String(a.display_name ?? '').localeCompare(String(b.display_name ?? '')))
    .map((r, _, all) => {
      const first = all.findIndex((o) => o.sessions === r.sessions && o.clubs === r.clubs);
      return { ...r, place: r.sessions + r.clubs > 0 ? first : -1 };
    });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Belt-ups" value={data.beltUps.length} compare={ninjasMoved !== data.beltUps.length ? `by ${plural(ninjasMoved, 'ninja')}` : null} />
        <Metric label="Sessions logged" value={sessions} />
        <Metric label="Senseis teaching" value={data.senseis.length} compare="logged a session or ran a club" />
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
        <Card title="Sessions by sensei">
          <Table
            rowKey={(r) => r.sensei_id ?? 'deleted'}
            rows={ranked}
            maxHeight={420}
            empty="No sessions logged or clubs run in this period."
            columns={[
              {
                key: 'name',
                label: 'Sensei',
                render: (r) => (
                  <span className="flex items-center gap-2.5">
                    <RankMedal place={r.place} />
                    <span className="font-medium">{authorName(r.display_name)}</span>
                  </span>
                ),
              },
              { key: 'sessions', label: 'Sessions', align: 'right' },
              { key: 'clubs', label: 'Clubs run', align: 'right' },
              { key: 'ninjas', label: 'Ninjas', align: 'right' },
              { key: 'days', label: 'Days', align: 'right' },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
