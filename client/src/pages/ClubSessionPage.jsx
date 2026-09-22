import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
import Layout from '../components/layout/Layout';
import Button from '../components/ui/Button';
import LazyMarkdownEditor from '../components/shared/LazyMarkdownEditor';
import MarkdownView from '../components/shared/MarkdownView';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/dateUtils';
import { getClubColors } from '../utils/clubUtils';
import { SkeletonProfile } from '../components/ui/Skeleton';

export default function ClubSessionPage() {
  const { slug, id } = useParams();
  const navigate = useNavigate();
  const { user, isReadOnly } = useAuth();

  const [clubDef, setClubDef] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Attendee editing (manager only)
  const [editingAttendees, setEditingAttendees] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [savingAttendees, setSavingAttendees] = useState(false);
  const [attendeeError, setAttendeeError] = useState('');

  useEffect(() => {
    // Resolve slug → club definition
    api.get('/clubs/definitions').then((defs) => {
      const def = defs.find((d) => d.slug === slug);
      if (!def) { setNotFound(true); setLoading(false); return; }
      setClubDef(def);
      return api.get(`/clubs/sessions/${id}`);
    }).then((data) => {
      if (!data) return;
      setSession(data);
      setNotesDraft(data.notes || '');
      setSelectedIds(new Set((data.attendees || []).map((a) => a.id)));
    }).catch((err) => {
      if (err?.status === 404) setNotFound(true);
    }).finally(() => setLoading(false));
  }, [id, slug]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.patch(`/clubs/${id}/notes`, { notes: notesDraft });
      setSession((prev) => ({ ...prev, notes: notesDraft, sensei_name: user?.displayName || prev.sensei_name }));
      setEditingNotes(false);
    } catch { /* editing panel stays open so user can retry */ } finally {
      setSavingNotes(false);
    }
  };

  const handleSaveAttendees = async () => {
    setSavingAttendees(true);
    setAttendeeError('');
    try {
      await api.patch(`/clubs/${id}/attendees`, { student_ids: [...selectedIds] });
      const updated = allStudents.filter((s) => selectedIds.has(s.id)).map((s) => ({ id: s.id, full_name: s.full_name }));
      setSession((prev) => ({ ...prev, attendees: updated }));
      setEditingAttendees(false);
    } catch {
      // alert() is silent when the app runs standalone from the home screen.
      setAttendeeError("Couldn't save attendees. Please try again.");
    } finally {
      setSavingAttendees(false);
    }
  };

  const loadStudents = () => {
    if (allStudents.length === 0) {
      api.get('/students?all=true').then(({ students: data }) => setAllStudents(data.filter((s) => s.active !== false))).catch(() => {});
    }
    setEditingAttendees(true);
  };

  if (notFound) return <Layout><p className="text-ninja-red font-ninja text-center py-12">Session not found.</p></Layout>;
  if (loading || !clubDef || !session) return <Layout><SkeletonProfile label="Loading session" /></Layout>;

  const c = getClubColors(clubDef);
  const filteredStudents = allStudents.filter((s) =>
    s.full_name.toLowerCase().includes(attendeeSearch.toLowerCase())
  );

  return (
    <Layout>
      <motion.div className="space-y-5 max-w-3xl mx-auto" variants={stagger} initial="hidden" animate="show">
        <button
          onClick={() => navigate(`/clubs/${slug}`)}
          className="text-ninja-muted hover:text-ninja-blue font-ninja text-sm flex items-center gap-1 transition-colors"
        >
          ← Back to {clubDef.name}
        </button>

        {/* Header */}
        <motion.div variants={fadeUp} className="bg-white border border-ninja-border rounded-xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <span className={`text-sm font-ninja font-bold px-3 py-1 rounded-md border border-ninja-border ${c.bg} ${c.text}`}>
              {clubDef.name}
            </span>
            <h1 className="text-xl font-bold font-ninja text-ninja-navy">{formatDate(session.session_date)}</h1>
          </div>
          {session.sensei_name && (
            <p className="text-ninja-muted font-ninja text-sm mt-1">Notes by {session.sensei_name}</p>
          )}
        </motion.div>

        {/* Attendees */}
        <motion.div variants={fadeUp} className="bg-white border border-ninja-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-ninja-navy font-ninja font-bold text-lg">
              Attendees <span className="text-ninja-muted font-normal text-base">({session.attendees?.length ?? 0})</span>
            </h2>
            {!isReadOnly && !editingAttendees && (
              <button onClick={loadStudents} className="text-ninja-blue font-ninja text-sm font-semibold hover:underline">
                Edit
              </button>
            )}
          </div>

          {editingAttendees ? (
            <div className="space-y-3">
              <input type="text" placeholder="Search ninjas..." value={attendeeSearch}
                onChange={(e) => setAttendeeSearch(e.target.value)}
                className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue" />
              <div className="space-y-1 max-h-56 overflow-y-auto border border-ninja-border rounded-lg p-2 bg-ninja-bg">
                {filteredStudents.map((s) => {
                  const checked = selectedIds.has(s.id);
                  return (
                    <button key={s.id} type="button"
                      onClick={() => setSelectedIds((prev) => {
                        const next = new Set(prev);
                        next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                        return next;
                      })}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        checked ? 'bg-ninja-blue text-white' : 'bg-white text-ninja-navy hover:bg-ninja-navy/[0.04] dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                        checked ? 'bg-[#ffffff] border-[#ffffff]' : 'border-ninja-border bg-ninja-bg'
                      }`}>
                        {checked && <span className="text-ninja-blue text-xs font-bold">✓</span>}
                      </div>
                      <span className="font-ninja font-semibold text-sm">{s.full_name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveAttendees} disabled={savingAttendees}>
                  {savingAttendees ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  setEditingAttendees(false);
                  setSelectedIds(new Set((session.attendees || []).map((a) => a.id)));
                }}>Cancel</Button>
              </div>
              {attendeeError && (
                <p role="alert" className="font-ninja text-xs text-ninja-red">{attendeeError}</p>
              )}
            </div>
          ) : (
            session.attendees?.length === 0 ? (
              <p className="text-ninja-muted font-ninja text-sm italic">No attendees recorded.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {session.attendees.map((a) => (
                  <span key={a.id} className="bg-ninja-bg border border-ninja-border text-ninja-navy font-ninja text-sm px-3 py-1 rounded-md">
                    {a.full_name}
                  </span>
                ))}
              </div>
            )
          )}
        </motion.div>

        {/* Session Notes */}
        <motion.div variants={fadeUp} className="bg-white border border-ninja-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-ninja-navy font-ninja font-bold text-lg">Session Notes</h2>
            {!isReadOnly && !editingNotes && (
              <button onClick={() => setEditingNotes(true)}
                className="text-ninja-blue font-ninja text-sm font-semibold hover:underline">
                {session.notes ? 'Edit' : '+ Add Notes'}
              </button>
            )}
          </div>

          {editingNotes ? (
            <div className="space-y-2">
              <LazyMarkdownEditor
                value={notesDraft}
                onChange={setNotesDraft}
                placeholder="How did the session go?"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
                  {savingNotes ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setEditingNotes(false); setNotesDraft(session.notes || ''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            session.notes ? (
              <MarkdownView className="font-ninja text-sm leading-relaxed text-ninja-navy">{session.notes}</MarkdownView>
            ) : (
              <div className="font-ninja text-sm leading-relaxed text-ninja-muted italic">No notes added yet.</div>
            )
          )}
        </motion.div>
      </motion.div>
    </Layout>
  );
}
