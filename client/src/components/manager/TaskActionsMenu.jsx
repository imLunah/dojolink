import { useState } from 'react';
import { PencilIcon, Trash2Icon, ArrowLeftIcon, ArrowRightIcon, ArchiveRestoreIcon } from 'lucide-react';
import ActionMenu, { MenuItem } from '../ui/ActionMenu';
import { COLUMN_KEYS, COLUMN_LABEL } from '../../lib/taskBoard';

// Everything a card can have done to it, in one menu. The list view uses it:
// working through twenty rows at once wants every action in one place, where
// the board puts the common ones on the card and the rest in its dialog.
// `canMove` and `canDelete` are the carrier and owner rights from
// taskBoard.js. They default on so the menu keeps working anywhere that has
// not learned the tiers; the list passes the real answers.
export default function TaskActionsMenu({ task, canMove = true, canDelete = true, onOpen, onDelete, onPurge, onRestore, onMoveTo, className = '' }) {
  const [confirming, setConfirming] = useState(false);
  // `archived_at` is the day the card was deleted; the column is older than the
  // name. A card here is in Recently deleted, waiting out its fortnight.
  const deleted = Boolean(task.archived_at);

  return (
    <ActionMenu label="Task actions" className={className} onClosed={() => setConfirming(false)}>
      {({ close }) =>
        confirming ? (
          // A destructive confirm keeps its word. Everything else here is a
          // glyph; nothing irreversible rests on recognising one. This is the
          // only irreversible thing left in the menu — the plain Delete puts
          // the card in Recently deleted, where it can be fetched back.
          <div className="p-1.5 w-44">
            <p className="font-ninja text-xs text-ninja-muted px-1 pb-2 leading-snug">
              Delete this task for good? This can't be undone.
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => { onPurge(task); close({ restoreFocus: false }); }}
                className="flex-1 py-1.5 rounded-lg bg-ninja-red text-white font-ninja text-xs font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-95"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 py-1.5 rounded-lg bg-ninja-bg text-ninja-navy font-ninja text-xs font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-95"
              >
                Keep
              </button>
            </div>
          </div>
        ) : deleted ? (
          <>
            <MenuItem icon={ArchiveRestoreIcon} onSelect={() => { close(); onRestore(task); }}>
              Put back on the board
            </MenuItem>
            <MenuItem icon={Trash2Icon} danger onSelect={() => setConfirming(true)}>
              Delete now
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem icon={PencilIcon} onSelect={() => { close(); onOpen(); }}>
              {/* The same door either way; what is behind it depends on whose
                  card it is, and the dialog says so itself. */}
              {canDelete ? 'Edit' : 'Open'}
            </MenuItem>
            {/* The keyboard and touch route between columns, and the only route
                below xl or while a filter is on. The arrow points the way the
                card will actually travel: from the middle of the board some of
                these go backwards, and four arrows pointing right would say
                otherwise. */}
            {canMove && COLUMN_KEYS.filter((k) => k !== task.column_key).map((k) => {
              const back = COLUMN_KEYS.indexOf(k) < COLUMN_KEYS.indexOf(task.column_key);
              return (
                <MenuItem
                  key={k}
                  icon={back ? ArrowLeftIcon : ArrowRightIcon}
                  onSelect={() => { close(); onMoveTo(task, k); }}
                >
                  Move to {COLUMN_LABEL[k]}
                </MenuItem>
              );
            })}
            {/* One Delete, and it is the recoverable one: the card goes to
                Recently deleted and sits there for a fortnight. Nothing on a
                live card is irreversible any more, which is why nothing here
                stops to ask. */}
            {canDelete && (
              <MenuItem icon={Trash2Icon} danger onSelect={() => { close(); onDelete(task); }}>
                Delete
              </MenuItem>
            )}
          </>
        )
      }
    </ActionMenu>
  );
}
