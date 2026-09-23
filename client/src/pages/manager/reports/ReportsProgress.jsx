import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '../../../components/ui/chart';
import BeltIcon from '../../../components/ui/BeltIcon';
import { SkeletonCards } from '../../../components/ui/Skeleton';
import { authorName } from '../../../lib/authors';
import {
  ACCENT, TILE, Empty, ErrorLine, KpiStrip, Section,
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
    <div className="rounded-lg border border-ninja-border bg-white px-2.5 py-1.5 shadow-lg font-ninja">
      <p className="text-[11px] text-ninja-muted">Week of {shortDate(p.week)}{p.partial ? ', part of it' : ''}</p>
      <p className="text-sm font-bold text-ninja-navy tabular-nums">{plural(p.value, noun)}</p>
    </div>
  );
}

// Weeks the period only partly covers are drawn pale, so a three-day first
// week does not read as a slump.
function WeeklyBars({ title, rows, field, noun }) {
  const data = rows.map((r) => ({ week: r.week, value: r[field], partial: r.partial }));
  const total = data.reduce((s, r) => s + r.value, 0);
  return (
    <Section title={title} value={total} unit={`${noun}${total === 1 ? '' : 's'}`}>
      <div className={`${TILE} px-2 pt-3 pb-1`}>
        <ChartContainer config={{ value: { label: title, color: ACCENT } }} className="w-full" style={{ height: 200 }}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="week" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={16} tickMargin={8} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
            <ChartTooltip cursor={{ fill: 'rgb(var(--ninja-border) / 0.35)' }} content={<WeekTooltip noun={noun} />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={36} animationDuration={600}>
              {data.map((d) => <Cell key={d.week} fill="var(--color-value)" fillOpacity={d.partial ? 0.35 : 1} />)}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </Section>
  );
}

function BeltLog({ rows }) {
  return (
    <Section title="Belt-ups" value={rows.length} unit={`in this period`}>
      {rows.length === 0 ? <Empty>No belt-ups in this period.</Empty> : (
        <ul className="grid gap-1.5 sm:grid-cols-2 max-h-[28rem] overflow-y-auto">
          {rows.map((r, i) => (
            <motion.li
              key={`${r.student_id}-${r.program}-${r.belt}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3), ease: 'easeOut' }}
            >
              <Link to={`/manager/students/${r.student_id}`} className={`${TILE} flex items-center gap-3 px-3 py-2 transition-colors hover:bg-ninja-bg`}>
                <BeltIcon belt={r.belt} size={28} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-ninja text-[13px] font-semibold text-ninja-navy">{r.full_name}</span>
                  <span className="block truncate font-ninja text-xs text-ninja-muted">
                    {r.belt} belt{r.program !== 'CREATE' ? ` · ${r.program}` : ''}{r.centers ? ` · ${r.centers}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-ninja text-[13px] text-ninja-navy tabular-nums">{shortDate(r.day)}</span>
                  <span className="block max-w-[9rem] truncate font-ninja text-xs text-ninja-muted">{authorName(r.sensei_name)}</span>
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Senseis({ rows }) {
  return (
    <Section title="Sessions logged by sensei" value={rows.length} unit={`sensei${rows.length === 1 ? '' : 's'} logged sessions`}>
      {rows.length === 0 ? <Empty>No sessions logged in this period.</Empty> : (
        <div className={`${TILE} overflow-x-auto`}>
          <table className="w-full min-w-[420px] font-ninja text-[13px]">
            <thead>
              <tr className="text-left text-xs text-ninja-muted">
                <th className="px-4 py-2.5 font-semibold">Sensei</th>
                <th className="px-4 py-2.5 font-semibold text-right">Sessions</th>
                <th className="px-4 py-2.5 font-semibold text-right">Ninjas</th>
                <th className="px-4 py-2.5 font-semibold text-right">Days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sensei_id ?? 'deleted'} className="border-t border-ninja-border text-ninja-navy tabular-nums">
                  <td className="px-4 py-2.5 font-semibold">{authorName(r.display_name)}</td>
                  <td className="px-4 py-2.5 text-right">{r.sessions}</td>
                  <td className="px-4 py-2.5 text-right">{r.ninjas}</td>
                  <td className="px-4 py-2.5 text-right">{r.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export default function ReportsProgress() {
  const { query } = useReportFilters();
  const { data, error } = useReport(`/reports/progress?${query}`);

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!data) return <SkeletonCards count={6} label="Loading progress" />;

  const { period } = data;
  const weeks = data.weekly.map((w) => ({
    ...w,
    partial: w.week < period.from || addDays(w.week, 6) > period.to,
  }));
  const sessions = weeks.reduce((s, w) => s + w.sessions, 0);
  const ninjasMoved = new Set(data.beltUps.map((b) => b.student_id)).size;

  return (
    <>
      <KpiStrip
        items={[
          { label: 'Belt-ups', value: data.beltUps.length, sub: ninjasMoved !== data.beltUps.length ? `${plural(ninjasMoved, 'ninja')}` : null },
          { label: 'Sessions logged', value: sessions },
          { label: 'Senseis who logged', value: data.senseis.length },
        ]}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <WeeklyBars title="Sessions logged each week" rows={weeks} field="sessions" noun="session" />
        <WeeklyBars title="Belt-ups each week" rows={weeks} field="belt_ups" noun="belt-up" />
        <BeltLog rows={data.beltUps} />
        <Senseis rows={data.senseis} />
      </div>
    </>
  );
}
