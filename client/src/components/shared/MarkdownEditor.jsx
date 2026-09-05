import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import '../../styles/markdown.css';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { ItalicIcon, LinkIcon } from 'lucide-react';

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
        // StarterKit v3 bundles the Link extension, and its default is to OPEN
        // a link on click — so typing "code.org" mid-note and then clicking
        // near it to move the caret navigated away from the form. The editor
        // is for writing: a link here is text that happens to be a link, so it
        // still autolinks (the saved markdown carries it and the rendered log
        // makes it clickable) but never navigates from inside the editor.
        link: { openOnClick: false },
      }),
      Placeholder.configure({ placeholder: placeholder || 'Write a note…' }),
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.storage.markdown.getMarkdown()),
    editorProps: {
      attributes: {
        class: bare
          ? 'tiptap-note tiptap-inherit font-ninja text-sm leading-relaxed focus:outline-none'
          : 'tiptap-note font-ninja text-sm leading-relaxed text-ninja-navy focus:outline-none min-h-[5.5rem]',
      },
    },
  });

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
          <button type="button" onClick={onRemove}
            className="font-ninja text-xs font-bold text-ninja-red hover:underline rounded mr-auto">
            Remove
          </button>
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
