import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';
import Logo from '../ui/Logo';
import { RocketIcon } from '../ui/icons';
import { LogOutIcon, UserIcon, ChevronDownIcon } from 'lucide-react';
import { managerLinks, senseiLinks, isLinkActive, QuickFlyoutPanel } from './Sidebar';

// Experimental desktop layout: the sidebar's contents rearranged into a
// horizontal bar. Mobile keeps the floating capsule nav either way, so this
// only ever renders at lg and up. Links are text-only here — five icons in a
// row read as noise — and the account actions fold into an avatar menu so the
// right side stays to three things: centre, theme, you.
export default function TopNav({ onOpenBug }) {
  const { user, logout, switchLocation, viewAs } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  // Which tab's quick flyout is open, and where it drops. Fixed-position
  // because the tab strip is a scroll container and clips absolute children.
  const [flyout, setFlyout] = useState(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const openFlyout = (id, el) => {
    const r = el.getBoundingClientRect();
    setFlyoutPos({ top: r.bottom, left: r.left });
    setFlyout(id);
  };
  useEffect(() => { setFlyout(null); }, [location.pathname]);

  const isSenseiView = user?.role === 'admin' && viewAs === 'sensei';
  const navLinks = isSenseiView ? senseiLinks : ['manager', 'admin'].includes(user?.role) ? managerLinks : user?.role === 'sensei' ? senseiLinks : [];

  const initials = user?.displayName?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  const canSwitch = (['manager', 'admin'].includes(user?.role) || (user?.availableLocations?.length > 1)) && !isSenseiView;

  // Close the avatar menu on outside click, Escape, or navigation.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    try { await logout(); } catch {}
    navigate('/login');
  };

  const MENU_ITEM =
    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-ninja text-sm font-semibold text-left transition-colors';

  return (
    <header className="hidden lg:flex sticky top-0 z-40 h-16 items-center gap-6 bg-white glass-chrome glass-edge border-b border-ninja-border px-6 flex-shrink-0">
      <Link to="/" className="flex-shrink-0 outline-none" aria-label="DojoLink">
        <Logo variant="lockup" className="h-8 text-ninja-navy" />
      </Link>

      <nav className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
        {navLinks.map((link) => {
          const isActive = isLinkActive(link, location.pathname, location.search);
          const tab = (
            <Link
              key={link.quick ? undefined : link.to}
              to={link.to}
              className={`px-3.5 py-2 rounded-xl font-ninja font-bold text-sm transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-ninja-blue/10 text-ninja-blue-ink'
                  : 'text-ninja-navy hover:bg-ninja-bg'
              }`}
            >
              {link.label}
            </Link>
          );
          if (!link.quick) return tab;
          // Hovering (or focusing into) the tab drops the same flyout panel
          // the sidebar shows, under the tab. The flyout's hover box starts
          // at the tab's bottom edge so the pointer never crosses dead
          // ground on the way down.
          return (
            <span
              key={link.to}
              onMouseEnter={(e) => openFlyout(link.to, e.currentTarget)}
              onMouseLeave={() => setFlyout(null)}
              onFocus={(e) => openFlyout(link.to, e.currentTarget)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFlyout(null); }}
            >
              {tab}
              {flyout === link.to && (
                <div className="fixed z-50 pt-2" style={{ top: flyoutPos.top, left: flyoutPos.left }}>
                  <QuickFlyoutPanel link={link} pathname={location.pathname} search={location.search} />
                </div>
              )}
            </span>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
        {user && (canSwitch ? (
          <select
            aria-label="Active center"
            value={user.activeLocation?.id ?? ''}
            onChange={(e) => switchLocation(Number(e.target.value))}
            className="max-w-[11rem] bg-transparent text-ninja-navy rounded-lg px-2 py-1.5 font-ninja text-sm font-semibold cursor-pointer hover:bg-ninja-bg focus:outline-none transition-colors"
          >
            {user.availableLocations?.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        ) : (
          <span className="px-2 py-1.5 text-ninja-muted font-ninja text-sm font-semibold whitespace-nowrap">
            {user.activeLocation?.name ?? ''}
          </span>
        ))}

        <ThemeToggle />

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="flex items-center gap-1 pl-1.5 pr-1 py-1 rounded-full hover:bg-ninja-bg transition-colors"
          >
            {user?.profilePicUrl ? (
              <img src={user.profilePicUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-ninja-border" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-ninja-blue flex items-center justify-center text-white font-ninja font-bold text-xs">
                {initials}
              </div>
            )}
            <ChevronDownIcon className={`w-3.5 h-3.5 text-ninja-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                className="absolute right-0 top-full mt-2 w-52 bg-white border border-ninja-border rounded-xl shadow-lg p-1.5 origin-top-right"
              >
                <div className="px-3 pt-1.5 pb-2 border-b border-ninja-border mb-1.5">
                  <p className="font-ninja font-bold text-ninja-navy text-sm truncate">{user?.displayName}</p>
                  <p className="font-ninja text-ninja-muted text-xs capitalize">{user?.role === 'manager' ? 'Center Director' : user?.role === 'admin' ? 'Admin' : user?.role}</p>
                </div>
                <Link to="/account" role="menuitem" className={`${MENU_ITEM} text-ninja-navy hover:bg-ninja-bg`}>
                  <UserIcon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
                  Account
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onOpenBug(); }}
                  className={`${MENU_ITEM} text-ninja-navy hover:bg-ninja-bg`}
                >
                  <RocketIcon className="w-4 h-4 flex-shrink-0" />
                  Report a bug
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className={`${MENU_ITEM} text-ninja-red hover:bg-ninja-red/10`}
                >
                  <LogOutIcon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
                  Log out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
