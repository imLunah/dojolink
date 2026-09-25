import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LinkIcon, FileTextIcon, ImageIcon, FilmIcon, FileIcon,
  ArrowDownToLineIcon, ExternalLinkIcon, PaperclipIcon, PencilIcon, PlusIcon,
} from 'lucide-react';
import Markdown from './Markdown';
import LazyMarkdownEditor from './LazyMarkdownEditor';
import Button from '../ui/Button';
import ActionMenu, { MenuItem } from '../ui/ActionMenu';
import { ReactionPicker, ReactionChips, RowActions, IN_STRIP_MENU, toggleLocally } from '../ui/Reactions';
import { TrashIcon } from '../ui/icons';
import { api } from '../../api/client';
import { uploadToSigned } from '../../lib/supabase';
import { CARD } from '../../lib/surfaces';

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const MAX_BODY = 4000;

const extOf = (post) => (post.file_name || post.url || '').split('?')[0].split('.').pop().toLowerCase();

// Only OUR uploaded files render as an image. A pasted remote URL stays a link
// card on purpose: an <img> pointing off-site would fetch on open and leak who
// looked and when.
const isImagePost = (post) => post.resource_type === 'file' && IMAGE_EXT.includes(extOf(post));

function attachmentIcon(post) {
  if (post.resource_type === 'url') return LinkIcon;
  const ext = extOf(post);
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx'].includes(ext)) return FileTextIcon;
  if (IMAGE_EXT.includes(ext)) return ImageIcon;
  if (['mp4', 'webm'].includes(ext)) return FilmIcon;
  return FileIcon;
}

const hostnameOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
};

// "Today at 4:52 PM" for the posts people are actually reading, a date once the
// post is older than that.
function postTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday - dayStart) / 86400000);
  const clock = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 0) return `Today at ${clock}`;
  if (diffDays === 1) return `Yesterday at ${clock}`;
  if (diffDays > 0 && diffDays < 7) return `${d.toLocaleDateString('en-US', { weekday: 'long' })} at ${clock}`;
  const withYear = d.getFullYear() !== now.getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear && { year: 'numeric' }) });
}

function ImageAttachment({ post }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <FileAttachment post={post} />;
  return (
    <a href={post.url} target="_blank" rel="noopener noreferrer"
      className="block mt-2 w-fit max-w-full rounded-xl overflow-hidden border border-ninja-border">
      <img
        src={post.url}
        alt={post.title || post.file_name || 'Attached image'}
        loading="lazy"
        onError={() => setBroken(true)}
        className="max-h-80 w-auto max-w-full object-contain bg-ninja-bg"
      />
    </a>
  );
}

function LinkAttachment({ post }) {
  const host = hostnameOf(post.url);
  return (
    <a href={post.url} target="_blank" rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2.5 rounded-xl border border-ninja-border px-3 py-2.5 hover:border-ninja-blue transition-colors duration-150 w-fit max-w-full">
      <LinkIcon size={16} strokeWidth={1.75} className="text-ninja-muted flex-shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block font-ninja font-semibold text-sm text-ninja-navy truncate">
          {post.title || host || post.url}
        </span>
        {host && <span className="block font-ninja text-xs text-ninja-muted truncate">{host}</span>}
      </span>
      <ExternalLinkIcon size={14} strokeWidth={1.75} className="text-ninja-muted flex-shrink-0 ml-1" aria-hidden="true" />
    </a>
  );
}

function FileAttachment({ post }) {
  const Icon = attachmentIcon(post);
  return (
    <a href={post.url} target="_blank" rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2.5 rounded-xl border border-ninja-border px-3 py-2.5 hover:border-ninja-blue transition-colors duration-150 w-fit max-w-full">
      <Icon size={16} strokeWidth={1.75} className="text-ninja-muted flex-shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block font-ninja font-semibold text-sm text-ninja-navy truncate">
          {post.title || post.file_name}
        </span>
        {post.file_name && post.title && (
          <span className="block font-ninja text-xs text-ninja-muted truncate">{post.file_name}</span>
        )}
      </span>
      <ArrowDownToLineIcon size={14} strokeWidth={1.75} className="text-ninja-muted flex-shrink-0 ml-1" aria-hidden="true" />
    </a>
  );
}

function Attachment({ post }) {
  if (!post.url) return null;
  if (isImagePost(post)) return <ImageAttachment post={post} />;
  if (post.resource_type === 'url') return <LinkAttachment post={post} />;
  return <FileAttachment post={post} />;
}

function Post({ post, canEdit, canReact, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const hasImage = isImagePost(post);
  // An image carries its own name in the caption slot; other attachments print
  // the title inside their own card, so it must not print twice.
  const heading = hasImage ? post.title : null;

  const save = async () => {
    const text = draft.trim();
    if (!text && !post.url) { setError('A post needs text.'); return; }
    setSaving(true);
    setError('');
    try {
      const updated = await api.patch(`/clubs/resources/${post.id}`, { title: post.title, body: text || null });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err?.message || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // Optimistic, then corrected by the server's own count. A failure puts the
  // chips back rather than leaving a reaction that was never stored.
  const react = async (emoji) => {
    if (!canReact) return;
    const before = post.reactions || [];
    onUpdated({ ...post, reactions: toggleLocally(before, emoji) });
    try {
      const { reactions } = await api.post(`/clubs/resources/${post.id}/reactions`, { emoji });
      onUpdated({ ...post, reactions });
    } catch (err) {
      onUpdated({ ...post, reactions: before });
      setError(err?.message || 'Could not save that reaction.');
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await api.delete(`/clubs/resources/${post.id}`);
      onDeleted(post.id);
    } catch (err) {
      setError(err?.message || 'Could not delete. Try again.');
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <motion.article
      layout="position"
      exit={{ opacity: 0, y: -4, transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] } }}
      // The tint bleeds past the text so the row reads as one object under the
      // pointer. It is an alpha over whatever is behind it, not a ninja-bg
      // swap: on the dark card ninja-bg is DARKER than the surface, which
      // recesses the row you are pointing at instead of lifting it.
      className="group -mx-3 px-3 py-4 first:pt-0 last:pb-0 rounded-lg transition-colors duration-150 hover:bg-ninja-navy/[0.04] dark:hover:bg-white/[0.05]"
    >
      <header className="flex items-baseline gap-2">
        <span className="font-ninja font-bold text-sm text-ninja-navy">{post.author_name || post.added_by}</span>
        <time className="font-ninja text-xs text-ninja-muted" dateTime={post.created_at}>
          {postTime(post.created_at)}
        </time>
        {post.updated_at && <span className="font-ninja text-xs text-ninja-muted">(edited)</span>}

        {(canReact || canEdit) && (
          <RowActions className="ml-auto self-center">
            {canReact && <ReactionPicker onPick={react} />}
            {canEdit && (
          <ActionMenu
            label="Post actions"
            step={confirming ? 'confirm' : 'actions'}
            className={`flex-shrink-0 ${IN_STRIP_MENU}`}
            onClosed={() => setConfirming(false)}
          >
            {({ close }) =>
              confirming ? (
                // The confirm stays inside the panel and keeps the word
                // "Delete". Glyphs are fine for reversible actions.
                <div className="p-1.5 w-48">
                  <p className="font-ninja text-xs text-ninja-muted mb-2">
                    Delete this post{post.url ? ' and its attachment' : ''}?
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button variant="danger" size="sm" onClick={remove} disabled={saving}>
                      {saving ? 'Deleting…' : 'Delete'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>Keep</Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* An attachment-only post can still gain text, so Edit is
                      offered on every post. Hidden mid-edit: reopening it would
                      reset the draft to what is stored and lose the typing. */}
                  {!editing && (
                    <MenuItem
                      icon={PencilIcon}
                      onSelect={() => { setDraft(post.body || ''); setEditing(true); close(); }}
                    >
                      {post.body ? 'Edit' : 'Add text'}
                    </MenuItem>
                  )}
                  {post.url && (
                    <MenuItem
                      icon={isImagePost(post) ? ExternalLinkIcon : ArrowDownToLineIcon}
                      onSelect={() => { window.open(post.url, '_blank', 'noopener,noreferrer'); close(); }}
                    >
                      {isImagePost(post) ? 'Open image' : post.resource_type === 'url' ? 'Open link' : 'Download'}
                    </MenuItem>
                  )}
                  <MenuItem icon={TrashIcon} danger onSelect={() => setConfirming(true)}>Delete</MenuItem>
                </>
              )
            }
          </ActionMenu>
            )}
          </RowActions>
        )}
      </header>

      {heading && <p className="font-ninja font-semibold text-sm text-ninja-navy mt-1.5">{heading}</p>}

      {editing ? (
        <div className="mt-2 space-y-2">
          <LazyMarkdownEditor value={draft} onChange={setDraft} placeholder="Write an update…" />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={saving || draft.length > MAX_BODY}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setEditing(false); setError(''); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        post.body && <div className="mt-1.5"><Markdown>{post.body}</Markdown></div>
      )}

      {!editing && <Attachment post={post} />}
      <ReactionChips reactions={post.reactions} canReact={canReact} onToggle={react} />
      {error && <p className="font-ninja text-xs text-ninja-red mt-2">{error}</p>}
    </motion.article>
  );
}

function Composer({ clubName, onPosted }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [attach, setAttach] = useState(null); // null | 'file' | 'url'
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  // Revoke the object URL rather than leaking a blob per picked image.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const reset = () => {
    setOpen(false); setBody(''); setAttach(null); setTitle(''); setUrl('');
    setFile(null); setPreview(null); setStatus(''); setError('');
  };

  const pickFile = (f) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f || null);
    setPreview(f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  };

  const canPost = !saving && (body.trim() || (attach === 'file' && file) || (attach === 'url' && url.trim()));

  const submit = async (e) => {
    e.preventDefault();
    if (!canPost) return;
    setSaving(true);
    setError('');
    try {
      let payload = { body: body.trim() || null, title: title.trim() || null };
      if (attach === 'file' && file) {
        setStatus('Uploading…');
        const sign = await api.post('/storage/club-resource', { filename: file.name });
        await uploadToSigned(sign.bucket, sign.path, sign.token, file, file.type || undefined);
        setStatus('Posting…');
        payload = { ...payload, path: sign.path, resource_type: 'file', file_name: file.name };
      } else if (attach === 'url' && url.trim()) {
        payload = { ...payload, url: url.trim(), resource_type: 'url' };
      }
      const post = await api.post(`/clubs/profile/${encodeURIComponent(clubName)}/resources`, payload);
      onPosted(post);
      reset();
    } catch (err) {
      setError(err?.message || 'Could not post. Try again.');
      setStatus('');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 rounded-xl border border-ninja-border bg-ninja-bg px-3.5 py-3 text-left transition-colors duration-150 hover:border-ninja-blue group/new">
        <PlusIcon size={16} strokeWidth={2} className="text-ninja-muted group-hover/new:text-ninja-blue transition-colors" aria-hidden="true" />
        <span className="font-ninja text-sm text-ninja-muted">Post an update, a link, or a file</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <LazyMarkdownEditor value={body} onChange={setBody} placeholder="Logins, class codes, what the club is building…" />

      {attach === 'url' && (
        <div className="space-y-2">
          <input type="url" value={url} autoFocus onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-xl px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue" />
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="What to call it (optional)"
            className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-xl px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue" />
        </div>
      )}

      {attach === 'file' && (
        <div className="space-y-2">
          <input ref={fileInput} type="file" onChange={(e) => pickFile(e.target.files[0])}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm"
            className="w-full text-sm font-ninja text-ninja-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-ninja file:font-semibold file:bg-ninja-blue file:text-white file:cursor-pointer cursor-pointer" />
          {preview && (
            <img src={preview} alt="" className="max-h-48 w-auto rounded-xl border border-ninja-border object-contain bg-ninja-bg" />
          )}
          {file && (
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="What to call it (optional)"
              className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-xl px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue" />
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setAttach(attach === 'file' ? null : 'file')}
          title="Attach a file" aria-label="Attach a file" aria-pressed={attach === 'file'}
          className={`p-2 rounded-full transition-colors duration-150 ${
            attach === 'file' ? 'bg-ninja-blue/10 text-ninja-blue-ink' : 'text-ninja-muted hover:text-ninja-blue'
          }`}>
          <PaperclipIcon size={17} strokeWidth={1.75} />
        </button>
        <button type="button" onClick={() => setAttach(attach === 'url' ? null : 'url')}
          title="Add a link" aria-label="Add a link" aria-pressed={attach === 'url'}
          className={`p-2 rounded-full transition-colors duration-150 ${
            attach === 'url' ? 'bg-ninja-blue/10 text-ninja-blue-ink' : 'text-ninja-muted hover:text-ninja-blue'
          }`}>
          <LinkIcon size={17} strokeWidth={1.75} />
        </button>
        <span className="ml-auto flex items-center gap-2">
          {status && <span className="font-ninja text-xs text-ninja-muted">{status}</span>}
          <Button size="sm" variant="secondary" onClick={reset}>Cancel</Button>
          <Button size="sm" type="submit" disabled={!canPost}>Post</Button>
        </span>
      </div>
      {body.length > MAX_BODY && (
        <p className="font-ninja text-xs text-ninja-red">That is longer than {MAX_BODY} characters. Trim it or attach a file instead.</p>
      )}
      {error && <p className="font-ninja text-xs text-ninja-red">{error}</p>}
    </form>
  );
}

export default function ClubBoard({ clubName, posts: initial, isReadOnly, currentUser }) {
  const [posts, setPosts] = useState(initial || []);

  const canEditPost = (post) => {
    if (isReadOnly) return false;
    if (['manager', 'admin'].includes(currentUser?.role)) return true;
    return post.created_by != null && post.created_by === currentUser?.id;
  };

  return (
    <div className={`${CARD} p-5`}>
      <h2 className="font-ninja font-bold text-ninja-navy text-base">Board</h2>
      <p className="font-ninja text-xs text-ninja-muted mt-0.5">
        Logins, class codes, slides and photos for whoever runs this club next.
      </p>

      {!isReadOnly && (
        <div className="mt-4">
          <Composer clubName={clubName} onPosted={(post) => setPosts((prev) => [post, ...prev])} />
        </div>
      )}

      {posts.length === 0 ? (
        <p className="font-ninja text-sm text-ninja-muted mt-4">
          {isReadOnly ? 'Nothing posted yet.' : 'Nothing posted yet. Start with the logins or class code the club needs every week.'}
        </p>
      ) : (
        <div className="mt-4 divide-y divide-ninja-border">
          <AnimatePresence initial={false}>
            {posts.map((post) => (
              <Post
                key={post.id}
                post={post}
                canEdit={canEditPost(post)}
                // Reacting is not editing: anyone posting at this center can
                // react to anyone's post, including their own.
                canReact={!isReadOnly}
                onUpdated={(updated) => setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
                onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
