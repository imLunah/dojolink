// One definition of the director task board's vocabulary.
//
// The dashboard summary card and the full board page both need the column
// order, the palette and the due-date reading. Kept here so a card that says
// "2 in progress" can't come to mean something different from the column the
// board draws under the same name.

// Order here IS the board's left-to-right order, the order the arrows on a card
// move it in, and the order moveTask restamps positions in. Anything added has
// to go in at the right place rather than on the end: a card travels by index,
// so a stage appended after Done would be a stage after finished.
export const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'doing', label: 'In progress' },
  { key: 'done', label: 'Done' },
];

// The columns that hold work still to finish. Derived, not listed: an
// allowlist is how the dashboard came to leave a whole column out of its
// overdue count the last time one was added.
export const OPEN_COLUMN_KEYS = COLUMNS.filter((c) => c.key !== 'done').map((c) => c.key);

export const COLUMN_KEYS = COLUMNS.map((c) => c.key);

export const COLUMN_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.key, c.label]));

// The glass moved into CARD, which every card in the app now wears. What is
// left here is the board's own: the drag lens, and the rule that lifts a card
// above its siblings while its menu is open.
//
// Tasks still carry a `color` in the database. Nothing draws it: three passes
// at a coloured card all read as paint on glass, and the board is quieter
// without it. The column is left alone so the choice can come back.
export const TASK_SURFACE = 'task-card';

/* ------------------------------------------------------------ grouping -- */

// Tasks arrive already ordered by position. Grouping preserves that order, so
// the array index IS the rank and nothing has to re-sort on every render.
export function groupByColumn(tasks) {
  const out = Object.fromEntries(COLUMN_KEYS.map((k) => [k, []]));
  for (const t of tasks) (out[t.column_key] || out.todo).push(t);
  return out;
}

// Rebuild the flat list after a move, restamping position from the array index
// so the numbers stay dense. Returns the whole board because that is what the
// reorder endpoint takes: one transaction covering the dropped card and every
// card that shifted under it.
export function moveTask(tasks, id, toColumn, toIndex) {
  const moving = tasks.find((t) => t.id === id);
  if (!moving) return tasks;

  const grouped = groupByColumn(tasks.filter((t) => t.id !== id));
  const target = grouped[toColumn] || grouped.todo;
  const at = Math.max(0, Math.min(toIndex, target.length));
  target.splice(at, 0, { ...moving, column_key: toColumn });

  const out = [];
  for (const key of COLUMN_KEYS) {
    grouped[key].forEach((t, i) => out.push({ ...t, column_key: key, position: i }));
  }
  return out;
}

export const reorderPayload = (tasks) =>
  tasks.map(({ id, column_key, position }) => ({ id, column_key, position }));

/* ----------------------------------------------------------- due dates -- */

const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Compared as calendar strings, never as timestamps. A pg DATE arrives as
// YYYY-MM-DD and `new Date('2026-08-14')` parses as UTC midnight, which in
// California is the evening of the 13th — that is exactly how club sessions
// ended up labelled "Yesterday" on the day they happened.
export function dueMeta(due, todayStr = dayKey(new Date())) {
  if (!due) return null;

  const [y, m, d] = due.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  if (due < todayStr) return { label, text: `Overdue · ${label}`, tone: 'overdue' };
  if (due === todayStr) return { label, text: 'Due today', tone: 'today' };

  const [ty, tm, td] = todayStr.split('-').map(Number);
  const days = Math.round((new Date(y, m - 1, d) - new Date(ty, tm - 1, td)) / 86400000);
  if (days === 1) return { label, text: 'Due tomorrow', tone: 'soon' };
  if (days <= 7) return { label, text: `Due ${label}`, tone: 'soon' };
  return { label, text: `Due ${label}`, tone: 'later' };
}

// Plain red text, no pill. Matches the overdue club badge — a red box beside a
// task title makes the box the loudest thing in the card.
export const DUE_TONE = {
  overdue: 'text-ninja-red font-semibold',
  today: 'text-ninja-red font-semibold',
  soon: 'text-ninja-navy',
  later: 'text-ninja-muted',
};

/* ------------------------------------------------------------- preview -- */

// Bodies are stored as markdown. On a card we want a couple of lines of prose,
// not rendered headings and bullets fighting the title for weight, so the
// syntax is stripped rather than rendered. The full note renders properly the
// moment the card is opened.
export function plainPreview(md) {
  if (!md) return '';
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // A URL on its own line is stored as a markdown autolink, <https://…>,
    // which is how every markdown writer serialises a link whose text is the
    // link. Rendered it disappears into the link; stripped naively it leaves
    // the angle brackets sitting around the address on the card, which reads
    // as something the typist did by mistake.
    .replace(/<((?:https?|mailto):[^\s>]+)>/gi, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    // Emphasis markers, everywhere except inside an address: a query string is
    // full of underscores and they are part of where the link goes, not
    // decoration around a word. Split on the URLs, strip between them.
    .split(/((?:https?|mailto):[^\s]+)/gi)
    .map((part, i) => (i % 2 ? part : part.replace(/[*_~>]/g, '')))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export const todayKey = () => dayKey(new Date());

// A card as the fields the API takes. PATCH /:id is a whole-card write, so an
// edit of one cell has to hand back everything else unchanged; this is that
// "everything else", in one place, so a new field cannot be forgotten by the
// list and silently wiped every time somebody changes a due date.
export const cardFields = (t) => ({
  title: t.title ?? null,
  body: t.body ?? null,
  color: t.color ?? 'none',
  due_date: t.due_date ?? null,
  assignee_id: t.assignee_id ?? null,
  assignee_center: Boolean(t.assignee_center),
  checklist: t.checklist ?? [],
  column_key: t.column_key,
});

// Who is carrying a card, as one string. The center's name travels with the
// card so a board viewed from another center still names the right one.
export function taskHolder(task) {
  if (task.assignee_center) return task.location_name || 'The whole center';
  return task.assignee_name || null;
}
