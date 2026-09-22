// Event types are each center's own (table event_types, /api/events/types).
// Directors add them and pick a color, but only from this palette, so every
// chip keeps white text readable. Mirrored by TYPE_PALETTE in
// server/routes/events.js. Avoids the pinned program hues (JR purple, VR teal)
// so an event never reads as a program.
export const TYPE_PALETTE = [
  '#2563eb', '#0284c7', '#4f46e5', '#059669', '#65a30d', '#ca8a04',
  '#ea580c', '#dc2626', '#e11d48', '#db2777', '#92400e', '#64748b',
];

const NEUTRAL = '#64748b';

// The center's entry for a stored type, matched the way the server matches it.
export const findType = (types, type) => {
  const key = (type || '').trim().toLowerCase();
  return key ? (types || []).find((t) => t.label.toLowerCase() === key) || null : null;
};

// A type that has since been deleted keeps its label on the event and is
// drawn grey.
export const colorFor = (types, type) => findType(types, type)?.color || NEUTRAL;
