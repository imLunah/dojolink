import { getBelt } from '../../utils/beltConfig';

// The nine CREATE belts are TRUE VECTOR now — the franchise Canva account's
// "Ninja Belt Icons: SVG" folder, ~3KB each, from the asset pack rather than
// cut off a poster. That replaced 18 PNGs (nine at 256px and nine at 1280px)
// with nine files: 1.3MB down to 30KB, sharp at 26px on the belt road and at
// 650px as the course banner's art, and no resolution tier to pick.
const VECTOR_BELTS = new Set(['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black']);

// The Degrees belts are not in that folder and have no transparent source at
// all, so they stay the 256px PNGs they have always been.
const RASTER_BELTS = new Set(['Bronze', 'Silver', 'Gold', 'Platinum']);

// White is the one belt that needs two files, and not for size any more: its
// ring is white, so on a white card there is nothing to see. The everyday copy
// carries a hairline in the head's own charcoal, painted into the SVG; the
// `-lg` copy is the vector exactly as drawn, for the blue hero where an
// outline is wrong. `large` therefore means "painted as hero art", not "the
// big file" — for every other belt one file answers both.
const LARGE_BELTS = new Set(['White']);

export function hasLargeBelt(belt) {
  return LARGE_BELTS.has(belt);
}

// The image for a belt, or null where there is none. Exported because a chart
// axis and a split avatar draw belts through a bare <img> or an SVG <image>
// and cannot mount a component — and the extension is not the same for every
// belt, so nobody should be building this path by hand.
export function beltIconSrc(belt, { large = false } = {}) {
  if (VECTOR_BELTS.has(belt)) {
    return `/belts/belt-${belt.toLowerCase()}${large && LARGE_BELTS.has(belt) ? '-lg' : ''}.svg`;
  }
  if (RASTER_BELTS.has(belt)) return `/belts/belt-${belt.toLowerCase()}.png`;
  return null;
}

export default function BeltIcon({ belt, size = 40, dimmed = false, large = false, className = '', style = {} }) {
  if (!belt) return null;
  const dim = dimmed ? 'opacity-25 grayscale' : '';
  const src = beltIconSrc(belt, { large });

  if (src) {
    return (
      <img
        src={src}
        alt={belt}
        draggable={false}
        style={{ width: size, height: size, ...style }}
        className={`object-contain ${dim} ${className}`}
      />
    );
  }

  const cfg = getBelt(belt);
  return (
    <div
      title={belt}
      style={{ width: size, height: size, backgroundColor: cfg?.color || '#9ca3af', color: cfg?.textColor || '#fff', ...style }}
      className={`rounded-full flex items-center justify-center font-ninja font-black border border-black/10 ${dim} ${className}`}
    >
      <span style={{ fontSize: Math.round(size * 0.44), lineHeight: 1 }}>{belt[0]}</span>
    </div>
  );
}
