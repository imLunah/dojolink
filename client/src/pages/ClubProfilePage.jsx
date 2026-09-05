import { useState, useEffect, useRef } from 'react';
import '../styles/markdown.css';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
import remarkGfm from 'remark-gfm';
import Layout from '../components/layout/Layout';
import Button from '../components/ui/Button';
import CropModal from '../components/ui/CropModal';
import LazyMarkdownEditor from '../components/shared/LazyMarkdownEditor';
import Linkify from '../components/shared/Linkify';
import { Pin, MARKDOWN_COMPONENTS } from '../components/shared/PinnedNote';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate, today } from '../utils/dateUtils';
import { getClubColors } from '../utils/clubUtils';
import { uploadToSigned } from '../lib/supabase';
import { CARD } from '../lib/surfaces';
import { SkeletonProfile } from '../components/ui/Skeleton';
import { TrashIcon, CameraIcon } from '../components/ui/icons';
import { UsersIcon, ChevronLeftIcon, PlusIcon, ReplyIcon } from 'lucide-react';
import ClubBoard from '../components/shared/ClubBoard';
import ActionMenu, { MenuItem } from '../components/ui/ActionMenu';
import { ReactionPicker, ReactionChips, RowActions, StripButton, toggleLocally } from '../components/ui/Reactions';
import { authorName } from '../lib/authors';

const relativeDate = (ts) => {
  if (!ts) return '';
  // Compare by calendar day in LOCAL time. pg DATE columns serialize to a
  // UTC-midnight ISO string (e.g. 2026-07-20T00:00:00.000Z); using the raw ms
  // diff against a local `now` mis-rounds it to the previous day. Parse the
  // YYYY-MM-DD part into a local date so "today" reads as Today.
  const [y, m, day] = String(ts).split('T')[0].split('-').map(Number);
  const d = new Date(y, m - 1, day);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((startOfToday - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 0 && diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Flatten markdown to a plain-text one-liner for list previews (no ** _ # - leaking).
const stripMarkdown = (text = '') =>
  text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

const mdComponents = {
  h1: ({ children }) => <h1 className="text-lg font-bold text-ninja-navy mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold text-ninja-navy mb-1">{children}</h2>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-ninja-blue hover:underline">{children}</a>,
  code: ({ children }) => <code className="bg-amber-100 px-1 rounded font-mono text-xs">{children}</code>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-amber-400 pl-3 italic text-amber-800">{children}</blockquote>,
};

function PinnedNoteSection({ clubName, initialNote, initialAuthor, initialUpdatedAt, onUpdated, isReadOnly }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(initialNote || '');
  const [draft, setDraft] = useState(initialNote || '');
  const [author, setAuthor] = useState(initialAuthor || '');
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt || null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/clubs/profile/${encodeURIComponent(clubName)}/pinned-note`, { note: draft });
      setNote(draft);
      setEditing(false);
      onUpdated && onUpdated(draft);
    } catch { } finally {
      setSaving(false);
    }
  };


  const hasNote = Boolean(note && note.trim());

  return (
    <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200/80 shadow-sm">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 text-amber-700">
            <Pin className="w-4 h-4 -rotate-12" />
            <h3 className="font-ninja font-bold text-[15px] text-amber-900">
              {hasNote && author ? `Pinned by ${author}` : 'Pinned note'}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {!isReadOnly && !editing && (
              <button
                onClick={() => { setDraft(note); setEditing(true); }}
                className="font-ninja text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors"
              >
                {hasNote ? 'Edit' : 'Add note'}
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-2.5">
            <LazyMarkdownEditor
              value={draft}
              onChange={setDraft}
              placeholder="Notes, tips, reminders for this club..."
            />
            <div className="flex items-center gap-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="font-ninja text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save note'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="font-ninja text-xs font-bold text-amber-700 hover:text-amber-900 px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : hasNote ? (
          <div className="font-ninja text-sm leading-relaxed text-gray-900 dark:text-white">
            <ReactMarkdown
              components={MARKDOWN_COMPONENTS}
              urlTransform={(url) => (/^(https?:|mailto:)/i.test(url) ? url : '')}
            >
              {note}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="font-ninja text-sm leading-relaxed text-amber-700/70 dark:text-amber-200/40">
            Nothing pinned yet.
          </p>
        )}
      </div>
    </div>
  );
}

// A session's comments, which the server has stored and returned all along
// without anything ever drawing them. Same shape as a progress log's: the thread
// is content and always shows, while replying is a button on the row.
function SessionComment({ comment }) {
  return (
    <div className="flex gap-2">
      <div className="flex-shrink-0 w-1 rounded-full bg-ninja-blue" />
      <div className="min-w-0">
        <p className="text-ninja-navy font-ninja text-sm break-words"><Linkify>{comment.body}</Linkify></p>
        <p className="text-ninja-muted font-ninja text-xs mt-0.5">
          {authorName(comment.user_name)} · {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

function SessionReplyBox({ sessionId, onAdded, onClose }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError('');
    try {
      const comment = await api.post(`/clubs/${sessionId}/comments`, { body: body.trim() });
      onAdded(comment);
      setBody('');
      onClose();
    } catch (err) {
      setError(err?.message || 'Could not post that reply.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="text"
        value={body}
        autoFocus
        onChange={(e) => setBody(e.target.value)}
        // Escape closes the box, and must not bubble: the modal listens for
        // Escape too, and would close the whole session behind it.
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
        placeholder="Write a reply…"
        className="flex-1 bg-white border border-ninja-border text-ninja-navy rounded-lg px-3 py-1.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue transition-colors"
      />
      <Button type="submit" size="sm" disabled={saving || !body.trim()}>{saving ? '…' : 'Reply'}</Button>
      {error && <p className="text-ninja-red font-ninja text-xs mt-1">{error}</p>}
    </form>
  );
}

// Quick-look popup for a session — notes, attendance, reactions and the comment
// thread, without leaving the page. Esc, backdrop click, or × to close.
function SessionQuickView({ session, memberCount, isReadOnly, onClose, onLogSession, onSessionChanged }) {
  const comments = session.comments || [];
  const [reactions, setReactions] = useState(session.reactions || []);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  // Optimistic, then corrected by the server's own count. The list behind the
  // modal is told too, so closing does not throw the change away.
  const react = async (emoji) => {
    if (isReadOnly) return;
    const before = reactions;
    const next = toggleLocally(before, emoji);
    setReactions(next);
    setError('');
    try {
      const res = await api.post(`/clubs/${session.id}/reactions`, { emoji });
      setReactions(res.reactions);
      onSessionChanged?.(session.id, { reactions: res.reactions });
    } catch (err) {
      setReactions(before);
      setError(err?.message || 'Could not save that reaction.');
    }
  };

  const present = session.attendees?.length ?? 0;
  const rel = relativeDate(session.session_date);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] p-0 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full sm:max-w-2xl max-h-[88dvh] flex flex-col bg-white border border-ninja-border rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-ninja-border flex-shrink-0">
          <div className="min-w-0">
            <h3 className="font-ninja font-bold text-ninja-navy text-lg leading-tight">{formatDate(session.session_date)}</h3>
            {rel && <p className="font-ninja text-xs text-ninja-muted mt-0.5">{rel}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-ninja-bg border border-ninja-border px-2.5 py-1 font-ninja text-xs font-semibold text-ninja-navy">
              <UsersIcon className="w-3.5 h-3.5 text-ninja-muted" />
              {present}{memberCount > 0 ? `/${memberCount}` : ''}
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-ninja-muted hover:text-ninja-navy transition-colors text-2xl leading-none -mt-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {session.attendees?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {session.attendees.map((a) => (
                <span key={a.id} className="text-xs font-ninja bg-ninja-bg border border-ninja-border text-ninja-navy px-2 py-0.5 rounded-md">
                  {a.full_name}
                </span>
              ))}
            </div>
          )}
          {/* The session and its actions. Unlike a row in a list there is only
              one subject here, so nothing is hover-revealed: there is nothing to
              disambiguate and no second thing the strip could belong to. */}
          <div className="group">
            {session.notes ? (
              <div className="md-view font-ninja text-sm text-ninja-navy leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{session.notes}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-ninja-muted font-ninja text-sm italic">No notes logged yet.</p>
            )}

            {/* Chips stay live in here so you can join a reaction while
                reading, but the picker and reply live on the row in the list.
                Reacting is a thing you do TO a session in a list of them, not
                something to open a session for. */}
            <ReactionChips reactions={reactions} canReact={!isReadOnly} onToggle={react} className="mt-3" />
            {error && <p className="text-ninja-red font-ninja text-xs mt-1.5">{error}</p>}
          </div>

          {comments.length > 0 && (
            <div className="space-y-2 border-t border-ninja-border pt-4">
              {comments.map((c) => <SessionComment key={c.id} comment={c} />)}
            </div>
          )}
        </div>

        {/* Logging notes is still a trip to the session page, because it is an
            editor and not a thing to read. Reading, reacting and replying all
            happen here now, so the old "Open full session" way out is gone. */}
        {!session.notes && !isReadOnly && (
          <div className="flex-shrink-0 px-5 py-3.5 border-t border-ninja-border">
            <button
              onClick={onLogSession}
              className="w-full py-2.5 rounded-xl bg-ninja-blue text-white font-ninja font-bold text-sm hover:bg-ninja-blue/90 transition-colors"
            >
              Log this session
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
}

function SessionsSection({ sessions, memberCount, slug, navigate, isManager, isReadOnly, onDeleted, onSessionChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [quickView, setQuickView] = useState(null);
  const [replyingId, setReplyingId] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const todayStr = today();
  const shown = expanded ? sessions : sessions.slice(0, 4);
  const canDelete = isManager && !isReadOnly;

  // Optimistic, then corrected by the server's own count.
  const react = async (session, emoji) => {
    if (isReadOnly) return;
    const before = session.reactions || [];
    onSessionChanged?.(session.id, { reactions: toggleLocally(before, emoji) });
    setRowErrors((prev) => ({ ...prev, [session.id]: '' }));
    try {
      const { reactions } = await api.post(`/clubs/${session.id}/reactions`, { emoji });
      onSessionChanged?.(session.id, { reactions });
    } catch (err) {
      onSessionChanged?.(session.id, { reactions: before });
      setRowErrors((prev) => ({ ...prev, [session.id]: err?.message || 'Could not save that reaction.' }));
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/clubs/${id}`);
      onDeleted && onDeleted(id);
      setConfirmId(null);
    } catch {
      // leave confirm open so the CD can retry
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-ninja font-bold text-ninja-navy text-base">Sessions</h2>
        {sessions.length > 4 && (
          <button onClick={() => setExpanded(!expanded)}
            className="text-ninja-blue font-ninja text-sm font-semibold hover:underline">
            {expanded ? 'Show less' : `All ${sessions.length} sessions →`}
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-ninja-muted font-ninja text-sm italic">No sessions logged yet.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((s) => {
            const notesText = stripMarkdown(s.notes || '');
            const isOverdue = !s.notes && String(s.session_date).split('T')[0] < todayStr;
            const present = s.attendees?.length ?? 0;
            const rel = relativeDate(s.session_date);
            const replies = s.comments?.length ?? 0;
            const reacted = s.reactions || [];
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => setQuickView(s)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setQuickView(s); } }}
                className="group w-full text-left rounded-xl border border-ninja-border bg-ninja-bg p-3.5 hover:border-ninja-blue/40 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-ninja font-bold text-ninja-navy text-sm truncate">
                      {formatDate(s.session_date)}
                    </span>
                    {rel && (
                      <span className="font-ninja text-[11px] text-ninja-muted flex-shrink-0">{rel}</span>
                    )}
                    {isOverdue && (
                      <span className="text-[10px] font-ninja font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 uppercase tracking-wide flex-shrink-0">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* The whole row opens the session, so anything live inside
                        it has to swallow its own clicks and keys or reacting
                        would also open the thing you reacted to. */}
                    {!isReadOnly && (
                      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <RowActions surface="bg-white">
                          <ReactionPicker onPick={(emoji) => react(s, emoji)} />
                          <StripButton
                            icon={ReplyIcon}
                            label={replyingId === s.id ? 'Cancel reply' : 'Reply'}
                            active={replyingId === s.id}
                            onClick={() => setReplyingId(replyingId === s.id ? null : s.id)}
                          />
                        </RowActions>
                      </div>
                    )}
                    <span
                      title="Present"
                      className="inline-flex items-center gap-1 rounded-full bg-white border border-ninja-border px-2 py-0.5 font-ninja text-xs font-semibold text-ninja-navy"
                    >
                      <UsersIcon className="w-3 h-3 text-ninja-muted" />
                      {present}{memberCount > 0 ? `/${memberCount}` : ''}
                    </span>
                    {canDelete && (
                      confirmId === s.id ? (
                        <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={deletingId === s.id}
                            className="text-[11px] font-ninja font-bold text-ninja-red hover:underline disabled:opacity-50"
                          >
                            {deletingId === s.id ? '…' : 'Delete'}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="text-[11px] font-ninja font-bold text-ninja-muted hover:underline"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmId(s.id); }}
                          title="Delete session"
                          aria-label="Delete session"
                          className="text-ninja-muted hover:text-ninja-red transition-colors text-lg leading-none"
                        >
                          &times;
                        </button>
                      )
                    )}
                  </div>
                </div>
                {notesText ? (
                  <p className="mt-1.5 text-ninja-muted font-ninja text-xs leading-snug line-clamp-2">{notesText}</p>
                ) : (
                  <p className="mt-1.5 text-ninja-muted/70 font-ninja text-xs italic">No notes yet</p>
                )}
                {/* Chips and the reply box are live controls sitting inside a
                    row that opens on click, so they stop their own events for
                    the same reason the strip above does. */}
                {(reacted.length > 0 || replies > 0 || replyingId === s.id) && (
                  <div
                    className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <ReactionChips
                      reactions={reacted}
                      canReact={!isReadOnly}
                      onToggle={(emoji) => react(s, emoji)}
                      className="mt-0"
                    />
                    {replies > 0 && (
                      // The thread itself lives in the session; this only says
                      // it is in there, so the row does not grow a conversation.
                      <span className="flex items-center gap-1 font-ninja text-[11px] text-ninja-muted">
                        <ReplyIcon size={12} strokeWidth={2} aria-hidden="true" />
                        {replies}
                      </span>
                    )}
                  </div>
                )}
                {rowErrors[s.id] && (
                  <p className="mt-1 font-ninja text-[11px] text-ninja-red">{rowErrors[s.id]}</p>
                )}
                {replyingId === s.id && !isReadOnly && (
                  <div
                    className="mt-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <SessionReplyBox
                      sessionId={s.id}
                      onAdded={(c) => onSessionChanged?.(s.id, { comments: [...(s.comments || []), c] })}
                      onClose={() => setReplyingId(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {quickView && (
          <SessionQuickView
            session={quickView}
            memberCount={memberCount}
            isReadOnly={isReadOnly}
            onClose={() => setQuickView(null)}
            onLogSession={() => { setQuickView(null); navigate(`/clubs/${slug}/sessions/${quickView.id}`); }}
            onSessionChanged={onSessionChanged}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// The club's identity is its photo and its color, so the page opens with them
// at full width instead of a thumbnail in a 288px rail. The title lives here
// and nowhere else; it used to be printed twice.
function ClubHero({ clubDef, colors, memberCount, locationName, isManager, isReadOnly, onCoverUpdated, onNewSession, onBack }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [cropSrc, setCropSrc] = useState(null);
  const [coverError, setCoverError] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileInputRef = useRef(null);
  const reduce = useReducedMotion();

  const hasCover = Boolean(clubDef.cover_image_url) && !coverError;
  const canEditCover = isManager && !isReadOnly && clubDef.location_id !== null;
  const createdOn = clubDef.created_at
    ? new Date(clubDef.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setUploadError('Please select an image file.'); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError('Image must be under 10 MB.'); return; }
    setUploadError('');
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveCover = async () => {
    setUploading(true);
    setUploadError('');
    try {
      // Server clears the DB and deletes the orphaned object.
      await api.patch(`/clubs/definitions/${clubDef.id}/cover-image`, { path: null });
      onCoverUpdated(null);
      setCoverError(false);
    } catch {
      setUploadError('Remove failed. Try again.');
    } finally {
      setUploading(false);
      setConfirmRemove(false);
    }
  };

  const handleCropConfirm = async (blob) => {
    setCropSrc(null);
    setUploading(true);
    setUploadError('');
    try {
      const sign = await api.post(`/storage/club-cover/${clubDef.id}`, { contentType: 'image/jpeg' });
      await uploadToSigned(sign.bucket, sign.path, sign.token, blob, 'image/jpeg');
      // Server signs the read URL, stores it, and deletes the old cover.
      const updated = await api.patch(`/clubs/definitions/${clubDef.id}/cover-image`, { path: sign.path });
      onCoverUpdated(updated?.cover_image_url || null);
      setCoverError(false);
    } catch {
      setUploadError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  // With no photo the field is built from the club's own colour rather than a
  // pastel tint with the initials ghosted across it. Inline hex on purpose:
  // this surface is coloured, so the .dark bg-* overrides must not reach it.
  const solid = colors.solid;
  const colorField = {
    backgroundColor: '#111a2e',
    backgroundImage: [
      `radial-gradient(115% 130% at 6% -10%, ${solid} 0%, ${solid}cc 38%, ${solid}33 68%, rgba(17,26,46,0) 100%)`,
      `radial-gradient(80% 120% at 100% 120%, ${solid}55 0%, rgba(17,26,46,0) 70%)`,
      'repeating-linear-gradient(115deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 13px)',
    ].join(', '),
  };

  const meta = [
    locationName,
    memberCount > 0 && `${memberCount} member${memberCount !== 1 ? 's' : ''}`,
    clubDef.schedule && `Meets ${clubDef.schedule}`,
    createdOn && `Since ${createdOn}`,
  ].filter(Boolean);

  return (
    <div className="relative">
      {/* The media layer clips itself so the actions above it can overflow. */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        {hasCover ? (
          <>
            <motion.img
              src={clubDef.cover_image_url}
              alt=""
              onError={() => setCoverError(true)}
              className="w-full h-full object-cover"
              initial={reduce ? false : { scale: 1.06, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
            {/* Weighted to the bottom left, where the title sits, so the copy
                holds up over a bright photo without flattening the whole image. */}
            <div className="absolute inset-0" style={{
              backgroundImage:
                'linear-gradient(to top, rgba(8,12,22,0.92) 0%, rgba(8,12,22,0.55) 38%, rgba(8,12,22,0.12) 70%, rgba(8,12,22,0.35) 100%),' +
                'linear-gradient(to right, rgba(8,12,22,0.6) 0%, rgba(8,12,22,0) 55%)',
            }} />
          </>
        ) : (
          <div className="w-full h-full" style={colorField} />
        )}
      </div>

      <div className="relative flex flex-col min-h-[13rem] sm:min-h-[15rem] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <button onClick={onBack}
            className="font-ninja text-sm font-semibold text-white/70 hover:text-white transition-colors duration-150 flex items-center gap-1.5">
            <ChevronLeftIcon size={16} strokeWidth={2.25} aria-hidden="true" />
            Clubs
          </button>

          {canEditCover && (
            hasCover ? (
              <ActionMenu label="Club photo" onClosed={() => setConfirmRemove(false)}
                className="[&>button]:text-white [&>button:hover]:text-white [&>button]:bg-black/25 [&>button:hover]:bg-black/40">
                {({ close }) => (
                  confirmRemove ? (
                    <div className="p-1.5 w-44">
                      <p className="font-ninja text-xs text-ninja-muted mb-2">Remove this photo?</p>
                      <div className="flex items-center gap-1.5">
                        <Button variant="danger" size="sm" onClick={handleRemoveCover} disabled={uploading}>
                          {uploading ? 'Removing…' : 'Remove'}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(false)}>Keep</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <MenuItem icon={CameraIcon} onSelect={() => { fileInputRef.current?.click(); close(); }}>
                        {uploading ? 'Uploading…' : 'Change photo'}
                      </MenuItem>
                      <MenuItem icon={TrashIcon} danger onSelect={() => setConfirmRemove(true)}>Remove photo</MenuItem>
                    </>
                  )
                )}
              </ActionMenu>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="font-ninja text-xs font-bold text-white/80 hover:text-white border border-white/25 hover:border-white/60 rounded-full px-3 py-1.5 transition-colors duration-150 flex items-center gap-1.5 disabled:opacity-50">
                <CameraIcon className="w-3.5 h-3.5" />
                {uploading ? 'Uploading…' : 'Add photo'}
              </button>
            )
          )}
        </div>

        {/* Title block sits on the floor of the hero, hard left. */}
        <motion.div
          className="mt-auto pt-8 max-w-2xl"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
        >
          <h1 className="font-ninja font-black text-white text-3xl sm:text-[2.6rem] leading-[1.05] tracking-[-0.02em]">
            {clubDef.name}
          </h1>
          {meta.length > 0 && (
            <p className="mt-2 font-ninja text-sm text-white/70 flex flex-wrap items-center gap-x-2 gap-y-1">
              {meta.map((bit, i) => (
                <span key={bit} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true" className="w-1 h-1 rounded-full bg-white/35" />}
                  {bit}
                </span>
              ))}
            </p>
          )}
          {clubDef.description && (
            <p className="mt-3 font-ninja text-sm text-white/60 leading-relaxed line-clamp-2">
              {clubDef.description}
            </p>
          )}
          {/* Arbitrary hex on the pill below, not bg-white and not the ninja
              tokens: it sits on a coloured surface, where `.dark .bg-white`
              would darken the rest state while `hover:bg-white/90` escapes that
              same override and flashes true white under near-white ink. */}
          {isManager && !isReadOnly && (
            <button onClick={onNewSession}
              className="mt-4 inline-flex items-center gap-1.5 font-ninja font-bold text-sm text-[#0f1729] bg-[#ffffff] hover:bg-[#e6ecf7] rounded-xl px-4 py-2 transition duration-150 ease-[var(--ease-out)] active:scale-[0.97]">
              <PlusIcon size={16} strokeWidth={2.5} aria-hidden="true" />
              New session
            </button>
          )}
        </motion.div>
      </div>

      {canEditCover && (
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      )}
      {uploadError && <p className="text-ninja-red font-ninja text-xs mt-2">{uploadError}</p>}
      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          aspect={16 / 9}
          cropShape="rect"
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}

export default function ClubProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isReadOnly, viewAs } = useAuth();
  const isSenseiView = user?.role === 'admin' && viewAs === 'sensei';
  const isManager = ['manager', 'admin'].includes(user?.role) && !isSenseiView;

  const [clubDef, setClubDef] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [resources, setResources] = useState([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get('/clubs/definitions').then((defs) => {
      const def = defs.find((d) => d.slug === slug);
      if (!def) { setNotFound(true); setLoading(false); return; }
      setClubDef(def);
      return Promise.all([
        api.get(`/clubs?club=${encodeURIComponent(def.name)}`),
        api.get(`/clubs/profile/${encodeURIComponent(def.name)}`),
      ]).then(([sessionsData, profileData]) => {
        setSessions(sessionsData);
        setProfile(profileData.profile);
        setResources(profileData.resources);
        setMemberCount(profileData.member_count || 0);
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [slug, user?.activeLocation?.id]);

  if (notFound) return <Layout><p className="text-ninja-red font-ninja text-center py-12">Club not found.</p></Layout>;
  if (loading || !clubDef) return <Layout><SkeletonProfile label="Loading club" /></Layout>;

  const colors = getClubColors(clubDef);
  const locationName = user?.activeLocation?.name ?? '';

  return (
    <Layout>
      <motion.div className="space-y-5" variants={stagger} initial="hidden" animate="show">
        <ClubHero
          clubDef={clubDef}
          colors={colors}
          memberCount={memberCount}
          locationName={locationName}
          isManager={isManager}
          isReadOnly={isReadOnly}
          onBack={() => navigate('/clubs')}
          onNewSession={() => navigate(`/clubs/log?club=${encodeURIComponent(clubDef.name)}`)}
          onCoverUpdated={(url) => setClubDef((prev) => ({ ...prev, cover_image_url: url }))}
        />

        {/* One column. The hero carries the club's identity, so nothing needs a
            rail beside it and the board gets the full width. */}
        <motion.div variants={fadeUp} className="space-y-5">
          <PinnedNoteSection
            clubName={clubDef.name}
            initialNote={profile?.pinned_note}
            initialAuthor={profile?.pinned_note_author}
            initialUpdatedAt={profile?.pinned_note_updated_at}
            isReadOnly={isReadOnly}
            onUpdated={(note) => setProfile((prev) => ({ ...prev, pinned_note: note, pinned_note_author: user?.displayName, pinned_note_updated_at: new Date().toISOString() }))}
          />
          <ClubBoard
            clubName={clubDef.name}
            posts={resources}
            isReadOnly={isReadOnly}
            currentUser={{ id: user?.id, role: isSenseiView ? 'sensei' : user?.role }}
          />
          <SessionsSection
            sessions={sessions}
            memberCount={memberCount}
            slug={slug}
            navigate={navigate}
            isManager={isManager}
            isReadOnly={isReadOnly}
            onDeleted={(id) => setSessions((prev) => prev.filter((s) => s.id !== id))}
            onSessionChanged={(id, patch) =>
              setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
            }
          />
        </motion.div>
      </motion.div>
    </Layout>
  );
}
