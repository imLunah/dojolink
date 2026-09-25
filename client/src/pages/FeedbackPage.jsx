import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { TriangleAlertIcon, LightbulbIcon, InboxIcon, CheckCheckIcon, UserIcon } from 'lucide-react';
import Layout from '../components/layout/Layout';
import Modal from '../components/ui/Modal';
import { SkeletonList } from '../components/ui/Skeleton';
import TicketStatus from '../components/shared/TicketStatus';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CARD } from '../lib/surfaces';
import { STATUS, STATUS_ORDER, isClosed, ticketName, shortDate } from '../lib/tickets';

// Issues & roadmap: every bug report and feature idea, as tickets.
//
// Staff see what an admin has triaged, by the title the admin gave it and its
// status, plus everything they sent themselves. An admin also has the Inbox
// of untriaged tickets and opens any ticket to read what the reporter wrote,
// retitle it and move it along. The reporter's own words stay in the admin
// view; see server/routes/bugs.js for why.

const OPEN_ORDER = ['in_progress', 'planned', 'aware'];

const byStatusThenRecent = (a, b) =>
  OPEN_ORDER.indexOf(a.status) - OPEN_ORDER.indexOf(b.status) || new Date(b.updated_at) - new Date(a.updated_at);

const TypeIcon = ({ type, className = 'w-4 h-4' }) => (type === 'feature'
  ? <LightbulbIcon className={className} strokeWidth={2} aria-label="Feature idea" />
  : <TriangleAlertIcon className={className} strokeWidth={2} aria-label="Bug" />);

export default function FeedbackPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const [tickets, setTickets] = useState(null);
  const [mine, setMine] = useState(null);

  const load = useCallback(() => {
    api.get(isAdmin ? '/bugs/admin' : '/bugs/board')
      .then((rows) => setTickets(Array.isArray(rows) ? rows : []))
      .catch(() => setTickets([]));
    api.get('/bugs/mine')
      .then((rows) => setMine(Array.isArray(rows) ? rows : []))
      .catch(() => setMine([]));
  }, [isAdmin]);

  useEffect(load, [load]);

  const inbox = useMemo(() => (tickets || []).filter((t) => t.status === 'new'), [tickets]);
  const triaged = useMemo(() => (tickets || []).filter((t) => t.status !== 'new'), [tickets]);

  const tabs = [
    ...(isAdmin ? [{ key: 'inbox', label: 'Inbox', Icon: InboxIcon, count: inbox.length }] : []),
    { key: 'bugs', label: 'Known issues', Icon: TriangleAlertIcon },
    { key: 'roadmap', label: 'Roadmap', Icon: LightbulbIcon },
    { key: 'closed', label: 'Closed', Icon: CheckCheckIcon },
    { key: 'mine', label: 'Yours', Icon: UserIcon },
  ];
  const tab = tabs.some((t) => t.key === params.get('tab')) ? params.get('tab') : tabs[0].key;
  const openId = Number(params.get('ticket')) || null;

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value == null) next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  const onSaved = (updated) => {
    setTickets((prev) => (prev || []).map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    setMine((prev) => (prev || []).map((t) => (t.id === updated.id ? { ...t, status: updated.status, title: updated.title } : t)));
  };
  const onDeleted = (id) => {
    setTickets((prev) => (prev || []).filter((t) => t.id !== id));
    setMine((prev) => (prev || []).filter((t) => t.id !== id));
    setParam('ticket', null);
  };

  const loading = tickets === null || (tab === 'mine' && mine === null);

  let body;
  if (loading) {
    body = <div className="p-4"><SkeletonList rows={4} label="Loading tickets" /></div>;
  } else if (tab === 'inbox') {
    body = <Rows items={inbox} empty="Nothing waiting. New reports land here." onOpen={(t) => setParam('ticket', t.id)} inbox />;
  } else if (tab === 'mine') {
    body = <Rows items={mine} empty="You haven't sent any reports yet." mine onOpen={isAdmin ? (t) => setParam('ticket', t.id) : null} />;
  } else if (tab === 'closed') {
    const items = triaged.filter((t) => isClosed(t.status))
      .sort((a, b) => new Date(b.closed_at || b.updated_at) - new Date(a.closed_at || a.updated_at));
    body = <Rows items={items} empty="Nothing closed yet." showType onOpen={isAdmin ? (t) => setParam('ticket', t.id) : null} />;
  } else {
    const type = tab === 'bugs' ? 'bug' : 'feature';
    const items = triaged.filter((t) => t.type === type && !isClosed(t.status)).sort(byStatusThenRecent);
    body = (
      <Grouped
        items={items}
        empty={type === 'bug' ? 'No known issues right now.' : 'Nothing on the roadmap yet.'}
        onOpen={isAdmin ? (t) => setParam('ticket', t.id) : null}
      />
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mb-5"
        >
          <h1 className="text-2xl font-black font-ninja text-ninja-navy">Issues &amp; roadmap</h1>
        </motion.header>

        <nav aria-label="Tickets" className="no-scrollbar mb-4 flex overflow-x-auto rounded-xl border border-ninja-border bg-ninja-bg p-1">
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setParam('tab', t.key)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-1 shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 font-ninja text-[13px] font-semibold transition-colors ${active ? 'text-ninja-navy' : 'text-ninja-muted hover:text-ninja-navy'}`}
              >
                {active && (
                  <motion.span
                    layoutId="feedback-tab"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    className="absolute inset-0 rounded-lg border border-ninja-border bg-white shadow-sm"
                  />
                )}
                <t.Icon className="relative hidden h-4 w-4 sm:block" strokeWidth={1.9} aria-hidden="true" />
                <span className="relative whitespace-nowrap">{t.label}</span>
                {t.count > 0 && (
                  <span className="relative min-w-[18px] h-[18px] px-1 rounded-full bg-ninja-red text-white text-[10px] font-black leading-[18px] text-center">
                    {t.count > 99 ? '99+' : t.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className={`${CARD} overflow-hidden`}>{body}</div>
      </div>

      {isAdmin && (
        <TicketDialog
          id={openId}
          onClose={() => setParam('ticket', null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </Layout>
  );
}

// Open tickets, grouped under their status.
function Grouped({ items, empty, onOpen }) {
  if (!items.length) return <Empty text={empty} />;
  return OPEN_ORDER.map((status) => {
    const group = items.filter((t) => t.status === status);
    if (!group.length) return null;
    return (
      <section key={status} className="border-b border-ninja-border last:border-b-0">
        <h2 className="flex items-center gap-2 px-4 pt-3 pb-1">
          <TicketStatus status={status} />
          <span className="font-ninja text-xs text-ninja-muted">{group.length}</span>
        </h2>
        <Rows items={group} onOpen={onOpen} hideStatus />
      </section>
    );
  });
}

function Rows({ items, empty, onOpen, inbox = false, mine = false, showType = false, hideStatus = false }) {
  if (!items?.length) return <Empty text={empty} />;
  return (
    <ul className="divide-y divide-ninja-border">
      {items.map((t) => {
        const content = (
          <>
            {(inbox || showType || mine) && (
              <span className="mt-0.5 text-ninja-muted flex-shrink-0"><TypeIcon type={t.type} /></span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                {inbox && !t.seen_at && <span aria-label="Unread" className="w-2 h-2 rounded-full bg-ninja-blue flex-shrink-0" />}
                <span className={`block font-ninja text-sm text-ninja-navy break-words ${inbox ? 'line-clamp-2' : 'font-semibold'}`}>
                  {inbox ? t.description : ticketName(t)}
                </span>
              </span>
              {mine && t.title && (
                <span className="block font-ninja text-xs text-ninja-muted mt-1 line-clamp-2 break-words">{t.description}</span>
              )}
              <span className="block font-ninja text-xs text-ninja-muted mt-1">
                {inbox
                  ? [t.reporter_name || 'Unknown', roleLabel(t.reporter_role), t.location_name, shortDate(t.created_at)].filter(Boolean).join(' · ')
                  : [t.category, shortDate(mine ? t.created_at : t.updated_at)].filter(Boolean).join(' · ')}
              </span>
            </span>
            {!hideStatus && !inbox && <TicketStatus status={t.status} className="mt-0.5" />}
          </>
        );
        return (
          <li key={t.id}>
            {onOpen ? (
              <button type="button" onClick={() => onOpen(t)} className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ninja-bg">
                {content}
              </button>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ text }) {
  return <p className="px-4 py-10 text-center font-ninja text-sm text-ninja-muted">{text}</p>;
}

function roleLabel(role) {
  if (role === 'manager') return 'Director';
  if (role === 'sensei') return 'Sensei';
  if (role === 'admin') return 'Admin';
  if (role === 'parent') return 'Parent';
  return null;
}

// The admin's view of one ticket: everything the reporter sent, and the two
// things triage decides, the public title and the status.
function TicketDialog({ id, onClose, onSaved, onDeleted }) {
  const [ticket, setTicket] = useState(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('new');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setTicket(null);
    setError('');
    setConfirmDelete(false);
    api.get(`/bugs/admin/${id}`)
      .then((t) => {
        if (!alive) return;
        setTicket(t);
        setTitle(t.title || '');
        setStatus(t.status);
        onSaved({ id: t.id, seen_at: t.seen_at });
      })
      .catch(() => { if (alive) setError('Could not load this ticket.'); });
    return () => { alive = false; };
    // onSaved is a fresh function each render; the ticket id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const dirty = ticket && ((title.trim() || null) !== (ticket.title || null) || status !== ticket.status);

  const save = async () => {
    if (status !== 'new' && !title.trim()) {
      setError('Give it a title before it leaves the inbox.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await api.patch(`/bugs/${id}`, { title: title.trim(), status });
      setTicket((prev) => ({ ...prev, ...updated }));
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err?.data?.error || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await api.delete(`/bugs/${id}`);
      onDeleted(id);
    } catch {
      setError('Could not delete.');
      setSaving(false);
    }
  };

  const label = 'block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1.5';

  return (
    <Modal
      isOpen={Boolean(id)}
      onClose={onClose}
      title={ticket ? (ticket.type === 'feature' ? 'Feature idea' : 'Bug report') : 'Ticket'}
      width="max-w-2xl"
      canDismiss={!dirty}
      guardHint="This ticket has unsaved changes."
    >
      {!ticket ? (
        error ? <p className="font-ninja text-sm text-ninja-red">{error}</p> : <SkeletonList rows={4} label="Loading ticket" />
      ) : (
        <div className="space-y-5">
          <div>
            <p className="font-ninja text-xs text-ninja-muted mb-1.5">
              {[ticket.reporter_name || 'Unknown', roleLabel(ticket.reporter_role), ticket.location_name, ticket.category].filter(Boolean).join(' · ')}
            </p>
            <p className="font-ninja text-sm text-ninja-navy whitespace-pre-wrap break-words rounded-xl bg-ninja-bg px-4 py-3 leading-relaxed">
              {ticket.description}
            </p>
          </div>

          {ticket.screenshot_url && (
            <a href={ticket.screenshot_url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-ninja-border bg-ninja-bg">
              <img src={ticket.screenshot_url} alt="Screenshot sent with the report" className="w-full max-h-72 object-contain" />
            </a>
          )}

          <dl className="grid grid-cols-[88px,1fr] gap-x-3 gap-y-1.5 font-ninja text-xs">
            <dt className="text-ninja-muted">Sent</dt>
            <dd className="text-ninja-navy">{new Date(ticket.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
            {ticket.reporter_parent_email && (<><dt className="text-ninja-muted">Email</dt><dd className="text-ninja-navy break-all">{ticket.reporter_parent_email}</dd></>)}
            {ticket.page_url && (<><dt className="text-ninja-muted">Page</dt><dd className="text-ninja-navy break-all">{ticket.page_url}</dd></>)}
            {ticket.screen_size && (<><dt className="text-ninja-muted">Screen</dt><dd className="text-ninja-navy">{ticket.screen_size}</dd></>)}
            {ticket.user_agent && (<><dt className="text-ninja-muted">Browser</dt><dd className="text-ninja-muted break-all">{ticket.user_agent}</dd></>)}
          </dl>

          {Array.isArray(ticket.console_errors) && ticket.console_errors.length > 0 && (
            <details>
              <summary className="cursor-pointer font-ninja text-xs font-semibold text-ninja-navy">
                Console errors ({ticket.console_errors.length})
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-ninja-bg p-3 text-[11px] text-ninja-navy whitespace-pre-wrap break-words">
                {ticket.console_errors.join('\n')}
              </pre>
            </details>
          )}

          <div className="border-t border-ninja-border pt-5 space-y-4">
            <div>
              <label htmlFor="ticket-title" className={label}>Title everyone sees</label>
              <input
                id="ticket-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-xl px-3 py-2.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
              />
            </div>

            <fieldset>
              <legend className={label}>Status</legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    aria-pressed={status === s}
                    className={`flex items-center gap-2 rounded-lg border border-ninja-border px-3 py-2 font-ninja text-sm transition-colors ${
                      status === s ? 'bg-ninja-blue/10 text-ninja-navy font-bold' : 'text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg'
                    }`}
                  >
                    <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS[s].dot }} />
                    {STATUS[s].label}
                  </button>
                ))}
              </div>
            </fieldset>

            {error && <p className="font-ninja text-sm text-ninja-red">{error}</p>}

            <div className="flex items-center justify-between gap-3 pt-1">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={remove} disabled={saving} className="rounded-full bg-ninja-red px-4 py-2 font-ninja text-sm font-bold text-white disabled:opacity-50">
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="px-2 py-2 font-ninja text-sm font-semibold text-ninja-muted hover:text-ninja-navy">
                    Keep
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="font-ninja text-sm font-semibold text-ninja-muted hover:text-ninja-red">
                  Delete ticket
                </button>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="border border-ninja-border text-ninja-muted font-ninja font-semibold text-sm px-4 py-2.5 rounded-xl hover:text-ninja-navy transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={save} disabled={saving || !dirty} className="bg-ninja-blue text-white font-ninja font-bold text-sm px-5 py-2.5 rounded-xl disabled:opacity-50 hover:bg-ninja-blue-hover transition-colors">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
