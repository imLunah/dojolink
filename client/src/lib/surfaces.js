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
export const CARD =
  'bg-white border border-ninja-border rounded-2xl shadow-sm ' +
  'dark:shadow-[0_10px_34px_rgb(0_0_0/0.32)] ring-1 ring-transparent dark:ring-white/[0.05] ' +
  'glass-card glass-clear';

// Tighter radius, no lift, and NOT glass. For surfaces nested inside a CARD,
// and for the denser list/form panels that predate the 2xl card.
//
// The deliberate exception, and the reason the glass reads as a material at
// all: a pane inside a pane is two sheets of glass with nothing between them,
// and if everything on the page is glass then nothing on it is. What is behind
// a nested panel is the card it is sitting in, which is not worth bending.
export const PANEL = 'bg-white border border-ninja-border rounded-xl shadow-sm';

// Clear glass, over the top of CARD. A translucent pane with its saturation
// lifted and its edges lit, defined in index.css — two class names deep,
// because `.dark .bg-white` and `.dark .shadow-sm` are two deep as well and a
// single class would tie with them and lose on source order.
//
// Not every surface should take it. Glass is worth having where there is
// something behind it worth bending: a card on a column, a panel on a page. A
// field inside a card has nothing behind it but the card.
export const GLASS = 'glass-card glass-clear';

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
