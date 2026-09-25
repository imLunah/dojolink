import { useState, useRef } from 'react';
import { SmileIcon, SendHorizontalIcon } from 'lucide-react';
import { EmojiPickerButton } from '../ui/Reactions';

// The one way to reply to anything: a single filled bar, the words on the left
// and the few things you can do to them on the right, the shape every chat app
// has taught people to type into. Enter sends and Escape backs out, so the
// buttons are there for a phone, not for a keyboard.
//
// `onSend(body)` does the request and throws to report a failure; the bar keeps
// what was typed until it succeeds.
export default function ReplyBar({ onSend, onClose, placeholder = 'Write a reply…', className = '' }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const ready = body.trim() && !saving;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError('');
    try {
      await onSend(body.trim());
      setBody('');
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Could not post that reply.');
    } finally {
      setSaving(false);
    }
  };

  // An emoji lands where the caret was, not on the end of the line.
  const insert = (emoji) => {
    const el = inputRef.current;
    const at = el?.selectionStart ?? body.length;
    const to = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, at) + emoji + body.slice(to));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + emoji.length, at + emoji.length);
    });
  };

  return (
    <div className={className}>
      <form
        onSubmit={submit}
        className="flex items-center gap-0.5 h-11 pl-4 pr-1 rounded-xl bg-ninja-bg border border-ninja-border"
      >
        <input
          ref={inputRef}
          type="text"
          value={body}
          autoFocus
          onChange={(e) => setBody(e.target.value)}
          // Escape backs out of a bar opened by mistake, and must not bubble:
          // a modal behind it listens for Escape too and would close as well.
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } }}
          placeholder={placeholder}
          aria-label={placeholder.replace('…', '')}
          className="flex-1 min-w-0 bg-transparent dark:hover:bg-transparent border-0 p-0 font-ninja text-sm text-ninja-navy placeholder:text-ninja-muted focus:outline-none"
        />
        <EmojiPickerButton label="Add emoji" icon={SmileIcon} onPick={insert} />
        <button
          type="submit"
          disabled={!ready}
          title="Send"
          aria-label="Send reply"
          className="w-8 h-8 flex items-center justify-center rounded-md transition-colors duration-150 text-ninja-blue hover:bg-ninja-navy/[0.06] dark:hover:bg-white/10 disabled:text-ninja-muted disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <SendHorizontalIcon size={19} strokeWidth={2} />
        </button>
      </form>
      {error && <p className="text-ninja-red font-ninja text-xs mt-1">{error}</p>}
    </div>
  );
}
