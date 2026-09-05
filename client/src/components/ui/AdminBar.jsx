import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const pillStyle = {
  background: 'rgba(15, 18, 30, 0.92)',
  border: '1px solid rgba(56,161,255,0.25)',
  backdropFilter: 'blur(12px)',
};

export default function AdminBar() {
  const { user, viewAs, setViewAs } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const isManager = viewAs === 'manager' || (!viewAs && pathname.startsWith('/manager'));
  const isSensei  = viewAs === 'sensei'  || (!viewAs && pathname.startsWith('/sensei'));
  const isAdmin   = viewAs === 'admin'   || (!viewAs && pathname.startsWith('/admin'));

  const activeLabel = isManager ? 'Manager' : isSensei ? 'Sensei' : isAdmin ? 'Admin' : null;

  const options = [
    { label: 'Manager', path: '/manager/overview', view: 'manager', active: isManager },
    { label: 'Sensei',  path: '/sensei/dashboard',  view: 'sensei',  active: isSensei },
    { label: 'Admin',   path: '/admin/locations',    view: 'admin',   active: isAdmin },
  ];

  function go(path, view) {
    setViewAs(view);
    navigate(path);
    setOpen(false);
  }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  if (user?.role !== 'admin') return null;

  return (
    <>
      {/* Desktop — full pill at bottom center. A <nav> because axe counts any
          content outside a landmark as orphaned, and this pill floats above
          everything with nothing else claiming it. */}
      <nav
        aria-label="Admin view switcher"
        className="hidden lg:flex fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] items-center gap-1 px-2 py-1.5 rounded-2xl shadow-xl font-ninja text-xs font-bold"
        style={pillStyle}
      >
        <span style={{ color: 'rgba(56,161,255,0.9)' }} className="px-2 tracking-widest uppercase text-[10px]">
          Admin
        </span>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
        <button
          onClick={() => go('/manager/overview', 'manager')}
          title="UI preview only. Server permissions unchanged"
          className="px-3 py-1 rounded-xl transition-colors"
          style={{ background: isManager ? 'rgb(56,161,255)' : 'transparent', color: isManager ? '#fff' : 'rgba(255,255,255,0.5)' }}
        >
          Manager
        </button>
        <button
          onClick={() => go('/sensei/dashboard', 'sensei')}
          title="UI preview only. Server permissions unchanged"
          className="px-3 py-1 rounded-xl transition-colors"
          style={{ background: isSensei ? 'rgb(56,161,255)' : 'transparent', color: isSensei ? '#fff' : 'rgba(255,255,255,0.5)' }}
        >
          Sensei
        </button>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
        <button
          onClick={() => go('/admin/locations', 'admin')}
          className="px-3 py-1 rounded-xl transition-colors"
          style={{ background: isAdmin ? 'rgb(56,161,255)' : 'transparent', color: isAdmin ? '#fff' : 'rgba(255,255,255,0.5)' }}
        >
          Admin
        </button>
      </nav>

      {/* Mobile — compact pill above Report Bug button */}
      <nav ref={ref} aria-label="Admin view switcher" className="lg:hidden fixed bottom-36 right-4 z-[90] flex flex-col items-end gap-2">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-1 p-1.5 rounded-2xl shadow-xl font-ninja text-xs font-bold"
              style={pillStyle}
            >
              {options.map(({ label, path, view, active }) => (
                <button
                  key={label}
                  onClick={() => go(path, view)}
                  className="px-4 py-1.5 rounded-xl text-left transition-colors"
                  style={{
                    background: active ? 'rgb(56,161,255)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                    minWidth: 90,
                  }}
                >
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-ninja text-[10px] font-bold tracking-widest uppercase transition-all shadow-lg"
          style={{
            background: open ? 'rgb(56,161,255)' : 'rgba(15,18,30,0.92)',
            color: open ? '#fff' : 'rgba(56,161,255,0.8)',
            border: '1px solid rgba(56,161,255,0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span>A</span>
          {activeLabel && !open && (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              {activeLabel}
            </span>
          )}
        </button>
      </nav>
    </>
  );
}
