import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Layout from '../../components/layout/Layout';
import TodayBoard from '../../components/manager/TodayBoard';
import DashboardFilters from '../../components/shared/DashboardFilters';
import BoardStats from '../../components/shared/BoardStats';
import AddStudentToday from '../../components/manager/AddStudentToday';
import ExpectedToday from '../../components/manager/ExpectedToday';
import CheckInClubModal from '../../components/manager/CheckInClubModal';
import ClubSessionsPanel from '../../components/shared/ClubSessionsPanel';
import Button from '../../components/ui/Button';
import { api } from '../../api/client';
import { today, formatDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import { SkeletonList } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import { UsersIcon } from 'lucide-react';
import { CARD } from '../../lib/surfaces';
import useExpectedToday, { countNinjas } from '../../lib/useExpectedToday';
import useLiveRefresh from '../../lib/useLiveRefresh';

export default function ManagerDashboard() {
  const { user, isReadOnly } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [bookedOpen, setBookedOpen] = useState(false);
  const [showCheckInClub, setShowCheckInClub] = useState(false);
  const [clubSessions, setClubSessions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('unlogged');
  const [programFilter, setProgramFilter] = useState(null);

  const todayStr = today();

  // Held here rather than inside the panel, so the icon knows whether there
  // is anything behind it before it offers to open.
  //
  // Driven by the center's connection, the same as the sensei board. A
  // director's own Experimental toggle is a display preference for their
  // account page; switching it off should not quietly stop the center's
  // bookings arriving. The off switch for that is feature_booked, which is per
  // center and enforced server side.
  const bookedFeed = useExpectedToday(todayStr);
  const bookedCount = countNinjas(bookedFeed.data?.expected);
  // Shown while the answer is still coming, so the header does not
  // reshuffle a couple of seconds after the page settles. It only goes
  // away once MyStudio has actually said there is nobody.
  const showBooked = bookedFeed.loading || bookedCount > 0;

  const programs = [...new Set(assignments.map((a) => a.program))].filter(Boolean);
  const visibleAssignments = programFilter
    ? assignments.filter((a) => a.program === programFilter)
    : assignments;

  const isPast = (a) => a.session_date && String(a.session_date).split('T')[0] < todayStr;
  const counts = {
    logged:  visibleAssignments.filter((a) => a.completed).length,
    pending: visibleAssignments.filter((a) => !a.completed && !isPast(a)).length,
    overdue: visibleAssignments.filter((a) => !a.completed && isPast(a)).length,
    total:   visibleAssignments.length,
  };

  const fetchAssignments = useCallback(async ({ quiet = false } = {}) => {
    try {
      const data = await api.get(`/daily?date=${todayStr}`);
      setAssignments(data);
      if (quiet) setError('');
    } catch (err) {
      // A background refresh that fails keeps whatever is on screen. The board
      // going red behind somebody mid check-in is worse than it being a few
      // seconds behind.
      if (!quiet) setError('Failed to load today\'s board');
    } finally {
      setLoading(false);
    }
  }, [todayStr, user?.activeLocation?.id]);

  // Somebody else is using this board too. A sensei logging a ninja at the back
  // desk should not need the director at the front to reload the page.
  useLiveRefresh(() => fetchAssignments({ quiet: true }));

  useEffect(() => {
    const controller = new AbortController();
    fetchAssignments();
    api.get('/clubs').then((data) => { if (!controller.signal.aborted) setClubSessions(data); }).catch(() => {});
    return () => controller.abort();
  }, [fetchAssignments]);

  const handleAdded = (newAssignment) => {
    // Server may reuse an existing (overdue) session and move it to today —
    // replace by id rather than appending a duplicate.
    setAssignments((prev) => [...prev.filter((a) => a.id !== newAssignment.id), newAssignment]);
  };

  const handleUpdate = (updated) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    );
  };

  const handleRemove = (id) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  };

  const existingEntries = assignments.map((a) => ({ student_id: a.student_id, program: a.program }));

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-ninja text-ninja-navy tracking-wide">
              Today's <span className="text-ninja-blue">Ninjas</span>
            </h1>
            <p className="text-ninja-muted font-ninja mt-1">{formatDate(todayStr)}</p>
            {user && (
              <p className="text-ninja-navy font-ninja mt-1 font-semibold">
                Welcome Center Director {user.displayName?.split(' ')[0]}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Who MyStudio says is booked in. It used to sit open above the
                board, which pushed the ninjas down the page every day to show
                a list that is usually just confirming what is already there.
                Behind an icon it is available in one press and costs no room,
                and it only appears when somebody is actually booked. */}
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
                className={`${CARD} relative w-11 h-11 flex items-center justify-center text-ninja-muted hover:text-ninja-blue hover:border-ninja-blue/50 transition-colors`}
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

            {!isReadOnly && (
              <Button onClick={() => setShowAddModal(true)} size="md">
                + Check In Ninja
              </Button>
            )}
          </div>
        </div>

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

        {/* Stat cards — also the board's status filter */}
        {!loading && !error && assignments.length > 0 && (
          <BoardStats counts={counts} active={statusFilter} onSelect={setStatusFilter} />
        )}

        {/* Board */}
        {error && <p className="text-ninja-red font-ninja text-center py-4">{error}</p>}

        {!loading && !error && assignments.length > 0 && (
          <DashboardFilters
            program={programFilter}
            onProgram={setProgramFilter}
            programs={programs}
          />
        )}

        {loading ? (
          <SkeletonList rows={4} label="Loading today's board" />
        ) : (
          <TodayBoard
            assignments={visibleAssignments}
            onRemove={handleRemove}
            onUpdate={handleUpdate}
            statusFilter={statusFilter}
          />
        )}

        {/* Clubs */}
        <ClubSessionsPanel
          sessions={clubSessions}
          onDeleted={(id) => setClubSessions((prev) => prev.filter((s) => s.id !== id))}
          onAttendeesUpdated={(id, attendees) => setClubSessions((prev) => prev.map((s) => s.id === id ? { ...s, attendees } : s))}
          onCheckIn={() => setShowCheckInClub(true)}
        />
      </div>

      <AddStudentToday
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={handleAdded}
        existingEntries={existingEntries}
      />

      <CheckInClubModal
        isOpen={showCheckInClub}
        onClose={() => setShowCheckInClub(false)}
        onCheckedIn={(newSession) => {
          api.get('/clubs').then(setClubSessions).catch(() => {});
        }}
      />
    </Layout>
  );
}
