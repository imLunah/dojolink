import { useState, useEffect } from 'react';
import { PencilIcon, ReplyIcon } from 'lucide-react';
import { formatDate, today } from '../../utils/dateUtils';
import { STATUSES } from '../../utils/beltConfig';
import { useAuth } from '../../context/AuthContext';
import { useCurriculum } from '../../context/CurriculumContext';
import BeltProgressFields from '../sensei/BeltProgressFields';
import { CreateProjectRow, LessonEntryRow } from '../sensei/LogEntryForm';
import { createEntryFromLog, lessonEntryFromLog, applyEntryChange, logPayload } from '../../lib/logDraft';
import { api } from '../../api/client';
import BeltBadge from '../ui/BeltBadge';
import ProgramBadge from '../ui/ProgramBadge';
import Button from '../ui/Button';
import ActionMenu, { MenuItem } from '../ui/ActionMenu';
import { TrashIcon } from '../ui/icons';
import { ReactionPicker, ReactionChips, RowActions, StripButton, IN_STRIP_MENU, toggleLocally } from '../ui/Reactions';
import LazyMarkdownEditor from './LazyMarkdownEditor';
import MarkdownView from './MarkdownView';
import { authorName } from '../../lib/authors';
import Linkify from './Linkify';

function LogComment({ comment }) {
  return (
    <div className="flex gap-2 mt-2">
      <div className="flex-shrink-0 w-1 rounded-full bg-ninja-blue" />
      <div>
        <p className="text-ninja-navy font-ninja text-sm"><Linkify>{comment.body}</Linkify></p>
        <p className="text-ninja-muted font-ninja text-xs mt-0.5">
          {authorName(comment.user_name)} · {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

// Status was a filled green box, sitting beside four other coloured boxes. The
// colour is the whole signal, so it only needs a dot to carry it: bg-current
// takes the text's own colour, which the dark overrides have already corrected.
const STATUS_TONE = {
  Completed: 'text-green-700',
  'Working On': 'text-blue-700',
};

function StatusMark({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-ninja text-xs font-semibold ${STATUS_TONE[status] || 'text-ninja-muted'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}

// The same buttons the log form uses, so a correction is made the way the
// original entry was. Clicking the current status clears it — a log that never
// carried one shouldn't be forced to gain one just by opening the editor.
function StatusPicker({ value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-ninja-muted text-xs font-ninja font-semibold mb-1.5 uppercase tracking-wide">
        Status
      </label>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const selected = value === s;
          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(selected ? '' : s)}
              className={`px-3 py-1 rounded-lg text-sm font-ninja font-semibold transition-colors disabled:opacity-50 ${
                selected
                  ? s === 'Completed' ? 'bg-emerald-500 text-white' : 'bg-ninja-blue text-white'
                  : 'bg-white border border-ninja-border text-ninja-navy hover:border-ninja-blue'
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Where in the curriculum the session happened. This was three bordered pills in
// three different colours, which gave a lesson name the same weight as the
// program it belongs to. It is one line now, read left to right, with the
// emphasis falling off as it narrows: course, then module, then lesson.
function CurriculumPath({ log }) {
  const crumbs = [log.sub_program, log.module_name, log.lesson_name].filter(Boolean);
  if (!crumbs.length) return null;
  return (
    <p className="font-ninja text-xs mb-1.5">
      {crumbs.map((crumb, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1.5 text-ninja-muted opacity-50" aria-hidden="true">·</span>}
          <span className={i === 0 ? 'text-ninja-navy font-semibold' : 'text-ninja-muted'}>{crumb}</span>
        </span>
      ))}
    </p>
  );
}

const FIELD =
  'w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-3 py-1.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue transition-colors';

const FIELD_LABEL = 'block text-ninja-muted text-xs font-ninja font-semibold mb-1 uppercase tracking-wide';

// A saved log read back into the shape the log form's own field rows expect, so
// a correction is made with the same dropdowns the entry was made with.
function draftFromLog(log, { beltProjects, curriculum }) {
  const program = log.program || '';
  const beltLevel = log.belt_level_at || '';
  const beltSublevel = log.belt_sublevel_at ? String(log.belt_sublevel_at) : '';
  return {
    program,
    session_date: String(log.session_date || '').split('T')[0],
    notes: log.notes || '',
    beltLevel,
    beltSublevel,
    entry: program === 'CREATE'
      ? createEntryFromLog(log, { beltProjects })
      : lessonEntryFromLog(log, curriculum),
  };
}

const payloadFromDraft = (draft) => logPayload({
  program: draft.program,
  sessionDate: draft.session_date,
  notes: draft.notes,
  beltLevel: draft.beltLevel,
  beltSublevel: draft.beltSublevel,
  entry: draft.entry,
});

// Every field the row displays, editable. Mounted per row rather than lifted
// into the list so the draft is seeded from the log it belongs to and thrown
// away with it — closing the editor can't leak a half-edit onto the next log.
function LogEditor({ log, programs, saving, error, onSave, onCancel }) {
  const { subPrograms, curriculum, beltProjects } = useCurriculum();
  const [draft, setDraft] = useState(() => draftFromLog(log, { beltProjects, curriculum }));
  const [dirty, setDirty] = useState(false);

  // The curriculum loads on its own clock. If it lands after the editor opened,
  // re-read the log against it — otherwise a standard module that looked
  // unknown a moment ago stays stuck in the custom field.
  useEffect(() => {
    if (dirty) return;
    setDraft(draftFromLog(log, { beltProjects, curriculum }));
  }, [curriculum, beltProjects]);

  const isCreate = draft.program === 'CREATE';
  const update = (patch) => { setDirty(true); setDraft((d) => ({ ...d, ...patch })); };
  const updateEntry = (field, value) => {
    setDirty(true);
    setDraft((d) => ({ ...d, entry: applyEntryChange(d.entry, field, value) }));
  };
  const clearProject = () => {
    setDirty(true);
    setDraft((d) => ({ ...d, entry: { ...d.entry, project: '', isCustom: false, customProject: '' } }));
  };

  // Moving a log between programs swaps which fields exist, so the entry starts
  // clean in the new shape; the status is the one thing both shapes share.
  const changeProgram = (program) => {
    const status = draft.entry.status || '';
    update({
      program,
      beltLevel: program === 'CREATE' ? draft.beltLevel : '',
      beltSublevel: program === 'CREATE' ? draft.beltSublevel : '',
      entry: program === 'CREATE'
        ? { project: '', isCustom: false, customProject: '', status }
        : { subProgram: '', moduleName: '', lessonName: '', customModule: '', customLesson: '', status },
    });
  };

  const programOptions = [...new Set([log.program, ...(programs || [])].filter(Boolean))];
  // The lesson row grows its own status buttons once a lesson is named. Without
  // one — a program with no curriculum, or a log that only ever had a status —
  // the picker is the only way to reach the field.
  const rowHasStatus = isCreate || !!(
    draft.entry.lessonName ||
    (draft.entry.moduleName === '__custom__' && (draft.entry.customModule || draft.entry.customLesson))
  );

  return (
    <div className="space-y-3 mt-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={FIELD_LABEL} htmlFor={`program-${log.id}`}>Program</label>
          <select
            id={`program-${log.id}`}
            value={draft.program}
            onChange={(e) => changeProgram(e.target.value)}
            className={FIELD}
          >
            {programOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={FIELD_LABEL} htmlFor={`date-${log.id}`}>Session Date</label>
          <input
            id={`date-${log.id}`}
            type="date"
            value={draft.session_date}
            max={today()}
            onChange={(e) => update({ session_date: e.target.value })}
            className={FIELD}
          />
        </div>
      </div>

      {isCreate ? (
        <>
          <BeltProgressFields
            beltLevel={draft.beltLevel}
            setBeltLevel={(v) => update({ beltLevel: v })}
            beltSublevel={draft.beltSublevel}
            setBeltSublevel={(v) => update({ beltSublevel: v })}
            setProject={clearProject}
          />
          <CreateProjectRow
            entry={draft.entry}
            index={0}
            total={1}
            beltLevel={draft.beltLevel}
            beltSublevel={draft.beltSublevel}
            beltProjects={beltProjects}
            onChange={updateEntry}
          />
        </>
      ) : (
        <LessonEntryRow
          entry={draft.entry}
          index={0}
          total={1}
          program={draft.program}
          onChange={updateEntry}
          subPrograms={subPrograms}
          curriculum={curriculum}
        />
      )}

      {!rowHasStatus && (
        <StatusPicker value={draft.entry.status} onChange={(v) => updateEntry('status', v)} disabled={saving} />
      )}

      <div>
        <label className={FIELD_LABEL}>Session Notes</label>
        <LazyMarkdownEditor value={draft.notes} onChange={(v) => update({ notes: v })} placeholder="Update the session notes…" />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onSave(payloadFromDraft(draft))}
          disabled={saving || !draft.notes.trim() || !draft.program || !draft.session_date}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
      {error && <p className="text-ninja-red font-ninja text-xs">{error}</p>}
    </div>
  );
}

// Opened from the row's reply button rather than parked under every entry. A
// permanently mounted box asks a question of every log you scroll past; most of
// them do not need an answer.
function CommentBox({ logId, onAdded, onClose }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError('');
    try {
      const comment = await api.post(`/progress/${logId}/comments`, { body: body.trim() });
      onAdded(comment);
      setBody('');
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to post comment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={body}
          autoFocus
          onChange={(e) => setBody(e.target.value)}
          // Escape backs out of a box you opened by mistake, without reaching
          // for a Cancel button that would sit there for the other 99% of uses.
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } }}
          placeholder="Write a reply…"
          className="flex-1 bg-white border border-ninja-border text-ninja-navy rounded-lg px-3 py-1.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue transition-colors"
        />
        <Button type="submit" size="sm" disabled={saving || !body.trim()}>
          {saving ? '...' : 'Reply'}
        </Button>
      </form>
      {error && <p className="text-ninja-red font-ninja text-xs mt-1">{error}</p>}
    </div>
  );
}

// `enrolledPrograms` (names) lets a log be moved to another of the ninja's
// programs; without it the editor offers only the program the log already has.
// Two projects worked on in one sitting are one session with one note, not two
// copies of it. Rows are gathered into the course they belong to — the program,
// and the course inside it where a program has them — and the note is printed
// once, under the last line of its group.
//
// CREATE is one course: a session that carried a ninja from Brown into Red is
// still one class and still one note. The note itself is part of the key, so a
// genuinely separate session logged the same day keeps its own, and so does a
// line whose note gets edited afterwards. The sensei is in the key too, because
// two of them logging the same course is two sessions.
const noteKey = (log) =>
  [log.program || '', log.sub_program || '', log.sensei_id ?? '', log.notes || ''].join('\u001f');

// Which lines open and close a group. Only ADJACENT lines are gathered: rows
// written by one submission arrive together (one transaction, one created_at),
// and anything that lands between them came from somewhere else and is not part
// of the same session.
function groupEdges(dayLogs) {
  const keys = dayLogs.map(noteKey);
  return new Map(dayLogs.map((log, i) => [log.id, {
    startsGroup: i === 0 || keys[i - 1] !== keys[i],
    endsGroup: i === dayLogs.length - 1 || keys[i + 1] !== keys[i],
  }]));
}

export default function ProgressHistory({ logs = [], enrolledPrograms, onLogUpdated, onLogDeleted }) {
  const { user, isReadOnly } = useAuth();
  const isManager = ['manager', 'admin'].includes(user?.role);

  const programs = [...new Set(logs.map((l) => l.program).filter(Boolean))];
  const multiProgram = programs.length > 1;
  const [filter, setFilter] = useState('');
  const [localComments, setLocalComments] = useState({});

  const [editingId, setEditingId] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [commentErrors, setCommentErrors] = useState({});
  const [reactionErrors, setReactionErrors] = useState({});
  const [replyingId, setReplyingId] = useState(null);

  // Optimistic, then corrected by the server's own count. A failure puts the
  // chips back rather than leaving a reaction that was never stored.
  const react = async (log, emoji) => {
    if (isReadOnly || !onLogUpdated) return;
    const before = log.reactions || [];
    onLogUpdated(log.id, { reactions: toggleLocally(before, emoji) });
    setReactionErrors((prev) => ({ ...prev, [log.id]: '' }));
    try {
      const { reactions } = await api.post(`/progress/${log.id}/reactions`, { emoji });
      onLogUpdated(log.id, { reactions });
    } catch (err) {
      onLogUpdated(log.id, { reactions: before });
      setReactionErrors((prev) => ({ ...prev, [log.id]: err.message || 'Could not save that reaction.' }));
    }
  };

  const visible = filter ? logs.filter((l) => l.program === filter) : logs;

  const handleCommentAdded = (logId, comment) => {
    setLocalComments((prev) => ({
      ...prev,
      [logId]: [...(prev[logId] || []), comment],
    }));
  };

  const startEdit = (log) => {
    setEditingId(log.id);
    setEditError('');
    setConfirmDeleteId(null);
  };

  // The payload's keys are the log's own columns, so the same object is both
  // what the server writes and what the row shows without waiting for a refetch.
  const saveEdit = async (logId, patch) => {
    if (!patch.notes) return;
    setSavingEdit(true);
    setEditError('');
    try {
      await api.patch(`/progress/${logId}`, patch);
      onLogUpdated && onLogUpdated(logId, patch);
      setEditingId(null);
    } catch (err) {
      setEditError(err.message || 'Failed to save. Try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (logId) => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/progress/${logId}`);
      onLogDeleted && onLogDeleted(logId);
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-ninja-muted font-ninja">
        No progress logs yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {multiProgram && (
        <div className="flex flex-wrap gap-2 pb-1">
          <button
            onClick={() => setFilter('')}
            className={`px-3 py-1 rounded-lg text-sm font-ninja font-semibold transition-colors ${
              filter === '' ? 'bg-ninja-blue text-white' : 'bg-ninja-bg border border-ninja-border text-ninja-navy hover:border-ninja-blue'
            }`}
          >
            All
          </button>
          {programs.map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`px-3 py-1 rounded-lg text-sm font-ninja font-semibold transition-colors ${
                filter === p ? 'bg-ninja-blue text-white' : 'bg-ninja-bg border border-ninja-border text-ninja-navy hover:border-ninja-blue'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 && (
        <div className="text-center py-6 text-ninja-muted font-ninja text-sm">No logs for this program yet.</div>
      )}

      {(() => {
        // Group logs by session_date. Keyed on the calendar day alone: a log
        // whose date was just edited carries a bare YYYY-MM-DD while the rest
        // arrived as timestamps, and the two would head their own days.
        const groups = visible.reduce((acc, log) => {
          const key = String(log.session_date || '').split('T')[0];
          if (!acc[key]) acc[key] = [];
          acc[key].push(log);
          return acc;
        }, {});
        const dates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

        return dates.map((date) => {
          const dayLogs = groups[date];
          // Resolve the name first, so a day logged entirely by a deleted account
          // still collapses to one header line instead of falling through to the
          // per-entry byline and printing nothing at all.
          const names = dayLogs.map((l) => authorName(l.sensei_name));
          const sharedSensei = names.every((n) => n === names[0]) ? names[0] : null;
          const edges = groupEdges(dayLogs);

          return (
            // No padding on the card itself: the entries own it, so an entry's
            // hover tint reaches the card's edges. Bleeding out of a padded
            // card with negative margins can't do that here — the history sits
            // in an overflow-y-auto box, which clips whatever hangs outside it.
            <div key={date} className="bg-ninja-bg border border-ninja-border rounded-xl">
              {/* Day header */}
              <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3">
                <span className="text-ninja-blue font-ninja font-semibold text-sm">{formatDate(date)}</span>
                {sharedSensei && <span className="text-ninja-muted text-sm font-ninja">by {sharedSensei}</span>}
              </div>

              {/* Individual log entries. The gap between them is the entries'
                  own padding rather than a margin, so the tint covers the whole
                  band an entry occupies rather than stopping at its text. */}
              <div className="pb-1">
                {dayLogs.map((log, i) => {
                  const allComments = [...(log.comments || []), ...(localComments[log.id] || [])];
                  const edge = edges.get(log.id);
                  const isEditing = editingId === log.id;
                  const isConfirmingDelete = confirmDeleteId === log.id;
                  const isReplying = replyingId === log.id;

                  const canEdit = !isReadOnly && (isManager || log.sensei_id === user?.id);

                  return (
                    // The tint runs the full width of the card, so a line
                    // lights up as one object under the pointer and it is the
                    // line the action strip belongs to. It is an alpha over
                    // whatever is behind it rather than a bg-* swap that the
                    // dark overrides would fight.
                    //
                    // The padding and the rule between entries follow the
                    // GROUP: lines of one session sit tight together with no
                    // rule, and the next session starts a new band.
                    <div
                      key={log.id}
                      className={`group px-4 ${edge.startsGroup ? 'pt-3' : 'pt-1.5'} ${edge.endsGroup ? 'pb-3' : 'pb-0'} rounded-lg transition-colors duration-150 hover:bg-ninja-navy/[0.04] dark:hover:bg-white/[0.05] ${
                        edge.startsGroup && i > 0 ? 'border-t border-ninja-border/60' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                        {/* Program and belt keep their badges: those are
                            identities the eye picks out, and the program colours
                            are pinned to the program. Everything that was merely
                            a word in a coloured box is a word again. */}
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
                          {/* The saved values step aside mid-edit: every one of
                              them is a field in the editor below, and two of
                              them on screen disagreeing reads as a bug. */}
                          {!isEditing && (
                            <>
                              {log.program && <ProgramBadge program={log.program} size="xs" />}
                              {log.belt_level_at && <BeltBadge belt={log.belt_level_at} sublevel={log.belt_sublevel_at} size="xs" />}
                              {log.project_at && (
                                <span className="font-ninja text-xs text-ninja-muted">{log.project_at}</span>
                              )}
                              {log.status_at && <StatusMark status={log.status_at} />}
                            </>
                          )}
                          {isEditing && (
                            <span className="font-ninja text-xs font-semibold text-ninja-blue">Editing</span>
                          )}
                          {!sharedSensei && (
                            <span className="text-ninja-muted text-xs font-ninja">by {authorName(log.sensei_name)}</span>
                          )}
                        </div>
                        {!isEditing && (!isReadOnly || canEdit) && (
                          // bg-white, not the default: this card is already
                          // ninja-bg, so a ninja-bg strip would vanish into it.
                          <RowActions surface="bg-white" className="self-center">
                            {!isReadOnly && (
                              <>
                                <ReactionPicker onPick={(emoji) => react(log, emoji)} />
                                <StripButton
                                  icon={ReplyIcon}
                                  label={isReplying ? 'Cancel reply' : 'Reply'}
                                  active={isReplying}
                                  onClick={() => setReplyingId(isReplying ? null : log.id)}
                                />
                              </>
                            )}
                            {canEdit && (
                              <ActionMenu
                                label="Log actions"
                                className={`flex-shrink-0 ${IN_STRIP_MENU}`}
                                onClosed={() => { setConfirmDeleteId(null); setDeleteError(''); }}
                              >
                                {({ close }) =>
                                  isConfirmingDelete ? (
                                    // The confirm keeps the word "Delete" while
                                    // everything around it is a glyph. Icons are
                                    // fine for reversible actions.
                                    <div className="p-1.5 w-48">
                                      <p className="font-ninja text-xs text-ninja-muted mb-2">Delete this log entry?</p>
                                      <div className="flex items-center gap-1.5">
                                        <Button variant="danger" size="sm" onClick={() => handleDelete(log.id)} disabled={deleting}>
                                          {deleting ? 'Deleting…' : 'Delete'}
                                        </Button>
                                        <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)}>Keep</Button>
                                      </div>
                                      {deleteError && <p className="text-ninja-red font-ninja text-xs mt-1.5">{deleteError}</p>}
                                    </div>
                                  ) : (
                                    <>
                                      <MenuItem icon={PencilIcon} onSelect={() => { startEdit(log); close(); }}>Edit</MenuItem>
                                      <MenuItem icon={TrashIcon} danger onSelect={() => { setConfirmDeleteId(log.id); setEditingId(null); }}>
                                        Delete
                                      </MenuItem>
                                    </>
                                  )
                                }
                              </ActionMenu>
                            )}
                          </RowActions>
                        )}
                      </div>

                      {!isEditing && <CurriculumPath log={log} />}

                      {isEditing ? (
                        <LogEditor
                          log={log}
                          programs={enrolledPrograms}
                          saving={savingEdit}
                          error={editError}
                          onSave={(patch) => saveEdit(log.id, patch)}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        // Once per session, under the last of its lines. An
                        // edit to one line's note takes it out of the group, so
                        // the two notes then stand apart, which is what having
                        // said different things about them means.
                        edge.endsGroup && log.notes && (
                          <MarkdownView className="text-ninja-navy font-ninja text-sm leading-relaxed">{log.notes}</MarkdownView>
                        )
                      )}

                      <ReactionChips
                        reactions={log.reactions}
                        canReact={!isReadOnly}
                        onToggle={(emoji) => react(log, emoji)}
                      />
                      {reactionErrors[log.id] && (
                        <p className="text-ninja-red font-ninja text-xs mt-1">{reactionErrors[log.id]}</p>
                      )}

                      {allComments.length > 0 && (
                        <div className="mt-3 space-y-1 border-t border-ninja-border pt-3">
                          {allComments.map((c) => <LogComment key={c.id} comment={c} />)}
                        </div>
                      )}
                      {!isReadOnly && isReplying && (
                        <CommentBox
                          logId={log.id}
                          onAdded={(c) => handleCommentAdded(log.id, c)}
                          onClose={() => setReplyingId(null)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
}
