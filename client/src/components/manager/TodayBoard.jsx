import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { today } from '../../utils/dateUtils';
import { CheckIcon, PencilIcon } from 'lucide-react';
import { ProgramAvatar } from '../ui/ProgramBadge';
import ActionMenu, { MenuItem } from '../ui/ActionMenu';
import { isBirthdayToday } from '../shared/BirthdayConfetti';
import { MARKDOWN_COMPONENTS, Pin } from '../shared/PinnedNote';

// Sticky-note marker that reveals the ninja's pinned note on hover or click.
// Filled amber square with a folded corner + text lines — reads as "note" at a
// glance without a pill around it.
function StickyNoteIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8.5L14.5 20H6a2 2 0 0 1-2-2V5z"
        fill="currentColor"
      />
      <path d="M20 13.5L14.5 20v-4.5a2 2 0 0 1 2-2H20z" fill="#00000022" />
      <path d="M8 8.5h8M8 12h5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

const POPOVER_WIDTH = 256; // matches w-64

function PinnedNotePill({ note, parentNote }) {
  const hasNote = Boolean(note && note.trim());
  const hasParent = Boolean(parentNote && parentNote.trim());
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const closeTimer = useRef(null);

  // Position a viewport-fixed popover clamped inside the window, so it never
  // clips off the left or right edge regardless of which column the card is in.
  // (The dashboard cards use framer transforms, which would otherwise trap an
  // absolutely-positioned popover and let overflow clip it.)
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 8;
    const maxLeft = window.innerWidth - POPOVER_WIDTH - margin;
    const left = Math.min(Math.max(r.left, margin), Math.max(margin, maxLeft));
    setCoords({ top: r.bottom + 6, left });
  };

  const show = () => { clearTimeout(closeTimer.current); place(); setOpen(true); };
  const hide = () => { closeTimer.current = setTimeout(() => setOpen(false), 80); };

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={btnRef}
        type="button"
        aria-label="Pinned note"
        title="Pinned note"
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : show(); }}
        className="inline-flex items-center justify-center p-0.5 text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 hover:scale-110 transition-all"
      >
        <StickyNoteIcon className="w-5 h-5 -rotate-6 drop-shadow-sm" />
      </button>
      {open && createPortal(
        <div
          onMouseEnter={show}
          onMouseLeave={hide}
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: POPOVER_WIDTH, maxWidth: 'calc(100vw - 16px)' }}
          className="z-50 rounded-xl bg-white border border-ninja-border shadow-lg p-3 text-left cursor-default"
        >
          <div className="max-h-64 overflow-y-auto no-scrollbar">
            {hasNote && (
              <>
                <div className="flex items-center gap-1.5 text-amber-700 mb-1.5">
                  <Pin className="w-3 h-3 -rotate-12" />
                  <span className="font-ninja font-bold text-[11px] uppercase tracking-wide">Pinned note</span>
                </div>
                <div className="font-ninja text-sm leading-relaxed text-ninja-navy break-words">
                  <ReactMarkdown
                    components={MARKDOWN_COMPONENTS}
                    urlTransform={(url) => (/^(https?:|mailto:)/i.test(url) ? url : '')}
                  >
                    {note}
                  </ReactMarkdown>
                </div>
              </>
            )}
            {hasParent && (
              <div className={hasNote ? 'mt-3 pt-3 border-t border-ninja-border' : ''}>
                <span className="font-ninja font-bold text-[11px] uppercase tracking-wide text-ninja-muted block mb-1">Note from parent</span>
                <div className="font-ninja text-sm leading-relaxed text-ninja-navy break-words">
                  <ReactMarkdown
                    components={MARKDOWN_COMPONENTS}
                    urlTransform={(url) => (/^(https?:|mailto:)/i.test(url) ? url : '')}
                  >
                    {parentNote}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </span>
  );
}

// The card's class icon is the way to change the class, for anyone who can log
// (senseis included), so a check-in filed under the wrong class can be put
// right from the board. A pencil shows on hover so the icon reads as editable.
// Only unlogged check-ins move: a logged one's class belongs to its log.
function ClassPicker({ group, onChange, children }) {
  const { isReadOnly } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = group.assignments.filter((a) => !a.completed);
  const enrolled = group.assignments[0].enrolled_programs || [];
  const nothingToChange = enrolled.length === 1 && pending.every((a) => a.program === enrolled[0]);
  if (isReadOnly || !onChange || pending.length === 0 || enrolled.length === 0 || nothingToChange) return children;

  const pick = async (assignment, program, close) => {
    if (assignment.program === program) { close(); return; }
    setSaving(true);
    setError('');
    try {
      const updated = await api.patch(`/daily/${assignment.id}/program`, { program });
      onChange(updated);
      close();
    } catch (err) {
      setError(err.message || 'Could not change the class');
    } finally {
      setSaving(false);
    }
  };

  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <ActionMenu
        label="Change class"
        align="left"
        onClosed={() => setError('')}
        triggerClassName="group/class relative block rounded-full transition-transform duration-150 hover:scale-105"
        trigger={
          <>
            {children}
            <span
              aria-hidden
              className="absolute -top-1 -left-1 flex items-center justify-center w-5 h-5 rounded-full bg-white border border-ninja-border text-ninja-navy shadow-sm opacity-0 scale-75 transition-all duration-150 group-hover/class:opacity-100 group-hover/class:scale-100"
            >
              <PencilIcon size={11} strokeWidth={2.25} />
            </span>
          </>
        }
      >
        {({ close }) => (
          <div className="min-w-[12rem]">
            {pending.map((a, idx) => (
              <div key={a.id}>
                {pending.length > 1 && (
                  <p className="px-2.5 pt-1.5 pb-0.5 font-ninja text-[11px] font-bold uppercase tracking-wide text-ninja-muted">
                    Class {idx + 1}
                  </p>
                )}
                {enrolled.map((program) => (
                  <MenuItem key={program} disabled={saving} onSelect={() => pick(a, program, close)}>
                    <ProgramAvatar program={program} belt={program === 'CREATE' ? a.belt_level || group.assignments.find((x) => x.program === 'CREATE')?.belt_level : null} size="xs" />
                    <span className="flex-1">{program}</span>
                    {a.program === program && <CheckIcon size={15} strokeWidth={2.25} className="text-ninja-blue" aria-label="Current class" />}
                  </MenuItem>
                ))}
              </div>
            ))}
            {error && <p className="px-2.5 py-1.5 font-ninja text-xs text-ninja-red">{error}</p>}
          </div>
        )}
      </ActionMenu>
    </span>
  );
}

function buildLogUrl(group) {
  // A generic (no-class) check-in has no program — let the sensei pick any
  // enrolled class on the log page (no programs filter passed).
  if (group.assignments.some((a) => !a.program)) {
    return `/sensei/student/${group.student_id}`;
  }
  // Dates and counts describe what is still to be logged, so completed
  // assignments are left out of the tally.
  const programInfo = {};
  group.assignments.forEach((a) => {
    if (a.completed) return;
    const d = a.session_date ? String(a.session_date).split('T')[0] : null;
    if (!programInfo[a.program]) programInfo[a.program] = { date: d, count: 0 };
    programInfo[a.program].count++;
  });
  const uniquePrograms = [...new Set(group.assignments.map((a) => a.program))];
  // A class counts as done only when every one of its assignments is logged.
  const fullDone = uniquePrograms.filter((p) =>
    group.assignments.every((a) => a.program !== p || a.completed)
  );
  const datesStr = Object.entries(programInfo).map(([p, { date }]) => `${p}:${date}`).join(',');
  const countsStr = Object.entries(programInfo).map(([p, { count }]) => `${p}:${count}`).join(',');
  return (
    `/sensei/student/${group.student_id}` +
    `?programs=${encodeURIComponent(uniquePrograms.join(','))}` +
    `${fullDone.length > 0 ? `&done=${encodeURIComponent(fullDone.join(','))}` : ''}` +
    `&dates=${encodeURIComponent(datesStr)}` +
    `&counts=${encodeURIComponent(countsStr)}`
  );
}

// `canRemove` is off for senseis: DELETE /daily/:id is requireManager, so the
// × would only ever return a 403. `emptyHint` follows from that — the sensei
// board has no check-in button to point at.
export default function TodayBoard({
  assignments,
  onRemove,
  statusFilter = 'unlogged',
  canRemove = true,
  onUpdate,
  emptyHint = 'Use the "+ Check In Ninja" button to get started.',
}) {
  const { isReadOnly } = useAuth();
  const showRemove = canRemove && !isReadOnly;
  const navigate = useNavigate();
  const [confirmId, setConfirmId] = useState(null);
  const todayStr = today();

  const handleRemove = async (id) => {
    try {
      await api.delete(`/daily/${id}`);
    } catch (err) {
      if (!err.message?.toLowerCase().includes('not found')) {
        console.error('Failed to remove:', err);
        setConfirmId(null);
        return;
      }
    }
    onRemove && onRemove(id);
    setConfirmId(null);
  };

  if (assignments.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-16 text-ninja-muted font-ninja"
      >
        <img src="/CodeNinjasLaptop.webp" alt="Code Ninjas" width="384" height="320" className="h-28 w-auto mx-auto mb-4 opacity-80" />
        <p className="text-lg font-semibold text-ninja-navy">No ninjas added for today yet.</p>
        <p className="text-sm mt-1">{emptyHint}</p>
      </motion.div>
    );
  }

  const completedCount = assignments.filter((a) => a.completed).length;

  // Pick the base set per status filter, then group by student_id (one card each).
  const isPast = (a) => a.session_date && String(a.session_date).split('T')[0] < todayStr;
  const base =
    statusFilter === 'logged'  ? assignments.filter((a) => a.completed)
    : statusFilter === 'all'     ? assignments
    : statusFilter === 'overdue' ? assignments.filter((a) => !a.completed && isPast(a))
    : statusFilter === 'pending' ? assignments.filter((a) => !a.completed && !isPast(a))
    : assignments.filter((a) => !a.completed); // 'unlogged' (default)

  const groupedMap = base.reduce((acc, a) => {
    if (!acc[a.student_id]) acc[a.student_id] = { ...a, assignments: [] };
    acc[a.student_id].assignments.push(a);
    return acc;
  }, {});

  const groups = Object.values(groupedMap).sort((a, b) => {
    const aOver = a.assignments.some((x) => !x.completed && x.session_date && String(x.session_date).split('T')[0] < todayStr);
    const bOver = b.assignments.some((x) => !x.completed && x.session_date && String(x.session_date).split('T')[0] < todayStr);
    if (aOver === bOver) return 0;
    return aOver ? -1 : 1;
  });

  if (groups.length === 0) {
    const celebratory = statusFilter === 'unlogged' || statusFilter === 'pending';
    const msg = celebratory
      ? 'All ninjas logged!'
      : statusFilter === 'logged' ? 'Nothing logged yet.'
      : statusFilter === 'overdue' ? 'Nothing overdue 🎉'
      : 'No classes to show.';
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-16 font-ninja"
      >
        <img src="/CodeNinjasCelebrate.webp" alt="" width="581" height="694" className="h-28 w-auto mx-auto mb-4" />
        <p className="text-xl font-bold text-ninja-navy">{msg}</p>
        {celebratory && <p className="text-sm mt-1 text-ninja-muted">Great session today.</p>}
      </motion.div>
    );
  }

  return (
    <>
      {/* ── Mobile layout ── */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 font-ninja text-sm text-ninja-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
              Pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
              Overdue
            </span>
          </div>
          <span className="font-ninja font-bold text-sm text-ninja-navy">
            {completedCount} / {assignments.length} logged
          </span>
        </div>

        <div className="space-y-3">
          {groups.map((group, i) => {
            const allDone = group.assignments.every((a) => a.completed);
            const isOverdue = group.assignments.some(
              (a) => !a.completed && a.session_date && String(a.session_date).split('T')[0] < todayStr
            );
            const borderClass = allDone ? 'border-green-500' : isOverdue ? 'border-red-500' : 'border-yellow-400';
            const sessionCount = group.assignments.length;
            const uniquePrograms = [...new Set(group.assignments.map((a) => a.program))];
            const realPrograms = uniquePrograms.filter(Boolean);
            const primaryProgram = realPrograms[0] || null;
            const beltFor = (p) => group.assignments.find((a) => a.program === p)?.belt_level || null;
            const removeId = group.assignments[0].id;

            return (
              <motion.div
                key={group.student_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25, ease: 'easeOut' }}
                className={`relative has-[[aria-expanded=true]]:z-30 bg-white border-2 ${borderClass} rounded-2xl p-4 cursor-pointer`}
                onClick={() => navigate(`/manager/students/${group.student_id}`)}
              >
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <ClassPicker group={group} onChange={onUpdate}>
                        <ProgramAvatar
                          program={primaryProgram}
                          belt={beltFor(primaryProgram)}
                          items={realPrograms.map((p) => ({ program: p, belt: beltFor(p) }))}
                          size="md"
                        />
                      </ClassPicker>
                      {sessionCount > 1 && (
                        <span
                          title={`${sessionCount} sessions today`}
                          className="absolute -bottom-1 -right-1 text-[10px] font-ninja font-bold px-1.5 py-0.5 rounded-full bg-white text-ninja-navy border border-ninja-border leading-none"
                        >
                          ×{sessionCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-ninja-navy font-ninja font-bold text-lg leading-tight">
                      {group.student_name}{isBirthdayToday(group.birthday) && <span className="ml-1.5">🎂</span>}
                    </span>
                    {((group.pinned_note && group.pinned_note.trim()) || (group.special_instructions && group.special_instructions.trim())) && (
                      <PinnedNotePill note={group.pinned_note} parentNote={group.special_instructions} />
                    )}
                    {isOverdue && (
                      <span className="text-xs font-ninja font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-ninja-border">
                        Overdue
                      </span>
                    )}
                    {allDone && (
                      <span className="text-xs font-ninja font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-ninja-border">
                        Logged ✓
                      </span>
                    )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    {showRemove && (
                      confirmId === group.student_id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleRemove(removeId)}
                            className="text-xs font-ninja font-semibold text-white bg-red-500 px-2 py-0.5 rounded-lg"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="text-xs font-ninja font-semibold text-ninja-muted bg-ninja-bg border border-ninja-border px-2 py-0.5 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmId(group.student_id); }}
                          className="text-ninja-muted hover:text-red-400 transition-colors text-sm leading-none"
                          title="Remove from board"
                        >
                          ✕
                        </button>
                      )
                    )}
                  </div>
                </div>
                {group.assignments[0].sensei_name && (
                  <p className="text-ninja-muted font-ninja text-xs mt-1">
                    Sensei: {group.assignments[0].sensei_name}
                  </p>
                )}
                {/* A logged ninja still needs a way back into what was written —
                    the same door they went in by, since that page now carries
                    the session's own logs. The board was a dead end for it. */}
                {!isReadOnly && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(buildLogUrl(group)); }}
                    className="mt-3 w-full text-sm font-ninja font-bold text-ninja-blue border-2 border-ninja-blue rounded-xl py-2 hover:bg-ninja-blue hover:text-white transition-colors"
                  >
                    {allDone ? 'Edit Log' : 'Log Progress'}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Tablet + Desktop layout (sm+) ── */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group, i) => {
          const allDone = group.assignments.every((a) => a.completed);
          const isOverdue = group.assignments.some(
            (a) => !a.completed && a.session_date && String(a.session_date).split('T')[0] < todayStr
          );
          const borderClass = allDone ? 'border-green-500' : isOverdue ? 'border-red-500' : 'border-yellow-400';
          const sessionCount = group.assignments.length;
          const uniquePrograms = [...new Set(group.assignments.map((a) => a.program))];
          const realPrograms = uniquePrograms.filter(Boolean);
          const primaryProgram = realPrograms[0] || null;
          const beltFor = (p) => group.assignments.find((a) => a.program === p)?.belt_level || null;
          const removeId = group.assignments[0].id;

          return (
            <motion.div
              key={group.student_id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.28, ease: 'easeOut' }}
              className={`relative has-[[aria-expanded=true]]:z-30 bg-white border-2 ${borderClass} rounded-2xl p-4 shadow-sm flex flex-col gap-3`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <ClassPicker group={group} onChange={onUpdate}>
                      <ProgramAvatar
                        program={primaryProgram}
                        belt={beltFor(primaryProgram)}
                        items={realPrograms.map((p) => ({ program: p, belt: beltFor(p) }))}
                        size="md"
                      />
                    </ClassPicker>
                    {sessionCount > 1 && (
                      <span
                        title={`${sessionCount} sessions today`}
                        className="absolute -bottom-1 -right-1 text-[10px] font-ninja font-bold px-1.5 py-0.5 rounded-full bg-white text-ninja-navy border border-ninja-border leading-none"
                      >
                        ×{sessionCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <button
                    onClick={() => navigate(`/manager/students/${group.student_id}`)}
                    className="text-ninja-navy font-ninja font-bold text-lg leading-tight hover:text-ninja-blue transition-colors text-left"
                  >
                    {group.student_name}{isBirthdayToday(group.birthday) && <span className="ml-1.5">🎂</span>}
                  </button>
                  {((group.pinned_note && group.pinned_note.trim()) || (group.special_instructions && group.special_instructions.trim())) && (
                    <PinnedNotePill note={group.pinned_note} parentNote={group.special_instructions} />
                  )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                  {showRemove && (
                    confirmId === group.student_id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRemove(removeId)}
                          className="text-xs font-ninja font-semibold text-white bg-red-500 px-2 py-0.5 rounded-lg"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs font-ninja font-semibold text-ninja-muted bg-ninja-bg border border-ninja-border px-2 py-0.5 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(group.student_id)}
                        className="text-ninja-muted hover:text-red-400 transition-colors text-sm leading-none"
                      >
                        ✕
                      </button>
                    )
                  )}
                </div>
              </div>
              {allDone ? (
                <p className="text-green-600 font-ninja font-semibold text-xs">Logged ✓</p>
              ) : isOverdue ? (
                <p className="text-red-600 font-ninja font-semibold text-xs">Overdue</p>
              ) : (
                <p className="text-yellow-700 font-ninja font-semibold text-xs">Not logged yet</p>
              )}
              {!isReadOnly && (
                <button
                  onClick={() => navigate(buildLogUrl(group))}
                  className="mt-auto w-full text-sm font-ninja font-bold text-ninja-blue border-2 border-ninja-blue rounded-xl py-2 hover:bg-ninja-blue hover:text-white transition-colors"
                >
                  {allDone ? 'Edit Log' : 'Log Progress'}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
