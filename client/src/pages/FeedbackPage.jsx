import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { TriangleAlertIcon, LightbulbIcon, InboxIcon, CheckCheckIcon, UserIcon, PlusIcon } from 'lucide-react';
import Layout from '../components/layout/Layout';
import Modal from '../components/ui/Modal';
import { SkeletonList } from '../components/ui/Skeleton';
import TicketStatus from '../components/shared/TicketStatus';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CARD } from '../lib/surfaces';
import { STATUS, STATUS_ORDER, isClosed, shortDate, BUG_CATEGORIES, FEATURE_CATEGORIES } from '../lib/tickets';

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
  const [adding, setAdding] = useState(false);

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
  const open = isAdmin ? (t) => setParam('ticket', t.id) : null;
  // Admins see everything a reporter sent on every card; anyone else sees the
  // full report only on their own.
  const detail = isAdmin || tab === 'mine';

  let body;
  if (loading) {
    body = <div className={`${CARD} p-5`}><SkeletonList rows={4} label="Loading tickets" /></div>;
  } else if (tab === 'inbox') {
    body = <ByMonth items={inbox} dateOf={(t) => t.created_at} empty="Nothing waiting. New reports land here." detail onOpen={open} />;
  } else if (tab === 'mine') {
    body = <ByMonth items={mine} dateOf={(t) => t.created_at} empty="You haven't sent any reports yet." detail onOpen={open} />;
  } else if (tab === 'closed') {
    const items = triaged.filter((t) => isClosed(t.status));
    body = <ByMonth items={items} dateOf={(t) => t.closed_at || t.updated_at} empty="Nothing closed yet." detail={detail} onOpen={open} />;
  } else {
    const type = tab === 'bugs' ? 'bug' : 'feature';
    const items = triaged.filter((t) => t.type === type && !isClosed(t.status)).sort(byStatusThenRecent);
    body = (
      <ByStatus
        items={items}
        empty={type === 'bug' ? 'No known issues right now.' : 'Nothing on the roadmap yet.'}
        detail={detail}
        onOpen={open}
      />
    );
  }

  // The tab and the open ticket live in the URL, and Layout keys its page
  // animation on the location, so without a constant key every tab press
  // remounted the page: the old list faded out over the new one and the data
  // loaded again. Only the list below animates on a tab change.
  return (
    <Layout motionKey="feedback">
      <div className="max-w-6xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mb-5 flex items-center justify-between gap-3"
        >
          <h1 className="text-2xl font-black font-ninja text-ninja-navy">Issues &amp; roadmap</h1>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 rounded-xl bg-ninja-blue px-4 py-2.5 font-ninja text-sm font-bold text-white hover:bg-ninja-blue-hover transition-colors flex-shrink-0"
            >
              <PlusIcon className="w-4 h-4" strokeWidth={2.4} aria-hidden="true" />
              Add update
            </button>
          )}
        </motion.header>

        <nav aria-label="Tickets" className="no-scrollbar mb-6 flex overflow-x-auto rounded-xl border border-ninja-border bg-ninja-bg p-1 lg:max-w-3xl">
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

        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-8"
        >
          {body}
        </motion.div>
      </div>

      {isAdmin && (
        <NewItemDialog
          open={adding}
          initialType={tab === 'roadmap' ? 'feature' : 'bug'}
          onClose={() => setAdding(false)}
          onCreated={(t) => {
            setTickets((prev) => [t, ...(prev || [])]);
            setAdding(false);
            if (!isClosed(t.status)) setParam('tab', t.type === 'feature' ? 'roadmap' : 'bugs');
            else setParam('tab', 'closed');
          }}
        />
      )}

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

// A heading between groups: a hairline with the name in it.
function Divider({ children }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <span aria-hidden="true" className="h-px flex-1 bg-ninja-border" />
      <h2 className="flex items-center gap-2 font-ninja text-base font-bold text-ninja-muted whitespace-nowrap">{children}</h2>
      <span aria-hidden="true" className="h-px flex-1 bg-ninja-border" />
    </div>
  );
}

function Cards({ items, detail, onOpen }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {items.map((t) => <TicketCard key={t.id} t={t} detail={detail} onOpen={onOpen} />)}
    </div>
  );
}

// Newest month first, newest ticket first inside it.
function ByMonth({ items, dateOf, empty, detail, onOpen }) {
  if (!items?.length) return <Empty text={empty} />;
  const sorted = [...items].sort((a, b) => new Date(dateOf(b)) - new Date(dateOf(a)));
  const groups = [];
  for (const t of sorted) {
    const label = new Date(dateOf(t)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1).items.push(t);
  }
  return groups.map((g) => (
    <section key={g.label}>
      <Divider>{g.label}</Divider>
      <Cards items={g.items} detail={detail} onOpen={onOpen} />
    </section>
  ));
}

// Open tickets, grouped under their status, furthest along first.
function ByStatus({ items, empty, detail, onOpen }) {
  if (!items.length) return <Empty text={empty} />;
  return OPEN_ORDER.map((status) => {
    const group = items.filter((t) => t.status === status);
    if (!group.length) return null;
    return (
      <section key={status}>
        <Divider>
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS[status].dot }} />
          {STATUS[status].label}
          <span className="font-semibold">({group.length})</span>
        </Divider>
        <Cards items={group} detail={detail} onOpen={onOpen} />
      </section>
    );
  });
}

// One ticket, with as much of the report as this reader may see.
function TicketCard({ t, detail, onOpen }) {
  const [expanded, setExpanded] = useState(false);
  const heading = t.title || t.category || (t.type === 'feature' ? 'Feature idea' : 'Bug report');
  const long = (t.description || '').length > 420;
  const sent = new Date(t.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const unread = t.seen_at === null;

  const facts = detail
    ? [
        ['Type', t.type === 'feature' ? 'Feature idea' : 'Bug'],
        // An untriaged ticket already wears its category as the heading.
        t.title && ['Category', t.category],
        t.reporter_name !== undefined && ['From', [t.reporter_name || 'Unknown', roleLabel(t.reporter_role)].filter(Boolean).join(', ')],
        t.location_name && ['Center', t.location_name],
        ['Sent', sent],
        t.page_url && ['Page', pathOf(t.page_url)],
        t.user_agent && ['Device', deviceOf(t.user_agent, t.screen_size)],
        Array.isArray(t.console_errors) && t.console_errors.length > 0 && ['Errors', `${t.console_errors.length} in the console`],
      ].filter(Boolean)
    : [
        ['Type', t.type === 'feature' ? 'Feature idea' : 'Bug'],
        ['Category', t.category],
        ['Updated', shortDate(t.updated_at)],
      ];

  return (
    <article className={`${CARD} overflow-hidden flex flex-col`}>
      <div className="p-5 space-y-4">
        <header className="flex items-start gap-3">
          <span className="mt-1 text-ninja-muted flex-shrink-0"><TypeIcon type={t.type} className="w-5 h-5" /></span>
          <h3 className="flex-1 min-w-0 font-ninja text-lg font-bold text-ninja-navy leading-snug break-words">
            {unread && <span aria-label="Unread" className="inline-block align-middle mr-2 w-2 h-2 rounded-full bg-ninja-blue" />}
            {heading}
          </h3>
          <TicketStatus status={t.status} className="mt-1.5" />
        </header>

        {detail && t.description && (
          <div>
            <p className={`font-ninja text-[15px] text-ninja-navy leading-relaxed whitespace-pre-wrap break-words ${long && !expanded ? 'line-clamp-6' : ''}`}>
              {t.description}
            </p>
            {long && (
              <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1 font-ninja text-sm font-bold text-ninja-blue hover:text-ninja-blue-hover">
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        <dl className="grid grid-cols-[76px,1fr] gap-x-3 gap-y-1 font-ninja text-[13px]">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ninja-muted">{k}</dt>
              <dd className="text-ninja-navy break-words min-w-0">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {detail && t.screenshot_url && (
        <a href={t.screenshot_url} target="_blank" rel="noreferrer" className="block border-t border-ninja-border bg-ninja-bg" aria-label="Open the screenshot full size">
          <img src={t.screenshot_url} alt="Screenshot sent with the report" loading="lazy" className="w-full max-h-96 object-contain object-top" />
        </a>
      )}

      {onOpen && (
        <footer className="border-t border-ninja-border px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={() => onOpen(t)}
            className="rounded-lg border border-ninja-border px-3 py-1.5 font-ninja text-sm font-bold text-ninja-navy hover:bg-ninja-bg transition-colors"
          >
            {t.status === 'new' ? 'Triage' : 'Edit'}
          </button>
        </footer>
      )}
    </article>
  );
}

function Empty({ text }) {
  return <p className={`${CARD} px-4 py-10 text-center font-ninja text-sm text-ninja-muted`}>{text}</p>;
}

function pathOf(url) {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

// "Chrome 140 on macOS, 1512×823" from a user agent. Rough on purpose: the
// full string is in the ticket dialog.
function deviceOf(ua, screen) {
  const browser =
    (/Edg\/(\d+)/.exec(ua) && `Edge ${/Edg\/(\d+)/.exec(ua)[1]}`) ||
    (/CriOS\/(\d+)/.exec(ua) && `Chrome ${/CriOS\/(\d+)/.exec(ua)[1]}`) ||
    (/Chrome\/(\d+)/.exec(ua) && `Chrome ${/Chrome\/(\d+)/.exec(ua)[1]}`) ||
    (/Firefox\/(\d+)/.exec(ua) && `Firefox ${/Firefox\/(\d+)/.exec(ua)[1]}`) ||
    (/Version\/(\d+)[\d.]* .*Safari/.exec(ua) && `Safari ${/Version\/(\d+)/.exec(ua)[1]}`) ||
    'Browser';
  const os =
    (/iPad/.test(ua) && 'iPad') || (/iPhone/.test(ua) && 'iPhone') || (/Android/.test(ua) && 'Android') ||
    (/Mac OS X/.test(ua) && 'macOS') || (/Windows/.test(ua) && 'Windows') || (/CrOS/.test(ua) && 'ChromeOS') || null;
  return [os ? `${browser} on ${os}` : browser, screen].filter(Boolean).join(', ');
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
            {ticket.description && (
              <p className="font-ninja text-sm text-ninja-navy whitespace-pre-wrap break-words rounded-xl bg-ninja-bg px-4 py-3 leading-relaxed">
                {ticket.description}
              </p>
            )}
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

// An admin writing a known issue or a roadmap item straight onto the board,
// with no report behind it. It goes out with its title and status, so it
// never sits in the inbox.
function NewItemDialog({ open, initialType, onClose, onCreated }) {
  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Other');
  const [status, setStatus] = useState(initialType === 'feature' ? 'planned' : 'aware');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setTitle('');
    setCategory('Other');
    setStatus(initialType === 'feature' ? 'planned' : 'aware');
    setDetails('');
    setError('');
  }, [open, initialType]);

  const pickType = (next) => {
    setType(next);
    setCategory('Other');
    setStatus((s) => (s === 'aware' || s === 'planned' ? (next === 'feature' ? 'planned' : 'aware') : s));
  };

  const dirty = Boolean(title.trim() || details.trim());

  const save = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Give it a title.'); return; }
    setSaving(true);
    setError('');
    try {
      const created = await api.post('/bugs/admin', { type, title: title.trim(), category, status, description: details.trim() });
      onCreated(created);
    } catch (err) {
      setError(err?.data?.error || 'Could not add it.');
    } finally {
      setSaving(false);
    }
  };

  const label = 'block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1.5';
  const field = 'w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-xl px-3 py-2.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue';

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={type === 'feature' ? 'Add to roadmap' : 'Add known issue'}
      width="max-w-xl"
      canDismiss={!dirty}
      guardHint="This has unsaved changes."
    >
      <form onSubmit={save} className="space-y-4">
        <div className="relative flex bg-ninja-bg border border-ninja-border rounded-2xl p-1">
          <motion.div
            className="absolute top-1 bottom-1 bg-white rounded-xl shadow-sm"
            layout
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            style={{ width: 'calc(50% - 4px)', left: type === 'bug' ? 4 : 'calc(50%)' }}
          />
          {[{ key: 'bug', label: 'Known issue' }, { key: 'feature', label: 'Roadmap' }].map(({ key, label: l }) => (
            <button
              key={key}
              type="button"
              onClick={() => pickType(key)}
              className={`relative z-10 flex-1 py-2 font-ninja font-bold text-sm rounded-xl transition-colors duration-200 ${type === key ? 'text-ninja-navy' : 'text-ninja-muted'}`}
            >
              {l}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="new-item-title" className={label}>Title</label>
          <input id="new-item-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={field} />
        </div>

        <div>
          <label htmlFor="new-item-category" className={label}>Category</label>
          <select id="new-item-category" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            {(type === 'feature' ? FEATURE_CATEGORIES : BUG_CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <fieldset>
          <legend className={label}>Status</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {STATUS_ORDER.filter((s) => s !== 'new').map((s) => (
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

        <div>
          <label htmlFor="new-item-details" className={label}>
            Details <span className="font-normal normal-case">(optional)</span>
          </label>
          <textarea id="new-item-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={2000} className={`${field} resize-none`} />
        </div>

        {error && <p className="font-ninja text-sm text-ninja-red">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="border border-ninja-border text-ninja-muted font-ninja font-semibold text-sm px-4 py-2.5 rounded-xl hover:text-ninja-navy transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving || !title.trim()} className="bg-ninja-blue text-white font-ninja font-bold text-sm px-5 py-2.5 rounded-xl disabled:opacity-50 hover:bg-ninja-blue-hover transition-colors">
            Add
          </button>
        </div>
      </form>
    </Modal>
  );
}
