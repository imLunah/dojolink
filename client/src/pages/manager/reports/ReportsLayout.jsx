import { Suspense, useEffect, useMemo } from 'react';
import { NavLink, useLocation, useOutlet, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronDownIcon,
  ClockIcon,
  LayersIcon,
  LayoutDashboardIcon,
  TrendingUpIcon,
  UsersIcon,
} from 'lucide-react';
import Layout from '../../../components/layout/Layout';
import { useAuth } from '../../../context/AuthContext';
import { PROGRAMS } from '../../../utils/beltConfig';
import {
  Loading, REPORT_FONT, addDays, centerToday, isoDate, localDate, prefetchReport, rangeLabel,
} from '../../../components/reports/ReportParts';

// Reports is its own section, laid out like an analytics tool: a title with
// the filters beside it, a row of tabs under it, and the tab's cards below.
// The filters live in the URL, so a refresh keeps them, the back button walks
// through them, and a link sent to someone opens the same view.

const TABS = [
  { to: '/manager/reports', end: true, label: 'Overview', Icon: LayoutDashboardIcon },
  { to: '/manager/reports/attendance', label: 'Attendance', Icon: ClockIcon },
  { to: '/manager/reports/classes', label: 'Classes', Icon: LayersIcon },
  { to: '/manager/reports/students', label: 'Students', Icon: UsersIcon },
  { to: '/manager/reports/progress', label: 'Progress', Icon: TrendingUpIcon },
];

// Rolling periods end YESTERDAY: today is half over, and a half day at the end
// of every period makes each one look like it tailed off. The calendar months
// are what they say, and "This month" does include today.
//
// Six months is whole weeks too (26), so every weekday is counted the same
// number of times. All time starts on the first day any center has data in
// DojoLink. There is no "Last year" until May 2027: before then it covers the
// same days as All time.
const DOJOLINK_START = '2026-05-09';
const WEEKS = { '4w': 4, '12w': 12, '6m': 26 };
const PERIODS = [
  { value: '4w', label: 'Last 4 weeks' },
  { value: '12w', label: 'Last 12 weeks' },
  { value: '6m', label: 'Last 6 months' },
  { value: 'month', label: 'This month' },
  { value: 'lastmonth', label: 'Last month' },
  { value: 'all', label: 'All time' },
];

function periodRange(value, today) {
  const yesterday = addDays(today, -1);
  if (value === 'all') return { from: DOJOLINK_START, to: yesterday };
  const weeks = WEEKS[value];
  if (weeks) return { from: addDays(yesterday, -(weeks * 7 - 1)), to: yesterday };
  const t = localDate(today);
  if (value === 'month') return { from: isoDate(new Date(t.getFullYear(), t.getMonth(), 1)), to: today };
  return {
    from: isoDate(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
    to: isoDate(new Date(t.getFullYear(), t.getMonth(), 0)),
  };
}

// A filter reads as a button: its name in grey, its value in ink, a chevron.
// It is a native select underneath, so the menu, the keyboard and the phone
// picker are the platform's own. The select is a ghost on the field, and a
// ghost field needs its transparency held on hover too, or the dark theme's
// blanket field rule paints a box behind it.
function Filter({ label, value, onChange, children, className = '' }) {
  return (
    <label className={`relative flex h-9 min-w-0 items-center gap-2 rounded-lg border border-ninja-border bg-white pl-3 text-[13px] ${className}`}>
      <span className="shrink-0 text-ninja-muted">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-8 font-semibold text-ninja-navy outline-none dark:hover:bg-transparent"
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 h-4 w-4 text-ninja-muted" aria-hidden="true" />
    </label>
  );
}

// Every tab's code, loaded while the first tab is on screen. These are the
// same specifiers App.jsx lazy-loads, so the tab's own import finds them done.
const loadTabs = () => Promise.all([
  import('./ReportsOverview'),
  import('./ReportsAttendance'),
  import('./ReportsClasses'),
  import('./ReportsStudents'),
  import('./ReportsProgress'),
]);

export default function ReportsLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();

  const centers = user?.availableLocations || [];
  const activeId = user?.activeLocation?.id;
  const centerParam = params.get('center');
  const center = centerParam === 'all' || centers.some((c) => String(c.id) === centerParam)
    ? centerParam
    : String(activeId ?? centers[0]?.id ?? '');
  const period = PERIODS.some((p) => p.value === params.get('period')) ? params.get('period') : '4w';
  const program = PROGRAMS.includes(params.get('program')) ? params.get('program') : '';

  const set = (key, value, fallback) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  const context = useMemo(() => {
    const { from, to } = periodRange(period, centerToday());
    const q = new URLSearchParams({ center, from, to });
    if (program) q.set('program', program);
    const centerName = center === 'all' ? 'All centers' : centers.find((c) => String(c.id) === center)?.name || '';
    return {
      center,
      centers,
      centerName,
      from,
      to,
      program,
      period,
      periodLabel: PERIODS.find((p) => p.value === period).label,
      query: q.toString(),
    };
  }, [center, period, program, centers]);

  // Warm the other tabs once this one has had its turn: their code, and the
  // report each opens with. Attendance with All centers asks one question per
  // center, so it is left to load on its own.
  useEffect(() => {
    const id = setTimeout(() => {
      loadTabs().catch(() => {});
      const q = context.query;
      const paths = [`/reports/summary?${q}`, `/reports/classes?${q}`, `/reports/students?${q}`, `/reports/progress?${q}`];
      if (context.center !== 'all') paths.push(`/reports/checkins-by-hour?${q}`);
      paths.forEach((p) => prefetchReport(p).catch(() => {}));
    }, 400);
    return () => clearTimeout(id);
  }, [context.query, context.center]);

  const outlet = useOutlet(context);
  const search = params.toString() ? `?${params.toString()}` : '';

  return (
    <Layout motionKey="reports">
      <div className="space-y-6" style={{ fontFamily: REPORT_FONT }}>
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ninja-navy">Reports</h1>
            <p className="mt-1 text-sm text-ninja-muted">
              {context.centerName} · {rangeLabel(context.from, context.to)}{program ? ` · ${program}` : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Filter label="Center" value={center} onChange={(e) => set('center', e.target.value, String(activeId))} className="col-span-2 sm:col-span-1">
              {centers.length > 1 && <option value="all">All centers</option>}
              {centers.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </Filter>
            <Filter label="Period" value={period} onChange={(e) => set('period', e.target.value, '4w')}>
              {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Filter>
            <Filter label="Program" value={program} onChange={(e) => set('program', e.target.value, '')}>
              <option value="">All</option>
              {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Filter>
          </div>
        </header>

        {/* The tabs: one track, the open tab lifted onto a white chip that
            slides between them. A tint and a lift mark it, never an edge bar. */}
        <nav aria-label="Reports" className="no-scrollbar flex overflow-x-auto rounded-xl border border-ninja-border bg-ninja-bg p-1 sm:inline-grid sm:grid-cols-5">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={{ pathname: t.to, search }}
              end={t.end}
              className={({ isActive }) => `relative flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors sm:px-4 ${isActive ? 'text-ninja-navy' : 'text-ninja-muted hover:text-ninja-navy'}`}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="reports-tab"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      className="absolute inset-0 rounded-lg border border-ninja-border bg-white shadow-sm"
                    />
                  )}
                  <t.Icon className="relative hidden h-4 w-4 sm:block" strokeWidth={1.9} aria-hidden="true" />
                  <span className="relative">{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Only the tab's own content arrives; the header, filters and tabs
            stay put, which is why Layout is handed a constant motionKey. */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          {/* A tab's chunk loads the first time it is opened. Without a
              boundary here the app-wide one would blank the whole page. */}
          <Suspense fallback={<Loading />}>
            {outlet}
          </Suspense>
        </motion.div>
      </div>
    </Layout>
  );
}
