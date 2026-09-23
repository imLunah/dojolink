import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BELTS, PROGRAM_LOGOS } from '../../../utils/beltConfig';
import BeltIcon from '../../../components/ui/BeltIcon';
import { SkeletonCards } from '../../../components/ui/Skeleton';
import {
  ACCENT, TILE, BarRow, CompositionBar, Empty, ErrorLine, Initials, KpiStrip, Section,
  comparable, daysSince, initials, plural, shortDate, useReport, useReportFilters,
} from '../../../components/reports/ReportParts';

// The Students tab: who the roster is, how often they actually come, and who
// has gone quiet. The two quiet lists answer different questions and are kept
// apart on purpose: "stopped coming" is a change (here last period, not this
// one) and is the one to act on this week; "not seen in 30 days" is a state,
// and includes ninjas who were never regulars.

const BELT_COLOR = Object.fromEntries(BELTS.map((b) => [b.name, b.color]));
const BELT_ORDER = BELTS.map((b) => b.name);
const ENROLLMENT_COLORS = { CREATE: '#006ADD', 'Robotics Academy': '#7c3aed', 'AI Academy': '#0891b2', JR: '#16a34a', 'VR Coding': '#14b8a6' };

// How often a ninja who came at all came, in visits a week. Memberships are
// sold per week, so a week is the unit a director can compare against.
const FREQUENCY = [
  { name: '3 or more a week', test: (w) => w >= 2.5 },
  { name: 'About twice a week', test: (w) => w >= 1.5 },
  { name: 'About once a week', test: (w) => w >= 0.75 },
  { name: 'Less than once a week', test: () => true },
];

function Frequency({ visits, days }) {
  const weeks = days / 7;
  const counts = FREQUENCY.map((b) => ({ name: b.name, count: 0 }));
  for (const v of visits) counts[FREQUENCY.findIndex((b) => b.test(v / weeks))].count += 1;
  const total = visits.length;
  const max = Math.max(0, ...counts.map((c) => c.count));
  return (
    <Section title="How often they come" value={total} unit={`ninja${total === 1 ? '' : 's'} came in this period`}>
      {total === 0 ? <Empty>No check-ins in this period.</Empty> : (
        <ul className="flex flex-col gap-1.5">
          {counts.map((c, i) => (
            <BarRow
              key={c.name}
              index={i}
              name={c.name}
              count={c.count}
              pct={Math.round((c.count / total) * 100)}
              color={ACCENT}
              max={max}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function NinjaList({ title, rows, empty, detail, className = '' }) {
  return (
    <Section title={title} value={rows.length} unit={`ninja${rows.length === 1 ? '' : 's'}`} className={className}>
      {rows.length === 0 ? <Empty>{empty}</Empty> : (
        <ul className="grid gap-1.5 sm:grid-cols-2 max-h-96 overflow-y-auto">
          {rows.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3), ease: 'easeOut' }}
            >
              <Link
                to={`/manager/students/${s.id}`}
                className={`${TILE} flex items-center gap-3 px-3 py-2 transition-colors hover:bg-ninja-bg`}
              >
                <Initials name={s.full_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-ninja text-[13px] font-semibold text-ninja-navy">{s.full_name}</span>
                  {s.centers && <span className="block truncate font-ninja text-xs text-ninja-muted">{s.centers}</span>}
                </span>
                <span className="shrink-0 text-right font-ninja text-xs text-ninja-muted tabular-nums">{detail(s)}</span>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Enrollment({ data }) {
  const total = data.reduce((s, r) => s + r.count, 0);
  const rows = [...data].sort((a, b) => b.count - a.count).map((r) => ({
    name: r.program,
    count: r.count,
    pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
    color: ENROLLMENT_COLORS[r.program] || '#6b7280',
  }));
  const max = rows[0]?.count || 0;
  return (
    <Section
      title="Enrollment by program"
      value={total}
      unit={`enrollment${total === 1 ? '' : 's'} across ${plural(rows.length, 'program')}`}
      footer={<CompositionBar rows={rows} total={total} />}
    >
      {rows.length === 0 ? <Empty>No enrollments yet.</Empty> : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <BarRow
              key={r.name}
              index={i}
              art={
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-ninja-border bg-white">
                  {PROGRAM_LOGOS[r.name]
                    ? <img src={PROGRAM_LOGOS[r.name]} alt="" className="h-5 w-5 object-contain" />
                    : <span className="font-ninja text-[11px] font-semibold text-ninja-navy">{initials(r.name)}</span>}
                </span>
              }
              name={r.name}
              count={r.count}
              pct={r.pct}
              color={r.color}
              max={max}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function Belts({ data }) {
  // Ladder order, not ranked: the belts are a sequence and the shape of the
  // roster along it is the point.
  const sorted = [...data].sort((a, b) => BELT_ORDER.indexOf(a.belt_level) - BELT_ORDER.indexOf(b.belt_level));
  const total = sorted.reduce((s, r) => s + r.count, 0);
  const rows = sorted.map((r) => ({
    name: r.belt_level,
    count: r.count,
    pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
    color: BELT_COLOR[r.belt_level] || '#e5e7eb',
  }));
  const max = Math.max(0, ...rows.map((r) => r.count));
  return (
    <Section
      title="CREATE belts"
      value={total}
      unit={`ninja${total === 1 ? '' : 's'} on the ladder`}
      footer={<CompositionBar rows={rows} total={total} />}
    >
      {rows.length === 0 ? <Empty>No CREATE students yet.</Empty> : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <BarRow key={r.name} index={i} art={<BeltIcon belt={r.name} size={26} />} name={r.name} count={r.count} pct={r.pct} color={r.color} max={max} />
          ))}
        </ul>
      )}
    </Section>
  );
}

export default function ReportsStudents() {
  const { query } = useReportFilters();
  const { data, error } = useReport(`/reports/students?${query}`);

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!data) return <SkeletonCards count={6} label="Loading students" />;

  const { period } = data;
  const came = data.visitsPerNinja.length;
  const showLapsed = comparable(period, data.dataSince);

  return (
    <>
      <KpiStrip
        items={[
          { label: 'On the roster', value: data.roster },
          { label: 'Came in this period', value: came, sub: data.roster ? `${Math.round((came / data.roster) * 100)}% of the roster` : null },
          {
            label: 'Stopped coming',
            value: showLapsed ? data.lapsed.length : '-',
            tone: showLapsed && data.lapsed.length > 0 ? 'text-ninja-red' : undefined,
            sub: showLapsed ? `came the ${plural(period.days, 'day')} before, not since` : 'No earlier data to compare with',
          },
          { label: 'Not seen in 30 days', value: data.inactive.length, sub: 'on the roster, no visit or club' },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Frequency visits={data.visitsPerNinja} days={period.days} />
        {showLapsed ? (
          <NinjaList
            title={`Stopped coming · came ${shortDate(period.prevFrom)} to ${shortDate(period.prevTo)}, not since`}
            rows={data.lapsed}
            empty="Everyone who came the period before came again."
            detail={(s) => `${plural(s.prev_visits, 'visit')} before`}
          />
        ) : (
          <Section title="Stopped coming"><Empty>DojoLink has no check-ins from before this period to compare with.</Empty></Section>
        )}
        <Enrollment data={data.enrollment} />
        <Belts data={data.belts} />
        <NinjaList
          title="Not seen in 30 days"
          rows={data.inactive}
          empty="Everyone on the roster has come in the last 30 days."
          detail={(s) => (s.last_seen ? `${daysSince(s.last_seen)}d ago` : 'Never')}
          className="lg:col-span-2"
        />
      </div>
    </>
  );
}
