// One definition of the app's card surfaces.
//
// This class string was pasted inline in ~56 places and four components kept
// their own `const CARD` copy, which had already drifted: the sticky-note board
// was missing the dark ring and shadow and so sat visibly flatter than the
// cards beside it. Classes rather than a component, because most call sites
// need the surface on a motion.div, a form, a section or an anchor.
//
// The dark lift is deliberate. `ring-1 ring-transparent` is invisible in light
// mode and costs nothing; in dark mode the ring and shadow give cards enough
// separation from the deep-slate page that they stop reading as flat panels.
// The light-mode shadow is invisible on a dark background, hence the explicit
// dark variant.
// Solid, not glass. The cards wore a translucent liquid-glass pane for a
// while and it came off: the card is an opaque surface again, and the lift
// below is all the separation it carries.
export const CARD =
  'bg-white border border-ninja-border rounded-2xl shadow-sm ' +
  'dark:shadow-[0_10px_34px_rgb(0_0_0/0.32)] ring-1 ring-transparent dark:ring-white/[0.05]';

// Tighter radius, no lift. For surfaces nested inside a CARD, and for the
// denser list/form panels that predate the 2xl card.
export const PANEL = 'bg-white border border-ninja-border rounded-xl shadow-sm';

// The app's own edges — the nav, and nothing that opens. Between the cards and
// the menus: translucent enough to show the page as colour, blurred enough that
// none of it can be read, and flat, because chrome is not sitting on the page,
// it is the edge of it.
//
// Deliberately not on dialogs or the side panel. A surface that has come up to
// be dealt with cannot be see-through: what shows through it is the page it is
// covering, and the two read as one grey thing with the answer somewhere
// inside it. Glass is for what stays, not for what interrupts.
export const CHROME = 'glass-chrome glass-edge';

// The parent portal's card. Flat: white, a hairline, a soft radius, and no
// lift at all — no shadow, no ring, no glass. The parent pages are a flat
// page whose softness lives inside the cards (the coloured heroes, the tinted
// lists), and a shadow or a pane under those reads as a second material
// competing with the first. Decided on the design canvas; keep it flat.
export const FLAT = 'bg-white border border-ninja-border rounded-[22px]';
