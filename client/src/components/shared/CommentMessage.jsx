import { useState } from 'react';
import { PencilIcon, TrashIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authorName } from '../../lib/authors';
import ActionMenu, { MenuItem } from '../ui/ActionMenu';
import Linkify from './Linkify';
import ReplyBar from './ReplyBar';

// One reply in a thread, laid out the way a chat app lays out a message: the
// author's picture, then their name and when they wrote it on one line, then
// what they said. Shared by progress log replies and club session replies.
//
// `onEdit(body)` and `onDelete()` do the requests and throw to report a
// failure. Who may use them mirrors the server: the author edits; the author,
// a director or an admin deletes.

const initialsOf = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// 9/21/26, 2:32 PM
const stamp = (iso) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit',
  });

export default function CommentMessage({ comment, onEdit, onDelete }) {
  const { user, isReadOnly } = useAuth();
  const name = authorName(comment.user_name);
  const mine = comment.user_id != null && comment.user_id === user?.id;
  const canEdit = !isReadOnly && !!onEdit && (mine || user?.role === 'admin');
  const canDelete = !isReadOnly && !!onDelete && (mine || ['manager', 'admin'].includes(user?.role));

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setDeleting(true);
    setError('');
    try {
      await onDelete();
    } catch (err) {
      setError(err?.message || 'Could not delete that reply.');
      setDeleting(false);
    }
  };

  return (
    <div className="comment flex gap-3">
      {comment.user_pic ? (
        <img src={comment.user_pic} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-ninja-border" />
      ) : (
        <div aria-hidden="true" className="w-9 h-9 rounded-full bg-ninja-blue flex items-center justify-center text-white font-ninja font-bold text-xs flex-shrink-0">
          {initialsOf(name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 leading-tight">
            <span className="font-ninja font-bold text-sm text-ninja-navy">{name}</span>
            <time className="font-ninja text-xs text-ninja-muted" dateTime={comment.created_at}>{stamp(comment.created_at)}</time>
          </p>
          {(canEdit || canDelete) && !editing && (
            // Out of the way until the reply is pointed at, on a pointer that
            // can hover; a touch screen shows it, having no hover to wait for.
            <ActionMenu
              label="Reply actions"
              step={confirming ? 'confirm' : 'actions'}
              onClosed={() => { setConfirming(false); setError(''); }}
              className="comment-actions -my-1 flex-shrink-0"
            >
              {({ close }) =>
                confirming ? (
                  // The confirm keeps the word "Delete"; glyphs are for
                  // reversible actions.
                  <div className="p-1.5 w-48">
                    <p className="font-ninja text-xs text-ninja-muted mb-2">Delete this reply?</p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={remove}
                        disabled={deleting}
                        className="flex-1 py-1.5 rounded-lg bg-ninja-red text-white font-ninja text-xs font-bold disabled:opacity-60"
                      >
                        {deleting ? 'Deleting…' : 'Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(false)}
                        className="flex-1 py-1.5 rounded-lg bg-ninja-bg text-ninja-navy font-ninja text-xs font-bold"
                      >
                        Keep
                      </button>
                    </div>
                    {error && <p className="text-ninja-red font-ninja text-xs mt-1.5">{error}</p>}
                  </div>
                ) : (
                  <>
                    {canEdit && (
                      <MenuItem icon={PencilIcon} onSelect={() => { setEditing(true); close({ restoreFocus: false }); }}>Edit</MenuItem>
                    )}
                    {canDelete && (
                      <MenuItem icon={TrashIcon} danger onSelect={() => setConfirming(true)}>Delete</MenuItem>
                    )}
                  </>
                )
              }
            </ActionMenu>
          )}
        </div>
        {editing ? (
          <ReplyBar
            className="mt-1.5"
            initialValue={comment.body}
            placeholder="Edit reply…"
            onSend={onEdit}
            onClose={() => setEditing(false)}
          />
        ) : (
          <p className="font-ninja text-sm text-ninja-navy mt-0.5 break-words"><Linkify>{comment.body}</Linkify></p>
        )}
      </div>
    </div>
  );
}
