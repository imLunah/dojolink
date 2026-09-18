import { lazy, Suspense, useEffect, useState } from 'react';
import { ArchiveRestoreIcon, PlusIcon, SendIcon, Trash2Icon, XIcon } from 'lucide-react';
import Modal from '../ui/Modal';
import FloatingPanel from '../ui/FloatingPanel';
import useIsDesktop from '../../lib/useIsDesktop';
import Button from '../ui/Button';
import LazyMarkdownEditor from '../shared/LazyMarkdownEditor';
import Linkify from '../shared/Linkify';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { COLUMNS, DUE_TONE, carriesTask, dueMeta, ownsTask } from '../../lib/taskBoard';

// The rendered note, for a card that is not yours to edit. Lazy for the same
// reason the editor is: both ride the markdown chunk, and the dialog should
// not make every visitor to the board pay for it.
const MarkdownView = lazy(() => import('../shared/MarkdownView'));

const TITLE_MAX = 200;

// The form's fields as one comparable string. Checklist items are cut down to
// the two things the form can change, so a row carrying an id from the server
// doesn't read as an edit nobody made.
const snapshot = (f) => JSON.stringify({
  title: f.title,
  body: f.body,
  color: f.color,
  due: f.due,
  assignee: f.assignee,
  columnKey: f.columnKey,
  checklist: f.checklist.map((i) => ({ text: i.text, done: Boolean(i.done) })),
});


// Create and edit are the same form. `task` null means create; `column` is the
// column a new card lands in.
export default function TaskEditorModal({ isOpen, task, assignees = [], column = 'todo', draftTitle = '', onClose, onSave, onDelete, onPurge, onRestore, onDirtyChange, onCommentCount, refuseSignal = 0 }) {
  const { user, isReadOnly } = useAuth();
  // The task rail still fits in a narrow desktop window: at 27rem it leaves
  // enough of the board visible to keep its context. Phones remain modal.
  const isDesktop = useIsDesktop(560);
  const [confirming, setConfirming] = useState(false);
  // `archived_at` is the day the card was deleted. The column is older than the
  // name; see the note in the tasks route.
  const deleted = Boolean(task?.archived_at);
  // Whose card this is, and therefore what this dialog is. The owner gets the
  // form. A carrier gets a reading of the card with the two things that are
  // theirs still live: the stage and the checklist, plus the comments under
  // it. Anyone else reads. A new card is its author's by definition, and
  // browsing another center makes everyone a reader, same as the whole page.
  // The server holds the same line (see directorTasks.js), so this is the
  // honest drawing of it, not the enforcement.
  const owns = !isReadOnly && (!task || ownsTask(task, user));
  const carries = owns || (!isReadOnly && Boolean(task) && carriesTask(task, user));
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  // Kept, not chosen: a task's colour is no longer drawn on the board, so
  // there is nothing to pick. Carrying the stored value through an edit means
  // saving a card doesn't quietly wipe what is in the column.
  const [color, setColor] = useState('none');
  const [due, setDue] = useState('');
  const [assignee, setAssignee] = useState('');
  const [columnKey, setColumnKey] = useState(column);
  const [checklist, setChecklist] = useState([]);
  const [item, setItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // What the card looked like when it opened, to tell an edit from a read.
  const [baseline, setBaseline] = useState(null);

  // Seeded during render, not in an effect, and only when the dialog opens on a
  // different card.
  //
  // An effect is one render too late here. Modal mounts its children on the
  // same render that opens it, and the note editor reads its content ONCE when
  // it mounts — so opening a second card would build the editor from the state
  // still holding the first card's note, and the effect that corrected the
  // state afterwards could not reach inside an editor that had already started.
  // Titles looked right and notes were a card behind, which on a board of
  // titleless cards reads as the wrong task opening altogether.
  //
  // Keyed by which card is open, so a re-render of the board underneath the
  // dialog never clobbers what is being typed, and closing re-arms it: the same
  // card opened again comes back to what was saved, not to an abandoned edit.
  const seedKey = isOpen ? String(task?.id ?? `new:${column}`) : null;
  const [seeded, setSeeded] = useState(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    if (isOpen) {
      setTitle(task?.title ?? draftTitle ?? '');
      setBody(task?.body ?? '');
      setColor(task?.color ?? 'none');
      setDue(task?.due_date ?? '');
      // The center is the default, including for the older cards that predate
      // this field: with no empty option to fall back to, a select showing the
      // center while the card is stored as unassigned would save one thing and
      // display another.
      setAssignee(task?.assignee_id ? String(task.assignee_id) : 'center');
      setColumnKey(task?.column_key ?? column);
      const checklistSeed = task?.checklist ? task.checklist.map((i) => ({ ...i })) : [];
      setChecklist(checklistSeed);
      setBaseline(snapshot({
        title: task?.title ?? draftTitle ?? '',
        body: task?.body ?? '',
        color: task?.color ?? 'none',
        due: task?.due_date ?? '',
        assignee: task?.assignee_id ? String(task.assignee_id) : 'center',
        columnKey: task?.column_key ?? column,
        checklist: checklistSeed,
      }));
      setItem('');
      setError('');
      setSaving(false);
      setConfirming(false);
    }
  }

  // A card must say something, but it chooses whether that is a title or a
  // note. The server has always been the authority on this (has_content); the
  // editor agrees with it, so the titleless cards that came over from the
  // sticky wall can be opened, edited and saved instead of trapping their
  // author with a Save that never enables.
  const trimmed = title.trim();
  const hasContent = Boolean(trimmed || body.trim());

  // Anything typed and not yet saved. The board asks, because a card holding
  // unsaved work should not be closed or swapped out by a stray press — see
  // the panel's own note on refusing a dismissal.
  const dirty = isOpen
    && baseline !== null
    && snapshot({ title, body, color, due, assignee, columnKey, checklist }) !== baseline;
  useEffect(() => { if (onDirtyChange) onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  const submit = async () => {
    if (!hasContent) { setError('Give the task a title or a note.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        title: trimmed || null,
        body: body.trim() || null,
        color,
        due_date: due || null,
        assignee_id: assignee && assignee !== 'center' ? Number(assignee) : null,
        assignee_center: assignee === 'center',
        checklist,
        column_key: columnKey,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save the task.');
      setSaving(false);
    }
  };

  // One form, two shells. On a desktop board an existing card opens beside the
  // column it came out of, so the board it belongs to is still readable while
  // it is being edited. A new task has no card on the board to sit beside, so
  // it opens in the middle as a dialog, and on a phone there is no beside
  // either, so it takes the screen.
  const docked = isDesktop && !!task;
  const Shell = docked ? FloatingPanel : Modal;
  const shellProps = {
    width: docked ? 'w-[27rem]' : 'max-w-lg',
    canDismiss: !dirty,
    guardHint: 'Unsaved changes. Save them, or Cancel to discard.',
    refuseSignal,
  };

  return (
    <Shell
      isOpen={isOpen}
      onClose={onClose}
      title={task ? (owns ? 'Edit task' : 'Task details') : 'New task'}
      {...shellProps}
    >
      <div className="space-y-4">
        {owns ? (
          <div>
            <label htmlFor="task-title" className="block font-ninja text-sm font-bold text-ninja-navy mb-1.5">
              Title
              {/* Named as optional, because it is. A card that is just a note is
                  a normal card here, not a half-finished one. */}
              <span className="ml-1.5 font-normal text-ninja-muted">optional</span>
            </label>
            <input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              placeholder="Order laptops for the Friday camp"
              className="w-full rounded-xl bg-white border border-ninja-border focus:border-ninja-blue transition-colors px-3 py-2.5 font-ninja text-sm text-ninja-navy"
            />
          </div>
        ) : (
          <div>
            {title.trim() && (
              <h3 className="font-ninja text-base font-bold text-ninja-navy leading-snug text-pretty">
                {title}
              </h3>
            )}
          </div>
        )}

        {owns ? (
          <div>
            <span className="block font-ninja text-sm font-bold text-ninja-navy mb-1.5">Notes</span>
            <LazyMarkdownEditor
              value={body}
              onChange={setBody}
              placeholder="Anything the next director on shift needs to know…"
            />
          </div>
        ) : body.trim() ? (
          <div>
            <span className="block font-ninja text-sm font-bold text-ninja-navy mb-1.5">Notes</span>
            <Suspense fallback={<p className="font-ninja text-sm text-ninja-muted">Loading…</p>}>
              <MarkdownView className="font-ninja text-sm leading-relaxed text-ninja-navy">
                {body}
              </MarkdownView>
            </Suspense>
          </div>
        ) : null}

        {!owns && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className={`font-ninja text-sm ${dueMeta(due) ? DUE_TONE[dueMeta(due).tone] : 'text-ninja-muted'}`}>
              {dueMeta(due)?.text || 'No due date'}
            </span>
          </div>
        )}

        <div className={owns ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}>
          {owns && (
          <>
          <div>
            <label htmlFor="task-due" className="block font-ninja text-sm font-bold text-ninja-navy mb-1.5">
              Due date
            </label>
            <input
              id="task-due"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="w-full rounded-xl bg-white border border-ninja-border focus:border-ninja-blue transition-colors px-3 py-2.5 font-ninja text-sm text-ninja-navy"
            />
            {due && (
              <button
                type="button"
                onClick={() => setDue('')}
                className="mt-1.5 font-ninja text-xs text-ninja-muted hover:text-ninja-navy transition-colors"
              >
                Clear date
              </button>
            )}
          </div>

          <div>
            <label htmlFor="task-assignee" className="block font-ninja text-sm font-bold text-ninja-navy mb-1.5">
              Assigned to
            </label>
            <select
              id="task-assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full rounded-xl bg-white border border-ninja-border focus:border-ninja-blue transition-colors px-3 py-2.5 font-ninja text-sm text-ninja-navy"
            >
              {/* The center first and no empty option: every card belongs to
                  the center unless somebody there has taken it, which is truer
                  than an unassigned card and does not need reading between the
                  lines. */}
              <option value="center">{user?.activeLocation?.name || 'The whole center'}</option>
              <optgroup label="Center Directors">
                {assignees.filter((d) => d.role !== 'sensei').map((d) => (
                  <option key={d.id} value={d.id}>{d.display_name}</option>
                ))}
              </optgroup>
              <optgroup label="Senseis">
                {assignees.filter((d) => d.role === 'sensei').map((d) => (
                  <option key={d.id} value={d.id}>{d.display_name}</option>
                ))}
              </optgroup>
              {/* A card handed to someone who has since left the center would
                  otherwise show as unassigned the moment it is opened, and
                  saving would quietly drop them. */}
              {task?.assignee_id && !assignees.some((d) => d.id === task.assignee_id) && (
                <option value={task.assignee_id}>{task.assignee_name || 'No longer at this center'}</option>
              )}
            </select>
          </div>
          </>
          )}

          {/* The one field a carrier keeps: moving the card along is exactly
              what being on it means. A reader gets the fact, not the control. */}
          {carries ? (
          <div>
            <label htmlFor="task-column" className="block font-ninja text-sm font-bold text-ninja-navy mb-1.5">
              Column
            </label>
            <select
              id="task-column"
              value={columnKey}
              onChange={(e) => setColumnKey(e.target.value)}
              className="w-full rounded-xl bg-white border border-ninja-border focus:border-ninja-blue transition-colors px-3 py-2.5 font-ninja text-sm text-ninja-navy"
            >
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          ) : (
          <div>
            <span className="block font-ninja text-sm font-bold text-ninja-navy mb-1.5">Column</span>
            <p className="font-ninja text-sm text-ninja-muted">
              {COLUMNS.find((c) => c.key === columnKey)?.label}
            </p>
          </div>
          )}
        </div>

        {(carries || checklist.length > 0) && (
        <div>
          <span className="block font-ninja text-sm font-bold text-ninja-navy mb-1.5">
            Checklist
            {checklist.length > 0 && (
              <span className="ml-1.5 font-normal text-ninja-muted tabular-nums">
                {checklist.filter((i) => i.done).length}/{checklist.length}
              </span>
            )}
          </span>

          {checklist.length > 0 && (
            <ul className="mb-2 space-y-1">
              {checklist.map((it, i) => (
                <li key={i} className="flex items-center gap-2 group">
                  {/* A label around the box, so the words are the target too. */}
                  <label className={`flex items-center gap-2 flex-1 min-w-0 ${carries ? 'cursor-pointer' : ''}`}>
                    <input
                      type="checkbox"
                      checked={it.done}
                      disabled={!carries}
                      onChange={() => setChecklist((cs) => cs.map((c, j) => (j === i ? { ...c, done: !c.done } : c)))}
                      className={`rounded border-ninja-border accent-ninja-blue flex-shrink-0 ${carries ? 'cursor-pointer' : ''}`}
                    />
                    <span className={`font-ninja text-sm truncate ${it.done ? 'text-ninja-muted line-through' : 'text-ninja-navy'}`}>
                      {it.text}
                    </span>
                  </label>
                  {carries && (
                  <button
                    type="button"
                    onClick={() => setChecklist((cs) => cs.filter((_, j) => j !== i))}
                    aria-label={`Remove ${it.text}`}
                    className="p-1 rounded text-ninja-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-ninja-red transition-opacity flex-shrink-0"
                  >
                    <XIcon size={14} strokeWidth={2.5} />
                  </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Enter adds and leaves the field ready for the next one: a
              checklist is written in one go, not one dialog at a time. */}
          {carries && (
          <div className="flex items-center gap-2">
            <input
              value={item}
              onChange={(e) => setItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const text = item.trim();
                if (!text || checklist.length >= 20) return;
                setChecklist((cs) => [...cs, { text, done: false }]);
                setItem('');
              }}
              placeholder={checklist.length >= 20 ? 'Twenty is the limit' : 'Add a step and press Enter'}
              disabled={checklist.length >= 20}
              aria-label="Add a checklist item"
              className="flex-1 rounded-xl bg-white border border-ninja-border focus:border-ninja-blue transition-colors px-3 py-2 font-ninja text-sm text-ninja-navy disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => {
                const text = item.trim();
                if (!text || checklist.length >= 20) return;
                setChecklist((cs) => [...cs, { text, done: false }]);
                setItem('');
              }}
              aria-label="Add checklist item"
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-ninja-border text-ninja-muted hover:text-ninja-blue hover:border-ninja-blue transition-colors flex-shrink-0"
            >
              <PlusIcon size={16} strokeWidth={2.5} />
            </button>
          </div>
          )}
        </div>
        )}

        {/* The thread under the card. Only a saved, living card has one: a
            card being written has nobody to talk to yet, and a deleted card
            is on its way out. */}
        {task && !deleted && (
          <TaskComments task={task} canComment={carries} onCount={onCommentCount} />
        )}

        {error && <p className="font-ninja text-sm text-ninja-red">{error}</p>}

        {/* What can be done to the card, other than editing it. The board's
            cards carry two arrows where a menu holding all of this used to be,
            and a card's own dialog is where the rest went — it is also the
            route that does not need a pointer, which the board's gestures do.
            A card already in Recently deleted is offered the two things left:
            back to the board, or gone now rather than in a fortnight. */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {task && owns && (
            <div className="flex items-center gap-1 mr-auto">
              {deleted ? (
                <>
                  {onRestore && !confirming && (
                    <button
                      type="button"
                      onClick={() => { onRestore(task); onClose(); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-ninja text-xs font-bold text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg transition-colors"
                    >
                      <ArchiveRestoreIcon size={14} strokeWidth={2.25} />
                      Put back on the board
                    </button>
                  )}
                  {onPurge && (confirming ? (
                    // The word, not a glyph, and asked before it happens. This
                    // is the one action here with nothing behind it.
                    <>
                      <span className="font-ninja text-xs text-ninja-muted">Delete for good?</span>
                      <button
                        type="button"
                        onClick={() => { onPurge(task); onClose(); }}
                        className="px-2.5 py-1.5 rounded-lg bg-ninja-red text-white font-ninja text-xs font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-95"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(false)}
                        className="px-2.5 py-1.5 rounded-lg bg-ninja-bg text-ninja-navy font-ninja text-xs font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-95"
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-ninja text-xs font-bold text-ninja-red hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2Icon size={14} strokeWidth={2.25} />
                      Delete now
                    </button>
                  ))}
                </>
              ) : onDelete && (
                // No confirm on this one. It is not a question worth asking
                // when the answer is undoable for the next fortnight, and the
                // button says where the card is going.
                <button
                  type="button"
                  onClick={() => { onDelete(task); onClose(); }}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-ninja text-xs font-bold text-ninja-red hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <Trash2Icon size={14} strokeWidth={2.25} />
                  Delete
                </button>
              )}
            </div>
          )}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            {carries ? 'Cancel' : 'Close'}
          </Button>
          {carries && (
            <Button size="sm" onClick={submit} disabled={saving || !hasContent}>
              {saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}
            </Button>
          )}
        </div>
      </div>
    </Shell>
  );
}

// The thread under a card, in the same row the club sessions use: the words,
// then who said them and when. Fetched when the card opens rather than carried
// on every board read — the board itself only needs the count. Comments are
// plain text through Linkify, not markdown: they are one-line answers, and an
// editor here would out-weigh the note above it.
function TaskComments({ task, canComment, onCount }) {
  const [comments, setComments] = useState(null); // null is still loading
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setComments(null);
    setText('');
    setError('');
    api.get(`/director-tasks/${task.id}/comments`)
      .then((rows) => { if (alive) setComments(rows); })
      .catch(() => { if (alive) setComments([]); });
    return () => { alive = false; };
  }, [task.id]);

  const post = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || posting) return;
    setPosting(true);
    setError('');
    try {
      const created = await api.post(`/director-tasks/${task.id}/comments`, { body });
      setComments((cs) => {
        const next = [...(cs || []), created];
        onCount?.(task.id, next.length);
        return next;
      });
      setText('');
    } catch (err) {
      setError(err.message || 'Could not add the comment.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      <span className="block font-ninja text-sm font-bold text-ninja-navy mb-1.5">
        Comments
        {comments?.length > 0 && (
          <span className="ml-1.5 font-normal text-ninja-muted tabular-nums">{comments.length}</span>
        )}
      </span>

      {comments === null ? (
        <p className="font-ninja text-xs text-ninja-muted mb-2">Loading…</p>
      ) : comments.length > 0 ? (
        <div className="space-y-2.5 mb-2.5">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <div className="flex-shrink-0 w-1 rounded-full bg-ninja-blue" />
              <div className="min-w-0">
                <p className="font-ninja text-sm text-ninja-navy break-words whitespace-pre-wrap"><Linkify>{c.body}</Linkify></p>
                <p className="font-ninja text-xs text-ninja-muted mt-0.5">
                  {c.author_name || 'No longer here'} · {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : !canComment ? (
        <p className="font-ninja text-xs text-ninja-muted">Nothing said yet.</p>
      ) : null}

      {canComment && (
        <form onSubmit={post}>
          {/* A box to write in, not a field to fill: room for a few lines of
              how it is going, with the send button sitting in its corner.
              Enter posts, the way a chat does; Shift+Enter starts a new line. */}
          <div className="relative rounded-2xl bg-white border border-ninja-border focus-within:border-ninja-blue transition-colors">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (text.trim() && !posting) e.currentTarget.form.requestSubmit();
                }
              }}
              maxLength={2000}
              rows={4}
              placeholder={comments?.length ? 'Reply…' : 'Say how it is going…'}
              aria-label="Add a comment"
              className="block w-full min-h-[120px] resize-y rounded-2xl bg-transparent px-4 pt-3 pb-14 font-ninja text-[15px] leading-relaxed text-ninja-navy focus:outline-none"
            />
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
              <button
                type="submit"
                disabled={!text.trim() || posting}
                aria-label="Post comment"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-ninja-blue text-white font-ninja text-sm font-bold hover:bg-ninja-blue-hover transition-[background-color,opacity,transform] duration-150 active:scale-95 disabled:opacity-40 disabled:active:scale-100"
              >
                <SendIcon size={15} strokeWidth={2.25} aria-hidden="true" />
                Post
              </button>
            </div>
          </div>
        </form>
      )}
      {error && <p className="mt-1.5 font-ninja text-xs text-ninja-red">{error}</p>}
    </div>
  );
}
