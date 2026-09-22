import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ProgramsEditor, { toRows, commitPrograms } from './ProgramsEditor';

export default function EditStudentModal({ isOpen, onClose, student, programs = [], onSaved, onProgramsChanged }) {
  const [form, setForm] = useState({ full_name: '', birthday: '', parent_name: '', parent_email: '', parent_phone: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (student) {
      setForm({
        full_name: student.full_name || '',
        birthday: student.birthday ? student.birthday.split('T')[0] : '',
        parent_name: student.parent_name || '',
        parent_email: student.parent_email || '',
        parent_phone: student.parent_phone || '',
      });
      setRows(toRows(programs));
      setError('');
    }
  }, [student, isOpen]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const updated = await api.patch(`/students/${student.id}`, {
        full_name: form.full_name,
        birthday: form.birthday || null,
        parent_name: form.parent_name || null,
        parent_email: form.parent_email || null,
        parent_phone: form.parent_phone || null,
      });
      // Enrollments are written after the ninja's own fields. A failure here
      // leaves the name saved, so the dialog stays open holding the enrollment
      // edits rather than reporting success it did not achieve.
      const savedPrograms = await commitPrograms(student.id, programs, rows);
      onSaved && onSaved(updated);
      onProgramsChanged && onProgramsChanged(savedPrograms);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update ninja');
    } finally {
      setLoading(false);
    }
  };

  if (!student) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Ninja">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-ninja-border text-ninja-red rounded-lg p-3 text-sm font-ninja">
            {error}
          </div>
        )}

        <div>
          <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">Full Name</label>
          <input
            type="text"
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">Birthday</label>
          <input
            type="date"
            name="birthday"
            value={form.birthday}
            onChange={handleChange}
            className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
          />
        </div>

        <div className="border-t border-ninja-border pt-4">
          <p className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide mb-3">Programs</p>
          <ProgramsEditor rows={rows} setRows={setRows} disabled={loading} />
        </div>

        <div className="border-t border-ninja-border pt-4">
          <p className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide mb-3">Parent / Guardian</p>

          <div className="space-y-3">
            <div>
              <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">Name</label>
              <input
                type="text"
                name="parent_name"
                value={form.parent_name}
                onChange={handleChange}
                placeholder="Parent's full name"
                className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
              />
            </div>
            <div>
              <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">Email</label>
              <input
                type="email"
                name="parent_email"
                value={form.parent_email}
                onChange={handleChange}
                placeholder="parent@email.com"
                className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
              />
            </div>
            <div>
              <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">Phone</label>
              <input
                type="tel"
                name="parent_phone"
                value={form.parent_phone}
                onChange={handleChange}
                placeholder="(555) 555-5555"
                className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
