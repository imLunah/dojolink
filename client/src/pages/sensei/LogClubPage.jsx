import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../../components/layout/Layout';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { ClubBadge } from '../../components/shared/ClubSessionsPanel';
import LazyMarkdownEditor from '../../components/shared/LazyMarkdownEditor';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { today, formatDate } from '../../utils/dateUtils';
import { SkeletonList } from '../../components/ui/Skeleton';
import AttendeePicker from '../../components/shared/AttendeePicker';

export default function LogClubPage() {
  const navigate = useNavigate();
  const { user, isReadOnly } = useAuth();
  const [searchParams] = useSearchParams();

  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [recentSessions, setRecentSessions] = useState([]);
  const [clubs, setClubs] = useState([]);

  const [clubName, setClubName] = useState(searchParams.get('club') || '');
  const [sessionDate, setSessionDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/students?all=true')
      .then(({ students: data }) => setStudents((data ?? []).filter((s) => s.active !== false)))
      .catch(() => setError('Could not load students'))
      .finally(() => setLoadingStudents(false));

    api.get('/clubs').then(setRecentSessions).catch(() => {});
    api.get('/clubs/definitions').then(setClubs).catch(() => {});
  }, []);

  // Filter recent sessions for selected club
  const clubSessions = recentSessions.filter((s) => s.club_name === clubName).slice(0, 3);

  const toggleStudent = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clubName) return setError('Please select a club.');
    if (selectedIds.size === 0) return setError('Please mark at least one student as present.');
    setError('');
    setSubmitting(true);
    try {
      await api.post('/clubs', {
        club_name: clubName,
        session_date: sessionDate,
        notes: notes.trim() || undefined,
        student_ids: [...selectedIds],
      });
      navigate(['manager', 'admin'].includes(user?.role) ? '/manager/dashboard' : '/sensei/dashboard');
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isReadOnly) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-4">
          <button onClick={() => navigate(-1)} className="text-ninja-muted hover:text-ninja-blue font-ninja text-sm flex items-center gap-1 transition-colors">
            ← Back
          </button>
          <div className="bg-amber-50 border border-ninja-border rounded-xl p-6 text-center">
            <p className="text-amber-700 font-ninja font-semibold">You can only log sessions at your home center.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div className="space-y-6 max-w-2xl mx-auto" variants={stagger} initial="hidden" animate="show">
        <button
          onClick={() => navigate(-1)}
          className="text-ninja-muted hover:text-ninja-blue font-ninja text-sm flex items-center gap-1 transition-colors"
        >
          ← Back
        </button>

        {/* Club selector card */}
        <motion.div variants={fadeUp}><Card>
          <h1 className="text-2xl font-bold font-ninja text-ninja-navy mb-1">Log Club Session</h1>
          <p className="text-ninja-muted font-ninja text-sm mb-4">Select a club and mark who attended.</p>
          <div className="border-t border-ninja-border pt-4">
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-2">
              Which club?
            </label>
            <div className="flex flex-wrap gap-2">
              {clubs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClubName(c.name)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-ninja font-semibold transition-colors ${
                    clubName === c.name
                      ? 'bg-ninja-blue text-white'
                      : 'bg-ninja-bg border border-ninja-border text-ninja-navy hover:border-ninja-blue'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </Card></motion.div>

        {/* Recent sessions for this club */}
        {clubName && clubSessions.length > 0 && (
          <div className="bg-white border border-ninja-border rounded-xl p-4 shadow-sm">
            <h2 className="text-lg font-bold font-ninja text-ninja-navy mb-3">
              Recent <span className="text-ninja-blue">Sessions</span>
            </h2>
            <div className="space-y-2">
              {clubSessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2 border-b border-ninja-border last:border-0">
                  <ClubBadge name={s.club_name} />
                  <span className="text-ninja-muted font-ninja text-xs">{formatDate(s.session_date)}</span>
                  <span className="text-ninja-muted font-ninja text-xs ml-auto">{s.attendees?.length ?? 0} students</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        {clubName && (
          <div className="bg-white border border-ninja-border rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold font-ninja text-ninja-navy mb-4">
              Log Today's <span className="text-ninja-blue">Session</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Date */}
              <div>
                <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-2">Session Date</label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
                />
              </div>

              {/* Attendance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide">Who attended?</label>
                  {selectedIds.size > 0 && (
                    <span className="text-ninja-blue font-ninja font-bold text-sm">{selectedIds.size} selected</span>
                  )}
                </div>
                {loadingStudents ? (
                  <SkeletonList rows={4} label="Loading" />
                ) : (
                  <AttendeePicker
                    students={students}
                    selectedIds={selectedIds}
                    onToggle={toggleStudent}
                    search={search}
                    onSearchChange={setSearch}
                    maxHeight="max-h-64"
                  />
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-2">
                  Session Notes <span className="normal-case font-normal">(optional)</span>
                </label>
                <LazyMarkdownEditor
                  value={notes}
                  onChange={setNotes}
                  placeholder="How did the session go? What did the group work on?"
                />
              </div>

              {error && <p className="text-ninja-red font-ninja text-sm">{error}</p>}

              <Button type="submit" disabled={submitting} size="md" className="w-full">
                {submitting ? 'Saving...' : 'Save Club Session'}
              </Button>
            </form>
          </div>
        )}

        {!clubName && (
          <div className="bg-white border border-ninja-border rounded-xl p-6 shadow-sm text-center">
            <p className="text-ninja-muted font-ninja">Select a club above to log a session.</p>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
