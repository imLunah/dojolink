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

// Nav rows: an icon square and a label bar. Label widths vary the way real
// labels do — six identical bars read as a pattern, not a nav.
function NavRows({ collapsed, rows = 6 }) {
  return (
    <div className="p-3 mt-1 space-y-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`flex items-center gap-3 py-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
          <Skeleton className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <Skeleton className="h-3.5" style={{ width: `${44 + ((i * 17) % 32)}%` }} />}
        </div>
      ))}
    </div>
  );
}

// The white side rail, drawn at the width the real one will take: expanded or
// the icon rail, read from the same localStorage key the real sidebar reads.
function SideRailSkeleton({ collapsed, width }) {
  return (
    <aside className="hidden lg:flex flex-col shrink-0 sticky top-0 h-screen bg-white border-r border-ninja-border" style={{ width }}>
      <div className={`py-5 border-b border-ninja-border ${collapsed ? 'px-2 flex justify-center' : 'px-5'}`}>
        <Skeleton className={collapsed ? 'w-9 h-9 rounded-xl' : 'h-8 w-36 rounded-lg'} />
      </div>
      <NavRows collapsed={collapsed} />
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

// The horizontal-nav bar for staff who chose it in display settings.
function TopNavSkeleton() {
  return (
    <header className="hidden lg:flex sticky top-0 z-40 h-16 items-center gap-6 bg-white border-b border-ninja-border px-6 flex-shrink-0">
      <Skeleton className="h-8 w-36 rounded-lg flex-shrink-0" />
      <div className="flex items-center gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-3.5 rounded" style={{ width: 48 + ((i * 19) % 34) }} />
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3 flex-shrink-0">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
    </header>
  );
}

// A generic page: a title where the title will be, cards where the cards will
// be. No page is exactly this, but every page is roughly this, and roughly
// right holds the eye better than a word in the void.
function PageSkeleton({ card }) {
  return (
    <>
      <div className="space-y-2.5 mb-6">
        <PageBar className="h-7 w-48" />
        <PageBar className="h-3.5 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${card} p-5 space-y-3`}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${card} p-5 lg:col-span-2 space-y-3`}>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
          <Skeleton className="h-3 w-3/6" />
        </div>
        <div className={`${card} p-5 space-y-3`}>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
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
      {topNav ? <TopNavSkeleton /> : <SideRailSkeleton collapsed={collapsed} width={railWidth} />}

      {portal && (
        <header className="lg:hidden bg-white border-b border-ninja-border">
          <div className="h-16 px-4 sm:px-6 flex items-center">
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
        </header>
      )}

      {portal ? (
        <main className="flex-1 min-w-0 pt-5 lg:pt-7 pb-32 lg:pb-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <PageSkeleton card={FLAT} />
          </div>
        </main>
      ) : (
        <main className="flex-1 min-w-0 max-w-7xl lg:max-w-none mx-auto w-full px-4 sm:px-6 lg:px-8 pt-[max(env(safe-area-inset-top),1.25rem)] lg:pt-8 pb-28 lg:pb-8">
          <PageSkeleton card={CARD} />
        </main>
      )}
    </div>
  );
}

export default Skeleton;
