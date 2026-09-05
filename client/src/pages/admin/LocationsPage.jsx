import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../components/layout/Layout';
import { api } from '../../api/client';
import { SkeletonList } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';

const ADMIN_NAV_LINKS = [
  { to: '/admin/locations', label: 'Locations' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/curriculum', label: 'Curriculum' },
  { to: '/admin/settings', label: 'Settings' },
];

const autoSlug = (val) => val.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

function AdminNav() {
  const path = window.location.pathname;
  const links = ADMIN_NAV_LINKS;
  return (
    <div className="flex items-center gap-4 mb-6 border-b border-ninja-border pb-4">
      {links.map((l) => (
        <a
          key={l.to}
          href={l.to}
          className={`font-ninja text-sm font-semibold transition-colors ${
            path === l.to
              ? 'text-ninja-navy border-b-2 border-ninja-blue pb-0.5'
              : 'text-ninja-muted hover:text-ninja-navy'
          }`}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

function TempPasswordModal({ data, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(
      `Location: ${data.location.name}\nUsername: ${data.manager.username}\nTemp Password: ${data.temp_password}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🎉</span>
          <h2 className="text-ninja-navy font-ninja font-bold text-lg">Location Created!</h2>
        </div>
        <p className="text-ninja-muted font-ninja text-xs mb-5">
          Save these credentials. The password will not be shown again.
        </p>

        <div className="bg-ninja-bg rounded-xl p-4 space-y-2 font-mono text-sm mb-5">
          <div><span className="text-ninja-muted">Location:</span> <span className="text-ninja-navy font-semibold">{data.location.name}</span></div>
          <div><span className="text-ninja-muted">Slug:</span> <span className="text-ninja-navy">{data.location.slug}</span></div>
          <div><span className="text-ninja-muted">Manager username:</span> <span className="text-ninja-navy">{data.manager.username}</span></div>
          <div><span className="text-ninja-muted">Temp password:</span> <span className="text-ninja-red font-bold">{data.temp_password}</span></div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={copy}
            className="flex-1 bg-ninja-blue text-white font-ninja font-semibold rounded-xl py-2 text-sm transition-opacity hover:opacity-90"
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-ninja-bg text-ninja-navy font-ninja font-semibold rounded-xl py-2 text-sm border border-ninja-border hover:bg-ninja-border transition-colors"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AddLocationModal({ onClose, onAdded }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [managerUsername, setManagerUsername] = useState('');
  const [managerDisplayName, setManagerDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleNameChange = (val) => {
    setName(val);
    if (!slug || slug === autoSlug(name)) setSlug(autoSlug(val));
    if (!managerUsername || managerUsername === `cd_${autoSlug(name)}`) {
      setManagerUsername(`cd_${autoSlug(val)}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !slug.trim() || !managerUsername.trim() || !managerDisplayName.trim()) {
      return setError('All fields are required.');
    }
    setSaving(true);
    try {
      const result = await api.post('/admin/locations', {
        name: name.trim(),
        slug: slug.trim(),
        manager_username: managerUsername.trim(),
        manager_display_name: managerDisplayName.trim(),
      });
      onAdded(result);
    } catch (err) {
      setError(err?.message || 'Failed to create location.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue';
  const labelClass = 'block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
      >
        <h2 className="text-ninja-navy font-ninja font-bold text-lg mb-1">Add New Location</h2>
        <p className="text-ninja-muted font-ninja text-xs mb-5">A manager account will be created automatically.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Location Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Code Ninjas San Diego"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Slug <span className="normal-case text-ninja-muted font-normal">(URL-friendly ID)</span></label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="san-diego"
              className={inputClass}
            />
          </div>
          <div className="border-t border-ninja-border pt-4">
            <p className="text-ninja-muted font-ninja text-xs mb-3 font-semibold uppercase tracking-wide">Initial Manager Account</p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Username</label>
                <input
                  type="text"
                  value={managerUsername}
                  onChange={(e) => setManagerUsername(e.target.value)}
                  placeholder="cd_san-diego"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Display Name</label>
                <input
                  type="text"
                  value={managerDisplayName}
                  onChange={(e) => setManagerDisplayName(e.target.value)}
                  placeholder="San Diego Manager"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {error && <p className="text-ninja-red text-xs font-ninja">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-ninja-blue text-white font-ninja font-semibold rounded-xl py-2 text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Location'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-ninja-bg text-ninja-navy font-ninja font-semibold rounded-xl py-2 text-sm border border-ninja-border hover:bg-ninja-border transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function EditLocationModal({ loc, onClose, onSaved }) {
  const [name, setName] = useState(loc.name);
  const [code, setCode] = useState(loc.center_code || '');
  const [address, setAddress] = useState(loc.address || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextName = name.trim();
    const nextCode = code.trim().toUpperCase();
    const nextAddress = address.trim();
    if (!nextName) return setError('Name cannot be empty.');
    if (!nextCode) return setError('A center code is required.');
    if (nextName === loc.name && nextCode === (loc.center_code || '') && nextAddress === (loc.address || '')) return onClose();

    setSaving(true);
    setError('');
    try {
      const result = await api.patch(`/admin/locations/${loc.id}`, {
        name: nextName,
        center_code: nextCode,
        // Always sent, so clearing the box clears the column. The route reads
        // "key present" as "change it" and a blank string as "remove it".
        address: nextAddress,
      });
      onSaved(result);
    } catch (err) {
      setError(err?.message || 'Failed to update location.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
      >
        <h2 className="text-ninja-navy font-ninja font-bold text-lg mb-4">Edit center</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
            />
          </div>
          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1">
              Parent sign-in code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
              maxLength={10}
              spellCheck={false}
              className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-mono font-bold tracking-widest text-sm focus:outline-none focus:border-ninja-blue"
            />
            <p className="text-ninja-muted font-ninja text-xs mt-1.5">
              Parents type this with their email to sign in. Up to 10 letters or
              digits.
            </p>
          </div>
          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={200}
              placeholder="123 Main St, Yorba Linda, CA 92886"
              autoComplete="street-address"
              className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
            />
            <p className="text-ninja-muted font-ninja text-xs mt-1.5">
              One line, the way you would write it on a flyer. Parents get a
              Get directions button on an event; without this it searches the
              center by name instead.
            </p>
          </div>
          {error && <p className="text-ninja-red text-xs font-ninja">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="flex-1 bg-ninja-blue text-white font-ninja font-semibold rounded-xl py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-ninja-bg text-ninja-navy font-ninja font-semibold rounded-xl py-2 text-sm border border-ninja-border hover:bg-ninja-border transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function calcAge(birthday) {
  if (!birthday) return null;
  const dob = new Date(String(birthday).split('T')[0] + 'T00:00:00');
  if (Number.isNaN(dob.getTime())) return null;
  return Math.floor((Date.now() - dob) / (365.25 * 24 * 60 * 60 * 1000));
}

// Ninjas from other centers on this center's roster.
//
// A ninja has a home center and can be shared with others (student_locations).
// This is where a director pulls one in: search every other center by name,
// add, and the ninja appears on this center's roster, board and reports while
// staying exactly where they were everywhere else. Removing here only removes
// the share; the home center is the only one that can archive them, from the
// roster page, with its own confirm.
function SharedNinjasModal({ loc, onClose, onChanged }) {
  const [shared, setShared] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get(`/admin/locations/${loc.id}/students/shared`)
      .then((rows) => { if (!cancelled) setShared(rows); })
      .catch(() => { if (!cancelled) setShared([]); });
    return () => { cancelled = true; };
  }, [loc.id]);

  // Search as they type, but not on every keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      api.get(`/admin/locations/${loc.id}/students/search?q=${encodeURIComponent(q)}`)
        .then((rows) => { if (!cancelled) setResults(rows); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, loc.id]);

  const add = async (student) => {
    setBusyId(student.id);
    setError('');
    try {
      const row = await api.post(`/admin/locations/${loc.id}/students`, { studentId: student.id });
      setShared((prev) => [...(prev || []), row].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setResults((prev) => prev.filter((r) => r.id !== student.id));
      onChanged?.(1);
    } catch (err) {
      setError(err?.message || 'Could not add that ninja.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (student) => {
    setBusyId(student.id);
    setError('');
    try {
      await api.delete(`/admin/locations/${loc.id}/students/${student.id}`);
      setShared((prev) => (prev || []).filter((r) => r.id !== student.id));
      setConfirmId(null);
      onChanged?.(-1);
    } catch (err) {
      setError(err?.message || 'Could not remove that ninja.');
    } finally {
      setBusyId(null);
    }
  };

  const Row = ({ s, action }) => (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-ninja-navy font-ninja font-semibold text-sm truncate">{s.full_name}</p>
        <p className="text-ninja-muted font-ninja text-xs truncate">
          {calcAge(s.birthday) !== null ? `Age ${calcAge(s.birthday)} · ` : ''}
          Home: {s.home_location_name}
          {Array.isArray(s.programs) && s.programs.length > 0 ? ` · ${s.programs.join(', ')}` : ''}
        </p>
      </div>
      {action}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
      >
        <h2 className="text-ninja-navy font-ninja font-bold text-lg">Ninjas from other centers</h2>
        <p className="text-ninja-muted font-ninja text-xs mt-1 mb-4">
          Add a ninja who calls another center home to {loc.name}'s roster. They
          stay on their home roster too. Removing them here only takes them off
          {' '}{loc.name}.
        </p>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ninjas at other centers by name"
          autoFocus
          className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
        />

        {query.trim().length >= 2 && (
          <div className="mt-2 rounded-xl border border-ninja-border divide-y divide-ninja-border px-3 max-h-56 overflow-y-auto">
            {searching && results.length === 0 && (
              <p className="text-ninja-muted font-ninja text-xs py-3">Searching…</p>
            )}
            {!searching && results.length === 0 && (
              <p className="text-ninja-muted font-ninja text-xs py-3">No ninja by that name at another center.</p>
            )}
            {results.map((s) => (
              <Row key={s.id} s={s} action={
                <button
                  type="button"
                  onClick={() => add(s)}
                  disabled={busyId === s.id}
                  className="text-xs font-ninja font-semibold bg-ninja-blue text-white rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {busyId === s.id ? 'Adding…' : 'Add'}
                </button>
              } />
            ))}
          </div>
        )}

        <div className="mt-5">
          <p className="text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1">
            Shared with {loc.name}
          </p>
          {shared === null && <p className="text-ninja-muted font-ninja text-xs py-2">Loading…</p>}
          {shared && shared.length === 0 && (
            <p className="text-ninja-muted font-ninja text-xs py-2">Nobody from another center yet.</p>
          )}
          {shared && shared.length > 0 && (
            <div className="rounded-xl border border-ninja-border divide-y divide-ninja-border px-3 max-h-64 overflow-y-auto">
              {shared.map((s) => (
                <Row key={s.id} s={s} action={
                  confirmId === s.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => remove(s)}
                        disabled={busyId === s.id}
                        className="text-xs font-ninja font-semibold bg-ninja-red text-white rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
                      >
                        {busyId === s.id ? 'Removing…' : 'Remove'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="text-xs font-ninja text-ninja-muted hover:text-ninja-navy px-2 py-1.5"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(s.id)}
                      className="text-xs font-ninja text-ninja-muted hover:text-ninja-red transition-colors"
                    >
                      Remove
                    </button>
                  )
                } />
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-ninja-red text-xs font-ninja mt-3">{error}</p>}

        <div className="mt-5">
          <button type="button" onClick={onClose} className="w-full bg-ninja-bg text-ninja-navy font-ninja font-semibold rounded-xl py-2 text-sm border border-ninja-border hover:bg-ninja-border transition-colors">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DeleteLocationModal({ loc, onClose, onDeleted }) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const confirmed = typed.trim() === loc.name;

  const handleDelete = async () => {
    if (!confirmed) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/admin/locations/${loc.id}`);
      onDeleted(loc.id);
    } catch (err) {
      setError(err?.message || 'Failed to delete location.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
      >
        <h2 className="text-ninja-red font-ninja font-bold text-lg mb-1">Delete Location</h2>
        <p className="text-ninja-muted font-ninja text-xs mb-4 leading-relaxed">
          This permanently deletes all students, staff, progress logs, club sessions, and other data for this location. This cannot be undone.
        </p>
        <div className="bg-ninja-bg rounded-xl p-3 mb-4 text-sm font-ninja">
          <span className="text-ninja-muted">Deleting:</span>{' '}
          <span className="text-ninja-navy font-semibold">{loc.name}</span>
          <span className="text-ninja-muted ml-2">· {loc.student_count} students · {loc.staff_count} staff</span>
        </div>
        <div className="mb-5">
          <label className="block text-ninja-muted text-xs font-ninja font-semibold mb-1">
            Type <span className="text-ninja-navy font-mono">{loc.name}</span> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-red"
          />
        </div>
        {error && <p className="text-ninja-red font-ninja text-xs mb-3">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            disabled={!confirmed || deleting}
            className="flex-1 bg-ninja-red text-white font-ninja font-semibold rounded-xl py-2 text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {deleting ? 'Deleting…' : 'Delete Everything'}
          </button>
          <button onClick={onClose} className="flex-1 bg-ninja-bg text-ninja-navy font-ninja font-semibold rounded-xl py-2 text-sm border border-ninja-border hover:bg-ninja-border transition-colors">
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function LocationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [createdData, setCreatedData] = useState(null);
  const [editLoc, setEditLoc] = useState(null);
  const [deleteLoc, setDeleteLoc] = useState(null);
  const [sharedLoc, setSharedLoc] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/locations');
      setLocations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdded = (result) => {
    setShowAdd(false);
    setCreatedData(result);
    load();
  };

  const handleToggleActive = async (loc) => {
    setTogglingId(loc.id);
    try {
      const result = await api.patch(`/admin/locations/${loc.id}`, { active: !loc.active });
      setLocations((prev) => prev.map((l) => l.id === loc.id ? { ...l, ...result } : l));
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <AdminNav />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-ninja-navy font-ninja font-bold text-2xl">
              {isAdmin ? 'Locations' : 'Your center'}
            </h1>
            <p className="text-ninja-muted font-ninja text-sm mt-0.5">
              {isAdmin ? 'Manage Code Ninjas centers' : 'Your center\'s name and the code parents sign in with'}
            </p>
          </div>
          {/* Creating a center makes a place nobody is responsible for yet, and
              deleting one takes its students, staff, clubs and logs with it.
              Both stay with an admin; a director edits the center they run. */}
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="bg-ninja-blue text-white font-ninja font-semibold rounded-xl px-4 py-2 text-sm hover:opacity-90 transition-opacity"
            >
              + Add Location
            </button>
          )}
        </div>

        {loading ? (
          <SkeletonList rows={4} label="Loading locations" />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {locations.map((loc) => (
                <motion.div
                  key={loc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`bg-white border rounded-2xl p-4 flex items-center justify-between shadow-sm ${loc.active ? 'border-ninja-border' : 'border-dashed border-ninja-border opacity-60'}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-ninja-navy font-ninja font-semibold">{loc.name}</p>
                      {!loc.active && (
                        <span className="text-[10px] font-ninja font-bold uppercase tracking-wide bg-ninja-bg text-ninja-muted border border-ninja-border rounded-full px-2 py-0.5">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-ninja-muted font-ninja text-xs mt-0.5">
                      slug: <span className="font-mono">{loc.slug}</span>
                      <span className="mx-2">·</span>
                      {loc.student_count} student{loc.student_count !== 1 ? 's' : ''}
                      <span className="mx-2">·</span>
                      {loc.staff_count} staff
                    </p>
                    {/* The code parents type to sign in, shown here because the
                        person who has to tell them is the person on this page. */}
                    {loc.center_code && (
                      <p className="text-ninja-muted font-ninja text-xs mt-1">
                        class code:{' '}
                        <span className="font-mono font-bold tracking-widest text-ninja-navy">
                          {loc.center_code}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setEditLoc(loc)}
                      className="text-xs font-ninja text-ninja-muted hover:text-ninja-blue transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setSharedLoc(loc)}
                      className="text-xs font-ninja text-ninja-muted hover:text-ninja-blue transition-colors"
                    >
                      Ninjas
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleToggleActive(loc)}
                          disabled={togglingId === loc.id}
                          className="text-xs font-ninja text-ninja-muted hover:text-ninja-navy transition-colors disabled:opacity-50"
                        >
                          {loc.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => setDeleteLoc(loc)}
                          className="text-xs font-ninja text-ninja-muted hover:text-ninja-red transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {locations.length === 0 && !loading && (
              <p className="text-ninja-muted font-ninja text-center py-12">No locations yet.</p>
            )}
          </div>
        )}
      </div>

      {showAdd && <AddLocationModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
      {createdData && <TempPasswordModal data={createdData} onClose={() => setCreatedData(null)} />}
      {editLoc && (
        <EditLocationModal
          loc={editLoc}
          onClose={() => setEditLoc(null)}
          onSaved={(updated) => {
            setLocations((prev) => prev.map((l) => l.id === updated.id ? { ...l, ...updated } : l));
            setEditLoc(null);
          }}
        />
      )}
      {sharedLoc && (
        <SharedNinjasModal
          loc={sharedLoc}
          onClose={() => setSharedLoc(null)}
          onChanged={(delta) => {
            setLocations((prev) => prev.map((l) => l.id === sharedLoc.id ? { ...l, student_count: Math.max(0, (l.student_count || 0) + delta) } : l));
          }}
        />
      )}
      {deleteLoc && (
        <DeleteLocationModal
          loc={deleteLoc}
          onClose={() => setDeleteLoc(null)}
          onDeleted={(id) => {
            setLocations((prev) => prev.filter((l) => l.id !== id));
            setDeleteLoc(null);
          }}
        />
      )}
    </Layout>
  );
}
