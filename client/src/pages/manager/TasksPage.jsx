import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, LayoutGridIcon, ListIcon, PlusIcon } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import TaskBoard from '../../components/manager/TaskBoard';
import TaskList from '../../components/manager/TaskList';
import TaskEditorModal from '../../components/manager/TaskEditorModal';
import TaskComposer from '../../components/manager/TaskComposer';
import RecentlyDeleted from '../../components/manager/RecentlyDeleted';
import Segmented from '../../components/ui/Segmented';
import { Skeleton, SkeletonList } from '../../components/ui/Skeleton';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { COLUMNS, cardFields, reorderPayload } from '../../lib/taskBoard';

const EASE = [0.23, 1, 0.32, 1];

const VIEWS = [
  { value: 'board', label: 'Board', icon: <LayoutGridIcon size={14} strokeWidth={2.25} /> },
  { value: 'list', label: 'List', icon: <ListIcon size={14} strokeWidth={2.25} /> },
];

export default function TasksPage() {
  const { user, isReadOnly } = useAuth();
  const canManage = !isReadOnly;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null); // { task } | { column } | null
  // Opening another card is a dismissal of the one already open, so it goes
  // through the same guard: with unsaved work in the panel, the press is
  // refused and the panel says so rather than swapping the card underneath it.
  const [editorDirty, setEditorDirty] = useState(false);
  const [refuseSignal, setRefuseSignal] = useState(0);
  const openEditor = useCallback((next) => {
    if (editor && editorDirty) { setRefuseSignal((n) => n + 1); return; }
    setEditor(next);
  }, [editor, editorDirty]);

  // Writing a task, before it is a card. `origin` is the rect of whatever was
  // pressed, so the composer can grow out of it rather than appearing.
  const [composer, setComposer] = useState(null); // { column, origin } | null
  const openComposer = useCallback((column, origin) => {
    if (editor && editorDirty) { setRefuseSignal((n) => n + 1); return; }
    setEditor(null);
    setComposer({ column, origin });
  }, [editor, editorDirty]);
  const [showArchived, setShowArchived] = useState(false);
  const [directors, setDirectors] = useState([]);
  // The card on its way out. A delete asked for from the dialog or the list's
  // menu has nothing moving on screen to connect the press to the row closing
  // up, so the card is left where it is for a beat and shrinks out of it. The
  // gestures skip this: they have already carried the card off themselves.
  const [leavingId, setLeavingId] = useState(null);
  const leaveTimer = useRef(null);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);
  const LEAVE_MS = 200;
  const dropAfterExit = useCallback((id) => {
    setLeavingId(id);
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => {
      setLeavingId(null);
      setTasks((ts) => ts.filter((t) => t.id !== id));
    }, LEAVE_MS);
  }, []);

  // Which view, remembered per device. A director who works from the list works
  // from the list; asking them again every morning is the app forgetting.
  // Filters are deliberately NOT remembered — a filter is a momentary question,
  // and a board that silently reopens narrowed reads as work having vanished.
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('dj-tasks-view') === 'list' ? 'list' : 'board'; }
    catch { return 'board'; }
  });
  const chooseView = (next) => {
    setView(next);
    try { localStorage.setItem('dj-tasks-view', next); } catch { /* private mode */ }
  };

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    api.get(`/director-tasks${showArchived ? '?archived=true' : ''}`)
      .then((rows) => { if (alive) { setTasks(rows); setError(''); } })
      .catch((err) => { if (alive) setError(err.message || 'Could not load tasks.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [showArchived]);

  useEffect(load, [load, user?.activeLocation?.id]);

  // Who the assignee filter can offer, fetched once here rather than by every
  // component that needs the list.
  useEffect(() => {
    let alive = true;
    api.get('/director-tasks/assignees')
      .catch(() => [])
      .then((rows) => { if (alive) setDirectors(rows || []); });
    return () => { alive = false; };
  }, [user?.activeLocation?.id]);


  // Reordering is optimistic: the card is already under the pointer where the
  // director dropped it, and snapping it back while a round trip finishes would
  // read as the drag having failed. A rejected write puts the old board back
  // and says so, rather than leaving the screen disagreeing with the database.
  const reorder = useCallback(async (next) => {
    const previous = tasks;
    setTasks(next);
    setError('');
    try {
      await api.patch('/director-tasks/reorder', { items: reorderPayload(next) });
    } catch (err) {
      setTasks(previous);
      setError(err.message || 'Could not save the new order.');
    }
  }, [tasks]);

  const save = useCallback(async (fields) => {
    const editing = editor?.task;
    if (editing) {
      const saved = await api.patch(`/director-tasks/${editing.id}`, fields);
      setTasks((ts) => ts.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)));
    } else {
      const created = await api.post('/director-tasks', fields);
      setTasks((ts) => [...ts, created]);
    }
    setError('');
  }, [editor]);

  // Quick adds are chained rather than fired in parallel: position comes from
  // the server's MAX + 1, so three fast returns resolving out of order would
  // give the column an order nobody typed.
  const quickAddQueue = useRef(Promise.resolve());
  const quickAdd = useCallback((column_key, title) => {
    quickAddQueue.current = quickAddQueue.current
      .then(() => api.post('/director-tasks', {
        title,
        column_key,
        // The same default the dialog uses. A card typed into a column belongs
        // to the center until somebody there takes it.
        assignee_center: true,
      }))
      .then((created) => { setTasks((ts) => [...ts, created]); setError(''); })
      .catch((err) => setError(err.message || 'Could not add the task.'));
  }, []);

  // Deleting a card puts it in Recently deleted, where it sits for a fortnight
  // and is then gone for good. Every route off the board goes through here —
  // the swipe, the drop on the nav, the dialog, the list's menu — so there is
  // one meaning of delete and it is the recoverable one. `purge` below is the
  // other one, and it is only reachable from inside Recently deleted.
  const softDelete = useCallback(async (task) => {
    const previous = tasks;
    dropAfterExit(task.id);
    try {
      await api.post(`/director-tasks/${task.id}/archive`);
    } catch (err) {
      setLeavingId(null);
      setTasks(previous);
      setError(err.message || 'Could not delete the task.');
    }
  }, [tasks, dropAfterExit]);

  const restore = useCallback(async (task) => {
    const previous = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== task.id));
    try {
      await api.post(`/director-tasks/${task.id}/restore`);
    } catch (err) {
      setTasks(previous);
      setError(err.message || 'Could not put the task back.');
    }
  }, [tasks]);

  const clearDone = useCallback(async () => {
    const previous = tasks;
    setTasks((ts) => ts.filter((t) => t.column_key !== 'done'));
    try {
      await api.post('/director-tasks/archive-done');
    } catch (err) {
      setTasks(previous);
      setError(err.message || 'Could not clear the finished tasks.');
    }
  }, [tasks]);

  // One cell of one card, changed from the list. PATCH is a whole-card write,
  // so the rest of the card goes back with it — cardFields is that "rest", in
  // one place, so a field added later cannot be quietly wiped by an edit that
  // never meant to touch it.
  const patchTask = useCallback(async (task, fields) => {
    const previous = tasks;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, ...fields } : t)));
    try {
      const saved = await api.patch(`/director-tasks/${task.id}`, { ...cardFields(task), ...fields });
      setTasks((ts) => ts.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)));
      setError('');
    } catch (err) {
      setTasks(previous);
      setError(err.message || 'Could not save that change.');
    }
  }, [tasks]);

  // Emptying the bin. One request rather than one per card: the confirm was
  // asked once, and twenty round trips would leave the list half gone if the
  // fourth of them failed.
  const purgeAll = useCallback(async () => {
    const previous = tasks;
    setTasks([]);
    try {
      await api.delete('/director-tasks/deleted');
    } catch (err) {
      setTasks(previous);
      setError(err.message || 'Could not empty Recently deleted.');
    }
  }, [tasks]);

  // The one that does not come back, and the only one the fortnight's wait is
  // there to make unnecessary.
  const purge = useCallback(async (task) => {
    const previous = tasks;
    dropAfterExit(task.id);
    try {
      await api.delete(`/director-tasks/${task.id}`);
    } catch (err) {
      setLeavingId(null);
      setTasks(previous);
      setError(err.message || 'Could not delete the task for good.');
    }
  }, [tasks, dropAfterExit]);

  return (
    <Layout>
      <div className="space-y-6">
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          {/* Recently deleted is a place you go, not a filter you leave on, so
              the way out is the way out of anywhere else on this page: the
              back link, in the one spot on the header that never moves. It was
              a pressed pill on the right before, which failed twice over — the
              controls beside it unmount when it is on, so the button slid
              across the header the moment it was clicked and no longer looked
              like the thing that had just been pressed, and a toggle in the
              corner is a weak signal for "you are somewhere else now" when the
              heading, the description and the whole body have already
              changed. */}
          {showArchived ? (
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className="inline-flex items-center gap-1.5 font-ninja text-sm font-bold text-ninja-muted hover:text-ninja-navy transition-colors rounded"
            >
              <ArrowLeftIcon size={15} strokeWidth={2.25} />
              Tasks
            </button>
          ) : (
            <Link
              to="/manager/overview"
              className="inline-flex items-center gap-1.5 font-ninja text-sm font-bold text-ninja-muted hover:text-ninja-navy transition-colors rounded"
            >
              <ArrowLeftIcon size={15} strokeWidth={2.25} />
              Dashboard
            </Link>
          )}

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black font-ninja text-ninja-navy tracking-tight">
                {showArchived ? 'Recently deleted' : 'Tasks'}
              </h1>
              <p className="mt-1 font-ninja text-sm text-ninja-muted text-pretty">
                {showArchived
                  ? 'Deleted tasks are kept here for 14 days, then removed for good.'
                  : canManage
                    ? 'Assign tasks to this location'
                    : "You're viewing another center, so this board is read-only."}
              </p>
            </div>
            {/* The whole group is the board's controls, and Recently deleted
                is not a board — so while it is open the group is empty rather
                than half-empty, and the back link above is the only control.
                Nothing here can move under the pointer, because nothing here
                survives the click that opens it. */}
            <div className={`flex items-center gap-2 ${showArchived ? 'hidden' : ''}`}>
              {/* Not a filter — a different fetch. It goes first because it is
                  a question about which set of tasks the page is showing, and
                  the two controls after it are questions about how to show
                  them. */}
              <button
                type="button"
                onClick={() => setShowArchived(true)}
                className="px-3 py-1.5 rounded-full font-ninja text-xs font-semibold border border-transparent bg-transparent text-ninja-muted hover:text-ninja-navy hover:border-ninja-border transition-colors duration-150 ease-[var(--ease-out)] active:scale-95"
              >
                Recently deleted
              </button>
              <Segmented
                options={VIEWS}
                value={view}
                onChange={chooseView}
                label="How to show the tasks"
                layoutId="tasksViewPill"
                size="sm"
              />
              {/* The full task, from anywhere on the page. The quick adds are
                  the fast path — a title, in one breath, into the column you
                  typed at — and this is the one that asks for a date, an owner
                  and a checklist up front. It defaults to To do because a task
                  being created has not been started; the dialog's own Column
                  field is there to say otherwise.

                  The group above is already hidden while Recently deleted is
                  open, so this only has to ask whether the viewer can write
                  here at all. */}
              {canManage && (
                <button
                  type="button"
                  onClick={() => openEditor({ column: 'todo' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ninja-blue text-white font-ninja text-xs font-bold hover:bg-ninja-blue-hover transition-colors duration-150 ease-[var(--ease-out)] active:scale-95"
                >
                  <PlusIcon size={15} strokeWidth={2.75} aria-hidden="true" />
                  Add task
                </button>
              )}
            </div>
          </div>

        </motion.header>

        {error && (
          <p role="status" className="font-ninja text-sm text-ninja-red">{error}</p>
        )}

        {loading ? (
          view === 'list' || showArchived ? (
            <SkeletonList rows={8} label="Loading tasks" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5 items-start" aria-busy="true" aria-label="Loading tasks">
              {COLUMNS.map((col, i) => (
                <div key={col.key} className="rounded-2xl bg-ninja-bg p-3 space-y-2.5">
                  <Skeleton className="h-4 w-24 mb-1" />
                  {Array.from({ length: i === 0 ? 3 : 2 }, (_, j) => (
                    <Skeleton key={j} className="h-20 w-full rounded-2xl" />
                  ))}
                </div>
              ))}
            </div>
          )
        ) : showArchived ? (
          <RecentlyDeleted
            tasks={tasks}
            canManage={canManage}
            leavingId={leavingId}
            onRestore={restore}
            onPurge={purge}
            onPurgeAll={purgeAll}
          />
        ) : view === 'list' ? (
          <TaskList
            tasks={tasks}
            canManage={canManage}
            directors={directors}
            centerName={user?.activeLocation?.name}
            onEdit={(task) => openEditor({ task })}
            onDelete={softDelete}
            onPurge={purge}
            onRestore={restore}
            onPatch={patchTask}
            onQuickAdd={quickAdd}
          />
        ) : (
          <TaskBoard
            tasks={tasks}
            leavingId={leavingId}
            canManage={canManage}
            onCompose={openComposer}
            onEdit={(task) => openEditor({ task })}
            onDelete={softDelete}
            onRestore={restore}
            onReorder={reorder}
            onClearDone={clearDone}
          />
        )}
      </div>

      <TaskComposer
        isOpen={!!composer}
        origin={composer?.origin ?? null}
        column={composer?.column ?? 'todo'}
        onSubmit={quickAdd}
        onClose={() => setComposer(null)}
        // The same task, with the rest of the card's fields. Whatever has been
        // typed goes with it, because retyping it would be the form punishing
        // you for wanting a due date.
        onMore={(column, draftTitle) => { setComposer(null); openEditor({ column, draftTitle }); }}
      />

      <TaskEditorModal
        isOpen={!!editor}
        task={editor?.task ?? null}
        directors={directors}
        column={editor?.column ?? 'todo'}
        draftTitle={editor?.draftTitle ?? ''}
        onClose={() => setEditor(null)}
        onDirtyChange={setEditorDirty}
        refuseSignal={refuseSignal}
        onSave={save}
        onDelete={canManage ? softDelete : undefined}
        onPurge={canManage ? purge : undefined}
        onRestore={canManage ? restore : undefined}
      />
    </Layout>
  );
}
