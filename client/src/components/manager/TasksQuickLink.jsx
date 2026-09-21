import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ListTodoIcon } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { COLUMNS, OPEN_COLUMN_KEYS, groupByColumn, todayKey } from '../../lib/taskBoard';
import useLiveRefresh from '../../lib/useLiveRefresh';

// Tasks as one of the quick links: a link, and nothing more.
//
// It used to preview the board on hover. The board is one click away and the
// preview was a second, smaller copy of it that only some people could reach —
// hover doesn't exist on a phone, and a panel that opens over the page while
// you are reading past it costs more attention than the three cards inside it
// were worth.
//
// What the preview was actually for still rides on the link itself: the counts
// are in its accessible name, and overdue work carries a dot, because the one
// thing a director must not have to go hunting for is what is already late.
// `to`/`label` because the same chip serves both boards: a director's goes to
// the task board, a sensei's to their own list. The counts behind the dot come
// from the shared feed either way.
export default function TasksQuickLink({ className = '', to = '/manager/tasks', label = 'Tasks' }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState(null);
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    let alive = true;
    Promise.all([
      api.get('/director-tasks').catch(() => []),
      api.get('/director-tasks/mentions').catch(() => []),
    ]).then(([rows, mentions]) => {
      if (!alive) return;
      setTasks(rows || []);
      setUnread((mentions || []).length);
    });
    return () => { alive = false; };
  }, []);

  useEffect(load, [load, user?.activeLocation?.id]);
  useLiveRefresh(load);

  const grouped = tasks ? groupByColumn(tasks) : null;
  // Derived from the columns, not listed by name. An allowlist is how a whole
  // column came to be missing from this count the last time one was added, and
  // work that is invisible here is work nobody is reminded of.
  const openTasks = grouped ? OPEN_COLUMN_KEYS.flatMap((k) => grouped[k] || []) : [];
  const overdue = openTasks.filter((t) => t.due_date && t.due_date < todayKey()).length;

  const ariaLabel = !tasks
    ? label
    : `${label}: ${COLUMNS.filter((c) => c.key !== 'done')
        .map((c) => `${(grouped[c.key] || []).length} ${c.label.toLowerCase()}`)
        .join(', ')}`
      + (overdue ? `, ${overdue} overdue` : '')
      + (unread ? `, ${unread} unread ${unread === 1 ? 'mention' : 'mentions'}` : '');

  return (
    <Link to={to} aria-label={ariaLabel} className={className}>
      <span className="relative flex-shrink-0">
        <ListTodoIcon className="w-4 h-4 text-ninja-muted group-hover:text-ninja-blue transition-colors" />
        {overdue > 0 && (
          // Inline hex on a ring of the page colour, so the dot reads as a dot
          // in both themes rather than as a smudge on the icon.
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-2 ring-ninja-bg"
            style={{ backgroundColor: '#ef4444' }}
          />
        )}
      </span>
      {label}
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-ninja text-[11px] font-black leading-none tabular-nums text-white"
          style={{ backgroundColor: '#ef4444' }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
