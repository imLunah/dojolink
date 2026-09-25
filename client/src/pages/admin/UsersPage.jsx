import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../components/layout/Layout';
import { api } from '../../api/client';
import { CARD } from '../../lib/surfaces';
import { SkeletonList } from '../../components/ui/Skeleton';

const ADMIN_NAV_LINKS = [
  { to: '/admin/locations', label: 'Locations' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/parents', label: 'Parents' },
  { to: '/admin/curriculum', label: 'Curriculum' },
  { to: '/admin/settings', label: 'Settings' },
];

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

function HardDeleteModal({ user, onClose, onDeleted }) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const confirmed = typed.trim() === user.username;

  const handleDelete = async () => {
    if (!confirmed) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/admin/users/${user.id}`);
      onDeleted(user.id);
    } catch (err) {
      setError(err?.message || 'Failed to delete user.');
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
        <h2 className="text-ninja-red font-ninja font-bold text-lg mb-1">Permanently Delete Account</h2>
        <p className="text-ninja-muted font-ninja text-xs mb-4 leading-relaxed">
          This cannot be undone. All session assignments, club records, and progress log authorship linked to this account will be cleared.
        </p>

        <div className="bg-ninja-bg rounded-xl p-3 mb-5 font-mono text-sm">
          <span className="text-ninja-muted">Deleting:</span>{' '}
          <span className="text-ninja-navy font-semibold">{user.display_name}</span>{' '}
          <span className="text-ninja-muted">(@{user.username})</span>
        </div>

        <div className="mb-5">
          <label className="block text-ninja-muted text-xs font-ninja font-semibold mb-1">
            Type <span className="text-ninja-navy font-mono">{user.username}</span> to confirm
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
            {deleting ? 'Deleting…' : 'Delete Permanently'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-ninja-bg text-ninja-navy font-ninja font-semibold rounded-xl py-2 text-sm border border-ninja-border hover:bg-ninja-border transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function TempPasswordModal({ data, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(data.temp_password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
      >
        <h2 className="text-ninja-navy font-ninja font-bold text-lg mb-1">Temporary Password</h2>
        <p className="text-ninja-muted font-ninja text-xs mb-4">Save these. The password will not be shown again.</p>
        <div className="bg-ninja-bg rounded-xl p-4 space-y-2 font-mono text-sm mb-5">
          <div><span className="text-ninja-muted">Username:</span> <span className="text-ninja-navy font-semibold">{data.username}</span></div>
          <div><span className="text-ninja-muted">Password:</span> <span className="text-ninja-red font-bold">{data.temp_password}</span></div>
        </div>
        <div className="flex gap-3">
          <button onClick={copy} className="flex-1 bg-ninja-blue text-white font-ninja font-semibold rounded-xl py-2 text-sm hover:opacity-90 transition-opacity">
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={onClose} className="flex-1 bg-ninja-bg text-ninja-navy font-ninja font-semibold rounded-xl py-2 text-sm border border-ninja-border hover:bg-ninja-border transition-colors">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function UserFormModal({ locations, initial, onClose, onSaved }) {
  const [username, setUsername] = useState(initial?.username || '');
  const [displayName, setDisplayName] = useState(initial?.display_name || '');
  const [role, setRole] = useState(initial?.role || 'sensei');
  const [locationIds, setLocationIds] = useState(
    initial?.location_ids?.length ? initial.location_ids
      : initial?.location_id ? [initial.location_id]
      : (locations[0] ? [locations[0].id] : [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!initial;
  const inputClass = 'w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue';
  const labelClass = 'block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1';

  const toggleCenter = (id) => setLocationIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!displayName.trim() || !role || !locationIds.length) return setError('Name, role, and at least one center are required.');
    if (!isEdit && !username.trim()) return setError('Username is required.');
    setSaving(true);
    try {
      let result;
      if (isEdit) {
        result = await api.patch(`/admin/users/${initial.id}`, {
          display_name: displayName.trim(),
          role,
          location_ids: locationIds,
        });
      } else {
        result = await api.post('/admin/users', {
          username: username.trim(),
          display_name: displayName.trim(),
          role,
          location_ids: locationIds,
        });
      }
      onSaved(result);
    } catch (err) {
      setError(err?.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
      >
        <h2 className="text-ninja-navy font-ninja font-bold text-lg mb-1">{isEdit ? 'Edit User' : 'Add User'}</h2>
        {!isEdit && <p className="text-ninja-muted font-ninja text-xs mb-4">A temporary password will be generated.</p>}
        {isEdit && <div className="mb-4" />}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div>
              <label className={labelClass}>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} placeholder="cd_yorba-linda" />
            </div>
          )}
          <div>
            <label className={labelClass}>Display Name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} placeholder="Jordan Smith" />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
              <option value="manager">Center Director</option>
              <option value="sensei">Sensei</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Centers</label>
            <div className="space-y-1.5 max-h-44 overflow-y-auto border border-ninja-border rounded-lg p-2.5 bg-ninja-bg">
              {locations.map((l) => (
                <label key={l.id} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={locationIds.includes(l.id)}
                    onChange={() => toggleCenter(l.id)}
                    className="w-4 h-4 rounded accent-ninja-blue"
                  />
                  <span className="font-ninja text-sm text-ninja-navy">{l.name}</span>
                </label>
              ))}
            </div>
            <p className="text-ninja-muted font-ninja text-xs mt-1">Full access at every selected center.</p>
          </div>

          {error && <p className="text-ninja-red text-xs font-ninja">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="flex-1 bg-ninja-blue text-white font-ninja font-semibold rounded-xl py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
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

const ROLE_LABELS = { manager: 'Center Director', sensei: 'Sensei' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [tempPasswordData, setTempPasswordData] = useState(null);
  const [confirmToggleId, setConfirmToggleId] = useState(null);
  const [confirmResetId, setConfirmResetId] = useState(null);
  const [hardDeleteUser, setHardDeleteUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLocation) params.set('location_id', filterLocation);
      if (filterRole) params.set('role', filterRole);
      if (showInactive) params.set('inactive', 'true');
      const data = await api.get(`/admin/users?${params}`);
      setUsers(data);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/admin/locations').then(setLocations).catch(() => {});
  }, []);

  useEffect(() => { loadUsers(); }, [filterLocation, filterRole, showInactive]);

  const handleToggleActive = async (u) => {
    setActionLoading(u.id);
    try {
      await api.patch(`/admin/users/${u.id}`, { active: !u.active });
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      setError(err?.message || 'Failed to update user');
    } finally {
      setActionLoading(null);
      setConfirmToggleId(null);
    }
  };

  const handleResetPassword = async (u) => {
    setActionLoading(u.id);
    try {
      const result = await api.patch(`/admin/users/${u.id}/reset-password`, {});
      setTempPasswordData(result);
    } catch (err) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setActionLoading(null);
      setConfirmResetId(null);
    }
  };

  const centerLabel = (u) => {
    const ids = u.location_ids?.length ? u.location_ids : (u.location_id ? [u.location_id] : []);
    const names = ids.map((id) => locations.find((l) => l.id === id)?.name).filter(Boolean);
    return names.length ? names.join(', ') : (u.location_name || '—');
  };

  const handleSaved = (result) => {
    if (result.temp_password) {
      setTempPasswordData(result);
    }
    setShowAdd(false);
    setEditUser(null);
    loadUsers();
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <AdminNav />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-ninja-navy font-ninja font-bold text-2xl">Users</h1>
            <p className="text-ninja-muted font-ninja text-sm mt-0.5">Manage staff accounts across all locations</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-ninja-blue text-white font-ninja font-semibold rounded-xl px-4 py-2 text-sm hover:opacity-90 transition-opacity"
          >
            + Add User
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="bg-white border border-ninja-border text-ninja-navy rounded-lg px-3 py-1.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
          >
            <option value="">All Locations</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="bg-white border border-ninja-border text-ninja-navy rounded-lg px-3 py-1.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
          >
            <option value="">All Roles</option>
            <option value="manager">Center Director</option>
            <option value="sensei">Sensei</option>
          </select>
          <button
            onClick={() => setShowInactive((v) => !v)}
            className={`px-3 py-1.5 rounded-lg font-ninja text-sm font-semibold border transition-colors ${
              showInactive
                ? 'bg-ninja-hero text-white border-ninja-hero'
                : 'bg-white text-ninja-muted border-ninja-border hover:border-ninja-navy'
            }`}
          >
            {showInactive ? 'Showing Archived' : 'Show Archived'}
          </button>
        </div>

        {error && <p className="text-ninja-red font-ninja text-sm mb-4">{error}</p>}

        {loading ? (
          <SkeletonList rows={8} label="Loading users" />
        ) : (
          <div className={`${CARD} overflow-hidden`}>
            {users.length === 0 ? (
              <p className="text-ninja-muted font-ninja text-center py-12">
                {showInactive ? 'No archived users.' : 'No users found.'}
              </p>
            ) : (
              <>
                {/* Desktop header */}
                <div className="hidden lg:grid grid-cols-[2fr_1.5fr_1fr_1.2fr_auto] gap-4 px-5 py-3 border-b border-ninja-border bg-ninja-bg font-ninja font-bold text-xs text-ninja-muted uppercase tracking-widest">
                  <div>Name</div>
                  <div>Username</div>
                  <div>Role</div>
                  <div>Location</div>
                  <div />
                </div>
                <AnimatePresence>
                  {users.map((u) => {
                    const statusBadge = u.must_reset_password ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-ninja font-bold w-fit flex-shrink-0 bg-amber-100 text-amber-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Awaiting sign-in
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-ninja font-bold w-fit flex-shrink-0 bg-green-100 text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Signed in
                      </span>
                    );

                    const roleBadge = (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-ninja font-bold w-fit flex-shrink-0 ${
                        u.role === 'manager' ? 'bg-blue-100 text-ninja-blue' : 'bg-ninja-bg text-ninja-muted border border-ninja-border'
                      }`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    );

                    const actions = confirmResetId === u.id ? (
                      <>
                        <span className="text-ninja-muted font-ninja text-xs">Reset password?</span>
                        <button onClick={() => handleResetPassword(u)} disabled={actionLoading === u.id} className="text-xs font-ninja font-semibold text-white bg-amber-500 rounded-lg px-2 py-1 hover:opacity-90 disabled:opacity-50">
                          {actionLoading === u.id ? '…' : 'Yes'}
                        </button>
                        <button onClick={() => setConfirmResetId(null)} className="text-xs font-ninja text-ninja-muted hover:text-ninja-navy">No</button>
                      </>
                    ) : confirmToggleId === u.id ? (
                      <>
                        <span className="text-ninja-muted font-ninja text-xs">{u.active ? 'Deactivate?' : 'Restore?'}</span>
                        <button onClick={() => handleToggleActive(u)} disabled={actionLoading === u.id} className={`text-xs font-ninja font-semibold text-white rounded-lg px-2 py-1 hover:opacity-90 disabled:opacity-50 ${u.active ? 'bg-ninja-red' : 'bg-green-600'}`}>
                          {actionLoading === u.id ? '…' : 'Yes'}
                        </button>
                        <button onClick={() => setConfirmToggleId(null)} className="text-xs font-ninja text-ninja-muted hover:text-ninja-navy">No</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setConfirmResetId(u.id)} className="text-xs font-ninja text-ninja-muted hover:text-amber-600 transition-colors">Reset PW</button>
                        <button onClick={() => setEditUser(u)} className="text-xs font-ninja text-ninja-muted hover:text-ninja-blue transition-colors">Edit</button>
                        <button onClick={() => setConfirmToggleId(u.id)} className={`text-xs font-ninja transition-colors ${u.active ? 'text-ninja-muted hover:text-ninja-red' : 'text-ninja-muted hover:text-green-600'}`}>
                          {u.active ? 'Deactivate' : 'Restore'}
                        </button>
                        <button onClick={() => setHardDeleteUser(u)} className="text-xs font-ninja text-ninja-muted hover:text-ninja-red transition-colors">Delete</button>
                      </>
                    );

                    return (
                      <motion.div
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {/* Desktop row */}
                        <div className="hidden lg:grid grid-cols-[2fr_1.5fr_1fr_1.2fr_auto] gap-4 px-5 py-3.5 items-center border-b border-ninja-border/60 last:border-b-0 hover:bg-ninja-bg transition-colors">
                          <div className="min-w-0">
                            <p className="font-ninja font-semibold text-ninja-navy text-sm truncate">{u.display_name}</p>
                            <div className="mt-0.5">{statusBadge}</div>
                          </div>
                          <p className="font-ninja text-sm text-ninja-muted">@{u.username}</p>
                          {roleBadge}
                          <p className="font-ninja text-sm text-ninja-navy truncate" title={centerLabel(u)}>{centerLabel(u)}</p>
                          <div className="flex items-center gap-2 justify-end min-w-[220px]">{actions}</div>
                        </div>
                        {/* Mobile card */}
                        <div className="lg:hidden px-4 py-3.5 border-b border-ninja-border/60 last:border-b-0">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <p className="font-ninja font-semibold text-ninja-navy text-sm leading-snug">{u.display_name}</p>
                            {roleBadge}
                          </div>
                          <p className="font-ninja text-xs text-ninja-muted mb-1.5">@{u.username} · {centerLabel(u)}</p>
                          <div className="mb-2.5">{statusBadge}</div>
                          <div className="flex items-center gap-3 flex-wrap">{actions}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </>
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <UserFormModal
          locations={locations}
          onClose={() => setShowAdd(false)}
          onSaved={handleSaved}
        />
      )}
      {editUser && (
        <UserFormModal
          locations={locations}
          initial={editUser}
          onClose={() => setEditUser(null)}
          onSaved={handleSaved}
        />
      )}
      {tempPasswordData && (
        <TempPasswordModal data={tempPasswordData} onClose={() => setTempPasswordData(null)} />
      )}
      {hardDeleteUser && (
        <HardDeleteModal
          user={hardDeleteUser}
          onClose={() => setHardDeleteUser(null)}
          onDeleted={(id) => {
            setUsers((prev) => prev.filter((u) => u.id !== id));
            setHardDeleteUser(null);
          }}
        />
      )}
    </Layout>
  );
}
