import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapIcon, PencilIcon, PlusIcon } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import BirthdayConfetti, { isBirthdayToday } from '../../components/shared/BirthdayConfetti';
import PinnedNote, { Pin } from '../../components/shared/PinnedNote';
import ProgressHistory from '../../components/shared/ProgressHistory';
import ProgressVisuals from '../../components/parent/ProgressVisuals';
import { Group, PageTitle, Row, Tile, PinnedHero, PageSheet } from '../../components/parent/ParentUI';
import NinjaHero from '../../components/parent/NinjaHero';
import { StickerBook } from '../../components/parent/StickerCollection';
import EditStudentModal from '../../components/manager/EditStudentModal';
import StickerPickerModal from '../../components/shared/StickerPickerModal';
import RoadmapModal from '../../components/shared/RoadmapModal';
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
  const activityLogs = [
    ...realLogs.map((log) => ({ ...log, from_roadmap: false })),
    ...(student?.club_sessions || []).map((session) => ({ ...session, from_roadmap: false })),
  ];
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
      <div>
        <PinnedHero>
          <NinjaHero program="CREATE" name={`${student.full_name}${birthday ? ' 🎂' : ''}`}
            eyebrow={`Ninja since ${joinedLabel(student.created_at)}`}
            secondary={[locationName, ageFromBirthday(student.birthday) != null ? `Age ${ageFromBirthday(student.birthday)}` : null].filter(Boolean).join(' · ')}
            studentNumber={`#${String(student.id).padStart(4, '0')}`}
            belt={create?.belt_level} level={create?.level} tone={student.ninja_skin_tone}
            programCount={programs.length} sessionCount={activityLogs.length} className="!mt-0"
            left={<button type="button" onClick={() => navigate('/manager/students')} aria-label="Back to roster" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/15 font-ninja text-xl font-black text-white backdrop-blur-sm">←</button>}
            right={<div className="flex items-center gap-2">
              {manager && !isReadOnly && <button type="button" onClick={() => setShowEdit(true)} className="hidden sm:inline-flex h-11 items-center gap-2 rounded-xl border border-white/35 bg-white/15 px-4 font-ninja text-sm font-extrabold text-white backdrop-blur-sm"><PencilIcon size={16} />Edit</button>}
              {!isReadOnly && programs.length > 0 && <button type="button" onClick={() => navigate(logUrl)} className="hidden sm:inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 font-ninja text-sm font-extrabold text-[#0c3d99]"><PlusIcon size={17} />Log session</button>}
              <button type="button" onClick={() => setShowNote(true)} aria-label="Open pinned note" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#315383]"><Pin className="h-[18px] w-[18px] -rotate-12" /></button>
            </div>} />
        </PinnedHero>

        <PageSheet>
          <div className="mx-auto max-w-6xl space-y-5 px-4 pb-8 sm:px-6 lg:space-y-7">
        {programs.length > 0 ? (
          <>
            <ProgressVisuals programs={programs} sessionLogs={portalLogs} childName={firstName} />
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

        <StickerBook belt={create?.belt_level} level={create?.level} logs={portalLogs} />

        <PageTitle title="Sessions" eyebrow={realLogs.length ? `${realLogs.length} in all` : ''} className="pt-2" />
        {realLogs.length > 0 ? (
          <div className={`${FLAT} max-h-[min(58vh,520px)] overflow-y-auto overscroll-contain px-4`}>
            <ProgressHistory logs={realLogs} enrolledPrograms={programs.map((program) => program.program)} onLogUpdated={updateLog} onLogDeleted={removeLog} />
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
        </PageSheet>
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
