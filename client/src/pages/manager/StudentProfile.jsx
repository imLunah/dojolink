import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapIcon, PencilIcon, PlusIcon } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import BirthdayConfetti, { isBirthdayToday } from '../../components/shared/BirthdayConfetti';
import PinnedNote, { Pin } from '../../components/shared/PinnedNote';
import ProgressHistory from '../../components/shared/ProgressHistory';
import ProgressVisuals, { ActivityChart } from '../../components/parent/ProgressVisuals';
import { Group, PageTitle, Row, Tile } from '../../components/parent/ParentUI';
import EditStudentModal from '../../components/manager/EditStudentModal';
import StickerPickerModal from '../../components/shared/StickerPickerModal';
import RoadmapModal from '../../components/shared/RoadmapModal';
import BeltIcon from '../../components/ui/BeltIcon';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { SkeletonProfile } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { FLAT } from '../../lib/surfaces';
import { api } from '../../api/client';

function ageFromBirthday(value) {
  if (!value) return null;
  const birthday = new Date(String(value).split('T')[0] + 'T00:00:00');
  if (Number.isNaN(birthday.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  if (today.getMonth() < birthday.getMonth()
    || (today.getMonth() === birthday.getMonth() && today.getDate() < birthday.getDate())) age -= 1;
  return age;
}

function joinedLabel(value) {
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—';
}

function StudentHero({ student, programs, sessions, belt, locationName, birthday, canEdit, canLog, hasNote, onBack, onEdit, onLog, onNote }) {
  const age = ageFromBirthday(student.birthday);
  const since = joinedLabel(student.created_at);
  return (
    <section
      className="relative left-1/2 -mt-[max(env(safe-area-inset-top),1.25rem)] w-[calc(100%+2rem)] -translate-x-1/2 overflow-hidden rounded-b-[38px] px-6 pb-8 pt-[max(env(safe-area-inset-top),1.25rem)] text-white sm:-mt-[max(env(safe-area-inset-top),1.25rem)] sm:w-[calc(100%+3rem)] sm:px-10 lg:-mt-8 lg:min-h-[390px] lg:w-[calc(100%+4rem)] lg:px-16 lg:pb-12 lg:pt-8"
      style={{ background: 'linear-gradient(125deg, #2f74e6 0%, #1355c9 56%, #0c3d99 100%)' }}
    >
      <div aria-hidden className="absolute -right-16 -top-20 h-96 w-96 rounded-full bg-cyan-300/15 blur-3xl" />
      <img src="/profile/ninja-wave.png" alt="" aria-hidden draggable={false}
        className="pointer-events-none absolute -bottom-20 right-[-4.5rem] w-[270px] select-none object-contain drop-shadow-2xl sm:right-[-2rem] sm:w-[330px] lg:-bottom-24 lg:right-[3%] lg:w-[440px]" />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} aria-label="Back to roster"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-white/15 font-ninja text-xl font-black text-white backdrop-blur-sm transition-transform duration-150 active:scale-[0.97]">←</button>
        <div className="flex items-center gap-2">
          {canEdit && <button type="button" onClick={onEdit} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-3.5 font-ninja text-[13px] font-extrabold text-white backdrop-blur-sm transition-transform duration-150 active:scale-[0.97]"><PencilIcon size={15} aria-hidden />Edit</button>}
          {canLog && <button type="button" onClick={onLog} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-3.5 font-ninja text-[13px] font-extrabold text-[#0c3d99] shadow-sm transition-transform duration-150 active:scale-[0.97]"><PlusIcon size={16} aria-hidden />Log session</button>}
          <button type="button" onClick={onNote} aria-label={hasNote ? 'Open pinned note' : 'Add pinned note'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#315383] shadow-sm transition-transform duration-150 active:scale-[0.97]">
            <Pin className={`h-[18px] w-[18px] -rotate-12 ${hasNote ? 'text-ninja-blue' : ''}`} />
          </button>
        </div>
      </div>

      <div className="relative z-10 mt-8 max-w-[68%] lg:mt-7">
        <p className="font-ninja text-[11px] font-black uppercase tracking-[0.14em] text-white/75 sm:text-xs">Ninja since {since}</p>
        <h1 className="mt-1 font-ninja text-[38px] font-black leading-none tracking-[-0.035em] sm:text-5xl lg:text-6xl">{student.full_name}{birthday ? ' 🎂' : ''}</h1>
        <p className="mt-2 font-ninja text-[13px] font-bold text-white/75">{[locationName, age != null ? `Age ${age}` : null].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="relative z-10 mt-14 grid max-w-[72%] grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:gap-x-10 lg:mt-20">
        {[
          { label: 'Student number', value: `#${String(student.id).padStart(4, '0')}` },
          { label: 'Sessions', value: sessions },
          { label: 'Programs', value: programs.length },
          { label: 'Belt', value: belt || '—', belt },
        ].map((item) => (
          <div key={item.label} className="min-w-0">
            <div className="flex items-center gap-2">
              {item.belt && <BeltIcon belt={item.belt} size={28} />}
              <p className="truncate font-ninja text-2xl font-black leading-none sm:text-3xl">{item.value}</p>
            </div>
            <p className="mt-1.5 font-ninja text-[10px] font-black uppercase tracking-[0.1em] text-white/65 sm:text-xs">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isReadOnly, viewAs } = useAuth();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [roadmapEnrollment, setRoadmapEnrollment] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const senseiView = user?.role === 'admin' && viewAs === 'sensei';
  const manager = ['manager', 'admin'].includes(user?.role) && !senseiView;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api.get(`/students/${id}`)
      .then((data) => { if (alive) setStudent(data); })
      .catch(() => { if (alive) setError('Failed to load ninja'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, user?.activeLocation?.id]);

  const programs = student?.programs || [];
  const logs = student?.progress_logs || [];
  const realLogs = logs.filter((log) => log.notes !== 'Marked complete from roadmap');
  const portalLogs = logs.map((log) => ({ ...log, from_roadmap: log.notes === 'Marked complete from roadmap' }));
  const clubSessions = student?.club_sessions || [];
  const firstName = student?.full_name?.split(' ')[0] || '';
  const create = programs.find((program) => program.program === 'CREATE');
  const locationName = user?.availableLocations?.find((location) => location.id === student?.location_id)?.name;
  const canEditSticker = !isReadOnly && programs.some((program) => program.program === 'JR');

  const updateLog = (logId, patch) => setStudent((current) => ({
    ...current,
    progress_logs: (current.progress_logs || []).map((log) => (log.id === logId ? { ...log, ...patch } : log)),
  }));
  const removeLog = (logId) => setStudent((current) => ({
    ...current,
    progress_logs: (current.progress_logs || []).filter((log) => log.id !== logId),
  }));

  const archiveStudent = async () => {
    setArchiving(true);
    try {
      await api.delete(`/students/${id}`);
      navigate('/manager/students');
    } catch {
      setError('Failed to archive ninja');
      setArchiving(false);
      setConfirmArchive(false);
    }
  };

  const deleteStudent = async () => {
    setDeleting(true);
    try {
      await api.delete(`/students/${id}/permanent`);
      navigate('/manager/students');
    } catch {
      setError('Failed to delete ninja');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) return <Layout><SkeletonProfile label="Loading ninja" /></Layout>;
  if (error || !student) return <Layout><p className="py-12 text-center font-ninja text-ninja-red">{error || 'Ninja not found'}</p></Layout>;

  const birthday = isBirthdayToday(student.birthday);
  const logUrl = `/sensei/student/${student.id}?programs=${encodeURIComponent(programs.map((program) => program.program).join(','))}`;

  return (
    <Layout>
      {birthday && <BirthdayConfetti />}
      <div className="space-y-5 lg:space-y-7">
        <StudentHero student={student} programs={programs} sessions={realLogs.length} belt={create?.belt_level}
          locationName={locationName} birthday={birthday} canEdit={manager && !isReadOnly} canLog={!isReadOnly && programs.length > 0}
          hasNote={Boolean(student.pinned_note?.trim() || student.special_instructions?.trim())}
          onBack={() => navigate('/manager/students')} onEdit={() => setShowEdit(true)} onLog={() => navigate(logUrl)} onNote={() => setShowNote(true)} />

        <ActivityChart logs={realLogs} />

        <PageTitle title="Courses" eyebrow={`${firstName} · ${programs.length} program${programs.length === 1 ? '' : 's'}`} className="pt-2" />
        {programs.length > 0 ? (
          <>
            <ProgressVisuals programs={programs} sessionLogs={portalLogs} childName={firstName} showActivity={false} />
            {(programs.some((program) => program.program !== 'CREATE') || canEditSticker) && (
              <Group title="Course tools" className="mt-4">
                {canEditSticker && (
                  <Row first onClick={() => setShowStickerPicker(true)} lead={<Tile>JR</Tile>}
                    title="Code.AI sticker" subtitle="Choose this ninja's Code.AI login sticker" />
                )}
                {programs.filter((program) => program.program !== 'CREATE').map((program, index) => (
                  <Row key={program.id || program.program} first={!canEditSticker && index === 0} onClick={() => setRoadmapEnrollment(program)}
                    lead={<Tile><MapIcon size={15} aria-hidden /></Tile>} title={program.program} subtitle="View curriculum roadmap" />
                ))}
              </Group>
            )}
          </>
        ) : (
          <div className={`${FLAT} p-8 text-center`}><p className="font-ninja text-sm text-ninja-muted">{firstName} is not enrolled in a program yet.</p></div>
        )}

        <PageTitle title="Sessions" eyebrow={realLogs.length ? `${realLogs.length} in all` : ''} className="pt-2" />
        {realLogs.length + clubSessions.length > 0 ? (
          <div className={`${FLAT} overflow-hidden px-4`}>
            <ProgressHistory logs={realLogs} clubs={clubSessions} enrolledPrograms={programs.map((program) => program.program)} onLogUpdated={updateLog} onLogDeleted={removeLog} />
          </div>
        ) : (
          <div className={`${FLAT} p-8 text-center`}><p className="font-ninja text-sm text-ninja-muted">Sessions show up here as soon as a sensei logs one for {firstName}.</p></div>
        )}

        {manager && (student.parent_name || student.parent_email || student.parent_phone) && (
          <Group title="Parent contact">
            {student.parent_name && <Row first title={student.parent_name} subtitle="Parent or guardian" />}
            {student.parent_email && <Row first={!student.parent_name} title={student.parent_email} subtitle="Email" />}
            {student.parent_phone && <Row first={!student.parent_name && !student.parent_email} title={String(student.parent_phone).replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')} subtitle="Phone" />}
          </Group>
        )}

        {manager && !isReadOnly && (
          <section className={`${FLAT} p-4 space-y-3`}>
            {!confirmArchive && !confirmDelete && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirmArchive(true)}>Archive ninja</Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>Delete permanently</Button>
              </div>
            )}
            {confirmArchive && (
              <div className="space-y-2">
                <p className="font-ninja text-sm text-ninja-navy">Archive {firstName}? They can be restored later.</p>
                <div className="flex gap-2"><Button variant="danger" size="sm" disabled={archiving} onClick={archiveStudent}>{archiving ? 'Archiving…' : 'Confirm archive'}</Button><Button variant="secondary" size="sm" onClick={() => setConfirmArchive(false)}>Cancel</Button></div>
              </div>
            )}
            {confirmDelete && (
              <div className="space-y-2">
                <p className="font-ninja text-sm text-ninja-red">This permanently deletes all progress, programs, and session history. It cannot be undone.</p>
                <div className="flex gap-2"><Button variant="danger" size="sm" disabled={deleting} onClick={deleteStudent}>{deleting ? 'Deleting…' : 'Delete permanently'}</Button><Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button></div>
              </div>
            )}
          </section>
        )}
      </div>

      <Modal isOpen={showNote} onClose={() => setShowNote(false)} title="Pinned note">
        <PinnedNote studentId={student.id} initialNote={student.pinned_note} parentNote={student.special_instructions}
          onUpdated={(note) => setStudent((current) => ({ ...current, pinned_note: note }))} />
      </Modal>
      <EditStudentModal isOpen={showEdit} onClose={() => setShowEdit(false)} student={student} programs={programs}
        onSaved={(updated) => setStudent((current) => ({ ...current, ...updated }))}
        onProgramsChanged={(saved) => setStudent((current) => ({ ...current, programs: saved }))} />
      <StickerPickerModal isOpen={showStickerPicker} onClose={() => setShowStickerPicker(false)} student={student}
        onSaved={(sticker) => setStudent((current) => ({ ...current, codeorg_sticker: sticker }))} />
      <RoadmapModal open={Boolean(roadmapEnrollment)} onClose={() => setRoadmapEnrollment(null)} student={student} enrollment={roadmapEnrollment}
        onUpdate={() => {
          setRoadmapEnrollment(null);
          api.get(`/students/${student.id}`).then(setStudent).catch(() => {});
        }} />
    </Layout>
  );
}
