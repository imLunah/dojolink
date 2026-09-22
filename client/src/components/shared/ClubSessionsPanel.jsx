import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatDate, today } from '../../utils/dateUtils';
import { api } from '../../api/client';
import Button from '../ui/Button';
import { CLUB_COLORS, COLOR_SETS, toSlug } from '../../utils/clubUtils';
import AttendeePicker from './AttendeePicker';
import { CARD } from '../../lib/surfaces';
import { Skeleton } from '../ui/Skeleton';
import { CalendarIcon, UsersIcon } from 'lucide-react';

function ClubBadge({ name }) {
  const c = CLUB_COLORS[name] || { bg: 'bg-ninja-bg', text: 'text-ninja-navy' };
  return (
    <span className={`text-xs font-ninja font-semibold px-2 py-0.5 rounded-md border border-ninja-border ${c.bg} ${c.text}`}>
      {name}
    </span>
  );
}

export { ClubBadge };

export default function ClubSessionsPanel({ sessions = [], onDeleted, onAttendeesUpdated, onCheckIn }) {
  const navigate = useNavigate();
  const { user, isReadOnly, viewAs } = useAuth();
  const isSenseiView = user?.role === 'admin' && viewAs === 'sensei';
  const isManager = ['manager', 'admin'].includes(user?.role) && !isSenseiView;

  const todayStr = today();

  // Only show sessions that haven't been logged yet (no notes); sort overdue first
  const pendingSessions = [...sessions]
    .filter((s) => !s.notes)
    .sort((a, b) => {
      const aOver = String(a.session_date).split('T')[0] < todayStr;
      const bOver = String(b.session_date).split('T')[0] < todayStr;
      if (aOver === bOver) return 0;
      return aOver ? -1 : 1;
    });

  const [expanded, setExpanded] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  // Attendee editing (manager only)
  const [editingAttendeesId, setEditingAttendeesId] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [draftAttendeeIds, setDraftAttendeeIds] = useState(new Set());
  const [savingAttendees, setSavingAttendees] = useState(false);
  // alert() is silent when the app runs standalone from the home screen, so a
  // failed save used to show nothing at all. Keyed by session id.
  const [actionError, setActionError] = useState(null);

  const startEditAttendees = async (session) => {
    setEditingAttendeesId(session.id);
    setExpanded(session.id);
    setDraftAttendeeIds(new Set((session.attendees || []).map((a) => a.id)));
    setAttendeeSearch('');
    if (allStudents.length === 0) {
      setLoadingStudents(true);
      try {
        const { students: data } = await api.get('/students?all=true');
        setAllStudents((data ?? []).filter((s) => s.active !== false));
      } catch { /* ignore */ } finally {
        setLoadingStudents(false);
      }
    }
  };

  const toggleAttendee = (id) => {
    setDraftAttendeeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const saveAttendees = async (session) => {
    setSavingAttendees(true);
    setActionError(null);
    try {
      await api.patch(`/clubs/${session.id}/attendees`, { student_ids: [...draftAttendeeIds] });
      // Only derive display names from allStudents if it has actually loaded — otherwise
      // pass null so the parent re-fetches rather than showing an empty list.
      const updatedAttendees = allStudents.length > 0
        ? allStudents.filter((s) => draftAttendeeIds.has(s.id)).map((s) => ({ id: s.id, full_name: s.full_name, codeorg_sticker: s.codeorg_sticker }))
        : null;
      if (updatedAttendees !== null) onAttendeesUpdated && onAttendeesUpdated(session.id, updatedAttendees);
      setEditingAttendeesId(null);
    } catch {
      setActionError({ id: session.id, message: "Couldn't save attendees. Please try again." });
    } finally {
      setSavingAttendees(false);
    }
  };

  const handleDelete = async (id) => {
    setActionError(null);
    try {
      await api.delete(`/clubs/${id}`);
      onDeleted && onDeleted(id);
    } catch {
      setActionError({ id, message: "Couldn't delete this session. Please try again." });
    } finally {
      setConfirmId(null);
    }
  };

  return (
    <div className="bg-white border border-ninja-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold font-ninja text-ninja-navy tracking-wide">Clubs</h2>
        {isManager && !isReadOnly && (
          <Button size="sm" onClick={onCheckIn ?? (() => navigate('/clubs/log'))}>
            + Check In Club
          </Button>
        )}
      </div>

      {pendingSessions.length === 0 ? (
        <div className="text-center py-6">
          <img src="/empty.webp" alt="No sessions" width="338" height="384" className="h-28 w-auto mx-auto mb-4 opacity-80" />
          <p className="text-lg font-semibold font-ninja text-ninja-navy">No pending club sessions.</p>
          <p className="text-ninja-muted font-ninja text-sm mt-1">No clubs have been added to today's board yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pendingSessions.map((s) => {
            const isOpen = expanded === s.id;
            const isEditingAttendees = editingAttendeesId === s.id;
            const sessionDateStr = String(s.session_date).split('T')[0];
            const isPast = sessionDateStr < todayStr;
            const attendeeCount = s.attendees?.length ?? 0;
            const color = COLOR_SETS[s.color_key] || COLOR_SETS.blue;
            const hasCover = Boolean(s.cover_image_url);

            return (
              <div
                key={s.id}
                className={`group relative ${CARD} overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
              >
                {/* Colored header band — cover image if set, else club-color gradient */}
                <div
                  className="relative h-24 flex items-end p-3"
                  style={
                    hasCover
                      ? undefined
                      : { background: `linear-gradient(135deg, ${color.solid}, ${color.solid}b3)` }
                  }
                >
                  {hasCover && (
                    <>
                      <img
                        src={s.cover_image_url}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{ background: `linear-gradient(to top, ${color.solid}e6, ${color.solid}40)` }}
                      />
                    </>
                  )}

                  <h3 className="relative font-ninja font-bold text-white text-lg leading-tight drop-shadow-sm line-clamp-2">
                    {s.club_name}
                  </h3>

                  {isPast && (
                    <span className="absolute top-2.5 left-3 bg-white/90 text-red-600 font-ninja font-bold text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md shadow-sm">
                      Overdue
                    </span>
                  )}

                  {/* X delete button */}
                  {isManager && !isReadOnly && confirmId !== s.id && (
                    <button
                      onClick={() => setConfirmId(s.id)}
                      aria-label="Remove club session"
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/20 text-white/90 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors text-xs leading-none"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Body */}
                <div className="p-4 pt-3 flex flex-col gap-3 flex-1">
                <div className="flex items-center gap-3 text-ninja-muted font-ninja text-xs">
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {formatDate(s.session_date)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UsersIcon className="w-3.5 h-3.5" />
                    {attendeeCount} {attendeeCount === 1 ? 'ninja' : 'ninjas'}
                  </span>
                </div>

                {/* Attendees toggle */}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="text-ninja-blue font-ninja text-xs font-semibold text-left hover:underline"
                >
                  {isOpen ? 'Hide attendees ▲' : 'View attendees ▼'}
                </button>

                {isOpen && (
                  isEditingAttendees ? (
                    <div className="space-y-2">
                      {loadingStudents ? (
                        <div role="status" aria-busy="true" aria-label="Loading ninjas" className="space-y-1.5"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>
                      ) : (
                        <AttendeePicker
                          students={allStudents}
                          selectedIds={draftAttendeeIds}
                          onToggle={toggleAttendee}
                          search={attendeeSearch}
                          onSearchChange={setAttendeeSearch}
                          dense
                          maxHeight="max-h-48"
                        />
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" onClick={() => saveAttendees(s)} disabled={savingAttendees || draftAttendeeIds.size === 0}>
                          {savingAttendees ? 'Saving...' : `Save (${draftAttendeeIds.size})`}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditingAttendeesId(null)}>Cancel</Button>
                      </div>
                      {actionError?.id === s.id && (
                        <p role="alert" className="font-ninja text-xs text-ninja-red">{actionError.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {s.attendees?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {s.attendees.map((a) => (
                            <span key={a.id} className="text-xs font-ninja bg-ninja-bg border border-ninja-border text-ninja-navy px-2 py-0.5 rounded-md">
                              {a.full_name}
                            </span>
                          ))}
                        </div>
                      )}
                      {!isReadOnly && (
                        <button
                          onClick={() => startEditAttendees(s)}
                          className="text-ninja-blue font-ninja text-xs hover:underline"
                        >
                          Edit attendees
                        </button>
                      )}
                    </div>
                  )
                )}

                {/* Log Progress — opens session detail with notes + comment thread */}
                {!isReadOnly && (
                  <button
                    onClick={() => navigate(`/clubs/${toSlug(s.club_name)}/sessions/${s.id}`)}
                    className="mt-auto w-full text-sm font-ninja font-bold text-white bg-ninja-blue rounded-lg py-2 hover:bg-ninja-blue/90 transition-colors"
                  >
                    Log Club
                  </button>
                )}

                {/* Manager delete confirm */}
                {isManager && !isReadOnly && confirmId === s.id && (
                  <div className="flex items-center gap-2">
                    <Button variant="danger" size="sm" onClick={() => handleDelete(s.id)}>Confirm</Button>
                    <Button variant="secondary" size="sm" onClick={() => setConfirmId(null)}>Cancel</Button>
                  </div>
                )}

                {actionError?.id === s.id && editingAttendeesId !== s.id && (
                  <p role="alert" className="font-ninja text-xs text-ninja-red">{actionError.message}</p>
                )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
