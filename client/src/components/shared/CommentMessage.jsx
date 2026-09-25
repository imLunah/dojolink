import { useState, useEffect } from 'react';
import { PencilIcon, TrashIcon, ReplyIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authorName } from '../../lib/authors';
import ActionMenu, { MenuItem, MenuConfirm } from '../ui/ActionMenu';
import { ReactionPicker, ReactionChips, StripButton, IN_STRIP_MENU, toggleLocally } from '../ui/Reactions';
import MentionText from './MentionText';
import ReplyBar from './ReplyBar';

// One reply in a thread, behaving the way a chat app's message does: the
// author's picture, their name and when they wrote it, then what they said,
// with its reactions under it. Pointing at it lights the row and brings up a
// small toolbar in its corner (react, and a menu to edit or delete). A reply
// that mentions you is tinted, so it can be found in a long thread.
//
// Shared by progress log replies and club session replies. The callbacks do
// the requests and throw to report a failure:
//   onEdit(body, mentionIds) · onDelete() · onReact(emoji) -> reactions
// `onReply(person)` is the toolbar's Reply: it answers this reply in the
// thread's bar, @mentioning its author (nobody, if it is your own).
// Who may edit or delete mirrors the server: the author edits; the author, a
// director or an admin deletes.

const initialsOf = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// 9/21/26, 2:32 PM
const stamp = (iso) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit',
  });

export default function CommentMessage({ comment, onEdit, onDelete, onReact, onReply }) {
  const { user, isReadOnly } = useAuth();
  const name = authorName(comment.user_name);
  const mine = comment.user_id != null && comment.user_id === user?.id;
  const canEdit = !isReadOnly && !!onEdit && (mine || user?.role === 'admin');
  const canDelete = !isReadOnly && !!onDelete && (mine || ['manager', 'admin'].includes(user?.role));
  const canReact = !isReadOnly && !!onReact;
  const mentionsMe = (comment.mentions || []).some((m) => m.user_id === user?.id);

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [reactions, setReactions] = useState(comment.reactions || []);
  useEffect(() => { setReactions(comment.reactions || []); }, [comment.reactions]);

  // Optimistic, then settled on the server's count; a failure puts it back.
  const react = async (emoji) => {
    if (!canReact) return;
    const before = reactions;
    setReactions(toggleLocally(before, emoji));
    setError('');
    try {
      setReactions(await onReact(emoji));
    } catch (err) {
      setReactions(before);
      setError(err?.message || 'Could not save that reaction.');
    }
  };

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
    <div
      className={`comment relative flex gap-3 -mx-2 px-2 py-1.5 rounded-lg transition-colors duration-150 ${
        mentionsMe ? 'bg-amber-400/[0.12] hover:bg-amber-400/[0.18]' : 'hover:bg-ninja-navy/[0.035] dark:hover:bg-white/[0.04]'
      }`}
    >
      {comment.user_pic ? (
        <img src={comment.user_pic} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-ninja-border" />
      ) : (
        <div aria-hidden="true" className="w-9 h-9 rounded-full bg-ninja-blue flex items-center justify-center text-white font-ninja font-bold text-xs flex-shrink-0">
          {initialsOf(name)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 leading-tight">
          <span className="font-ninja font-bold text-sm text-ninja-navy">{name}</span>
          <time className="font-ninja text-xs text-ninja-muted" dateTime={comment.created_at}>{stamp(comment.created_at)}</time>
        </p>

        {editing ? (
          <ReplyBar
            className="mt-1.5"
            initialValue={comment.body}
            initialMentions={comment.mentions}
            placeholder="Edit reply…"
            onSend={onEdit}
            onClose={() => setEditing(false)}
          />
        ) : (
          <p className="font-ninja text-sm text-ninja-navy mt-0.5 break-words">
            <MentionText text={comment.body} mentions={comment.mentions} />
            {comment.edited_at && (
              <span className="ml-1.5 text-[11px] text-ninja-muted" title={`Edited ${stamp(comment.edited_at)}`}>(edited)</span>
            )}
          </p>
        )}

        <ReactionChips reactions={reactions} canReact={canReact} onToggle={react} className="mt-1" />
        {error && <p className="text-ninja-red font-ninja text-xs mt-1">{error}</p>}
      </div>

      {(canReact || canEdit || canDelete || (onReply && !isReadOnly)) && !editing && (
        // The message's toolbar, floating on its top corner. Out of sight until
        // the reply is pointed at on a pointer that can hover; a touch screen
        // shows it, having no hover to wait for.
        <div className="comment-actions absolute -top-4 right-2 z-10 flex items-center gap-0.5 rounded-lg border border-ninja-border bg-white px-1 py-0.5 shadow-sm">
          {canReact && <ReactionPicker onPick={react} />}
          {onReply && !isReadOnly && (
            <StripButton
              icon={ReplyIcon}
              label="Reply"
              onClick={() => onReply(mine ? null : { id: comment.user_id, username: comment.user_username, display_name: comment.user_name })}
            />
          )}
          {(canEdit || canDelete) && (
            <ActionMenu
              label="Reply actions"
              step={confirming ? 'confirm' : 'actions'}
              onClosed={() => { setConfirming(false); setError(''); }}
              className={`flex-shrink-0 ${IN_STRIP_MENU}`}
            >
              {({ close }) =>
                confirming ? (
                  <MenuConfirm
                    question="Delete this reply?"
                    busy={deleting}
                    onConfirm={remove}
                    onCancel={() => setConfirming(false)}
                  />
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
      )}
    </div>
  );
}
