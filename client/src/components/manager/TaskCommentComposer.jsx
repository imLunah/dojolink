import { useEffect, useMemo, useRef, useState } from 'react';
import { AtSignIcon, SendIcon } from 'lucide-react';
import { api } from '../../api/client';

const MAX_COMMENT = 2000;

function composerText(node) {
  return (node?.innerText || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n');
}

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function mentionIds(node) {
  return [...(node?.querySelectorAll('[data-mention-id]') || [])]
    .map((el) => Number(el.dataset.mentionId))
    .filter(Number.isInteger);
}

export default function TaskCommentComposer({ taskId, placeholder, posting, onPost }) {
  const editorRef = useRef(null);
  const rootRef = useRef(null);
  const savedRange = useRef(null);
  const mentionDismissed = useRef(false);
  const [body, setBody] = useState('');
  const [people, setPeople] = useState([]);
  const [mention, setMention] = useState(null); // { query, chars }
  const [active, setActive] = useState(0);

  useEffect(() => {
    let alive = true;
    api.get('/director-tasks/mentionables')
      .then((rows) => { if (alive) setPeople(rows || []); })
      .catch(() => { if (alive) setPeople([]); });
    return () => { alive = false; };
  }, [taskId]);

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        mentionDismissed.current = true;
        setMention(null);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return people
      .filter((person) => person.username && (person.username.toLowerCase().includes(query) || person.display_name.toLowerCase().includes(query)))
      .slice(0, 8);
  }, [mention, people]);

  useEffect(() => { setActive(0); }, [mention?.query]);

  const rememberCaret = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return null;
    const range = selection.getRangeAt(0).cloneRange();
    savedRange.current = range;
    return range;
  };

  const updateMention = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) {
      setMention(null);
      return;
    }
    const before = selection.getRangeAt(0).cloneRange();
    before.selectNodeContents(editorRef.current);
    before.setEnd(selection.anchorNode, selection.anchorOffset);
    const match = /(?:^|\s)@([^\s@]*)$/.exec(before.toString());
    if (!match) {
      mentionDismissed.current = false;
      setMention(null);
      return;
    }
    if (mentionDismissed.current) { setMention(null); return; }
    setMention({ query: match[1], chars: match[1].length + 1 });
  };

  const sync = () => {
    const next = composerText(editorRef.current);
    setBody(next);
    rememberCaret();
    updateMention();
  };

  const choose = (person) => {
    const range = savedRange.current;
    if (!range || !mention) return;

    // The query being replaced is always the plain text just typed after the
    // caret's nearest @. When a browser splits that text node, fall back to a
    // plain insertion rather than risking deleting an earlier token.
    if (range.startContainer.nodeType !== Node.TEXT_NODE || range.startOffset < mention.chars) return;
    range.setStart(range.startContainer, range.startOffset - mention.chars);
    range.deleteContents();

    const token = document.createElement('span');
    token.dataset.mentionId = String(person.id);
    token.dataset.mentionName = person.username;
    token.contentEditable = 'false';
    token.className = 'inline rounded-md bg-ninja-blue/15 px-1 py-0.5 font-bold text-ninja-blue-ink';
    token.textContent = `@${person.username}`;

    const spacer = document.createTextNode('\u00a0');
    const fragment = document.createDocumentFragment();
    fragment.append(token, spacer);
    range.insertNode(fragment);

    const selection = window.getSelection();
    range.setStartAfter(spacer);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange.current = range.cloneRange();
    mentionDismissed.current = false;
    setMention(null);
    setBody(composerText(editorRef.current));
    editorRef.current.focus();
  };

  const startMention = () => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    let range = savedRange.current;
    if (!range || !editorRef.current?.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    mentionDismissed.current = false;
    document.execCommand('insertText', false, '@');
    sync();
  };

  const submit = async (event) => {
    event.preventDefault();
    const text = composerText(editorRef.current).trim();
    if (!text || posting) return;
    const posted = await onPost(text, [...new Set(mentionIds(editorRef.current))]);
    if (posted === false) return;
    editorRef.current.innerHTML = '';
    setBody('');
    setMention(null);
    savedRange.current = null;
  };

  const onKeyDown = (event) => {
    if (mention && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((index) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((index) => (index - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
        event.preventDefault();
        choose(suggestions[active]);
        return;
      }
    }
    if (event.key === 'Escape' && mention) {
      event.preventDefault();
      event.stopPropagation();
      mentionDismissed.current = true;
      setMention(null);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.closest('form')?.requestSubmit();
    }
  };

  const onPaste = (event) => {
    event.preventDefault();
    const room = Math.max(0, MAX_COMMENT - composerText(editorRef.current).length);
    const plain = event.clipboardData.getData('text/plain').slice(0, room);
    document.execCommand('insertText', false, plain);
    sync();
  };

  return (
    <form ref={rootRef} onSubmit={submit}>
      <div className="relative rounded-2xl bg-white border border-ninja-border focus-within:border-ninja-blue transition-colors">
        {mention && suggestions.length > 0 && (
          <div
            role="listbox"
            aria-label="Mention a staff member"
            className="absolute left-0 right-0 bottom-[calc(100%+0.4rem)] z-10 max-h-72 overflow-y-auto rounded-xl border border-ninja-border bg-white p-1.5 shadow-lg"
          >
            <p className="px-2.5 py-1 font-ninja text-[10px] font-extrabold uppercase tracking-[0.08em] text-ninja-muted">
              People
            </p>
            {suggestions.map((person, index) => (
              <button
                key={person.id}
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(person)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-ninja text-sm font-semibold transition-colors active:scale-[0.98] ${
                  index === active
                    ? 'bg-ninja-blue/10 text-ninja-blue-ink'
                    : 'text-ninja-navy hover:bg-ninja-bg'
                }`}
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ninja-bg text-xs font-black text-ninja-muted">
                  {initials(person.display_name)}
                </span>
                <span className="truncate">{person.display_name}</span>
                <span className="ml-auto truncate font-normal text-xs text-ninja-muted">@{person.username}</span>
              </button>
            ))}
          </div>
        )}

        <div
          ref={editorRef}
          role="textbox"
          aria-label="Add a comment"
          aria-multiline="true"
          contentEditable={!posting}
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={sync}
          onKeyDown={onKeyDown}
          onKeyUp={rememberCaret}
          onMouseUp={() => { rememberCaret(); updateMention(); }}
          onPaste={onPaste}
          className="block w-full min-h-[120px] whitespace-pre-wrap break-words rounded-2xl bg-transparent px-4 pt-3 pb-14 font-ninja text-[15px] leading-relaxed text-ninja-navy focus:outline-none empty:before:pointer-events-none empty:before:text-ninja-muted empty:before:content-[attr(data-placeholder)]"
        />

        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={startMention}
            aria-label="Mention someone"
            aria-expanded={Boolean(mention)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ninja-muted transition-[color,background-color,transform] duration-150 hover:bg-ninja-bg hover:text-ninja-blue active:scale-95"
          >
            <AtSignIcon size={18} strokeWidth={2.25} aria-hidden="true" />
          </button>
          <button
            type="submit"
            disabled={!body.trim() || posting}
            aria-label="Post comment"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ninja-blue px-3.5 font-ninja text-sm font-bold text-white transition-[background-color,opacity,transform] duration-150 hover:bg-ninja-blue-hover active:scale-95 disabled:opacity-40 disabled:active:scale-100"
          >
            <SendIcon size={15} strokeWidth={2.25} aria-hidden="true" />
            Post
          </button>
        </div>
      </div>
    </form>
  );
}
