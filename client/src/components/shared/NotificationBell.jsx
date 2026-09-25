import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { toSlug } from '../../utils/clubUtils';
import useLiveRefresh from '../../lib/useLiveRefresh';
import { SkeletonList } from '../ui/Skeleton';

// The bell: every place somebody @mentioned you, whether on a task, a ninja's
// log or a club session, and every task somebody put you on, with a red count
// of what you have not opened. Admins also get every new bug report and
// feature idea.
// Pressing one marks it read and takes you to it.
//
// The list comes from /api/notifications, which reads the mention rows each
// kind of comment already keeps; there is no separate notification store to
// fall out of step with them. It refreshes on the same slow poll as the
// boards, and whenever the tab comes back into view.
//
// The panel is portalled and fixed, because the bell sits in scroll
// containers (the sidebar, the top bar) that would clip it, and it opens
// upward when there is no room below, as in the sidebar's footer.

const PANEL_W = 360;

const initialsOf = (name) =>
  String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// What happened, after the person's name.
function whatOf(n) {
  if (n.kind === 'ticket') return n.place === 'feature' ? 'suggested a feature' : 'reported a bug';
  if (n.kind === 'assign') return `assigned you to the task "${n.place}"`;
  if (n.kind === 'task') return `mentioned you on the task "${n.place}"`;
  if (n.kind === 'log') return `mentioned you on ${n.place}'s log`;
  return `mentioned you on a ${n.place} session`;
}

// The preview is what was said, without the mentions in it: the line above
// already says who was mentioned. Tags written either way ("@username", or the
// older "@Display Name") are taken out, longest first so "@Sam Lee" is not
// cut to "@Sam". A message that was only a mention has no preview at all.
function plain(body, mentions) {
  let text = body || '';
  const tags = (mentions || [])
    .flatMap((m) => [m.display_name, m.username])
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const tag of tags) text = text.split(`@${tag}`).join('');
  return text.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
}

// `children`, when given, replaces the round bell: a function handed
// { unread, open, toggle, anchorRef } that draws its own way in. The collapsed
// sidebar uses it to put the unread dot on the avatar and open the list from
// the account menu. `anchorRef` must be on the element the panel belongs to;
// `placement="side"` opens the panel beside it rather than above or below.
export default function NotificationBell({ className = '', compact = false, children, placement = 'auto' }) {
  const { user, viewAs } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const isManager = ['manager', 'admin'].includes(user?.role) && !(user?.role === 'admin' && viewAs === 'sensei');

  const load = useCallback(() => {
    let alive = true;
    api.get('/notifications')
      .then((res) => { if (alive) { setItems(res.items || []); setUnread(res.unread || 0); } })
      .catch(() => { if (alive) setItems((prev) => prev ?? []); });
    return () => { alive = false; };
  }, []);

  useEffect(load, [load, user?.activeLocation?.id]);
  useLiveRefresh(load);

  // Placed against the bell: below it if the panel fits, above it if not,
  // and kept inside the window either way.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      const margin = 8;
      if (placement === 'side') {
        // Beside the anchor, bottom edges level, rising only as far as fits.
        const maxHeight = Math.min(480, window.innerHeight - margin * 2);
        setPos({ left: Math.min(r.right + 12, window.innerWidth - PANEL_W - margin), bottom: Math.max(margin, window.innerHeight - r.bottom), maxHeight });
        return;
      }
      const left = Math.min(Math.max(r.left, margin), window.innerWidth - PANEL_W - margin);
      const below = window.innerHeight - r.bottom;
      setPos(below >= 320
        ? { left, top: r.bottom + 6, maxHeight: below - 18 }
        : { left, bottom: window.innerHeight - r.top + 6, maxHeight: r.top - 18 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, placement]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); buttonRef.current?.focus(); } };
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  const linkFor = (n) => {
    if (n.kind === 'ticket') return `/feedback?ticket=${n.id}`;
    if (n.kind === 'task' || n.kind === 'assign') return `${isManager ? '/manager/tasks' : '/sensei/tasks'}?task=${n.task_id}`;
    if (n.kind === 'log') return `/manager/students/${n.student_id}#log-${n.log_id}`;
    return `/clubs/${toSlug(n.club_name)}?session=${n.session_id}`;
  };

  // Optimistic: the row reads as read and the count drops before the request
  // lands; the next refresh settles it either way.
  const markRead = (n) => {
    if (n.read_at) return;
    setItems((prev) => prev.map((x) => (x.kind === n.kind && x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    setUnread((u) => Math.max(0, u - 1));
    api.post(`/notifications/${n.kind}/${n.id}/read`).catch(() => {});
  };

  const openOne = (n) => {
    markRead(n);
    setOpen(false);
    navigate(linkFor(n));
  };

  const readAll = () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })));
    setUnread(0);
    api.post('/notifications/read-all').catch(() => {});
  };

  const label = unread ? `Notifications, ${unread} unread` : 'Notifications';

  return (
    <>
      {children ? children({ unread, open, toggle: () => setOpen((o) => !o), anchorRef: buttonRef }) : (
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        title="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`relative flex items-center justify-center ${compact ? 'w-8 h-8' : 'w-9 h-9'} rounded-full transition-colors duration-150 hover:bg-ninja-bg ${
          open ? 'bg-ninja-bg text-ninja-navy' : 'text-ninja-muted hover:text-ninja-navy'
        } ${className}`}
      >
        <BellIcon size={19} strokeWidth={2} aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-ninja-red text-white font-ninja text-[10px] font-black leading-[18px] text-center"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      )}

      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          style={{ position: 'fixed', width: PANEL_W, left: pos.left, top: pos.top, bottom: pos.bottom, maxHeight: Math.min(pos.maxHeight, 480) }}
          className="z-[95] flex flex-col rounded-2xl border border-ninja-border bg-white shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-ninja-border">
            <h2 className="font-ninja font-bold text-sm text-ninja-navy">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="font-ninja text-xs font-bold text-ninja-blue hover:text-ninja-blue-hover">
                Mark all as read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-1.5">
            {items === null ? (
              <div className="p-2"><SkeletonList rows={3} /></div>
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center font-ninja text-sm text-ninja-muted">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={`${n.kind}-${n.id}`}
                  type="button"
                  onClick={() => openOne(n)}
                  className={`w-full flex gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                    n.read_at ? 'hover:bg-ninja-bg' : 'bg-ninja-blue/[0.06] hover:bg-ninja-blue/10'
                  }`}
                >
                  {n.author_pic ? (
                    <img src={n.author_pic} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-ninja-border" />
                  ) : (
                    <span aria-hidden="true" className="w-9 h-9 rounded-full bg-ninja-blue flex items-center justify-center text-white font-ninja font-bold text-xs flex-shrink-0">
                      {initialsOf(n.author_name)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-ninja text-sm text-ninja-navy leading-snug">
                      <span className="font-bold">{n.author_name || 'Someone'}</span> {whatOf(n)}
                    </span>
                    {plain(n.body, n.mentions) && (
                      <span className="block font-ninja text-xs text-ninja-muted mt-0.5 line-clamp-2 break-words">{plain(n.body, n.mentions)}</span>
                    )}
                    <span className="block font-ninja text-[11px] text-ninja-muted mt-1">{ago(n.created_at)}</span>
                  </span>
                  {!n.read_at && (
                    <span aria-label="Unread" className="mt-1.5 w-2 h-2 rounded-full bg-ninja-blue flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
