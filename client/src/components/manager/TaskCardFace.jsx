import { Building2Icon, MessageSquareIcon } from 'lucide-react';
import { DUE_TONE, dueMeta, plainPreview, taskHolder } from '../../lib/taskBoard';

export function MentionCountBadge({ count, className = '' }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} unread ${count === 1 ? 'mention' : 'mentions'}`}
      className={`pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-ninja text-[11px] font-black leading-none tabular-nums text-white ring-2 ring-ninja-bg ${className}`}
      style={{ backgroundColor: '#ef4444' }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// What a task card looks like, in one place.
//
// The board, the dashboard chip and its hover panel all draw this. Surfaces
// that claim to be the same board must not be separate pieces of code that can
// drift apart — a preview is only a preview if a card on it is recognisably the
// card you are about to go and find.
//
// `onOpen` is what makes a card editable. The board passes it; the previews do
// not, which is what makes them read-only by construction rather than by
// remembering to leave the controls off.
//
// Layout follows the reference: the card's own words and its menu, a
// description under them, then a footer holding the date on the left and the
// person carrying it on the right.

// Initials, then the name they belong to. The circle is what the eye finds
// when scanning a column for its own cards; the name is there because a
// two-letter circle is a puzzle until you have learnt it, and a board read by
// three people should not need learning.
function initials(name) {
  const parts = String(name).trim().split(/\s+/);
  return (parts.length === 1
    ? parts[0].slice(0, 2)
    : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// A card carried by the center wears the same chip with a building in place of
// the initials, so "everyone here" and "this person" read as answers to the
// same question rather than two different kinds of thing.
export function Assignee({ name, center }) {
  return (
    <span className="flex items-center gap-1.5 flex-shrink-0 min-w-0" aria-label={`Assigned to ${name}`}>
      <span
        aria-hidden="true"
        className="w-5 h-5 rounded-full border border-ninja-border flex items-center justify-center font-ninja text-[9px] font-black text-ninja-muted leading-none"
      >
        {center ? <Building2Icon size={11} strokeWidth={2.25} /> : initials(name)}
      </span>
      <span className="font-ninja text-xs text-ninja-muted truncate">
        {center ? name : name.split(/\s+/)[0]}
      </span>
    </span>
  );
}

export default function TaskCardFace({ task, onOpen, actions }) {
  const due = dueMeta(task.due_date);
  const body = plainPreview(task.body);
  // The center's name comes down with the card, so a board being viewed from
  // another center still names the right one.
  const holder = taskHolder(task);
  const checklist = task.checklist || [];
  const ticked = checklist.filter((i) => i.done).length;

  // A card is allowed to be a note. Everything carried over from the sticky
  // wall is a paragraph somebody typed with no title on it, and inventing one
  // from the first few words would put a heading on the card that its author
  // never wrote. So a titleless card simply leads with what it says, in the
  // weight prose deserves rather than the weight a name deserves.
  const titled = Boolean(task.title && task.title.trim());
  const lead = titled ? task.title : body;
  const supporting = titled ? body : '';

  const leadClass = titled
    ? 'font-ninja text-sm font-bold text-ninja-navy leading-snug text-pretty'
    : 'font-ninja text-sm text-ninja-navy leading-relaxed text-pretty line-clamp-4';

  return (
    <>
      <MentionCountBadge count={task.unread_mention_count} className="absolute -right-2 -top-2 z-20" />
      <div className="flex items-start gap-2">
        <div className={`flex-1 min-w-0 ${leadClass}`}>
          {onOpen ? (
            // Typography comes from the wrapper; this only adds the press.
            <button type="button" onClick={onOpen} className="w-full text-left rounded">
              {lead}
            </button>
          ) : (
            lead
          )}
        </div>
        {actions}
      </div>

      {supporting && (
        <p className="mt-1.5 font-ninja text-xs text-ninja-muted leading-relaxed line-clamp-2">
          {supporting}
        </p>
      )}

      {/* The footer holds the two things about a card that are not what it
          says: when it is due, and who has it. */}
      {(due || holder || checklist.length > 0 || task.comment_count > 0) && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 min-w-0">
            <span className={`font-ninja text-xs truncate ${due ? DUE_TONE[due.tone] : ''}`}>
              {due?.text}
            </span>
            {checklist.length > 0 && (
              <span className="font-ninja text-xs text-ninja-muted tabular-nums flex-shrink-0">
                {ticked}/{checklist.length}
              </span>
            )}
            {task.comment_count > 0 && (
              <span
                aria-label={task.comment_count === 1 ? '1 comment' : `${task.comment_count} comments`}
                className="flex items-center gap-1 font-ninja text-xs text-ninja-muted tabular-nums flex-shrink-0"
              >
                <MessageSquareIcon size={12} strokeWidth={2.25} aria-hidden="true" />
                {task.comment_count}
              </span>
            )}
          </span>
          {holder && <Assignee name={holder} center={task.assignee_center} />}
        </div>
      )}
    </>
  );
}
