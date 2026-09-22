// Event types are a fixed list. They used to be free text with suggestions, and
// one September at Yorba Linda produced "gb", "Game Building" and "JR Game
// Building" for what is two kinds of event, which no report can group. The
// server keeps the same list (server/routes/events.js) and refuses anything else.
//
// Colors avoid the pinned program hues (JR purple, VR teal) so an event never
// reads as a program. Lives here, not in EventCalendar, so anything outside the
// staff calendar can share the colors without pulling the calendar into its chunk.
export const EVENT_TYPES = [
  { label: 'Game Building',         color: '#2563eb' },
  { label: 'JR Game Building',      color: '#0284c7' },
  { label: 'Walk-in Game Building', color: '#ea580c' },
  { label: "Parents' Night Out",    color: '#db2777' },
  { label: 'Tournament',            color: '#ca8a04' },
  { label: 'Field Trip',            color: '#059669' },
  { label: 'Holiday',               color: '#dc2626' },
  { label: 'Other',                 color: '#64748b' },
];

const BY_KEY = new Map(EVENT_TYPES.map((t) => [t.label.toLowerCase(), t]));

// Punctuation and spacing fold away, so "Parents Night Out" still finds its
// entry. Anything unrecognised is Other.
const fold = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');
const BY_FOLD = new Map(EVENT_TYPES.map((t) => [fold(t.label), t]));

export const eventType = (type) =>
  BY_KEY.get((type || '').trim().toLowerCase()) || BY_FOLD.get(fold(type)) || BY_KEY.get('other');

export const colorFor = (type) => eventType(type).color;
