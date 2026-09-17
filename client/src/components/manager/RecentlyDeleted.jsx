import { useState } from 'react';
import { ArchiveRestoreIcon, Trash2Icon } from 'lucide-react';
import TaskCardFace from './TaskCardFace';
import { CARD } from '../../lib/surfaces';
import { useAuth } from '../../context/AuthContext';
import { TASK_SURFACE, ownsTask } from '../../lib/taskBoard';

// What is left of the board, as a list.
//
// This used to be the board itself with the deleted cards poured back into
// their columns, which said a deleted card was still in progress. It is not in
// anything. What matters about it here is when it goes, so the list is one
// column in the order they were deleted, newest first, and every row says how
// long it has left.

const KEEP_DAYS = 14;

// Whole days since it was deleted, read off the calendar rather than the clock:
// something deleted at 11pm and looked at at 1am is one day old, not two hours.
function daysLeft(archivedAt) {
  if (!archivedAt) return KEEP_DAYS;
  const then = new Date(archivedAt);
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const gone = Math.round((b - a) / 86400000);
  return Math.max(0, KEEP_DAYS - gone);
}

function timeLeft(task) {
  const left = daysLeft(task.archived_at);
  if (left <= 0) return 'Goes today';
  if (left === 1) return '1 day left';
  return `${left} days left`;
}

export default function RecentlyDeleted({ tasks, canManage, leavingId, onRestore, onPurge, onPurgeAll }) {
  const { user } = useAuth();
  // One confirm at a time, and it is the id being confirmed rather than a
  // boolean, so opening a second one closes the first instead of arming two.
  const [confirming, setConfirming] = useState(null);

  // The bin shows the whole center's deleted cards, but restore and purge are
  // the owner's, so Delete all counts only what pressing it would take.
  const mine = canManage ? tasks.filter((t) => ownsTask(t, user)) : [];

  if (tasks.length === 0) {
    return (
      <p className="font-ninja text-sm text-ninja-muted py-8">
        Nothing here. Deleted tasks wait {KEEP_DAYS} days before they go for good.
      </p>
    );
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {mine.length > 0 && (
        <div className="flex items-center justify-end">
          {confirming === 'all' ? (
            <div className="flex items-center gap-2">
              <span className="font-ninja text-xs text-ninja-muted">
                Delete {mine.length === tasks.length ? `all ${mine.length}` : `your ${mine.length}`} for good?
              </span>
              <button
                type="button"
                onClick={() => { setConfirming(null); onPurgeAll(); }}
                className="px-2.5 py-1.5 rounded-lg bg-ninja-red text-white font-ninja text-xs font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-95"
              >
                Delete all
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="px-2.5 py-1.5 rounded-lg bg-ninja-bg text-ninja-navy font-ninja text-xs font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-95"
              >
                Keep them
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming('all')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-ninja text-xs font-bold text-ninja-red hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2Icon size={14} strokeWidth={2.25} />
              Delete all
            </button>
          )}
        </div>
      )}

      {tasks.map((task) => (
        <div
          key={task.id}
          className={`${CARD} ${TASK_SURFACE} p-3.5 ${leavingId === task.id ? 'task-leaving' : ''}`}
        >
          {/* No onOpen: a card in here is not for editing, and a dialog that
              saved changes to something on its way out would be writing to a
              row the sweep is about to take. */}
          <TaskCardFace task={task} />

          <div className="mt-3 pt-3 border-t border-ninja-border flex items-center justify-between gap-3">
            <span className="font-ninja text-xs text-ninja-muted">{timeLeft(task)}</span>
            {canManage && ownsTask(task, user) && (
              <span className="flex items-center gap-1 flex-shrink-0">
                {confirming === task.id ? (
                  <>
                    <span className="font-ninja text-xs text-ninja-muted">For good?</span>
                    <button
                      type="button"
                      onClick={() => { setConfirming(null); onPurge(task); }}
                      className="px-2.5 py-1.5 rounded-lg bg-ninja-red text-white font-ninja text-xs font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-95"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="px-2.5 py-1.5 rounded-lg bg-ninja-bg text-ninja-navy font-ninja text-xs font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-95"
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onRestore(task)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-ninja text-xs font-bold text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg transition-colors"
                    >
                      <ArchiveRestoreIcon size={14} strokeWidth={2.25} />
                      Put back
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(task.id)}
                      aria-label="Delete this task for good"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-ninja-muted opacity-60 hover:opacity-100 hover:text-ninja-red hover:bg-ninja-red/10 transition-colors"
                    >
                      <Trash2Icon size={15} strokeWidth={2.25} />
                    </button>
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
