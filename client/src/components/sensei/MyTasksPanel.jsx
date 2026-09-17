import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { api } from '../../api/client';
import { CARD } from '../../lib/surfaces';
import { COLUMNS, OPEN_COLUMN_KEYS, plainPreview, todayKey } from '../../lib/taskBoard';
import { Skeleton } from '../ui/Skeleton';

export default function MyTasksPanel({ locationId }) {
  const [tasks, setTasks] = useState(null);

  useEffect(() => {
    let alive = true;
    setTasks(null);
    api.get('/director-tasks?mine=true')
      .then((rows) => { if (alive) setTasks(rows || []); })
      .catch(() => { if (alive) setTasks([]); });
    return () => { alive = false; };
  }, [locationId]);

  const open = useMemo(
    () => (tasks || []).filter((task) => OPEN_COLUMN_KEYS.includes(task.column_key)),
    [tasks]
  );
  const overdue = open.filter((task) => task.due_date && task.due_date < todayKey()).length;
  const next = [...open]
    .sort((a, b) => (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31') || a.position - b.position)
    .slice(0, 3);

  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="my-tasks-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="my-tasks-heading" className="font-ninja text-lg font-black text-ninja-navy">My tasks</h2>
          {tasks && (
            <p className={`mt-0.5 font-ninja text-xs ${overdue ? 'text-ninja-red font-bold' : 'text-ninja-muted'}`}>
              {overdue ? `${overdue} overdue` : open.length ? `${open.length} still open` : 'You are all caught up'}
            </p>
          )}
        </div>
        <Link
          to="/sensei/tasks"
          className="inline-flex items-center gap-1.5 rounded-lg font-ninja text-sm font-bold text-ninja-blue hover:text-ninja-blue-hover transition-colors"
        >
          View board
          <ArrowRightIcon size={15} strokeWidth={2.25} aria-hidden="true" />
        </Link>
      </div>

      {!tasks ? (
        <div className="mt-4 grid grid-cols-3 gap-3" aria-label="Loading assigned tasks" aria-busy="true">
          {COLUMNS.map((column) => <Skeleton key={column.key} className="h-16 rounded-xl" />)}
        </div>
      ) : tasks.length === 0 ? (
        <p className="mt-4 font-ninja text-sm text-ninja-muted">Nothing is assigned to you right now.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {COLUMNS.map((column) => (
              <div key={column.key} className="rounded-xl bg-ninja-bg px-3 py-2.5">
                <p className="font-ninja text-xl font-black text-ninja-navy tabular-nums">
                  {tasks.filter((task) => task.column_key === column.key).length}
                </p>
                <p className="font-ninja text-[11px] font-bold text-ninja-muted">{column.label}</p>
              </div>
            ))}
          </div>
          {next.length > 0 && (
            <div className="mt-4 border-t border-ninja-border/60 pt-3 space-y-1.5">
              {next.map((task) => (
                <Link
                  key={task.id}
                  to="/sensei/tasks"
                  className="flex items-center justify-between gap-3 rounded-lg px-1 py-1 font-ninja text-sm text-ninja-navy hover:text-ninja-blue transition-colors"
                >
                  <span className="truncate">{task.title?.trim() || plainPreview(task.body) || 'Untitled task'}</span>
                  {task.due_date && <span className="flex-shrink-0 text-xs text-ninja-muted">{task.due_date}</span>}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
