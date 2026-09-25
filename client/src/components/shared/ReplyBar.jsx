import { useState, useRef, useEffect, useMemo } from 'react';
import { SmileIcon, SendHorizontalIcon } from 'lucide-react';
import { api } from '../../api/client';
import { EmojiPickerButton } from '../ui/Reactions';

// The one way to reply to anything: a single filled bar, the words on the left
// and the few things you can do to them on the right, the shape every chat app
// has taught people to type into. Enter sends and Escape backs out, so the
// buttons are there for a phone, not for a keyboard.
//
// Typing @ offers the staff at this center, as in any chat app, matched on
// username or name, and picking one writes "@username". A mention is a person
// picked from that list, not a name typed out: the bar keeps the people
// picked, and sends the ids of those whose "@username" is still in the words, so
// the server records who was addressed rather than parsing prose.
//
// `onSend(body, mentionIds)` does the request and throws to report a failure;
// the bar keeps what was typed until it succeeds.
// `initialValue` and `initialMentions` open it on a reply already written,
// which is how one is edited: the same bar, holding the reply, caret at the end.

// Fetched when a bar opens, not cached for the page: the list is the people
// at the ACTIVE center, and a director can switch centers without a reload.
// Only one bar is open at a time, so this is one small request per reply.
const loadPeople = () => api.get('/director-tasks/mentionables').catch(() => []);

// "@" at the start or after a space, then the name so far, up to the caret.
const MENTION_AT_CARET = /(?:^|\s)@([^\s@]*)$/;

const initialsOf = (name) =>
  String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export default function ReplyBar({
  onSend, onClose, placeholder = 'Write a reply…', className = '', initialValue = '', initialMentions = [],
}) {
  const [body, setBody] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [people, setPeople] = useState([]);
  const [picked, setPicked] = useState(() =>
    initialMentions.map((m) => ({ id: m.user_id, display_name: m.display_name, username: m.username })).filter((m) => m.username));
  const [mention, setMention] = useState(null); // { query, start, end }
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const ready = body.trim() && !saving;

  useEffect(() => {
    let alive = true;
    loadPeople().then((rows) => { if (alive) setPeople(rows || []); });
    const el = inputRef.current;
    if (el && initialValue) el.setSelectionRange(initialValue.length, initialValue.length);
    return () => { alive = false; };
  }, []);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return people
      .filter((p) => p.username && (p.username.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [mention, people]);

  useEffect(() => { setActive(0); }, [mention?.query]);

  // Re-read whether the caret sits in an "@name" being typed.
  const track = (value, caret) => {
    const match = MENTION_AT_CARET.exec(value.slice(0, caret));
    setMention(match ? { query: match[1], start: caret - match[1].length - 1, end: caret } : null);
  };

  const choose = (person) => {
    if (!mention) return;
    const token = `@${person.username} `;
    const next = body.slice(0, mention.start) + token + body.slice(mention.end);
    const caret = mention.start + token.length;
    setBody(next);
    setPicked((prev) => (prev.some((p) => p.id === person.id) ? prev : [...prev, person]));
    setMention(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    const text = body.trim();
    const mentionIds = picked.filter((p) => text.includes(`@${p.username}`)).map((p) => p.id);
    setSaving(true);
    setError('');
    try {
      await onSend(text, mentionIds);
      setBody('');
      setPicked([]);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Could not post that reply.');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    if (mention && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % suggestions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(suggestions[active]); return; }
    }
    // Escape closes the list first and the bar second, and must not bubble:
    // a modal behind it listens for Escape too and would close as well.
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (mention) setMention(null);
      else onClose?.();
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
    <div className={`relative ${className}`}>
      {mention && suggestions.length > 0 && (
        <div
          role="listbox"
          aria-label="Mention a staff member"
          className="absolute left-0 right-0 bottom-[calc(100%+0.35rem)] z-30 max-h-64 overflow-y-auto rounded-xl border border-ninja-border bg-white p-1.5 shadow-lg"
        >
          {suggestions.map((person, index) => (
            <button
              key={person.id}
              type="button"
              role="option"
              aria-selected={index === active}
              // Keep the caret in the field while the pointer picks.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(person)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left font-ninja text-sm font-semibold transition-colors ${
                index === active ? 'bg-ninja-blue/10 text-ninja-blue-ink' : 'text-ninja-navy hover:bg-ninja-bg'
              }`}
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ninja-bg text-[11px] font-black text-ninja-muted">
                {initialsOf(person.display_name)}
              </span>
              <span className="truncate">{person.display_name}</span>
              <span className="ml-auto truncate font-normal text-xs text-ninja-muted">@{person.username}</span>
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={submit}
        className="flex items-center gap-0.5 h-11 pl-4 pr-1 rounded-xl bg-ninja-bg border border-ninja-border"
      >
        <input
          ref={inputRef}
          type="text"
          value={body}
          autoFocus
          onChange={(e) => { setBody(e.target.value); track(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
          onKeyDown={onKeyDown}
          onClick={(e) => track(body, e.currentTarget.selectionStart ?? body.length)}
          onBlur={() => setMention(null)}
          placeholder={placeholder}
          aria-label={placeholder.replace('…', '')}
          aria-autocomplete="list"
          aria-expanded={Boolean(mention && suggestions.length)}
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
