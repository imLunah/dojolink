import { authorName } from '../../lib/authors';
import Linkify from './Linkify';

// One reply in a thread, laid out the way a chat app lays out a message: the
// author's picture, then their name and when they wrote it on one line, then
// what they said. Shared by progress log replies and club session replies.

const initialsOf = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// 9/21/26, 2:32 PM
const stamp = (iso) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit',
  });

export default function CommentMessage({ comment }) {
  const name = authorName(comment.user_name);
  return (
    <div className="flex gap-3">
      {comment.user_pic ? (
        <img src={comment.user_pic} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-ninja-border" />
      ) : (
        <div aria-hidden="true" className="w-9 h-9 rounded-full bg-ninja-blue flex items-center justify-center text-white font-ninja font-bold text-xs flex-shrink-0">
          {initialsOf(name)}
        </div>
      )}
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 leading-tight">
          <span className="font-ninja font-bold text-sm text-ninja-navy">{name}</span>
          <time className="font-ninja text-xs text-ninja-muted" dateTime={comment.created_at}>{stamp(comment.created_at)}</time>
        </p>
        <p className="font-ninja text-sm text-ninja-navy mt-0.5 break-words"><Linkify>{comment.body}</Linkify></p>
      </div>
    </div>
  );
}
