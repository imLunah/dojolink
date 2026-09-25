import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from '../ui/Button';
import { api } from '../../api/client';
import { today } from '../../utils/dateUtils';

export default function CheckInClubModal({ isOpen, onClose, onCheckedIn }) {
  const [clubs, setClubs] = useState([]);
  const [clubName, setClubName] = useState('');
  const [sessionDate, setSessionDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setClubName('');
      setSessionDate(today());
      setError('');
      // Archived clubs keep their history but take no new sessions.
      api.get('/clubs/definitions').then((defs) => setClubs(defs.filter((d) => !d.archived_at))).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clubName) return setError('Select a club first.');
    setError('');
    setSubmitting(true);
    try {
      const result = await api.post('/clubs', { club_name: clubName, session_date: sessionDate });
      onCheckedIn && onCheckedIn(result);
      onClose();
    } catch {
      setError('Failed to check in club. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 px-4 py-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold font-ninja text-ninja-navy mb-4">Check In Club</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-2">
              Which club?
            </label>
            <div className="flex flex-wrap gap-2">
              {clubs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClubName(c.name)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-ninja font-semibold transition-colors ${
                    clubName === c.name
                      ? 'bg-ninja-blue text-white'
                      : 'bg-ninja-bg border border-ninja-border text-ninja-navy hover:border-ninja-blue'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-2">
              Date
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
            />
          </div>

          {error && <p className="text-ninja-red font-ninja text-sm">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={submitting || !clubName} size="md" className="flex-1">
              {submitting ? 'Checking in...' : 'Check In'}
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
