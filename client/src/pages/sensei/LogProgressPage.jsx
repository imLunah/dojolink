import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../../components/layout/Layout';
import BeltBadge from '../../components/ui/BeltBadge';
import Card from '../../components/ui/Card';
import LogEntryForm from '../../components/sensei/LogEntryForm';
import ProgressHistory from '../../components/shared/ProgressHistory';
import PinnedNote from '../../components/shared/PinnedNote';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import BirthdayConfetti, { isBirthdayToday } from '../../components/shared/BirthdayConfetti';
import { formatDate } from '../../utils/dateUtils';
import { PROGRAM_LOGOS } from '../../utils/beltConfig';
import { SkeletonProfile } from '../../components/ui/Skeleton';

export default function LogProgressPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isReadOnly } = useAuth();
  const dashboardPath = ['manager', 'admin'].includes(user?.role) ? '/manager/dashboard' : '/sensei/dashboard';
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');

  // ?program=X pre-selects a single program; ?programs=X,Y lists programs available today
  // ?done=X,Y lists programs already fully logged; ?dates=P:YYYY-MM-DD,...; ?counts=P:N,...
  const singleProgramParam = searchParams.get('program');
  const programsParam = searchParams.get('programs');
  const doneParam = searchParams.get('done');
  const datesParam = searchParams.get('dates');
  const countsParam = searchParams.get('counts');
  const todayPrograms = programsParam ? programsParam.split(',') : null;

  // Programs logged during this visit, and how many sessions each.
  const [loggedHere, setLoggedHere] = useState({});
  // Set to a program name when the sensei asks for a second session on a class
  // that is already logged, instead of the edit the page opens on.
  const [logAnotherFor, setLogAnotherFor] = useState(null);
  // Logged before we got here, kept apart from what gets logged during the
  // visit: arriving on a logged class means the sensei came back to fix it,
  // while one written here is a fresh session that should stand as it is.
  const loggedOnArrival = new Set(doneParam ? doneParam.split(',') : []);
  const donePrograms = new Set([...loggedOnArrival, ...Object.keys(loggedHere)]);

  // Parse per-program session date and pending count from URL (set by dashboard)
  const programDates = datesParam
    ? Object.fromEntries(datesParam.split(',').map(s => { const i = s.lastIndexOf(':'); return [s.slice(0, i), s.slice(i + 1)]; }))
    : {};
  const programCounts = countsParam
    ? Object.fromEntries(countsParam.split(',').map(s => { const i = s.lastIndexOf(':'); return [s.slice(0, i), parseInt(s.slice(i + 1))]; }))
    : {};

  // Sessions still waiting on a program, after the ones logged in this visit.
  // `counts` only ever carries the check-ins that were still open when the
  // board built the link, so a class logged before we arrived is not in it.
  const remainingFor = (p, logged) => Math.max((programCounts[p] || 0) - (logged[p] || 0), 0);
  const pendingCount = (p) => remainingFor(p, loggedHere);
  // Every check-in this ninja still owes today, across all their classes.
  const outstanding = (logged) =>
    Object.keys(programCounts).reduce((n, p) => n + remainingFor(p, logged), 0);
  // The board's date is the OLDEST pending check-in for that program, so it is
  // spent once we log it — after that the refetched student carries the next one.
  const sessionDateFor = (p) =>
    (loggedHere[p] ? null : programDates[p]) || student?.pending_checkin_date || undefined;

  useEffect(() => {
    api.get(`/students/${id}`)
      .then((data) => {
        setStudent(data);
        if (singleProgramParam) {
          setSelectedProgram(singleProgramParam);
        } else if (todayPrograms) {
          const available = (data.programs || []).filter((p) => todayPrograms.includes(p.program));
          // Auto-select the first un-done program, or just the only program
          const pending = available.filter((p) => !donePrograms.has(p.program));
          if (pending.length === 1) setSelectedProgram(pending[0].program);
          else if (available.length === 1) setSelectedProgram(available[0].program);
        } else if (data.programs?.length === 1) {
          setSelectedProgram(data.programs[0].program);
        }
      })
      .catch(() => setError('Failed to load ninja'))
      .finally(() => setLoading(false));
  }, [id]);

  // A written session sends the sensei back to Today's Board, but only once the
  // ninja has nothing left owing. A kid booked into two classes, or carrying a
  // make-up session, gets logged in one sitting: bouncing out between them
  // means finding the same card again to finish the job. The board is the
  // receipt when we do leave, since the card drops out of the default unlogged
  // view and the counter moves. Editing an existing session never navigates,
  // because a correction is not a step forward.
  const handleLogged = () => {
    const program = selectedProgram;
    const logged = { ...loggedHere, [program]: (loggedHere[program] || 0) + 1 };
    setLoggedHere(logged);
    // The extra session is written; the page goes back to editing the latest.
    setLogAnotherFor(null);

    if (outstanding(logged) === 0) {
      navigate(dashboardPath);
      return;
    }

    // Refresh belt / project / last lesson so the header reflects what was just logged
    api.get(`/students/${id}`).then(setStudent).catch(() => {});
    // That class is finished, so the form moves itself to the one that is not.
    // Leaving it parked on a class with nothing left to write is how the second
    // check-in gets missed.
    if (remainingFor(program, logged) === 0) {
      const next = (todayPrograms || []).find((p) => p !== program && remainingFor(p, logged) > 0);
      if (next) setSelectedProgram(next);
    }
  };

  const handleLogUpdated = (logId, patch) =>
    setStudent((prev) => ({
      ...prev,
      progress_logs: (prev.progress_logs || []).map((l) => (l.id === logId ? { ...l, ...patch } : l)),
    }));

  const handleLogDeleted = (logId) =>
    setStudent((prev) => ({
      ...prev,
      progress_logs: (prev.progress_logs || []).filter((l) => l.id !== logId),
    }));

  const handleSavedEdit = (logId, patch) => {
    handleLogUpdated(logId, patch);
    // The belt and project in the header come off the enrollment, which the
    // server moves with the edit when this is the ninja's latest session.
    api.get(`/students/${id}`).then(setStudent).catch(() => {});
  };

  if (loading) {
    return (
      <Layout>
        <SkeletonProfile label="Loading ninja" />
      </Layout>
    );
  }

  if (error || !student) {
    return (
      <Layout>
        <p className="text-ninja-red font-ninja text-center py-12">{error || 'Ninja not found'}</p>
      </Layout>
    );
  }

  // Show only today's programs if we came from the board; otherwise all enrolled
  const availablePrograms = todayPrograms
    ? (student.programs || []).filter((p) => todayPrograms.includes(p.program))
    : (student.programs || []);

  // The question above these is which class you are logging, so a class that is
  // already written is not one of the answers. When nothing is left to log the
  // visit is a correction instead, and then the logged classes are exactly the
  // ones that have to be reachable, so they come back.
  //
  // Written once is not the same as finished: a ninja catching up on two CREATE
  // sessions has one logged and one still owed, and that class has to stay.
  const isFullyLogged = (p) => donePrograms.has(p) && pendingCount(p) === 0;
  const pendingPrograms = availablePrograms.filter((p) => !isFullyLogged(p.program));
  const selectablePrograms = pendingPrograms.length > 0 ? pendingPrograms : availablePrograms;
  const loggedCount = availablePrograms.filter((p) => isFullyLogged(p.program)).length;

  const enrollment = availablePrograms.find((p) => p.program === selectedProgram);

  // The sessions already written for this ninja, newest first, narrowed to the
  // class being logged. Capped: this is the log page, not the profile — enough
  // to reach today's entry and the last few, not the whole history.
  const loggedSessions = (student.progress_logs || [])
    .filter((l) => l.notes !== 'Marked complete from roadmap')
    .filter((l) => !selectedProgram || l.program === selectedProgram)
    .slice()
    .sort((a, b) => new Date(b.session_date) - new Date(a.session_date))
    .slice(0, 10);

  // Coming back to a class that is already logged means fixing what was
  // written, not writing it again — so the form opens on that session with its
  // own values in it. A genuine second session is one click away.
  const isLogged = !!selectedProgram && loggedOnArrival.has(selectedProgram);
  const editLog = isLogged && logAnotherFor !== selectedProgram ? loggedSessions[0] : null;
  const otherSessions = loggedSessions.filter((l) => l.id !== editLog?.id);

  const isStudentBirthday = isBirthdayToday(student.birthday);

  return (
    <Layout>
      {isStudentBirthday && <BirthdayConfetti />}
      <motion.div
        className="max-w-2xl mx-auto lg:max-w-none"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <button
          onClick={() => navigate(dashboardPath)}
          className="text-ninja-muted hover:text-ninja-blue font-ninja text-sm flex items-center gap-1 transition-colors mb-6"
        >
          ← Back to Dashboard
        </button>

        <div className="lg:flex lg:gap-8 lg:items-start space-y-6 lg:space-y-0">
          {/* Left panel: student info + program selector + pinned note */}
          <div className="lg:w-80 lg:flex-shrink-0 space-y-4">
            <Card>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold font-ninja text-ninja-navy">{student.full_name}{isStudentBirthday && <span className="ml-2">🎂</span>}</h1>
                  {enrollment?.program === 'CREATE' && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {enrollment.belt_level && (
                        <BeltBadge belt={enrollment.belt_level} sublevel={enrollment.belt_sublevel} />
                      )}
                      {enrollment.current_project && (
                        <span className="text-ninja-muted font-ninja text-sm">
                          {enrollment.current_project}{enrollment.project_status ? `, ${enrollment.project_status}` : ''}
                        </span>
                      )}
                    </div>
                  )}
                  {enrollment && enrollment.program !== 'CREATE' && (enrollment.last_module_name || enrollment.last_lesson_name) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide">Previous:</span>
                      {enrollment.last_sub_program && (
                        <span className="text-xs font-ninja font-semibold text-ninja-muted bg-ninja-bg border border-ninja-border px-2 py-0.5 rounded-md">{enrollment.last_sub_program}</span>
                      )}
                      {enrollment.last_module_name && (
                        <span className="text-xs font-ninja text-ninja-muted">{enrollment.last_module_name}</span>
                      )}
                      {enrollment.last_module_name && enrollment.last_lesson_name && (
                        <span className="text-ninja-muted/50 font-ninja text-xs">·</span>
                      )}
                      {enrollment.last_lesson_name && (
                        <span className="text-xs font-ninja text-ninja-navy font-semibold">{enrollment.last_lesson_name}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {availablePrograms.length > 1 && (
                <div className="mt-4 pt-4 border-t border-ninja-border">
                  <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-2">
                    Which program are you logging?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectablePrograms.map((p) => {
                      const isDone = isFullyLogged(p.program);
                      const isSelected = selectedProgram === p.program;
                      return (
                        <button
                          key={p.program}
                          onClick={() => setSelectedProgram(p.program)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-ninja font-semibold transition-colors flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-ninja-blue text-white'
                              : isDone
                              ? 'bg-green-50 border border-green-300 text-green-700 hover:border-green-500'
                              : 'bg-ninja-bg border border-ninja-border text-ninja-navy hover:border-ninja-blue'
                          }`}
                        >
                          {isDone && !isSelected && <span className="text-green-600">✓</span>}
                          {PROGRAM_LOGOS[p.program] && (
                            <img src={PROGRAM_LOGOS[p.program]} alt="" className="w-5 h-5 rounded overflow-hidden object-contain flex-shrink-0" />
                          )}
                          {p.program}
                          {isDone && !isSelected && <span className="text-xs font-normal opacity-75">logged</span>}
                        </button>
                      );
                    })}
                  </div>
                  {/* With the logged classes off the list, this line is the
                      only thing that says they happened. */}
                  {loggedCount > 0 && loggedCount < availablePrograms.length && (
                    <p className="text-ninja-muted font-ninja text-xs mt-2">
                      {loggedCount}/{availablePrograms.length} programs already logged today.
                    </p>
                  )}
                </div>
              )}
            </Card>

            <PinnedNote
              studentId={student.id}
              initialNote={student.pinned_note}
              parentNote={student.special_instructions}
              onUpdated={(note) => setStudent((prev) => ({ ...prev, pinned_note: note }))}
            />
          </div>

          {/* Right panel: log form + what has already been logged */}
          <div className="lg:flex-1 min-w-0 space-y-6">
            {isReadOnly ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm text-center">
                <p className="text-amber-700 font-ninja font-semibold">
                  You can only log progress at your home center.
                </p>
              </div>
            ) : selectedProgram ? (
              <div className="bg-white border border-ninja-border rounded-xl p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h2 className="text-xl font-bold font-ninja text-ninja-navy">
                    {editLog
                      ? <>Edit This <span className="text-ninja-blue">Session</span></>
                      : <>Log Today's <span className="text-ninja-blue">Session</span></>}
                  </h2>
                  {isLogged && (
                    <button
                      type="button"
                      onClick={() => setLogAnotherFor(editLog ? selectedProgram : null)}
                      className="text-ninja-muted hover:text-ninja-blue font-ninja text-sm font-semibold transition-colors"
                    >
                      {editLog ? 'Log another session' : 'Edit the logged session'}
                    </button>
                  )}
                </div>
                {editLog && (
                  <p className="text-ninja-muted font-ninja text-sm mb-4">
                    Saving overwrites what was logged on {formatDate(String(editLog.session_date).split('T')[0])}.
                  </p>
                )}
                {!editLog && pendingCount(selectedProgram) > 1 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm font-ninja text-amber-700">
                    <strong>{pendingCount(selectedProgram)} sessions to log.</strong> Starting with the oldest
                    {sessionDateFor(selectedProgram) ? ` (${formatDate(sessionDateFor(selectedProgram))})` : ''}. They'll still show up for today after.
                  </div>
                )}
                <LogEntryForm
                  student={student}
                  program={selectedProgram}
                  enrollment={enrollment}
                  editLog={editLog}
                  onLogged={handleLogged}
                  onSaved={handleSavedEdit}
                  sessionDate={sessionDateFor(selectedProgram)}
                />
              </div>
            ) : (
              <div className="bg-white border border-ninja-border rounded-xl p-6 shadow-sm text-center">
                <p className="text-ninja-muted font-ninja">Select a program above to log a session.</p>
              </div>
            )}

            {/* The earlier sessions, editable in place. The one the form above
                is already holding is left out — the same log with two editors
                open on it is how a correction turns into a duplicate. */}
            {otherSessions.length > 0 && (
              <div className="bg-white border border-ninja-border rounded-xl p-6 shadow-sm">
                <h2 className="text-xl font-bold font-ninja text-ninja-navy mb-4">
                  {editLog ? <>Earlier <span className="text-ninja-blue">Sessions</span></> : <>Already <span className="text-ninja-blue">Logged</span></>}
                </h2>
                <div className="max-h-[28rem] overflow-y-auto no-scrollbar">
                  <ProgressHistory
                    logs={otherSessions}
                    enrolledPrograms={(student.programs || []).map((p) => p.program)}
                    onLogUpdated={handleLogUpdated}
                    onLogDeleted={handleLogDeleted}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}
