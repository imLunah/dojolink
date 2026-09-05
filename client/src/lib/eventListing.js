// One definition of how a center's event listing is read and drawn.
//
// Three surfaces show the same rows now — the home billboard, the Events
// index, and a listing's own page — and the markdown map, the navy ink, the
// artwork wash and the date wording were all about to exist in three copies.
// The surfaces file already records what happens when a pasted constant lives
// in four places: it drifts, and the drift is invisible until two of them are
// on screen together.
//
// Everything here is inline colour on purpose. A listing is drawn on artwork
// somebody chose or on white paper, in both themes, and `.dark .bg-white`
// would turn the paper slate and leave the words unreadable on it.
//
// No JSX: nothing else in lib/ is a component and esbuild only reads JSX out
// of a .jsx file. The markdown component map that used to sit beside these
// lives on the listing page, which is the only surface that renders prose.

// The local date as YYYY-MM-DD, which is what every listing endpoint wants.
// Never `toISOString().slice(0, 10)`: that is UTC, already tomorrow every
// California evening, and an event has to stay today through its own evening.
export function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// A listing's date as a local Date at midnight, or null. The split is what
// keeps it local: `new Date('2026-09-06')` is parsed as UTC and reads back a
// day early west of Greenwich.
export function listingDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).split('T')[0] + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

// Whole days from today to the listing, negative once it has passed.
export function daysUntil(dateStr, now = new Date()) {
  const d = listingDate(dateStr);
  if (!d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d - today) / 86400000);
}

// The ink of the artwork wash. Strongest on the left, where the words are,
// and nearly clear on the right so the picture is still a picture.
export const WASH = 'linear-gradient(90deg, rgb(6 11 24 / 0.82) 0%, rgb(6 11 24 / 0.55) 55%, rgb(6 11 24 / 0.2) 100%)';
// What a listing with no artwork wears, and what the portal's own banners
// wear when they are speaking for the center rather than for a program.
export const HOUSE = 'linear-gradient(135deg, #12264d 0%, #0b3d8f 100%)';
// The plate the artwork sits on while it crossfades, so a gap between two
// images is navy rather than white.
export const PLATE = '#0e1c3a';

// Markdown syntax has no place in a one-line hook.
export function stripMd(text = '') {
  return text
    .replace(/[*_`#>]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim();
}

// The one line under a title. The subtitle if the CD wrote one, else the
// opening line of the description, which is where somebody who skipped the
// subtitle field put their hook anyway.
export function listingHook(ev) {
  if (!ev) return null;
  if (ev.subtitle) return ev.subtitle;
  return ev.description ? stripMd(ev.description.split('\n')[0]) : null;
}

// The date in full, for the surface that is stating the facts:
// "Saturday, September 6". The year comes along only when it is not this one.
export function fullWhen(dateStr, now = new Date()) {
  const d = listingDate(dateStr);
  if (!d) return null;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

// How near it is, in the words a person would use. This is the caption on
// artwork; `fullWhen` is the fact in the details. Saying "Saturday, September
// 6" in both places is the repetition an events list is warned about, so the
// two surfaces deliberately say different halves of the same thing.
export function nearWhen(dateStr, now = new Date()) {
  const days = daysUntil(dateStr, now);
  if (days === null) return 'Announcement';
  if (days < 0) return 'This event has passed';
  if (days === 0) return 'Happening today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `This ${listingDate(dateStr).toLocaleDateString('en-US', { weekday: 'long' })}`;
  if (days < 14) return 'Next week';
  return 'Coming up';
}

// The short version for a row: "Sat 9/6", plus the time if there is one.
//
// THE MONTH COMES ALONG even though the row sits under a month heading. It
// used to be left out as a repetition, and the day on its own was a riddle:
// "THU 3" beside a time reads as an hour, or a count, or the third of some
// month you have to scroll up to find. A slashed date is unmistakably a date
// at a glance, and it costs two characters. Numeric rather than "Sep 6"
// because the eyebrow is already an uppercase weekday and two abbreviated
// words in a row is the noisier read.
export function rowWhen(ev) {
  const d = listingDate(ev?.event_date);
  const day = d
    ? `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getMonth() + 1}/${d.getDate()}`
    : null;
  return [day, ev?.event_time].filter(Boolean).join(' · ') || null;
}

// The heading a group of listings sits under. Undated listings are their own
// group at the end: they are the evergreen "join our club" promos, and they
// belong to no month.
export const ANYTIME = 'Anytime';

export function monthGroup(dateStr, now = new Date()) {
  const d = listingDate(dateStr);
  if (!d) return ANYTIME;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

// Listings in the order the endpoint already returns them, cut into their
// month groups. Dated first, soonest first; Anytime last, which is where the
// server's `NULLS LAST` has already put them.
export function byMonth(events, now = new Date()) {
  const out = [];
  const at = new Map();
  for (const ev of events || []) {
    const key = monthGroup(ev.event_date, now);
    if (!at.has(key)) { at.set(key, out.length); out.push({ key, events: [] }); }
    out[at.get(key)].events.push(ev);
  }
  return out;
}
