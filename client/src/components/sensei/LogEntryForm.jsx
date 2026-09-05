import { useState } from 'react';
import { api } from '../../api/client';
import Toast from '../ui/Toast';
import { today, formatDate } from '../../utils/dateUtils';
import Button from '../ui/Button';
import LazyMarkdownEditor from '../shared/LazyMarkdownEditor';
import BeltProgressFields from './BeltProgressFields';
import { useCurriculum } from '../../context/CurriculumContext';
import { BELTS, STATUSES, UPPER_BELTS, createProjectOptions, getLevels } from '../../utils/beltConfig';
import { createEntryFromLog, lessonEntryFromLog, logPayload } from '../../lib/logDraft';

// `belt` and `sublevel` are this row's own scope, blank while it follows the
// belt and level chosen above the rows. A ninja who finished a level, or a
// whole belt, and carried on in the same class fills them in on the second
// project rather than needing a second check-in to record it.
const emptyCreateEntry = { project: '', status: '', isCustom: false, customProject: '', belt: '', sublevel: '' };
const emptyEntry = { subProgram: '', moduleName: '', lessonName: '', customModule: '', customLesson: '', status: '' };

// Stable row ids so React keys survive add/remove (index keys bleed row DOM state).
let _rowSeq = 0;
const rowUid = () => `row-${++_rowSeq}`;
const newLessonEntry = () => ({ ...emptyEntry, _uid: rowUid() });
const newCreateEntry = (init) => ({ ...emptyCreateEntry, ...init, _uid: rowUid() });

function getSectionLabel(index, total) {
  if (index === total - 1) return 'Adventure';
  const num = Math.floor(index / 2) + 1;
  return index % 2 === 0 ? `Build ${num}` : `Solve ${num}`;
}

const SCOPE_SELECT =
  'w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-3 py-1.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue transition-colors';

export function CreateProjectRow({ entry, index, total, beltLevel, beltSublevel, beltProjects, onChange, onRemove }) {
  // The belt and level this row is on. A row that has taken a belt of its own
  // does NOT inherit the session's level: level 3 of Brown means nothing on
  // Bronze, and inheriting it would file the project under a level the belt
  // does not have.
  const sessionSublevel = beltSublevel ? String(beltSublevel) : '';
  const rowBelt = entry.belt || beltLevel;
  const rowSublevel = entry.belt ? (entry.sublevel || '') : (entry.sublevel || sessionSublevel);

  const { options: projectOptions, needsSublevel, showLabels } =
    createProjectOptions({ beltLevel: rowBelt, beltSublevel: rowSublevel, beltProjects });

  // Black and the bonus tracks name their projects outright, so they get no
  // level step here for the same reason the session's own fields skip it.
  const scopeLevels = UPPER_BELTS.includes(rowBelt) ? [] : getLevels(rowBelt);
  // The first project is the session's own, described by the fields above it.
  // Added ones carry their own scope. A row that already has one keeps the
  // fields even if it becomes the first, so an override can never go silent.
  const showScope = index > 0 || !!(entry.belt || entry.sublevel);

  // Changing scope invalidates whatever project was under it.
  const setScope = (field, value) => {
    if (value === (field === 'belt' ? rowBelt : rowSublevel)) return;
    onChange(field, value);
    if (field === 'belt') onChange('sublevel', '');
    onChange('project', '');
    onChange('isCustom', false);
    onChange('customProject', '');
  };

  return (
    <div className="relative border border-ninja-border rounded-xl p-4 bg-ninja-bg space-y-3">
      {total > 1 && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide">
            Project {index + 1}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="text-ninja-muted hover:text-red-400 transition-colors text-sm leading-none"
            title="Remove this project"
          >
            ✕
          </button>
        </div>
      )}

      {showScope && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold mb-1 uppercase tracking-wide">
              Belt
            </label>
            <select value={rowBelt} onChange={(e) => setScope('belt', e.target.value)} className={SCOPE_SELECT}>
              {/* Clearing the override puts the row back on the session's own
                  belt, which is the way out of a wrong pick. */}
              <option value="">{beltLevel ? 'Same as above' : 'Select belt...'}</option>
              {BELTS.map((b) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          {scopeLevels.length > 0 && (
            <div>
              <label className="block text-ninja-muted text-xs font-ninja font-semibold mb-1 uppercase tracking-wide">
                Level
              </label>
              <select value={rowSublevel} onChange={(e) => setScope('sublevel', e.target.value)} className={SCOPE_SELECT}>
                <option value="">Select level...</option>
                {scopeLevels.map((lv) => (
                  <option key={lv} value={String(lv)}>Level {lv}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
          Project
        </label>
        {needsSublevel ? (
          <p className="text-ninja-muted font-ninja text-sm italic">Select a level above to see projects.</p>
        ) : entry.isCustom ? (
          <div className="space-y-1.5">
            <input
              type="text"
              value={entry.customProject}
              onChange={(e) => onChange('customProject', e.target.value)}
              placeholder="Project name..."
              className="w-full bg-white border border-ninja-blue text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none transition-colors"
              autoFocus
            />
            <button
              type="button"
              onClick={() => { onChange('isCustom', false); onChange('customProject', ''); }}
              className="text-ninja-muted hover:text-ninja-navy text-xs font-ninja underline"
            >
              ← Use standard project
            </button>
          </div>
        ) : (
          <select
            value={entry.project}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                onChange('isCustom', true);
                onChange('project', '');
              } else {
                onChange('project', e.target.value);
              }
            }}
            className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
          >
            <option value="">Select project...</option>
            {projectOptions.map((p, i) => {
              const label = showLabels ? `${getSectionLabel(i, projectOptions.length)}: ${p}` : p;
              return <option key={p} value={p}>{label}</option>;
            })}
            <option value="__custom__">Custom...</option>
          </select>
        )}
      </div>

      <div>
        <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
          Status
        </label>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange('status', entry.status === s ? '' : s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-ninja font-semibold transition-colors ${
                entry.status === s
                  ? s === 'Completed' ? 'bg-emerald-500 text-white' : 'bg-ninja-blue text-white'
                  : 'bg-white border border-ninja-border text-ninja-navy hover:border-ninja-blue'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LessonEntryRow({ entry, index, total, program, onChange, onRemove, subPrograms, curriculum: curriculumData }) {
  const subProgramOptions = subPrograms[program] || null;
  const curriculum = (entry.subProgram ? curriculumData[entry.subProgram] : curriculumData[program]) || [];
  const moduleOptions = curriculum;
  const isCustomModule = entry.moduleName === '__custom__';
  const lessonOptions = isCustomModule ? [] : (moduleOptions.find((m) => m.module === entry.moduleName)?.lessons || []);

  return (
    <div className="relative border border-ninja-border rounded-xl p-4 bg-ninja-bg space-y-3">
      {total > 1 && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide">
            Lesson {index + 1}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="text-ninja-muted hover:text-red-400 transition-colors text-sm leading-none"
            title="Remove this lesson"
          >
            ✕
          </button>
        </div>
      )}

      {subProgramOptions && (
        <div>
          <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
            Kit / Curriculum
          </label>
          <div className="flex flex-wrap gap-2">
            {subProgramOptions.map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => onChange('subProgram', sp)}
                className={`px-3 py-1.5 rounded-lg text-sm font-ninja font-semibold transition-colors ${
                  entry.subProgram === sp
                    ? 'bg-ninja-blue text-white'
                    : 'bg-white border border-ninja-border text-ninja-navy hover:border-ninja-blue'
                }`}
              >
                {sp}
              </button>
            ))}
          </div>
        </div>
      )}

      {(entry.subProgram || !subProgramOptions) && moduleOptions.length > 0 && !isCustomModule && (
        <div>
          <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
            Module
          </label>
          <select
            value={entry.moduleName}
            onChange={(e) => onChange('moduleName', e.target.value)}
            className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
          >
            <option value="">Select module...</option>
            {moduleOptions.map((m) => (
              <option key={m.module} value={m.module}>{m.module}</option>
            ))}
            <option value="__custom__">Custom...</option>
          </select>
        </div>
      )}

      {isCustomModule && (
        <div className="space-y-3">
          <div>
            <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
              Custom Module
            </label>
            <input
              type="text"
              value={entry.customModule}
              onChange={(e) => onChange('customModule', e.target.value)}
              placeholder="e.g., Special Project, Guest Session..."
              className="w-full bg-white border border-ninja-blue text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
              Custom Lesson
            </label>
            <input
              type="text"
              value={entry.customLesson}
              onChange={(e) => onChange('customLesson', e.target.value)}
              placeholder="e.g., Intro to Python, Robot Challenge..."
              className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange('moduleName', '')}
            className="text-ninja-muted hover:text-ninja-navy text-xs font-ninja underline"
          >
            ← Back to curriculum
          </button>
        </div>
      )}

      {entry.moduleName && !isCustomModule && lessonOptions.length > 0 && (
        <div>
          <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
            Lesson
          </label>
          <select
            value={entry.lessonName}
            onChange={(e) => onChange('lessonName', e.target.value)}
            className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
          >
            <option value="">Select lesson...</option>
            {lessonOptions.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      )}

      {(entry.lessonName || (isCustomModule && (entry.customModule || entry.customLesson))) && (
        <div>
          <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
            Status
          </label>
          <div className="flex flex-wrap gap-2">
            {['Started', 'Working On', 'Completed'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange('status', entry.status === s ? '' : s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-ninja font-semibold transition-colors ${
                  entry.status === s
                    ? s === 'Completed'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-ninja-blue text-white'
                    : 'bg-white border border-ninja-border text-ninja-navy hover:border-ninja-blue'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// `editLog` turns the form into an edit of that session: every field starts on
// what was saved, and submitting rewrites that log instead of adding a second
// one beside it. Without it the form is the blank new-session form it has
// always been.
export default function LogEntryForm({ student, program, enrollment, onLogged, onSaved, sessionDate: sessionDateProp, editLog }) {
  const { subPrograms, curriculum, beltProjects } = useCurriculum();
  const isEditing = !!editLog;

  // One place decides what every field starts on, so opening an edit and
  // switching programs can't drift apart.
  const seed = () => (editLog ? {
    notes: editLog.notes || '',
    beltLevel: editLog.belt_level_at || '',
    beltSublevel: editLog.belt_sublevel_at ? String(editLog.belt_sublevel_at) : '',
    createEntries: [newCreateEntry(createEntryFromLog(editLog, { beltProjects }))],
    lessonEntries: [{ ...lessonEntryFromLog(editLog, curriculum), _uid: rowUid() }],
  } : {
    notes: '',
    beltLevel: enrollment?.belt_level || '',
    beltSublevel: enrollment?.belt_sublevel || '',
    createEntries: [newCreateEntry({
      project: enrollment?.current_project || '',
      status: enrollment?.project_status || '',
    })],
    lessonEntries: [newLessonEntry()],
  });

  const [initial] = useState(seed);
  const [notes, setNotes] = useState(initial.notes);
  const [beltLevel, setBeltLevel] = useState(initial.beltLevel);
  const [beltSublevel, setBeltSublevel] = useState(initial.beltSublevel);
  const [createEntries, setCreateEntries] = useState(initial.createEntries);
  const [lessonEntries, setLessonEntries] = useState(initial.lessonEntries);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // The note editor takes its content when it mounts and never reads the prop
  // again, so clearing `notes` in state leaves the old words on screen: the
  // class you switched away from writing its notes into the one you switched
  // to, and a form that reads as filled in while it holds nothing. Bumping
  // this remounts the editor, which is the only way to hand it new content.
  const [notesKey, setNotesKey] = useState(0);
  const resetNotes = (value) => { setNotes(value); setNotesKey((n) => n + 1); };

  const isCreate = program === 'CREATE';
  // An edit stays on the day it was logged; only a new session takes the
  // pending check-in's date.
  const sessionDate = isEditing
    ? String(editLog.session_date || '').split('T')[0]
    : (sessionDateProp || today());
  const hasLessonFields = !!(subPrograms[program] || curriculum[program]?.length);

  // Switching class, or switching which log is being edited, starts over.
  //
  // During render rather than in an effect, so no frame is ever painted with a
  // half-swapped form. Handing the note editor its new content takes more than
  // a changed prop, which is what resetNotes is for. Guarded by what is being
  // logged, so nothing clobbers what is being typed.
  const seedKey = `${program}:${editLog?.id ?? 'new'}`;
  const [seeded, setSeeded] = useState(seedKey);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    const next = seed();
    // A different class is a different note. Switching program starts one
    // afresh rather than carrying the last one across.
    resetNotes(next.notes);
    setBeltLevel(next.beltLevel);
    setBeltSublevel(next.beltSublevel);
    setCreateEntries(next.createEntries);
    setLessonEntries(next.lessonEntries);
    // A leftover success banner from the previous program would hide this form
    setSuccess(false);
    setError('');
  }

  const updateEntry = (index, field, value) => {
    setLessonEntries((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const updated = { ...e, [field]: value };
        if (field === 'subProgram') { updated.moduleName = ''; updated.lessonName = ''; updated.customModule = ''; updated.customLesson = ''; }
        if (field === 'moduleName') { updated.lessonName = ''; updated.customModule = ''; updated.customLesson = ''; }
        return updated;
      })
    );
  };

  const addEntry = () => setLessonEntries((prev) => [...prev, newLessonEntry()]);
  const removeEntry = (index) => setLessonEntries((prev) => prev.filter((_, i) => i !== index));

  const updateCreateEntry = (index, field, value) => {
    setCreateEntries((prev) => prev.map((e, i) => i !== index ? e : { ...e, [field]: value }));
  };
  const addCreateEntry = () => setCreateEntries((prev) => [...prev, newCreateEntry()]);
  const removeCreateEntry = (index) => setCreateEntries((prev) => prev.filter((_, i) => i !== index));

  // Changing the session's belt or level resets the rows, overrides included:
  // a second project scoped to the belt they were on is not the one they are on
  // now, and leaving it behind would attach it to a session it never belonged to.
  const handleBeltClearProjects = () => {
    setCreateEntries((prev) => prev.map((e) => ({ ...e, project: '', isCustom: false, customProject: '', belt: '', sublevel: '' })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError('Notes are required');
      return;
    }
    if (isCreate && !beltLevel) {
      setError('Belt level is required for CREATE logs');
      return;
    }
    if (loading) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Editing rewrites the session in place — the point of coming back to it
      // is that the old project or status was wrong, not that another one
      // happened. Multi-entry rows are hidden in this mode for the same reason:
      // one form, one log.
      if (isEditing) {
        const patch = logPayload({
          program,
          sessionDate,
          notes,
          beltLevel,
          beltSublevel,
          entry: isCreate ? createEntries[0] : lessonEntries[0],
        });
        await api.patch(`/progress/${editLog.id}`, patch);
        setSuccess(true);
        onSaved && onSaved(editLog.id, patch);
        return;
      }

      let payload;

      if (isCreate) {
        const filledCreateEntries = createEntries
          .filter((e) => e.isCustom ? e.customProject : e.project)
          .map((e) => {
            // Each project is written at the belt and level it was worked on,
            // so a session that crossed either boundary reads back as what
            // happened instead of all of it being filed under one snapshot.
            const belt = e.belt || beltLevel;
            const sub = e.belt ? e.sublevel : (e.sublevel || beltSublevel);
            return {
              project_at: e.isCustom ? (e.customProject || null) : (e.project || null),
              status: e.status || null,
              belt_level_at: belt || null,
              belt_sublevel_at: sub ? parseInt(sub) : null,
            };
          });
        const lastCE = filledCreateEntries[filledCreateEntries.length - 1];

        payload = {
          student_id: student.id,
          program,
          session_date: sessionDate,
          notes: notes.trim(),
          // Where the ninja is left standing, which is the last project written:
          // the same rule the project and status already follow, so the belt,
          // the level and the project cannot disagree about where they got to.
          belt_level_at: lastCE ? lastCE.belt_level_at : (beltLevel || null),
          belt_sublevel_at: lastCE ? lastCE.belt_sublevel_at : (beltSublevel ? parseInt(beltSublevel) : null),
          project_at: lastCE?.project_at || null,
          status_at: lastCE?.status || null,
          update_student: true,
          ...(filledCreateEntries.length > 1 ? { lesson_entries: filledCreateEntries } : {}),
        };
      } else {
        const filledEntries = lessonEntries
          .filter((e) => {
            if (e.moduleName === '__custom__') return e.customModule || e.customLesson;
            return e.moduleName || e.subProgram || e.lessonName;
          })
          .map((e) => ({
            sub_program: e.subProgram || null,
            module_name: e.moduleName === '__custom__' ? (e.customModule || null) : (e.moduleName || null),
            lesson_name: e.moduleName === '__custom__' ? (e.customLesson || null) : (e.lessonName || null),
            status: e.status || null,
          }));

        payload = {
          student_id: student.id,
          program,
          session_date: sessionDate,
          notes: notes.trim(),
          belt_level_at: null,
          belt_sublevel_at: null,
          project_at: null,
          status_at: filledEntries.length <= 1 ? (filledEntries[0]?.status || null) : null,
          update_student: true,
          ...(filledEntries.length > 1
            ? { lesson_entries: filledEntries }
            : {
                sub_program: filledEntries[0]?.sub_program || null,
                module_name: filledEntries[0]?.module_name || null,
                lesson_name: filledEntries[0]?.lesson_name || null,
              }),
        };
      }

      const log = await api.post('/progress', payload);
      setSuccess(true);
      resetNotes('');
      setLessonEntries([newLessonEntry()]);
      setCreateEntries([newCreateEntry()]);
      onLogged && onLogged(log);
    } catch (err) {
      setError(err.message || 'Failed to save log');
    } finally {
      setLoading(false);
    }
  };

  const filledCreateCount = isCreate
    ? createEntries.filter((e) => e.isCustom ? e.customProject : e.project).length
    : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Same treatment as the confirmation, for the same reason: a banner
          above the form pushes the fields down to tell you about one of them,
          and "Notes are required" is about a box you are already looking at. */}
      <Toast message={error} show={Boolean(error)} variant="error" onDone={() => setError('')} />
      {/* The form stays put and the confirmation arrives from the bottom.
          Swapping the form for a green banner made the thing you had just
          finished disappear in order to tell you it had worked, and then asked
          you to press a button to get it back. The fields are already cleared
          for the next one. */}
      <Toast
        message={isEditing ? 'Session updated.' : 'Progress logged'}
        show={success}
        onDone={() => setSuccess(false)}
      />

      <>

      <div>
        <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
          Session Date
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={formatDate(sessionDate)}
            readOnly
            className="flex-1 bg-ninja-bg border border-ninja-border text-ninja-muted rounded-lg px-4 py-2 font-ninja cursor-not-allowed"
          />
          {sessionDate !== today() && (
            <span className="text-xs font-ninja text-ninja-blue bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg whitespace-nowrap">
              Check-in date
            </span>
          )}
        </div>
      </div>

      {/* Multi-lesson entries for non-CREATE programs */}
      {!isCreate && hasLessonFields && (
        <div className="space-y-3">
          {lessonEntries.map((entry, i) => (
            <LessonEntryRow
              key={entry._uid}
              entry={entry}
              index={i}
              total={lessonEntries.length}
              program={program}
              onChange={(field, value) => updateEntry(i, field, value)}
              onRemove={() => removeEntry(i)}
              subPrograms={subPrograms}
              curriculum={curriculum}
            />
          ))}
          {!isEditing && (
            <button
              type="button"
              onClick={addEntry}
              className="w-full py-2 rounded-xl border-2 border-dashed border-ninja-border text-ninja-muted hover:border-ninja-blue hover:text-ninja-blue font-ninja font-semibold text-sm transition-colors"
            >
              + Add Another Lesson
            </button>
          )}
        </div>
      )}

      <div>
        <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
          Session Notes *
        </label>
        <LazyMarkdownEditor
          key={notesKey}
          value={notes}
          onChange={setNotes}
          placeholder="What did the ninja work on today? Any breakthroughs or challenges?"
        />
      </div>

      {isCreate && (
        <div className="space-y-4 border-t border-ninja-border pt-4">
          <p className="text-ninja-muted font-ninja text-sm italic">Belt & project snapshot for this session:</p>

          <BeltProgressFields
            beltLevel={beltLevel}
            setBeltLevel={setBeltLevel}
            beltSublevel={beltSublevel}
            setBeltSublevel={setBeltSublevel}
            setProject={handleBeltClearProjects}
          />

          <div className="space-y-3">
            {createEntries.map((entry, i) => (
              <CreateProjectRow
                key={entry._uid}
                entry={entry}
                index={i}
                total={createEntries.length}
                beltLevel={beltLevel}
                beltSublevel={beltSublevel}
                beltProjects={beltProjects}
                onChange={(field, value) => updateCreateEntry(i, field, value)}
                onRemove={() => removeCreateEntry(i)}
              />
            ))}
            {!isEditing && (
              <button
                type="button"
                onClick={addCreateEntry}
                className="w-full py-2 rounded-xl border-2 border-dashed border-ninja-border text-ninja-muted hover:border-ninja-blue hover:text-ninja-blue font-ninja font-semibold text-sm transition-colors"
              >
                + Add Another Project
              </button>
            )}
          </div>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Saving...' : isEditing
          ? 'Save Changes'
          : filledCreateCount > 1
          ? `Log ${filledCreateCount} Projects`
          : lessonEntries.length > 1
          ? `Log ${lessonEntries.length} Lessons`
          : 'Log Progress'}
      </Button>

      </>
    </form>
  );
}
