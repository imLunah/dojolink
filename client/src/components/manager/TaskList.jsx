import { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, Trash2Icon } from 'lucide-react';
import TaskActionsMenu from './TaskActionsMenu';
import { MentionCountBadge } from './TaskCardFace';
import { CARD } from '../../lib/surfaces';
import { useAuth } from '../../context/AuthContext';
import { COLUMNS, COLUMN_KEYS, DUE_TONE, carriesTask, dueMeta, ownsTask, plainPreview, taskHolder } from '../../lib/taskBoard';

// The same cards, as one table. The board answers "what is happening in each
// stage"; this answers "what is coming up", which a column layout cannot show
// because the thing you want to compare is spread across four of them.
//
// Every cell that holds a fact is the control that changes it. A table you can
// only read means triaging twenty cards is twenty dialogs, which is the work
// the list was supposed to save.

// A checkbox column ahead of the rest. Triaging is what this view is for, and
// triaging twenty cards one menu at a time is the work it was meant to save.
const COLS = 'grid-cols-[1.5rem_minmax(0,2.6fr)_9rem_11rem_9rem_2rem]';

// Ghost controls: no chrome until the pointer or focus arrives, so the table
// reads as text and behaves as a form. The row is a row, not a toolbar.
const GHOST =
  'w-full bg-transparent border border-transparent rounded-lg px-2 py-1 -mx-2 font-ninja text-xs text-ninja-muted ' +
  'hover:border-ninja-border hover:text-ninja-navy focus:border-ninja-blue focus:text-ninja-navy focus:outline-none ' +
  'cursor-pointer transition-colors appearance-none';

// Nulls sort last in BOTH directions. A card with no date is not the earliest
// or the latest, it is not on the timeline at all, and flipping it to the top
// would put the least informative rows where the most urgent ones were.
const nullsLast = (a, b, cmp) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return cmp(a, b);
};

const text = (a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });

const SORTS = {
  // Dates compare as strings: YYYY-MM-DD sorts correctly and never goes through
  // Date(), which reads a pg DATE as the evening before in this timezone.
  due: (t) => t.due_date || null,
  title: (t) => (t.title?.trim() || plainPreview(t.body) || null),
  status: (t) => COLUMN_KEYS.indexOf(t.column_key),
  assignee: (t) => taskHolder(t) || null,
};

function SortHeader({ label, sortKey, sort, onSort, className = '' }) {
  const on = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}`}
      className={`flex items-center gap-1 text-left uppercase tracking-widest transition-colors hover:text-ninja-navy ${on ? 'text-ninja-navy' : ''} ${className}`}
    >
      {label}
      {on && (sort.dir === 'asc'
        ? <ChevronUpIcon size={12} strokeWidth={3} aria-hidden="true" />
        : <ChevronDownIcon size={12} strokeWidth={3} aria-hidden="true" />)}
    </button>
  );
}

export default function TaskList({ tasks, canManage, canCreate = canManage, assignees = [], centerName, onEdit, onDelete, onPurge, onRestore, onPatch, onQuickAdd }) {
  const { user } = useAuth();
  const [sort, setSort] = useState({ key: 'due', dir: 'asc' });
  const [picked, setPicked] = useState(() => new Set());
  const [adding, setAdding] = useState('');

  const togglePicked = (id) => setPicked((p) => {
    const next = new Set(p);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const rows = useMemo(() => {
    const read = SORTS[sort.key];
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...tasks].sort((a, b) => {
      const av = read(a);
      const bv = read(b);
      const cmp = nullsLast(av, bv, typeof av === 'number' ? (x, y) => x - y : text);
      if (cmp !== 0) return cmp * dir;
      // Stable and reproducible across a refetch: archiving leaves holes in
      // position, so two cards can share one.
      return COLUMN_KEYS.indexOf(a.column_key) - COLUMN_KEYS.indexOf(b.column_key)
        || a.position - b.position
        || a.id - b.id;
    });
  }, [tasks, sort]);

  // Selection is by id, and ids outlive a sort but not a delete. Anything that
  // has left the board is dropped rather than left in the set, or the count
  // above the table would go on counting rows that are not there.
  //
  // Only rows that are yours to delete are selectable at all — the bar's one
  // action is Delete, and a checkbox that arms a refusal is worse than none.
  const selectable = canManage ? rows.filter((t) => ownsTask(t, user)) : [];
  const live = selectable.filter((t) => picked.has(t.id));
  const allPicked = selectable.length > 0 && live.length === selectable.length;

  const quickAdd = (e) => {
    e.preventDefault();
    const text = adding.trim();
    if (!text) return;
    setAdding('');
    onQuickAdd?.('todo', text);
  };

  // Typing a task straight into the list, the way each column does at its foot.
  // It lands in To do, because the list has no column to be at the bottom of
  // and anything typed in one breath is a thing to do rather than a thing being
  // done. The header's Add task is the other half of this: one breath here,
  // everything else there.
  const addRow = canCreate && onQuickAdd && (
    <form onSubmit={quickAdd} className="px-4 lg:px-5 py-2 border-t border-ninja-border/50">
      <input
        type="text"
        value={adding}
        onChange={(e) => setAdding(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(''); e.currentTarget.blur(); } }}
        placeholder="+ Quick add to To do"
        aria-label="Quick add a task to To do"
        className="w-full px-2 py-1.5 -mx-2 rounded-lg bg-transparent border border-transparent hover:border-ninja-border focus:border-ninja-blue focus:bg-white dark:focus:bg-white/5 font-ninja text-sm text-ninja-navy placeholder:text-ninja-muted transition-colors duration-150"
      />
    </form>
  );

  // Sits above the table rather than floating over it: the count is the point,
  // and a bar that covers the rows it is counting is a bar you have to move to
  // check. Delete here is the recoverable one, like everywhere else, so it goes
  // without asking.
  const selectionBar = live.length > 0 && (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="font-ninja text-sm font-bold text-ninja-navy">
        {live.length} selected
      </span>
      <button
        type="button"
        onClick={() => { live.forEach((t) => onDelete(t)); setPicked(new Set()); }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-ninja text-xs font-bold text-ninja-red hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
      >
        <Trash2Icon size={14} strokeWidth={2.25} />
        Delete
      </button>
      <button
        type="button"
        onClick={() => setPicked(new Set())}
        className="font-ninja text-xs font-semibold text-ninja-muted hover:text-ninja-navy transition-colors"
      >
        Clear selection
      </button>
    </div>
  );

  const pickBox = (task) => canManage && ownsTask(task, user) && (
    <input
      type="checkbox"
      checked={picked.has(task.id)}
      onChange={() => togglePicked(task.id)}
      aria-label={`Select ${task.title?.trim() || plainPreview(task.body) || 'task'}`}
      className="rounded border-ninja-border accent-ninja-blue cursor-pointer flex-shrink-0"
    />
  );

  if (!rows.length) {
    return (
      <div className={CARD}>
        <p className="py-12 text-center font-ninja text-sm text-ninja-muted">Nothing here yet.</p>
        {addRow}
      </div>
    );
  }

  // No overflow-hidden on the shell. It rounded the corners for free and
  // clipped every menu that opened near the bottom of the list with it; the
  // corners are rounded by the first and last rows instead.
  return (
    <>
    {selectionBar}
    <div className={CARD}>
      <div className={`hidden lg:grid ${COLS} gap-3 px-5 py-2.5 rounded-t-2xl border-b border-ninja-border bg-ninja-bg font-ninja font-bold text-[11px] text-ninja-muted`}>
        {selectable.length > 0 ? (
          <input
            type="checkbox"
            checked={allPicked}
            onChange={() => setPicked(allPicked ? new Set() : new Set(selectable.map((t) => t.id)))}
            aria-label={allPicked ? 'Clear selection' : 'Select every task'}
            className="rounded border-ninja-border accent-ninja-blue cursor-pointer self-center"
          />
        ) : <span />}
        <SortHeader label="Task" sortKey="title" sort={sort} onSort={toggleSort} />
        <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
        <SortHeader label="Who has it" sortKey="assignee" sort={sort} onSort={toggleSort} />
        <SortHeader label="Due" sortKey="due" sort={sort} onSort={toggleSort} />
        <span className="sr-only">Actions</span>
      </div>

      {rows.map((task) => {
        // Computed once and used by both layouts, so the phone and the desktop
        // cannot come to say different things about the same card.
        const due = dueMeta(task.due_date);
        const lead = task.title?.trim() || plainPreview(task.body) || 'Untitled';
        const note = task.title?.trim() ? plainPreview(task.body) : '';
        const list = task.checklist || [];
        const ticked = list.filter((i) => i.done).length;
        // The three tiers, per row: the stage is a carrier's, the words and
        // the date are the owner's, and everyone else reads. Same answers the
        // board and the dialog give, because they are the same functions.
        const own = canManage && ownsTask(task, user);
        const carry = canManage && !task.archived_at && carriesTask(task, user);
        const editable = own && !task.archived_at;
        const who = task.assignee_center ? 'center' : task.assignee_id ? String(task.assignee_id) : 'center';

        const title = (
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="max-w-full text-left rounded font-ninja text-sm font-semibold text-ninja-navy hover:text-ninja-blue transition-colors truncate block"
            >
              {lead}
            </button>
            {(note || list.length > 0) && (
              <p className="font-ninja text-xs text-ninja-muted truncate">
                {list.length > 0 && <span className="tabular-nums mr-2">{ticked}/{list.length}</span>}
                {note}
              </p>
            )}
          </div>
        );

        const status = carry ? (
          <select
            value={task.column_key}
            onChange={(e) => onPatch(task, { column_key: e.target.value })}
            aria-label={`Status of ${lead}`}
            className={GHOST}
          >
            {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        ) : (
          <span className="font-ninja text-xs text-ninja-muted">
            {COLUMNS.find((c) => c.key === task.column_key)?.label}
          </span>
        );

        const owner = editable ? (
          <select
            value={who}
            onChange={(e) => {
              const v = e.target.value;
              onPatch(task, v === 'center'
                ? { assignee_center: true, assignee_id: null, assignee_name: null }
                : { assignee_center: false, assignee_id: Number(v), assignee_name: assignees.find((d) => String(d.id) === v)?.display_name || null });
            }}
            aria-label={`Who has ${lead}`}
            className={GHOST}
          >
            <option value="center">{centerName || 'The whole center'}</option>
            <optgroup label="Center Directors">
              {assignees.filter((d) => d.role !== 'sensei').map((d) => (
                <option key={d.id} value={String(d.id)}>{d.display_name}</option>
              ))}
            </optgroup>
            <optgroup label="Senseis">
              {assignees.filter((d) => d.role === 'sensei').map((d) => (
                <option key={d.id} value={String(d.id)}>{d.display_name}</option>
              ))}
            </optgroup>
            {task.assignee_id && !assignees.some((d) => d.id === task.assignee_id) && (
              <option value={String(task.assignee_id)}>{task.assignee_name || 'No longer here'}</option>
            )}
          </select>
        ) : (
          <span className="font-ninja text-xs text-ninja-muted truncate">{taskHolder(task) || 'Nobody yet'}</span>
        );

        // The date input carries the tone the card carries, so an overdue row
        // reads as overdue whether or not anyone is about to change it.
        const when = editable ? (
          <input
            type="date"
            value={task.due_date || ''}
            onChange={(e) => onPatch(task, { due_date: e.target.value || null })}
            aria-label={`Due date of ${lead}`}
            className={`${GHOST} ${due ? DUE_TONE[due.tone] : ''}`}
          />
        ) : (
          <span className={`font-ninja text-xs ${due ? DUE_TONE[due.tone] : 'text-ninja-muted'}`}>
            {due?.text || 'No date'}
          </span>
        );

        // A deleted row someone else owns has nothing in the menu at all —
        // restore and purge are the owner's, and a menu of zero items is a
        // control that lies about being one.
        const menu = canManage && (own || !task.archived_at) && (
          <TaskActionsMenu
            task={task}
            canMove={carry}
            canDelete={own}
            onOpen={() => onEdit(task)}
            onDelete={onDelete}
            onPurge={onPurge}
            onRestore={onRestore}
            onMoveTo={(t, key) => onPatch(t, { column_key: key })}
          />
        );

        return (
          <div
            key={task.id}
            className={`relative border-b border-ninja-border/50 last:border-b-0 last:rounded-b-2xl hover:bg-ninja-bg/60 transition-colors ${task.archived_at ? 'opacity-60' : ''}`}
          >
            <MentionCountBadge count={task.unread_mention_count} className="absolute -right-2 -top-2 z-20" />
            <div className={`hidden lg:grid ${COLS} gap-3 px-5 py-2.5 items-center`}>
              {canManage ? pickBox(task) : <span />}
              {title}
              {status}
              {owner}
              {when}
              <div className="justify-self-end">{menu}</div>
            </div>

            <div className="lg:hidden px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                {canManage && <span className="pt-0.5">{pickBox(task)}</span>}
                {title}
                {menu}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {status}
                {when}
                <div className="col-span-2">{owner}</div>
              </div>
            </div>
          </div>
        );
      })}
      {addRow}
    </div>
    </>
  );
}
