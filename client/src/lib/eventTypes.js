// Event types are free text. These are just suggestions + known colors;
// anything else falls back to a neutral chip. Avoids the pinned program hues
// (JR purple, VR teal) so event colors never read as a program. Lives here —
// not in EventCalendar — because the parent portal's featured-event banner
// shares the colors without wanting the whole staff calendar in its chunk.
export const TYPE_SUGGESTIONS = ['Game Building', 'Tournament', 'Parents Night', 'Field Trip', 'Holiday'];

const TYPE_COLOR = {
  'game building': '#2563eb',
  'tournament':    '#f59e0b',
  'parents night': '#ec4899',
  'field trip':    '#10b981',
  'holiday':       '#ef4444',
};

export const colorFor = (type) => TYPE_COLOR[(type || '').trim().toLowerCase()] || '#64748b';
