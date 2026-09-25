import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../components/layout/Layout';
import Button from '../components/ui/Button';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { COLOR_SETS, toSlug } from '../utils/clubUtils';
import ModalPortal from '../components/ui/ModalPortal';
import CropModal from '../components/ui/CropModal';
import { uploadToSigned } from '../lib/supabase';
import { CARD } from '../lib/surfaces';
import { SkeletonCards } from '../components/ui/Skeleton';
import { TrashIcon, CameraIcon } from '../components/ui/icons';
import { ArchiveIcon, ClockIcon, PencilIcon } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ClubCard({ club, onClick, onDelete, onEdit, onArchive, canManage }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const c = COLOR_SETS[club.color_key] || COLOR_SETS.blue;
  const initial = (club.name?.trim()?.[0] || '?').toUpperCase();
  const hasCover = club.cover_image_url && !coverError;

  const handleDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await onDelete(club.id);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div className={`relative h-full flex flex-col ${CARD} hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group overflow-hidden`}>
      <button onClick={onClick} className="flex-1 flex flex-col text-left">
        {/* Identity header — cover image or a color wash with a faded monogram */}
        <div
          className="relative aspect-video overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${c.solid} 0%, ${c.solid}b3 100%)` }}
        >
          {hasCover ? (
            <img src={club.cover_image_url} alt={club.name} onError={() => setCoverError(true)} className="w-full h-full object-contain" />
          ) : (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-ninja font-black text-white/15 leading-none select-none" style={{ fontSize: '3.75rem' }}>
              {initial}
            </span>
          )}
        </div>

        <div className="flex-1 flex flex-col px-5 pt-4 pb-4">
          <h3 className="text-ninja-navy font-ninja font-bold text-lg leading-snug line-clamp-2">{club.name}</h3>

          {club.schedule && (
            <div className="flex items-center gap-1.5 mt-1.5 text-ninja-muted font-ninja text-xs font-semibold">
              <ClockIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{club.schedule}</span>
            </div>
          )}

          {club.description && (
            <p className="text-ninja-muted font-ninja text-sm leading-relaxed mt-2 line-clamp-2">{club.description}</p>
          )}

          <span className="mt-auto pt-4 inline-flex items-center gap-1 text-ninja-muted group-hover:text-ninja-blue font-ninja font-semibold text-sm transition-colors">
            View club
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </button>

      {canManage && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {confirming ? (
            <>
              <button onClick={handleDelete} disabled={deleting}
                className="text-xs font-ninja font-semibold text-white bg-ninja-red px-2 py-1 rounded-lg shadow disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => setConfirming(false)}
                className="text-xs font-ninja font-semibold text-ninja-navy bg-white/90 px-2 py-1 rounded-lg shadow">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={(e) => { e.stopPropagation(); onEdit(club); }} title="Edit club"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-white bg-black/25 hover:bg-black/40 backdrop-blur-sm p-1.5 rounded-lg">
                <PencilIcon className="w-4 h-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onArchive(club); }} title="Archive club" aria-label="Archive club"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-white bg-black/25 hover:bg-black/40 backdrop-blur-sm p-1.5 rounded-lg">
                <ArchiveIcon className="w-4 h-4" />
              </button>
              <button onClick={() => setConfirming(true)} title="Delete club"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-white bg-black/25 hover:bg-ninja-red backdrop-blur-sm p-1.5 rounded-lg">
                <TrashIcon className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EditClubModal({ club, onSaved, onClose }) {
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description || '');
  const [schedule, setSchedule] = useState(club.schedule || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const slug = name.trim() ? toSlug(name.trim()) : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Club name is required.');
    if (!schedule.trim()) return setError('Please pick which day the club meets.');
    setSaving(true);
    setError('');
    try {
      const updated = await api.patch(`/clubs/definitions/${club.id}`, {
        name: name.trim(),
        description: description.trim() || undefined,
        color_key: club.color_key || 'blue',
        schedule: schedule.trim(),
      });
      onSaved(updated);
    } catch (err) {
      setError(err?.message || 'Failed to update club.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal><div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-ninja-navy font-ninja font-bold text-xl mb-4">Edit Club</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1">
              Club Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
            />
            {slug && (
              <p className="text-ninja-muted font-ninja text-xs mt-1">URL: /clubs/{slug}</p>
            )}
          </div>

          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1">
              Description <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What do students do in this club?"
              rows={2}
              className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue resize-none"
            />
          </div>

          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1">
              Meeting Day
            </label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
            >
              <option value="">Select a day…</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-ninja-red font-ninja text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving || !name.trim() || !schedule.trim()}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div></ModalPortal>
  );
}

function CreateClubModal({ onCreated, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [cropSrc, setCropSrc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const slug = name.trim() ? toSlug(name.trim()) : '';

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please select an image file.');
    if (file.size > 10 * 1024 * 1024) return setError('Image must be under 10 MB.');
    setError('');
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (blob) => {
    setCropSrc(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(blob);
    setPhotoPreview(URL.createObjectURL(blob));
  };

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Club name is required.');
    if (!schedule.trim()) return setError('Please pick which day the club meets.');
    setSaving(true);
    setError('');
    try {
      const club = await api.post('/clubs/definitions', {
        name: name.trim(),
        description: description.trim() || undefined,
        color_key: 'blue',
        schedule: schedule.trim(),
      });

      if (photoFile) {
        try {
          const contentType = photoFile.type || 'image/jpeg';
          const sign = await api.post(`/storage/club-cover/${club.id}`, { contentType });
          await uploadToSigned(sign.bucket, sign.path, sign.token, photoFile, contentType);
          const updated = await api.patch(`/clubs/definitions/${club.id}/cover-image`, { path: sign.path });
          club.cover_image_url = updated?.cover_image_url || null;
        } catch {
          // Club is created; photo just didn't attach. Surface softly, still proceed.
          club.cover_image_url = null;
        }
      }

      onCreated(club);
    } catch (err) {
      setError(err?.message || 'Failed to create club.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal><div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-ninja-navy font-ninja font-bold text-xl mb-4">Create New Club</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1">
              Club Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Roblox Club"
              autoFocus
              className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
            />
            {slug && (
              <p className="text-ninja-muted font-ninja text-xs mt-1">URL: /clubs/{slug}</p>
            )}
          </div>

          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1">
              Description <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What do students do in this club?"
              rows={2}
              className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue resize-none"
            />
          </div>

          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1">
              Meeting Day
            </label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
            >
              <option value="">Select a day…</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1">
              Photo <span className="normal-case font-normal">(optional)</span>
            </label>
            {photoPreview ? (
              <div className="relative h-28 w-full rounded-lg overflow-hidden border border-ninja-border">
                <img src={photoPreview} alt="Club preview" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-black/50 hover:bg-black/70 text-white text-xs font-ninja font-semibold px-2 py-1 rounded-lg transition-colors"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="bg-black/50 hover:bg-ninja-red text-white text-xs font-ninja font-semibold px-2 py-1 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-ninja-bg border border-dashed border-ninja-border text-ninja-muted hover:border-ninja-blue hover:text-ninja-blue rounded-lg px-3 py-4 font-ninja text-sm transition-colors"
              >
                <CameraIcon className="w-4 h-4" />
                Add a photo
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </div>

          {error && <p className="text-ninja-red font-ninja text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving || !name.trim() || !schedule.trim()}>
              {saving ? 'Creating...' : 'Create Club'}
            </Button>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          aspect={16 / 9}
          cropShape="rect"
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div></ModalPortal>
  );
}

// Clubs that have stopped running. Their sessions and board stay, so each one
// still opens; Restore puts it back in the list and the pickers, and Delete
// (behind its own confirm) is still here for a club made by mistake.
function ArchivedClubs({ clubs, onOpen, onRestore, onDelete }) {
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const run = async (id, fn) => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); setConfirmId(null); }
  };

  return (
    <section className="space-y-3">
      <h2 className="font-ninja font-extrabold text-lg text-ninja-navy">Archived</h2>
      <ul className={`${CARD} divide-y divide-ninja-border`}>
        {clubs.map((club) => (
          <li key={club.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <button type="button" onClick={() => onOpen(club)}
              className="min-w-0 text-left font-ninja font-bold text-ninja-navy hover:text-ninja-blue transition-colors truncate">
              {club.name}
            </button>
            <div className="flex items-center gap-2 flex-shrink-0">
              {confirmId === club.id ? (
                <>
                  <button type="button" disabled={busyId === club.id} onClick={() => run(club.id, () => onDelete(club.id))}
                    className="text-sm font-ninja font-semibold text-white bg-ninja-red px-3 py-1.5 rounded-lg disabled:opacity-50">
                    {busyId === club.id ? 'Deleting…' : 'Delete'}
                  </button>
                  <button type="button" onClick={() => setConfirmId(null)}
                    className="text-sm font-ninja font-semibold text-ninja-navy border border-ninja-border px-3 py-1.5 rounded-lg">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button type="button" disabled={busyId === club.id} onClick={() => run(club.id, () => onRestore(club))}
                    className="text-sm font-ninja font-semibold text-ninja-navy border border-ninja-border px-3 py-1.5 rounded-lg hover:bg-ninja-bg transition-colors disabled:opacity-50">
                    Restore
                  </button>
                  <button type="button" onClick={() => setConfirmId(club.id)} title="Delete club" aria-label={`Delete ${club.name}`}
                    className="text-ninja-muted hover:text-ninja-red p-1.5 rounded-lg transition-colors">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ClubsPage() {
  const navigate = useNavigate();
  const { user, isReadOnly, viewAs } = useAuth();
  const isSenseiView = user?.role === 'admin' && viewAs === 'sensei';
  const isManager = ['manager', 'admin'].includes(user?.role) && !isSenseiView;

  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingClub, setEditingClub] = useState(null);

  const [error, setError] = useState('');

  const handleDeleteClub = async (id) => {
    await api.delete(`/clubs/definitions/${id}`);
    setClubs((prev) => prev.filter((c) => c.id !== id));
  };

  const setArchived = async (club, archived) => {
    setError('');
    try {
      const updated = await api.patch(`/clubs/definitions/${club.id}/archive`, { archived });
      setClubs((prev) => prev.map((c) => (c.id === updated.id ? { ...c, archived_at: updated.archived_at } : c)));
    } catch (err) {
      setError(err.message);
    }
  };

  const running = clubs.filter((c) => !c.archived_at);
  const archived = clubs.filter((c) => c.archived_at);

  useEffect(() => {
    api.get('/clubs/definitions')
      .then(setClubs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.activeLocation?.id]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-ninja text-ninja-navy tracking-wide">
              Clubs
            </h1>
            <p className="text-ninja-muted font-ninja mt-1">Weekly optional clubs at your center.</p>
          </div>
          {isManager && !isReadOnly && (
            <Button onClick={() => setShowCreate(true)}>+ Create Club</Button>
          )}
        </div>

        {loading ? (
          <SkeletonCards count={6} label="Loading clubs" />
        ) : running.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <img src="/CodeNinjasIcon.svg" alt="" className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-ninja-muted font-ninja italic">No clubs yet.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {running.map((club, i) => (
              <motion.div
                key={club.id}
                className="h-full"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.28, ease: 'easeOut' }}
              >
                <ClubCard
                  club={club}
                  onClick={() => navigate(`/clubs/${club.slug}`)}
                  canManage={isManager && !isReadOnly && !!club.location_id}
                  onDelete={handleDeleteClub}
                  onEdit={setEditingClub}
                  onArchive={(c) => setArchived(c, true)}
                />
              </motion.div>
            ))}
          </div>
        )}

        {error && <p role="alert" className="font-ninja text-sm font-semibold text-ninja-red">{error}</p>}

        {!loading && isManager && archived.length > 0 && (
          <ArchivedClubs
            clubs={archived}
            onOpen={(club) => navigate(`/clubs/${club.slug}`)}
            onRestore={(club) => setArchived(club, false)}
            onDelete={handleDeleteClub}
          />
        )}
      </div>

      {showCreate && (
        <CreateClubModal
          onCreated={(club) => {
            setClubs((prev) => [...prev, club]);
            setShowCreate(false);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editingClub && (
        <EditClubModal
          club={editingClub}
          onSaved={(updated) => {
            setClubs((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            setEditingClub(null);
          }}
          onClose={() => setEditingClub(null)}
        />
      )}
    </Layout>
  );
}
