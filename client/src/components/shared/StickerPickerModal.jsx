import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { CODEORG_STICKERS, stickerUrl, stickerLabel } from '../../utils/stickers';

// Assigns a Code.AI login sticker to a JR ninja. The sticker matches the
// picture on the student's Code.org account so kids recognize their own.
export default function StickerPickerModal({ isOpen, onClose, student, onSaved }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelected(student?.codeorg_sticker || null);
      setError('');
    }
  }, [isOpen, student]);

  const save = async (value) => {
    setLoading(true);
    setError('');
    try {
      const updated = await api.patch(`/students/${student.id}/sticker`, { codeorg_sticker: value });
      onSaved && onSaved(updated.codeorg_sticker);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save sticker');
    } finally {
      setLoading(false);
    }
  };

  if (!student) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Code.AI Sticker">
      <div className="space-y-4">
        <p className="text-ninja-muted font-ninja text-sm">
          Pick the sticker on {student.full_name.split(' ')[0]}'s Code.AI account.
        </p>

        {error && (
          <div className="bg-red-50 border border-ninja-border text-ninja-red rounded-lg p-3 text-sm font-ninja">
            {error}
          </div>
        )}

        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {CODEORG_STICKERS.map((name) => {
            const isSelected = selected === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelected(isSelected ? null : name)}
                title={stickerLabel(name)}
                className={`rounded-xl p-1.5 border transition-colors ${
                  isSelected
                    ? 'border-ninja-blue bg-ninja-blue/10'
                    : 'border-ninja-border bg-ninja-bg hover:border-ninja-blue/40'
                }`}
              >
                <img src={stickerUrl(name)} alt={stickerLabel(name)} className="w-full aspect-square object-contain" />
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 pt-1">
          <Button onClick={() => save(selected)} disabled={loading || selected === (student.codeorg_sticker || null)} className="flex-1">
            {loading ? 'Saving...' : selected ? 'Save Sticker' : student.codeorg_sticker ? 'Remove Sticker' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
