import { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

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
import { getClubColors, clubField, COVER_SCRIM } from '../utils/clubUtils';
import NinjaAvatar from '../components/ui/NinjaAvatar';
import { ChevronLeftIcon, PencilIcon, PlusIcon } from 'lucide-react';
import AttendeePicker from '../components/shared/AttendeePicker';
import { SkeletonProfile } from '../components/ui/Skeleton';
import { CARD } from '../lib/surfaces';

export default function ClubSessionPage() {
  const { slug, id } = useParams();
  const navigate = useNavigate();
  // Opened from Today's Board, the way back is the board, not the club.
  const { backTo, backLabel } = useLocation().state || {};
  const { user, isReadOnly } = useAuth();
  const reduce = useReducedMotion();

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
  const [coverError, setCoverError] = useState(false);

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
      if (!data.notes && !isReadOnly) setEditingNotes(true);
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
      const updated = allStudents.filter((s) => selectedIds.has(s.id)).map((s) => ({ id: s.id, full_name: s.full_name, codeorg_sticker: s.codeorg_sticker }));
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
  const attendeeCount = session.attendees?.length ?? 0;
  const hasCover = Boolean(session.cover_image_url) && !coverError;
  const meta = [
    `${attendeeCount} ninja${attendeeCount !== 1 ? 's' : ''}`,
    session.sensei_name && `Notes by ${session.sensei_name}`,
  ].filter(Boolean);

  return (
    <Layout>
      <motion.div className="space-y-5" variants={stagger} initial="hidden" animate="show">
        {/* Header.
            The session used to open on a chip and a date sitting on a grey
            slab, which said nothing about which club you were in. It now wears
            the club's own cover or its colour, the same two surfaces the club
            hero and the session cards are built from, so arriving here reads as
            going further into the club rather than landing somewhere else.
            The date is the heading because the club name is already the thing
            you came from. */}
        <motion.div variants={fadeUp} className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0">
            {hasCover ? (
              <>
                <img
                  src={session.cover_image_url}
                  alt=""
                  onError={() => setCoverError(true)}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0" style={{ backgroundImage: COVER_SCRIM }} />
              </>
            ) : (
              <div className="w-full h-full" style={clubField(c.solid)} />
            )}
          </div>

          <div className="relative flex flex-col min-h-[12rem] sm:min-h-[14rem] p-5 sm:p-6">
            <button
              onClick={() => navigate(backTo || `/clubs/${slug}`)}
              className="self-start font-ninja text-sm font-semibold text-white/70 hover:text-white transition-colors duration-150 flex items-center gap-1.5"
            >
              <ChevronLeftIcon size={16} strokeWidth={2.25} aria-hidden="true" />
              {backTo ? backLabel : clubDef.name}
            </button>

            <div className="mt-auto pt-6">
              <h1 className="font-ninja font-black text-white text-2xl sm:text-[2rem] leading-[1.05] tracking-[-0.02em]">
                {formatDate(session.session_date)}
              </h1>
              <p className="mt-1.5 font-ninja text-sm text-white/70 flex flex-wrap items-center gap-x-2 gap-y-1">
                {meta.map((bit, i) => (
                  <span key={bit} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden="true" className="w-1 h-1 rounded-full bg-white/35" />}
                    {bit}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Attendees */}
        <motion.div variants={fadeUp} className={`${CARD} p-5`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-ninja-navy font-ninja font-bold text-lg flex items-baseline gap-2">
              Attendees
              <span className="font-ninja font-black text-ninja-muted text-base tabular-nums">{attendeeCount}</span>
            </h2>
            {!isReadOnly && !editingAttendees && (
              <button
                onClick={loadStudents}
                className="flex items-center gap-1.5 font-ninja text-sm font-bold text-ninja-blue rounded-lg px-2 py-1 -mr-2 hover:bg-ninja-blue/[0.08] transition duration-150 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none"
              >
                {attendeeCount > 0
                  ? <><PencilIcon size={14} strokeWidth={2.5} aria-hidden="true" />Edit</>
                  : <><PlusIcon size={15} strokeWidth={2.5} aria-hidden="true" />Add ninjas</>}
              </button>
            )}
          </div>

          {editingAttendees ? (
            <div className="space-y-3">
              <AttendeePicker
                students={allStudents}
                selectedIds={selectedIds}
                onToggle={(sid) => setSelectedIds((prev) => {
                  const next = new Set(prev);
                  next.has(sid) ? next.delete(sid) : next.add(sid);
                  return next;
                })}
                search={attendeeSearch}
                onSearchChange={setAttendeeSearch}
                wide
                maxHeight="max-h-80"
              />

              <div className="flex items-center gap-2 pt-3 border-t border-ninja-border">
                <Button size="sm" onClick={handleSaveAttendees} disabled={savingAttendees}>
                  {savingAttendees ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  setEditingAttendees(false);
                  setAttendeeSearch('');
                  setSelectedIds(new Set((session.attendees || []).map((a) => a.id)));
                }}>Cancel</Button>
                <span className="ml-auto font-ninja text-sm font-bold text-ninja-muted tabular-nums">
                  {selectedIds.size} selected
                </span>
              </div>
              {attendeeError && (
                <p role="alert" className="font-ninja text-xs text-ninja-red">{attendeeError}</p>
              )}
            </div>
          ) : (
            attendeeCount === 0 ? (
              <p className="text-ninja-muted font-ninja text-sm">Nobody marked present yet.</p>
            ) : (
              /* Faces, not a wall of bordered name tags. A register is a room
                 of children, and it should be possible to tell at a glance who
                 was in it without reading every word. */
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-1 -mx-2">
                {session.attendees.map((a, i) => (
                  <motion.li
                    key={a.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg min-w-0"
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 12) * 0.03 }}
                  >
                    <NinjaAvatar name={a.full_name} sticker={a.codeorg_sticker} className="w-8 h-8 text-[11px]" />
                    <span className="font-ninja text-sm font-semibold text-ninja-navy truncate">{a.full_name}</span>
                  </motion.li>
                ))}
              </ul>
            )
          )}
        </motion.div>

        {/* Session Notes.
            An empty session opens straight into the editor. Writing the notes
            is the whole reason anyone comes back to this page, and putting a
            button in front of the box only asks them to confirm they meant it.
            With nothing written yet there is nothing to cancel back to either,
            so the editor stands alone until there is something to keep. */}
        <motion.div variants={fadeUp} className={`${CARD} p-5`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-ninja-navy font-ninja font-bold text-lg">Session Notes</h2>
            {!isReadOnly && !editingNotes && session.notes && (
              <button
                onClick={() => setEditingNotes(true)}
                className="flex items-center gap-1.5 font-ninja text-sm font-bold text-ninja-blue rounded-lg px-2 py-1 -mr-2 hover:bg-ninja-blue/[0.08] transition duration-150 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none"
              >
                <PencilIcon size={14} strokeWidth={2.5} aria-hidden="true" />
                Edit
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
                {session.notes && (
                  <Button size="sm" variant="secondary" onClick={() => { setEditingNotes(false); setNotesDraft(session.notes || ''); }}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : (
            session.notes ? (
              <MarkdownView className="font-ninja text-sm leading-relaxed text-ninja-navy">{session.notes}</MarkdownView>
            ) : (
              <p className="font-ninja text-sm leading-relaxed text-ninja-muted">No notes yet.</p>
            )
          )}
        </motion.div>
      </motion.div>
    </Layout>
  );
}
