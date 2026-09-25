// Feedback tickets: the one list of statuses and how each one reads.
// The server's allowlist (server/routes/bugs.js) and the table CHECK
// (056_feedback_tickets.sql) mirror STATUS_ORDER; change all three together.

export const STATUS_ORDER = ['new', 'aware', 'planned', 'in_progress', 'resolved', 'wont_fix'];

export const STATUS = {
  new:         { label: 'New',         dot: '#94a3b8' },
  aware:       { label: 'Aware',       dot: '#f59e0b' },
  planned:     { label: 'Planned',     dot: '#8b5cf6' },
  in_progress: { label: 'In progress', dot: '#3b82f6' },
  resolved:    { label: 'Resolved',    dot: '#22c55e' },
  wont_fix:    { label: "Won't fix",   dot: '#64748b' },
};

// What a report can be about. The report dialog and the admin's own form
// both offer these.
export const BUG_CATEGORIES = [
  'Login Issue',
  'Student Progress',
  'Check-In Issue',
  'Parent Portal',
  'UI / Visual Bug',
  'Slow Performance',
  'Other',
];

export const FEATURE_CATEGORIES = [
  'Check-In',
  'Student Progress',
  'Clubs',
  'Reports',
  'Parent Portal',
  'UI / Design',
  'Other',
];

export const isClosed = (status) => status === 'resolved' || status === 'wont_fix';

// What a ticket is called. Before triage it has no title yet, so its sender
// sees the start of what they wrote.
export function ticketName(t) {
  if (t.title) return t.title;
  const text = String(t.description || '').replace(/\s+/g, ' ').trim();
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export function shortDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
