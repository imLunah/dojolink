import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function AddSenseiModal({ isOpen, onClose, onAdded }) {
  const { user } = useAuth();
  const centers = user?.availableLocations || [];
  const activeId = user?.activeLocation?.id;
  const [form, setForm] = useState({ display_name: '', username: '' });
  const [role, setRole] = useState('sensei');
  const [locationIds, setLocationIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null); // { username, temp_password } after success
  const [copied, setCopied] = useState(false);

  // Default-check the current center each time the modal opens.
  useEffect(() => {
    if (isOpen) setLocationIds(activeId ? [activeId] : []);
  }, [isOpen, activeId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleCenter = (id) => {
    setLocationIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleClose = () => {
    setForm({ display_name: '', username: '' });
    setRole('sensei');
    setLocationIds(activeId ? [activeId] : []);
    setError('');
    setCreated(null);
    setCopied(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!locationIds.length) return setError('Select at least one center.');
    setLoading(true);
    setError('');
    try {
      const rawName = form.display_name.trim();
      const display_name = role === 'sensei' && !rawName.toLowerCase().startsWith('sensei ')
        ? `Sensei ${rawName}`
        : rawName;

      const result = await api.post('/users', {
        display_name,
        username: form.username,
        role,
        location_ids: locationIds,
      });
      onAdded && onAdded(result);
      setCreated({ username: result.username, temp_password: result.temp_password });
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.temp_password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={created ? 'Temporary Password' : 'Add Staff'}>
      {created ? (
        <div className="space-y-4">
          <p className="text-ninja-muted font-ninja text-xs">
            Share these with the new staff member. They'll set their own password during onboarding, so this password won't be shown again.
          </p>
          <div className="bg-ninja-bg rounded-xl p-4 space-y-2 font-mono text-sm border border-ninja-border">
            <div><span className="text-ninja-muted">Username:</span> <span className="text-ninja-navy font-semibold">{created.username}</span></div>
            <div><span className="text-ninja-muted">Password:</span> <span className="text-ninja-red font-bold">{created.temp_password}</span></div>
          </div>
          <div className="flex gap-3">
            <Button type="button" onClick={copy} className="flex-1">
              {copied ? 'Copied!' : 'Copy password'}
            </Button>
            <Button variant="secondary" type="button" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-ninja-border text-ninja-red rounded-lg p-3 text-sm font-ninja">
              {error}
            </div>
          )}

          {/* Role toggle */}
          <div>
            <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-2 uppercase tracking-wide">
              Role
            </label>
            <div className="flex gap-2">
              {[
                { value: 'sensei', label: 'Sensei' },
                { value: 'manager', label: 'Center Director' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-ninja font-semibold transition-colors border ${
                    role === opt.value
                      ? 'bg-ninja-blue text-white border-ninja-blue'
                      : 'bg-white border-ninja-border text-ninja-navy hover:border-ninja-blue'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {role === 'manager' && (
              <p className="text-ninja-muted font-ninja text-xs mt-1.5">
                Center Directors have full access to student management, staff, and settings.
              </p>
            )}
          </div>

          <div>
            <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
              Display Name
            </label>
            <input
              type="text"
              name="display_name"
              value={form.display_name}
              onChange={handleChange}
              required
              placeholder={role === 'sensei' ? 'e.g. Alex Kim' : 'e.g. Jordan Smith'}
              className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
            />
            {role === 'sensei' && form.display_name.trim() && !form.display_name.trim().toLowerCase().startsWith('sensei ') && (
              <p className="text-ninja-muted font-ninja text-xs mt-1">
                Will be saved as <span className="font-semibold text-ninja-navy">Sensei {form.display_name.trim()}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              placeholder={role === 'manager' ? 'e.g. director_kim' : 'e.g. sensei_alex'}
              className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
            />
          </div>

          {centers.length > 1 && (
            <div>
              <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-2 uppercase tracking-wide">
                Centers
              </label>
              <div className="space-y-1.5">
                {centers.map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={locationIds.includes(c.id)}
                      onChange={() => toggleCenter(c.id)}
                      className="w-4 h-4 rounded accent-ninja-blue"
                    />
                    <span className="font-ninja text-sm text-ninja-navy">{c.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-ninja-muted font-ninja text-xs mt-1.5">
                Assign this person to one or more centers. They get full access at each.
              </p>
            </div>
          )}

          <p className="text-ninja-muted font-ninja text-xs">
            A temporary password will be generated. The new staff member sets their own during onboarding.
          </p>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : `Add ${role === 'manager' ? 'Center Director' : 'Sensei'}`}
            </Button>
            <Button variant="secondary" type="button" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
