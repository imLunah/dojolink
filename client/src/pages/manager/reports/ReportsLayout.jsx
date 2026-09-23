import { Suspense, useMemo } from 'react';
import { NavLink, useLocation, useOutlet, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboardIcon,
  ClockIcon,
  UsersIcon,
  TrendingUpIcon,
} from 'lucide-react';
import Layout from '../../../components/layout/Layout';
import { useAuth } from '../../../context/AuthContext';
import { PROGRAMS } from '../../../utils/beltConfig';
import { CARD } from '../../../lib/surfaces';
import { SkeletonCards } from '../../../components/ui/Skeleton';
import { addDays, centerToday, localDate, isoDate, rangeLabel } from '../../../components/reports/ReportParts';

// Reports is its own section: a rail of tabs, and one filter bar that every
// tab reads. The filters live in the URL, so a refresh keeps them, the back
// button walks through them, and a link sent to someone opens the same view.

const TABS = [
  { to: '/manager/reports', end: true, label: 'Overview', Icon: LayoutDashboardIcon },
  { to: '/manager/reports/attendance', label: 'Attendance', Icon: ClockIcon },
  { to: '/manager/reports/students', label: 'Students', Icon: UsersIcon },
  { to: '/manager/reports/progress', label: 'Progress', Icon: TrendingUpIcon },
];

// Rolling periods end YESTERDAY: today is half over, and a half day at the end
// of every period makes each one look like it tailed off. The calendar months
// are what they say, and "This month" does include today.
const PERIODS = [
  { value: '4w', label: 'Last 4 weeks' },
  { value: '8w', label: 'Last 8 weeks' },
  { value: '12w', label: 'Last 12 weeks' },
  { value: 'month', label: 'This month' },
  { value: 'lastmonth', label: 'Last month' },
];

function periodRange(value, today) {
  const yesterday = addDays(today, -1);
  const weeks = { '4w': 4, '8w': 8, '12w': 12 }[value];
  if (weeks) return { from: addDays(yesterday, -(weeks * 7 - 1)), to: yesterday };
  const t = localDate(today);
  if (value === 'month') return { from: isoDate(new Date(t.getFullYear(), t.getMonth(), 1)), to: today };
  return {
    from: isoDate(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
    to: isoDate(new Date(t.getFullYear(), t.getMonth(), 0)),
  };
}

const SELECT = 'h-9 w-full rounded-lg border border-ninja-border bg-white pl-3 pr-8 font-ninja text-[13px] font-semibold text-ninja-navy';

function Filter({ label, children, className = '' }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="font-ninja text-xs text-ninja-muted">{label}</span>
      {children}
    </label>
  );
}

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

  const outlet = useOutlet(context);
  const search = params.toString() ? `?${params.toString()}` : '';
  const tabLink = (t) => ({ pathname: t.to, search });
  const tabClass = (isActive) => (isActive
    ? 'bg-ninja-blue/10 text-ninja-blue'
    : 'text-ninja-muted hover:bg-ninja-bg hover:text-ninja-navy');

  return (
    <Layout motionKey="reports">
      <div className="lg:flex lg:gap-6">
        {/* The rail. Its own card, sticky beside the page; the tab it is on is
            a tint and a colour, never a bar down the edge. */}
        <aside className="hidden lg:block w-[92px] shrink-0">
          <nav aria-label="Reports" className={`${CARD} sticky top-8 flex flex-col gap-1 p-2`}>
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={tabLink(t)}
                end={t.end}
                className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl px-1 py-3 font-ninja text-[11px] font-semibold transition-colors ${tabClass(isActive)}`}
              >
                <t.Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                {t.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-5">
          <header>
            <h1 className="text-3xl sm:text-4xl font-black font-ninja text-ninja-navy tracking-tight">Reports</h1>
            <p className="text-ninja-muted font-ninja text-sm mt-1">
              {context.centerName} · {rangeLabel(context.from, context.to)}{program ? ` · ${program}` : ''}
            </p>
          </header>

          {/* Below the desktop the rail becomes four even tabs under the title. */}
          <nav aria-label="Reports" className="lg:hidden">
            <div className="grid grid-cols-4 gap-1">
              {TABS.map((t) => (
                <NavLink
                  key={t.to}
                  to={tabLink(t)}
                  end={t.end}
                  className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl py-2 font-ninja text-xs font-semibold transition-colors ${tabClass(isActive)}`}
                >
                  <t.Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                  {t.label}
                </NavLink>
              ))}
            </div>
          </nav>

          <div className={`${CARD} grid grid-cols-2 gap-3 p-4 sm:grid-cols-3`}>
            <Filter label="Center" className="col-span-2 sm:col-span-1">
              <select className={SELECT} value={center} onChange={(e) => set('center', e.target.value, String(activeId))}>
                {centers.length > 1 && <option value="all">All centers</option>}
                {centers.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            </Filter>
            <Filter label="Period">
              <select className={SELECT} value={period} onChange={(e) => set('period', e.target.value, '4w')}>
                {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Filter>
            <Filter label="Program">
              <select className={SELECT} value={program} onChange={(e) => set('program', e.target.value, '')}>
                <option value="">All programs</option>
                {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Filter>
          </div>

          {/* Only the tab's own content arrives; the rail, title and filters
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
            <Suspense fallback={<SkeletonCards count={6} label="Loading report" />}>
              {outlet}
            </Suspense>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
