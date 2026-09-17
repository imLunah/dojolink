import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import '../../styles/markdown.css';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { ExternalLinkIcon, ItalicIcon, LinkIcon } from 'lucide-react';

// WYSIWYG note/log editor. Typing plain text and markdown shortcuts
// (**bold**, *italic*, "- " / "1. " for lists) converts in place. The value is
// stored back as markdown so saved content renders identically wherever it's
// shown. Shared by pinned notes, progress logs, and club logs.
// Two shells. `card` is the standalone editor used on white surfaces. `bare`
// drops the box entirely and inherits the surrounding text color, for editors
// that sit on a colored surface (sticky notes) where a second card inside the
// paper reads as a box in a box — and where `.dark .bg-white` would turn that
// inner box dark on top of a pastel note.
const btn = (active, bare) => {
  const base = 'flex items-center justify-center font-ninja text-sm font-bold rounded-lg transition-colors';
  if (bare) {
    return `${base} w-7 h-7 ${active ? 'bg-black/10 opacity-100' : 'opacity-60 hover:opacity-100'}`;
  }
  return `${base} w-8 h-8 ${active ? 'bg-ninja-blue/15 text-ninja-blue' : 'text-ninja-muted hover:bg-ninja-bg'}`;
};

export default function MarkdownEditor({ value, onChange, placeholder, variant = 'card', bodyClass = '' }) {
  const bare = variant === 'bare';
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkPos, setLinkPos] = useState({ top: 0, left: 0 });
  const [linkEditing, setLinkEditing] = useState(false);
  const linkBtnRef = useRef(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        // StarterKit v3 bundles the Link extension, and its default click
        // handler navigates the current tab — so clicking a link in a note
        // took the form away with it, unsaved. Opening is handled below
        // instead, in a new tab and without swallowing the click.
        link: { openOnClick: false },
      }),
      Placeholder.configure({ placeholder: placeholder || 'Write a note…' }),
      // transformCopiedText would put markdown on the clipboard, so copying a
      // URL out of a note and pasting it into the address bar handed over
      // <https://…> — angle brackets and all, because that is how a link whose
      // text is the link is written in markdown. Copying between two notes
      // keeps its formatting regardless: that travels as text/html, which
      // Tiptap writes and reads on its own.
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: false }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.storage.markdown.getMarkdown()),
    editorProps: {
      // A link in a note is usually there to be opened, and an editor you
      // cannot open a link from makes people retype the address by hand. So a
      // press opens it — in a NEW tab, which is the whole reason this is safe
      // to do from inside a form: nothing being typed is lost. Returning false
      // leaves ProseMirror to do what it would have done anyway, so the caret
      // still lands where it was pressed and the link is still editable.
      handleClick: (view, pos, event) => {
        if (event.button !== 0) return false;
        const a = event.target?.closest?.('a');
        const href = a?.getAttribute('href');
        // Only the schemes a browser should be asked to open. Anything else in
        // a stored note is not a destination, whatever it claims to be.
        if (!href || !/^(https?|mailto):/i.test(href)) return false;
        window.open(href, '_blank', 'noopener,noreferrer');
        return false;
      },
      attributes: {
        class: bare
          ? 'tiptap-note tiptap-inherit font-ninja text-sm leading-relaxed focus:outline-none'
          : 'tiptap-note font-ninja text-sm leading-relaxed text-ninja-navy focus:outline-none min-h-[5.5rem]',
      },
    },
  });

  // Tiptap builds its document from `content` when the editor is created and
  // never looks at the prop again, so a form that swaps in another record's
  // text while the editor stays mounted keeps showing the old words. On the
  // task board that reads as the wrong card open: clicking a second card
  // rebuilds every field around this one, and the note underneath is still the
  // first card's. Remounting the editor is the other way to do this, but it
  // throws away undo history and the caret, so the content is handed over
  // instead.
  //
  // Only when the incoming text is not already what the editor holds, which is
  // what typing produces: `onUpdate` sends this exact string up, it comes back
  // as `value`, and the editor is left alone.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const incoming = value || '';
    if (incoming === editor.storage.markdown.getMarkdown()) return;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div
      className={
        bare
          ? 'flex flex-col h-full min-h-0'
          : 'rounded-xl bg-white border border-ninja-border focus-within:border-ninja-blue transition-colors overflow-hidden'
      }
    >
      {editor && (
        <div
          className={
            bare
              ? 'flex items-center gap-0.5 pb-1.5 mb-1.5 border-b flex-shrink-0'
              : 'flex items-center gap-0.5 px-2 py-1.5 border-b border-ninja-border'
          }
          style={bare ? { borderColor: 'rgba(0,0,0,0.1)' } : undefined}
        >
          <button type="button" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'), bare)}>B</button>
          <button type="button" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'), bare)}>
            <ItalicIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            ref={linkBtnRef}
            title={editor.isActive('link') ? 'Edit link' : 'Insert link'}
            onClick={() => {
              if (linkOpen) { setLinkOpen(false); return; }
              // On an existing link, widen the selection to the whole link so
              // the popup edits it rather than splitting it.
              const onLink = editor.isActive('link');
              if (onLink) editor.chain().extendMarkRange('link').run();
              const { from, to } = editor.state.selection;
              setLinkText(editor.state.doc.textBetween(from, to, ' '));
              setLinkHref(onLink ? editor.getAttributes('link').href || '' : '');
              setLinkEditing(onLink);
              const r = linkBtnRef.current.getBoundingClientRect();
              setLinkPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 296)) });
              setLinkOpen(true);
            }}
            className={btn(editor.isActive('link') || linkOpen, bare)}
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          <span className={bare ? 'w-px h-4 mx-1 bg-current opacity-20' : 'w-px h-5 bg-ninja-border mx-1'} />
          <button type="button" title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'), bare)}>•</button>
          <button type="button" title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'), bare)}>1.</button>
        </div>
      )}
      {editor && linkOpen && (
        <LinkPopover
          pos={linkPos}
          text={linkText}
          setText={setLinkText}
          href={linkHref}
          setHref={setLinkHref}
          editing={linkEditing}
          onCancel={() => setLinkOpen(false)}
          onRemove={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            setLinkOpen(false);
          }}
          onApply={() => {
            let url = linkHref.trim();
            if (!url) return;
            if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
            const text = linkText.trim() || url;
            // Replaces the (widened) selection with the text carrying the
            // link, then drops the stored mark so typing after the link is
            // plain text, not more link.
            editor.chain().focus()
              .insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href: url } }] })
              .unsetMark('link')
              .run();
            setLinkOpen(false);
          }}
        />
      )}
      <EditorContent editor={editor} className={`${bare ? 'flex-1 min-h-0 overflow-y-auto' : 'px-3 py-2.5'} ${bodyClass}`.trim()} />
    </div>
  );
}

// A URL is worth opening only if a browser can be handed it. Typed addresses
// are given their scheme on save, so a field mid-edit ("amazon.com") is not
// openable yet and says so rather than opening something else.
const openable = (url) => /^(https?|mailto):/i.test(url.trim());
const openHref = (url) => {
  if (openable(url)) window.open(url.trim(), '_blank', 'noopener,noreferrer');
};

// The insert-link popup: Text and URL, and the text becomes the link. A
// solid little card portalled to the body (the editor's shell clips overflow)
// and anchored under the toolbar button, in the same fixed-position pattern
// as the pinned-note popover. Escape and Enter stop propagating so the form's
// own Modal doesn't close underneath it.
function LinkPopover({ pos, text, setText, href, setHref, editing, onApply, onRemove, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onCancel();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [onCancel]);

  const keys = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onApply(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
  };
  const fieldCls = 'w-full font-ninja text-sm text-ninja-navy bg-ninja-bg/60 border border-ninja-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-ninja-blue transition-colors';
  const labelCls = 'block font-ninja text-[11px] font-bold uppercase tracking-wide text-ninja-muted mb-1';

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={editing ? 'Edit link' : 'Insert link'}
      // Portalled to the body to escape the editor's clipping, which puts it
      // outside whatever panel the editor sits in. This says it is still part
      // of that panel, so typing a URL into it does not read as a press
      // somewhere else and close the panel out from under the note.
      data-panel-layer=""
      className="fixed z-[110] w-72 rounded-xl bg-white border border-ninja-border shadow-xl p-3"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="mb-2">
        <label className={labelCls}>Text</label>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={keys}
          placeholder="What it says" autoFocus className={fieldCls} />
      </div>
      <div className="mb-2.5">
        <label className={labelCls}>URL</label>
        <input value={href} onChange={(e) => setHref(e.target.value)} onKeyDown={keys}
          placeholder="https://…" type="url" className={fieldCls} />
      </div>
      <div className="flex items-center gap-2">
        {editing && (
          <div className="flex items-center gap-3 mr-auto">
            {/* The way to open a link without touching it. Pressing the link
                itself opens it too, but a link reached by keyboard, or one too
                short to aim at, has no press to make — and this panel is
                already open on the address. */}
            <button type="button" onClick={() => openHref(href)} disabled={!openable(href)}
              className="flex items-center gap-1 font-ninja text-xs font-bold text-ninja-blue hover:underline rounded disabled:opacity-40 disabled:no-underline">
              <ExternalLinkIcon className="w-3.5 h-3.5" />
              Open
            </button>
            <button type="button" onClick={onRemove}
              className="font-ninja text-xs font-bold text-ninja-red hover:underline rounded">
              Remove
            </button>
          </div>
        )}
        <button type="button" onClick={onCancel}
          className={`font-ninja text-xs font-bold text-ninja-muted hover:text-ninja-navy rounded px-2 py-1.5 ${editing ? '' : 'ml-auto'}`}>
          Cancel
        </button>
        <button type="button" onClick={onApply} disabled={!href.trim()}
          className="font-ninja text-xs font-bold text-white bg-ninja-blue hover:opacity-90 rounded-lg px-3 py-1.5 disabled:opacity-50 transition-opacity">
          {editing ? 'Save' : 'Add link'}
        </button>
      </div>
    </div>,
    document.body
  );
}
