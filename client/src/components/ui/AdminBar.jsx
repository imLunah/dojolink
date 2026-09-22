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
      {/* One compact corner pill at every width. The desktop used to get a full
          pill fixed at bottom centre, which sat over the main column and over
          the toasts that rise from the same spot. A <nav> because axe counts any
          content outside a landmark as orphaned. On a phone it clears the
          bottom nav; on a desktop the bottom right corner is empty. */}
      <nav ref={ref} aria-label="Admin view switcher" className="fixed bottom-36 right-4 lg:bottom-4 z-[90] flex flex-col items-end gap-2">
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
                  title={view === 'admin' ? undefined : 'UI preview only. Server permissions unchanged'}
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
