import { CARD, FLAT } from '../../lib/surfaces';
import { useTheme } from '../../context/ThemeContext';

// Loading placeholders shaped like the content that is coming, instead of the
// word "Loading". The page keeps its height and structure, so nothing jumps
// when the data lands.
//
// aria-hidden on the shapes and aria-busy on the wrapper: a screen reader
// should hear "loading", not a description of grey rectangles.

export function Skeleton({ className = '', style }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-ninja-bg ${className}`} style={style} />;
}

function Wrap({ label, children }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {children}
    </div>
  );
}

// Rows of text with a leading avatar block. Rosters, staff lists, user tables.
export function SkeletonList({ rows = 6, label = 'Loading' }) {
  return (
    <Wrap label={label}>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={`${CARD} p-4 flex items-center gap-3`}>
            <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-3.5" style={{ width: `${45 + ((i * 13) % 30)}%` }} />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

// A grid of cards. Clubs, reports tiles, anything laid out in a grid.
export function SkeletonCards({ count = 6, cols = 'sm:grid-cols-2 lg:grid-cols-3', height = 140, label = 'Loading' }) {
  return (
    <Wrap label={label}>
      <div className={`grid grid-cols-1 ${cols} gap-4`}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={`${CARD} p-5 space-y-3`} style={{ minHeight: height }}>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

// Header block plus body, for detail pages.
export function SkeletonProfile({ label = 'Loading' }) {
  return (
    <Wrap label={label}>
      <div className="space-y-6">
        <div className={`${CARD} p-6 flex items-center gap-4`}>
          <Skeleton className="w-16 h-16 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${CARD} p-5 lg:col-span-2 space-y-3`}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <div className={`${CARD} p-5 space-y-3`}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>
    </Wrap>
  );
}

// Bars that sit directly on the page background, where bg-ninja-bg would
// vanish into itself.
function PageBar({ className = '', style }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-ninja-border/60 ${className}`} style={style} />;
}

// Label bars sized like the labels they stand in for (Dashboard, Today's
// Board, Ninjas, Clubs, Staff) — identical bars read as a pattern, not a nav.
const STAFF_LABEL_W = [72, 92, 50, 44, 40];
const PARENT_LABEL_W = [42, 58, 48];
const QUICK_LINK_W = [40, 46, 52, 72, 66];

// The staff sidebar, piece for piece: wordmark, the center switcher box, five
// rows with the 9×9 icon blocks the real nav uses, the Appearance row, and
// the user card with its two small action glyphs.
function StaffRailSkeleton({ collapsed, width }) {
  return (
    <aside className="hidden lg:flex flex-col shrink-0 sticky top-0 h-screen bg-white border-r border-ninja-border" style={{ width }}>
      <div className={`py-5 border-b border-ninja-border ${collapsed ? 'px-2 flex justify-center' : 'px-5'}`}>
        <Skeleton className={collapsed ? 'w-9 h-9 rounded-xl' : 'h-7 w-32 rounded-lg'} />
      </div>
      {!collapsed && (
        <div className="px-3 pt-3">
          <Skeleton className="h-[38px] w-full rounded-lg" />
        </div>
      )}
      <nav aria-hidden className="flex-1 p-3 space-y-0.5 mt-2">
        {STAFF_LABEL_W.map((w, i) => (
          <div key={i} className={`flex items-center gap-3 py-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
            {!collapsed && <Skeleton className="h-3.5" style={{ width: w }} />}
          </div>
        ))}
      </nav>
      <div className={`py-2 flex items-center border-t border-ninja-border ${collapsed ? 'px-0 justify-center' : 'px-4 justify-between'}`}>
        {!collapsed && <Skeleton className="h-3 w-20" />}
        <Skeleton className="h-6 w-11 rounded-full" />
      </div>
      <div className="p-3 border-t border-ninja-border">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="w-4 h-4 rounded" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="w-4 h-4 rounded flex-shrink-0" />
            <Skeleton className="w-4 h-4 rounded flex-shrink-0" />
          </div>
        )}
      </div>
    </aside>
  );
}

// The parent portal's rail: lockup and tagline, three rows with the smaller
// 5×5 glyphs it uses, and the account row (no theme toggle down here).
function ParentRailSkeleton({ collapsed, width }) {
  return (
    <aside className="hidden lg:flex flex-col shrink-0 sticky top-0 h-screen bg-white border-r border-ninja-border" style={{ width }}>
      <div className={`py-5 border-b border-ninja-border ${collapsed ? 'px-2 flex justify-center' : 'px-5'}`}>
        {collapsed ? (
          <Skeleton className="w-9 h-9 rounded-xl" />
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-8 w-36 rounded-lg" />
            <Skeleton className="h-3 w-20" />
          </div>
        )}
      </div>
      <nav aria-hidden className="p-3 mt-1 space-y-0.5">
        {PARENT_LABEL_W.map((w, i) => (
          <div key={i} className={`flex items-center gap-3 py-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            <Skeleton className="w-5 h-5 rounded flex-shrink-0" />
            {!collapsed && <Skeleton className="h-3.5" style={{ width: w }} />}
          </div>
        ))}
      </nav>
      <div className="mt-auto p-3 border-t border-ninja-border">
        <div className={`flex items-center gap-2.5 py-2 ${collapsed ? 'justify-center px-0' : 'px-2'}`}>
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          {!collapsed && (
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// The horizontal-nav bar for staff who chose it in display settings: lockup,
// the link row, and the center select + account on the right.
function TopNavSkeleton() {
  return (
    <header className="hidden lg:flex sticky top-0 z-40 h-16 items-center gap-6 bg-white border-b border-ninja-border px-6 flex-shrink-0">
      <Skeleton className="h-8 w-36 rounded-lg flex-shrink-0" />
      <div className="flex items-center gap-4">
        {STAFF_LABEL_W.map((w, i) => (
          <Skeleton key={i} className="h-3.5 rounded" style={{ width: w }} />
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3 flex-shrink-0">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
    </header>
  );
}

// The staff dashboard, the page the guard almost always resolves into: the
// masthead (date line, the big greeting, the quick-link chips, the hairline),
// then the calendar beside the check-ins card.
function StaffPageSkeleton() {
  return (
    <div className="space-y-8">
      <header>
        <PageBar className="h-3.5 w-40" />
        <PageBar className="mt-2 h-9 sm:h-10 w-72 max-w-full" />
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          {QUICK_LINK_W.map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <PageBar className="w-4 h-4 rounded" />
              <PageBar className="h-3.5" style={{ width: w }} />
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-ninja-border" />
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className={`${CARD} p-5 lg:col-span-2`}>
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <Skeleton className="w-full rounded-lg h-64 sm:h-72" />
        </div>
        <div className={`${CARD} p-5`}>
          <Skeleton className="h-5 w-24 mb-3" />
          <div className="flex items-baseline justify-between mb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="w-full rounded-lg h-36" />
          <div className="mt-4 pt-4 border-t border-ninja-border space-y-3">
            {[28, 24, 32].map((w, i) => (
              <div key={i} className="flex items-baseline justify-between">
                <Skeleton className="h-4" style={{ width: `${w}%` }} />
                <Skeleton className="h-5 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// The parent home: the navy events banner flush with the top (it holds its
// place with the house gradient, exactly as the real one does when there are
// no listings), then the schedule strip and the family cards.
function ParentPageSkeleton() {
  return (
    <>
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #12264d 0%, #0b3d8f 100%)' }}
      >
        <div className="h-56 sm:h-64 lg:h-72 max-w-6xl mx-auto flex items-center px-4 sm:px-6">
          <div className="min-w-0 space-y-3">
            <div className="animate-pulse rounded-md bg-white/20 h-3 w-28" aria-hidden />
            <div className="animate-pulse rounded-md bg-white/25 h-8 sm:h-10 w-64 max-w-full" aria-hidden />
            <div className="animate-pulse rounded-md bg-white/15 h-3.5 w-80 max-w-full" aria-hidden />
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 lg:mt-5 space-y-4 lg:space-y-5">
        <div className={`${FLAT} p-4 flex items-center gap-3`}>
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-24 ml-auto" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className={`${FLAT} p-4 sm:p-5 space-y-4`} style={{ minHeight: 320 }}>
              <Skeleton className="w-full h-40 rounded-[16px]" />
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// The whole first paint, shown by the route guards while auth resolves.
// Shaped like the shell that is about to mount — the nav where the nav will
// be, cards where the page will be — and reading the same stored preferences
// the real shell reads (nav orientation, collapsed rail), so the app appears
// to assemble in place instead of replacing a "Loading" sign.
export function SkeletonShell({ portal = false }) {
  const { horizontalNav } = useTheme();
  const collapsed = localStorage.getItem(portal ? 'parent-nav-collapsed' : 'sidebar-collapsed') === '1';
  const railWidth = collapsed ? 76 : portal ? 240 : 224; // matches ParentSideNav / Sidebar
  const topNav = !portal && horizontalNav;

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={`min-h-[100dvh] bg-ninja-bg ${topNav ? '' : 'lg:flex'}`}
    >
      {portal ? (
        <ParentRailSkeleton collapsed={collapsed} width={railWidth} />
      ) : topNav ? (
        <TopNavSkeleton />
      ) : (
        <StaffRailSkeleton collapsed={collapsed} width={railWidth} />
      )}

      {portal && (
        <header className="lg:hidden bg-white border-b border-ninja-border">
          <div className="h-16 px-4 sm:px-6 flex items-center">
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
        </header>
      )}

      {portal ? (
        <main className="flex-1 min-w-0 pb-32 lg:pb-12">
          <ParentPageSkeleton />
        </main>
      ) : (
        <main className="flex-1 min-w-0 max-w-7xl lg:max-w-none mx-auto w-full px-4 sm:px-6 lg:px-8 pt-[max(env(safe-area-inset-top),1.25rem)] lg:pt-8 pb-28 lg:pb-8">
          <StaffPageSkeleton />
        </main>
      )}
    </div>
  );
}

export default Skeleton;
