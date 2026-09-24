import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../../components/layout/Layout';
import TodayBoard from '../../components/manager/TodayBoard';
import AddStudentToday from '../../components/manager/AddStudentToday';
import DashboardFilters from '../../components/shared/DashboardFilters';
import BoardStats from '../../components/shared/BoardStats';
import ClubSessionsPanel from '../../components/shared/ClubSessionsPanel';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { ListTodoIcon, UsersIcon } from 'lucide-react';
import { api } from '../../api/client';
import { today, formatDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import ExpectedToday from '../../components/manager/ExpectedToday';
import useExpectedToday, { countNinjas } from '../../lib/useExpectedToday';
import useLiveRefresh from '../../lib/useLiveRefresh';
import { CARD } from '../../lib/surfaces';
import { OPEN_COLUMN_KEYS, todayKey } from '../../lib/taskBoard';

// The board's header icons. One definition, so a second pasted class string
// cannot drift from the first.
const HEADER_ICON =
  'relative w-11 h-11 flex items-center justify-center text-ninja-muted ' +
  'hover:text-ninja-blue hover:border-ninja-blue/50 transition-colors';

// My tasks, as an icon rather than the card that used to sit under the header.
//
// The card spent a full row of the board saying "nothing is assigned to you
// right now", which is the answer most days. The count was the only part of it
// that was ever news and it fits on a badge; the list itself is one press away
// here, in the sidebar, and in the phone's top bar.
function MyTasksIcon({ locationId }) {
  const [tasks, setTasks] = useState(null);

  useEffect(() => {
    let alive = true;
    setTasks(null);
    api.get('/director-tasks?mine=true')
      .catch(() => [])
      .then((rows) => { if (alive) setTasks(rows || []); });
    return () => { alive = false; };
  }, [locationId]);

  // Open, not assigned: a done task is not work, and a badge counting it is a
  // badge nobody can clear.
  const open = (tasks || []).filter((t) => OPEN_COLUMN_KEYS.includes(t.column_key));
  const overdue = open.filter((t) => t.due_date && t.due_date < todayKey()).length;

  const label = !tasks
    ? 'My tasks'
    : overdue
      ? `My tasks, ${open.length} open, ${overdue} overdue`
      : open.length
        ? `My tasks, ${open.length} open`
        : 'My tasks, all caught up';

  return (
    <Link to="/sensei/tasks" aria-label={label} className={`${CARD} ${HEADER_ICON}`}>
      <ListTodoIcon className="w-5 h-5" />
      {open.length > 0 && (
        <span
          aria-hidden
          className={`absolute -top-1 -right-1 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full text-white font-ninja text-[11px] font-bold flex items-center justify-center tabular-nums ${
            overdue ? 'bg-ninja-red' : 'bg-ninja-blue'
          }`}
        >
          {open.length}
        </span>
      )}
    </Link>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export default function SenseiDashboard() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clubSessions, setClubSessions] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState('unlogged');
  const [programFilter, setProgramFilter] = useState(null);
  const [bookedOpen, setBookedOpen] = useState(false);
  const { user, isReadOnly } = useAuth();
  const todayStr = today();
  const [showAddModal, setShowAddModal] = useState(false);

  // Senseis can accept a booked ninja as a check-in, but cannot manage the
  // connection. The feed is held here rather than inside the panel so the icon
  // only appears when there is something behind it.
  //
  // Not gated on anything this sensei has to switch on. Whether their center
  // uses the booked list is their director's decision, made once by connecting
  // and left on, and the server answers { connected: false } or
  // { disabled: true } for a center that has not made it. A per-device flag
  // here meant every sensei had to find the same toggle on every browser they
  // ever signed in on, which is not a decision any of them were making.
  const bookedFeed = useExpectedToday(todayStr);
  const bookedCount = countNinjas(bookedFeed.data?.expected);
  // Shown while the answer is still coming, so the header does not
  // reshuffle a couple of seconds after the page settles. It only goes
  // away once MyStudio has actually said there is nobody.
  const showBooked = bookedFeed.loading || bookedCount > 0;

  const refresh = () => setRefreshKey(k => k + 1);

  const handleAdded = (newAssignment) => {
    // An overdue session can be reused and moved to today, so replace by id.
    setAssignments((prev) => [...prev.filter((a) => a.id !== newAssignment.id), newAssignment]);
  };

  const handleUpdate = (updated) => {
    setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const existingEntries = assignments.map((a) => ({ student_id: a.student_id, program: a.program }));

  // New check-ins from the front desk appear without a reload. Shared with the
  // director's board, and unlike the bare interval this replaced, it stops while
  // the tab is hidden and catches up the moment somebody looks again.
  useLiveRefresh(refresh);

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/daily?date=${todayStr}`)
      .then((data) => { if (!controller.signal.aborted) setAssignments(data); })
      .catch(() => { if (!controller.signal.aborted) setError('Failed to load today\'s ninjas'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    api.get('/clubs').then((data) => { if (!controller.signal.aborted) setClubSessions(data); }).catch(() => {});
    return () => controller.abort();
  }, [todayStr, user?.activeLocation?.id, refreshKey]);

  const programs = [...new Set(assignments.map((a) => a.program))].filter(Boolean);
  const filteredAssignments = programFilter
    ? assignments.filter((a) => a.program === programFilter)
    : assignments;

  const isPast = (a) => a.session_date && String(a.session_date).split('T')[0] < todayStr;
  const counts = {
    logged:  filteredAssignments.filter((a) => a.completed).length,
    pending: filteredAssignments.filter((a) => !a.completed && !isPast(a)).length,
    overdue: filteredAssignments.filter((a) => !a.completed && isPast(a)).length,
    total:   filteredAssignments.length,
  };

  return (
    <Layout>
      <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} className="flex items-start justify-between gap-4">
          <div>
          <h1 className="text-2xl sm:text-4xl font-bold font-ninja text-ninja-navy tracking-wide">
            Sensei <span className="text-ninja-blue">Dashboard</span>
          </h1>
          <p className="text-ninja-muted font-ninja mt-1">{formatDate(todayStr)}</p>
          {user && (
            <p className="text-ninja-navy font-ninja mt-1 font-semibold">
              Welcome {user.role === 'manager' ? 'Center Director' : user.role === 'admin' ? 'Admin' : 'Sensei'}{' '}
              {(() => {
                const name = user.role === 'sensei' && user.displayName?.toLowerCase().startsWith('sensei ')
                  ? user.displayName.slice(7)
                  : user.displayName;
                return name?.split(' ')[0];
              })()}
            </p>
          )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Only when somebody is actually booked. An icon that opens an
                empty box teaches people to stop pressing it. */}
            {showBooked && (
              <button
                type="button"
                onClick={() => setBookedOpen(true)}
                aria-label={
                  bookedCount > 0
                    ? `Who is booked in today, ${bookedCount} ninjas`
                    : "Who is booked in today"
                }
                aria-haspopup="dialog"
                aria-expanded={bookedOpen}
                className={`${CARD} ${HEADER_ICON}`}
              >
                <UsersIcon className="w-5 h-5" />
                {bookedCount > 0 && (
                  <span
                    aria-hidden
                    className="absolute -top-1 -right-1 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-ninja-blue text-white font-ninja text-[11px] font-bold flex items-center justify-center tabular-nums"
                  >
                    {bookedCount}
                  </span>
                )}
              </button>
            )}

            {/* Both the sidebar and the phone's top bar carry Curriculum and the
                calendar now, and the dashboard's own page leads with the
                calendar, so the board stopped needing its own copies of
                either. What is left here is the work: who is booked, and what
                is assigned to you. */}
            <MyTasksIcon locationId={user?.activeLocation?.id} />
            {!isReadOnly && (
              <Button onClick={() => setShowAddModal(true)} size="md">
                + Check In Ninja
              </Button>
            )}
          </div>
        </motion.div>

        <Modal
          isOpen={bookedOpen}
          onClose={() => setBookedOpen(false)}
          title="Booked in today"
          width="max-w-md"
        >
          <ExpectedToday
            feed={bookedFeed}
            date={todayStr}
            onAdded={handleAdded}
            existingStudentIds={new Set(assignments.map((a) => a.student_id))}
            readOnly={isReadOnly}
            bare
          />
        </Modal>

        <motion.div variants={fadeUp}>
          <h2 className="text-xl sm:text-2xl font-black font-ninja text-ninja-navy tracking-tight">
            Today&apos;s Ninjas
          </h2>
        </motion.div>

        {!loading && !error && assignments.length > 0 && (
          <motion.div variants={fadeUp}>
            <BoardStats counts={counts} active={statusFilter} onSelect={setStatusFilter} />
          </motion.div>
        )}

        {!loading && !error && assignments.length > 0 && (
          <motion.div variants={fadeUp}>
            <DashboardFilters
              program={programFilter}
              onProgram={setProgramFilter}
              programs={programs}
            />
          </motion.div>
        )}

        {error && <p className="text-ninja-red font-ninja text-center py-8">{error}</p>}
        {loading && <p className="text-ninja-muted font-ninja text-center py-8">Loading your ninjas...</p>}

        {/* Same board the directors see. Senseis can't remove a check-in
            (DELETE /daily/:id is manager-only), so the × stays off. */}
        {!loading && !error && (
          <motion.div variants={fadeUp}>
            <TodayBoard
              assignments={filteredAssignments}
              statusFilter={statusFilter}
              canRemove={false}
              onUpdate={handleUpdate}
              emptyHint={'Use the "+ Check In Ninja" button to get started.'}
            />
          </motion.div>
        )}

        {/* Clubs */}
        <ClubSessionsPanel
          sessions={clubSessions}
          onDeleted={(id) => setClubSessions((prev) => prev.filter((s) => s.id !== id))}
          onAttendeesUpdated={(id, attendees) => setClubSessions((prev) => prev.map((s) => s.id === id ? { ...s, attendees } : s))}
        />

      </motion.div>

      <AddStudentToday
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={handleAdded}
        existingEntries={existingEntries}
      />
    </Layout>
  );
}
