import { BELTS, PROGRAM_LOGOS } from '../../../utils/beltConfig';
import BeltIcon from '../../../components/ui/BeltIcon';
import { supportLabel } from '../../../lib/support';
import {
  Card, CompositionBar, Empty, ErrorLine, Loading, Meters, Metric, NinjaCell, Table,
  daysSince, initials, plural, shortDate, useReport, useReportFilters,
} from '../../../components/reports/ReportParts';

// The Students tab: who the roster is, how often they actually come, and who
// has gone quiet. "Not seen in 30+ days" is the one list of who to call,
// counted from today whatever the period, most recently seen first. It
// replaced a separate "stopped coming" list that followed the period and
// gave a different answer for the same question.

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
  const rows = counts.map((c) => ({ ...c, pct: total ? Math.round((c.count / total) * 100) : 0 }));
  return (
    <Card title="How often they come" sub={`${plural(total, 'ninja')} who came in this period`}>
      {total === 0 ? <Empty>No check-ins in this period.</Empty> : <Meters rows={rows} max={Math.max(...rows.map((r) => r.count))} />}
    </Card>
  );
}

function Enrollment({ data }) {
  const total = data.reduce((s, r) => s + r.count, 0);
  const rows = [...data].sort((a, b) => b.count - a.count).map((r) => ({
    name: r.program,
    count: r.count,
    pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
    color: ENROLLMENT_COLORS[r.program] || '#6b7280',
    art: PROGRAM_LOGOS[r.program]
      ? <img src={PROGRAM_LOGOS[r.program]} alt="" className="h-5 w-5 object-contain" />
      : <span className="text-[11px] font-semibold">{initials(r.program)}</span>,
  }));
  return (
    <Card title="Enrollment by program" sub={`${plural(total, 'enrollment')} across ${plural(rows.length, 'program')}`}>
      {rows.length === 0 ? <Empty>No enrollments yet.</Empty> : (
        <>
          <CompositionBar rows={rows} total={total} />
          <Meters rows={rows} max={rows[0].count} />
        </>
      )}
    </Card>
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
    art: <BeltIcon belt={r.belt_level} size={22} />,
  }));
  return (
    <Card title="CREATE belts" sub={`${plural(total, 'ninja')} on the ladder`}>
      {rows.length === 0 ? <Empty>No CREATE students yet.</Empty> : (
        <>
          <CompositionBar rows={rows} total={total} />
          <Meters rows={rows} max={Math.max(...rows.map((r) => r.count))} />
        </>
      )}
    </Card>
  );
}

export default function ReportsStudents() {
  const { query } = useReportFilters();
  const { data, error } = useReport(`/reports/students?${query}`);

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!data) return <Loading />;

  const { period } = data;
  const came = data.visitsPerNinja.length;
  const multi = data.inactive.some((r) => r.centers);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="On the roster" value={data.roster} />
        <Metric
          label="Came in this period"
          value={came}
          compare={data.roster ? `${Math.round((came / data.roster) * 100)}% of the roster` : null}
        />
        <Metric
          label="Not seen in 30+ days"
          value={data.inactive.length}
          tone={data.inactive.length > 0 ? 'text-ninja-red' : undefined}
          compare="on the roster, no visit or club"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Not seen in 30+ days" sub="On the roster, most recently seen first" className="xl:col-span-2">
          <Table
            rowKey={(r) => r.id}
            rows={data.inactive}
            maxHeight={380}
            empty="Everyone on the roster has come in the last 30 days."
            columns={[
              { key: 'name', label: 'Ninja', render: (r) => <NinjaCell id={r.id} name={r.full_name} sub={multi ? r.centers : null} /> },
              { key: 'last', label: 'Last came', align: 'right', render: (r) => (r.last_seen ? shortDate(r.last_seen) : 'Never') },
              { key: 'away', label: 'Days away', align: 'right', render: (r) => (r.last_seen ? daysSince(r.last_seen) : '') },
            ]}
          />
        </Card>
        <Frequency visits={data.visitsPerNinja} days={period.days} />
        <Card title="Needs extra support" className="xl:col-span-2">
          <Table
            rowKey={(r) => r.id}
            rows={data.support || []}
            maxHeight={380}
            minWidth={520}
            empty="No ninjas are marked as needing extra support."
            columns={[
              { key: 'name', label: 'Ninja', render: (r) => <NinjaCell id={r.id} name={r.full_name} sub={multi ? r.centers : null} /> },
              { key: 'reason', label: 'Reason', render: (r) => supportLabel(r.reason) },
              { key: 'by', label: 'Marked', className: 'text-ninja-muted', render: (r) => [r.set_by_name, shortDate(r.set_on)].filter(Boolean).join(', ') },
              { key: 'last', label: 'Last came', align: 'right', render: (r) => (r.last_seen ? shortDate(r.last_seen) : 'Never') },
            ]}
          />
        </Card>
        <Enrollment data={data.enrollment} />
        <Belts data={data.belts} />
      </div>
    </>
  );
}
