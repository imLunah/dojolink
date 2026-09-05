import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';
import Logo from '../ui/Logo';
import { RocketIcon } from '../ui/icons';
import { LogOutIcon } from 'lucide-react';
import { LayoutGridIcon, BookOpenIcon, MegaphoneIcon, ListTodoIcon, ChartNoAxesColumnIncreasingIcon, GiftIcon } from 'lucide-react';

const EXPANDED_W = 224; // matches w-56
const COLLAPSED_W = 76; // icon rail

function NavIcon({ id, Glyph }) {
  if (Glyph) {
    return (
      <span className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
        <Glyph className="w-5 h-5" strokeWidth={1.8} />
      </span>
    );
  }
  return (
    <img
      src={`/icons/${id}.png`}
      alt=""
      className="w-9 h-9 flex-shrink-0"
    />
  );
}

export function isLinkActive(link, pathname, search) {
  const linkPath = link.to.split('?')[0];
  const linkQuery = link.to.includes('?') ? link.to.split('?')[1] : null;

  if (linkQuery) {
    return pathname === linkPath && search.includes(linkQuery);
  }
  return pathname === link.to || (link.to.length > 1 && pathname.startsWith(link.to + '/'));
}

function BugIcon() {
  return (
    <RocketIcon className="w-4 h-4 flex-shrink-0" />
  );
}

export const managerLinks = [
  // Hovering Dashboard opens a flyout naming the director tools that live on
  // (or off) the dashboard, so none of them costs the nav a row of its own.
  // Tasks stays out of the main list for the old reason; the flyout and the
  // dashboard preview are its ways in. Both navs render `quick` their own way.
  {
    to: '/manager/overview', label: 'Dashboard', Glyph: LayoutGridIcon,
    quick: [
      { to: '/manager/events', label: 'Events', Glyph: MegaphoneIcon },
      { to: '/manager/tasks', label: 'Tasks', Glyph: ListTodoIcon },
      { to: '/manager/reports', label: 'Reports', Glyph: ChartNoAxesColumnIncreasingIcon },
      { to: '/curriculum-roadmap', label: 'Curriculum', Glyph: BookOpenIcon },
      { to: '/changelog', label: "What's New", Glyph: GiftIcon },
    ],
  },
  { to: '/manager/dashboard', label: "Today's Board", icon: 'today' },
  { to: '/manager/students', label: 'Ninjas', icon: 'roster' },
  { to: '/clubs', label: 'Clubs', icon: 'clubs' },
  { to: '/manager/staff', label: 'Staff', icon: 'senseis' },
];

// The flyout's panel, shared by the sidebar and the top bar so the two navs
// show the same thing. The caller owns positioning and hover state.
export function QuickFlyoutPanel({ link, pathname, search }) {
  return (
    <div className="w-48 bg-white border border-ninja-border rounded-xl shadow-lg p-1.5">
      <p className="px-3 pt-1.5 pb-1 font-ninja text-[10px] font-extrabold uppercase tracking-[0.08em] text-ninja-muted">{link.label}</p>
      {link.quick.map((q) => {
        const active = isLinkActive(q, pathname, search);
        return (
          <Link
            key={q.to}
            to={q.to}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-ninja text-sm font-bold transition-colors ${
              active ? 'bg-ninja-blue/10 text-ninja-blue-ink' : 'text-ninja-navy hover:bg-ninja-bg'
            }`}
          >
            {q.Glyph && <q.Glyph size={16} strokeWidth={1.9} className="flex-shrink-0" />}
            {q.label}
          </Link>
        );
      })}
    </div>
  );
}

export const senseiLinks = [
  { to: '/sensei/dashboard', label: "Today's Board", icon: 'today' },
  { to: '/manager/students', label: 'Ninjas', icon: 'roster' },
  { to: '/clubs', label: 'Clubs', icon: 'clubs' },
  { to: '/manager/staff', label: 'Staff', icon: 'senseis' },
  // Directors reach Curriculum from their dashboard. Instructors have no
  // dashboard, so without this the page had no entry point for them at all.
  { to: '/curriculum-roadmap', label: 'Curriculum', Glyph: BookOpenIcon },
];

export default function Sidebar({ onOpenBug }) {
  const { user, logout, switchLocation, viewAs } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === '1');
  // Which row's quick flyout is open, and where it anchors. Fixed-position
  // because the nav is a scroll container and clips absolute children.
  const [flyout, setFlyout] = useState(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const openFlyout = (id, el) => {
    const r = el.getBoundingClientRect();
    setFlyoutPos({ top: r.top - 6, left: r.right });
    setFlyout(id);
  };
  useEffect(() => { setFlyout(null); }, [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem('sidebar-collapsed', c ? '0' : '1');
      return !c;
    });
  };

  const isSenseiView = user?.role === 'admin' && viewAs === 'sensei';
  const navLinks = isSenseiView ? senseiLinks : ['manager', 'admin'].includes(user?.role) ? managerLinks : user?.role === 'sensei' ? senseiLinks : [];

  const initials = user?.displayName?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?';

  const handleLogout = async () => {
    try { await logout(); } catch {}
    navigate('/login');
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="hidden lg:flex flex-col bg-white glass-chrome glass-edge border-r border-ninja-border flex-shrink-0 sticky top-0 h-screen z-40"
    >
      {/* Collapse toggle — floats on the sidebar edge */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-[72px] z-50 w-6 h-6 rounded-full bg-white border border-ninja-border shadow-sm flex items-center justify-center text-ninja-muted hover:text-ninja-blue hover:border-ninja-blue/50 transition-colors"
      >
        <motion.svg
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </motion.svg>
      </button>

      {/* Logo */}
      <div className={`py-5 border-b border-ninja-border overflow-hidden ${collapsed ? 'px-2 flex justify-center' : 'px-5'}`}>
        <Link to="/" className="block outline-none" aria-label="DojoLink">
          {/* The rail already showed the mark a moment ago, and the two states
              are the same header: repeating it beside the name says the bird
              twice. Collapsed is the mark alone, expanded is the name alone.
              h-7 because the wordmark is 6.4:1 and the rail gives it 184px. */}
          {collapsed
            ? <Logo variant="mark" className="h-9 text-ninja-navy" />
            : <Logo variant="wordmark" className="h-7 text-ninja-navy" />}
        </Link>
      </div>

      {/* Center switcher (hidden on the icon rail) */}
      {user && !collapsed && (
        <div className="px-3 pt-3">
          {(['manager', 'admin'].includes(user.role) || (user.availableLocations?.length > 1)) && !isSenseiView ? (
            <select
              aria-label="Active center"
              value={user.activeLocation?.id ?? ''}
              onChange={(e) => switchLocation(Number(e.target.value))}
              className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm font-semibold focus:outline-none focus:border-ninja-blue transition-colors"
            >
              {user.availableLocations?.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-2 bg-ninja-bg border border-ninja-border rounded-lg">
              <span className="text-ninja-navy font-ninja text-sm font-semibold truncate">{user.activeLocation?.name ?? ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 mt-2 overflow-y-auto">
        {navLinks.map((link) => {
          const isActive = isLinkActive(link, location.pathname, location.search);
          const row = (
            <Link
              key={link.quick ? undefined : link.to}
              to={link.to}
              title={collapsed ? link.label : undefined}
              className={`flex items-center gap-3 py-2.5 rounded-xl font-ninja font-bold text-sm transition-colors relative overflow-hidden whitespace-nowrap ${
                collapsed ? 'px-0 justify-center' : 'px-3'
              } ${
                isActive
                  ? 'bg-ninja-blue/10 text-ninja-blue-ink'
                  : 'text-ninja-navy hover:bg-ninja-bg'
              }`}
            >
              <NavIcon id={link.icon} Glyph={link.Glyph} />
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, delay: 0.08 }}>
                  {link.label}
                </motion.span>
              )}
            </Link>
          );
          if (!link.quick) return row;
          // Hovering (or focusing into) the row opens a flyout panel beside
          // the sidebar listing the pages under it. The flyout's hover box
          // starts exactly at the row's right edge — the visual gap is the
          // panel's own padding — so the pointer never crosses dead ground
          // and the panel never flickers shut on the way over. Works on the
          // collapsed rail too, where it doubles as the row's label.
          return (
            <div
              key={link.to}
              onMouseEnter={(e) => openFlyout(link.to, e.currentTarget)}
              onMouseLeave={() => setFlyout(null)}
              onFocus={(e) => openFlyout(link.to, e.currentTarget)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFlyout(null); }}
            >
              {row}
              {flyout === link.to && (
                <div className="fixed z-50 pl-3" style={{ top: flyoutPos.top, left: flyoutPos.left }}>
                  <QuickFlyoutPanel link={link} pathname={location.pathname} search={location.search} />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className={`py-2 flex items-center border-t border-ninja-border ${collapsed ? 'px-0 justify-center' : 'px-4 justify-between'}`}>
        {!collapsed && <span className="text-ninja-muted font-ninja text-xs font-semibold">Appearance</span>}
        <ThemeToggle />
      </div>

      {/* User card */}
      <div className="p-3 border-t border-ninja-border">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <Link to="/account" title="Account" className="hover:opacity-80 transition-opacity">
              {user?.profilePicUrl ? (
                <img src={user.profilePicUrl} alt={user.displayName} className="w-8 h-8 rounded-full object-cover border border-ninja-border" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-ninja-blue flex items-center justify-center text-white font-ninja font-bold text-xs">
                  {initials}
                </div>
              )}
            </Link>
            <button
              onClick={handleLogout}
              title="Log out"
              className="text-ninja-muted hover:text-ninja-red transition-colors p-1"
            >
              <LogOutIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Link to="/account" className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity">
              {user?.profilePicUrl ? (
                <img src={user.profilePicUrl} alt={user.displayName} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-ninja-border" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-ninja-blue flex items-center justify-center text-white font-ninja font-bold text-xs flex-shrink-0">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-ninja font-bold text-ninja-navy text-sm truncate">{user?.displayName}</p>
                <p className="font-ninja text-ninja-muted text-xs capitalize">{user?.role === 'manager' ? 'Center Director' : user?.role === 'admin' ? 'Admin' : user?.role}</p>
              </div>
            </Link>
            <button
              onClick={onOpenBug}
              title="Report a bug or suggest a feature"
              className="text-ninja-muted hover:text-ninja-red transition-colors flex-shrink-0 p-1"
            >
              <BugIcon />
            </button>
            <button
              onClick={handleLogout}
              title="Log out"
              className="text-ninja-muted hover:text-ninja-red transition-colors flex-shrink-0 p-1"
            >
              <LogOutIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
