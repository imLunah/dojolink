// Color sets keyed by color_key stored in club_definitions
export const COLOR_SETS = {
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', solid: '#7c3aed' },
  green:  { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200',  solid: '#15803d' },
  red:    { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200',    solid: '#b91c1c' },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200',   solid: '#1d4ed8' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', solid: '#c2410c' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', solid: '#a16207' },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-200',   solid: '#0f766e' },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-700',   border: 'border-pink-200',   solid: '#be185d' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', solid: '#4338ca' },
};

// Legacy map keyed by club name (for components not yet migrated to color_key)
export const CLUB_COLORS = {
  '3D Design Club': COLOR_SETS.purple,
  'Minecraft Club':  COLOR_SETS.green,
  'Roblox Club':     COLOR_SETS.red,
};

export function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function getClubColors(clubDef) {
  return COLOR_SETS[clubDef?.color_key] || COLOR_SETS.blue;
}

// The club's identity as a background, for surfaces that have no cover photo.
// A wash of the club colour from the top left, a second bloom from the bottom
// right, and a faint diagonal hatch so a large empty area has some grain in it
// instead of reading as a flat panel.
//
// Inline, and in hex: these land on coloured surfaces, where the `.dark .bg-*`
// overrides must not reach. Shared so the club hero and a session's header are
// built from the same recipe rather than two that drift.
export function clubField(solid) {
  return {
    backgroundColor: '#111a2e',
    backgroundImage: [
      `radial-gradient(115% 130% at 6% -10%, ${solid} 0%, ${solid}cc 38%, ${solid}33 68%, rgba(17,26,46,0) 100%)`,
      `radial-gradient(80% 120% at 100% 120%, ${solid}55 0%, rgba(17,26,46,0) 70%)`,
      'repeating-linear-gradient(115deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 13px)',
    ].join(', '),
  };
}

// The scrim over a cover photo. Weighted to the bottom left, where the title
// sits, so copy holds up over a bright image without flattening the whole thing.
export const COVER_SCRIM =
  'linear-gradient(to top, rgba(8,12,22,0.92) 0%, rgba(8,12,22,0.55) 38%, rgba(8,12,22,0.12) 70%, rgba(8,12,22,0.35) 100%),' +
  'linear-gradient(to right, rgba(8,12,22,0.6) 0%, rgba(8,12,22,0) 55%)';
