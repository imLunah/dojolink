// The art for a lesson sticker, drawn rather than fetched.
//
// JR, Robotics and AI are 330 lessons. The IMPACT export has 219 achievement
// icons in it, CREATE's book took 43 and the module book took 38, so there are
// 138 left: not enough to give a lesson its own franchise picture, and short
// by enough that no amount of care in choosing would close the gap. These are
// DojoLink's own badges instead, generated here, and they are deliberately a
// DIFFERENT SHAPE from the two borrowed sets — a hexagon against the IMPACT
// set's die-cut blobs — so that a parent can see at a glance which stickers
// are Code Ninjas awards and which are ours. Passing off a generated badge as
// franchise art is the one thing this file must not do.
//
// SVG, not PNG. `scripts/png.mjs` can crop and downscale an existing image but
// has no rasteriser, so drawing 330 PNGs would mean writing one, and the
// output would be worse: an SVG badge is a few hundred bytes, stays crisp from
// the 44px row to the 176px record, and needs no build step and no 330 files
// committed to a public repo. It is handed to the card as a data URI in `src`,
// which is why nothing in StickerCard or StickerZoom had to change — the
// shared-element zoom, the grayscale lock state and the drop shadow all still
// work on an <img>.
//
// NO RANDOMNESS. The family and its variations are picked by the lesson's
// INDEX within its kit, walking the combination space in order, so a module's
// ten lessons are ten visibly different badges rather than ten rolls of a die
// that might land on the same face twice. A hash would collide: JR Coding
// alone is 100 lessons in one colour.

// One colour family per kit, so a shelf of Ozobot lessons reads as a set and
// does not blur into VEX GO's. The values follow the identity colour each
// track already wears on its course page (see PROGRAM_GRADIENTS), rather than
// a new palette invented here.
const KIT_COLORS = {
  'JR Coding': ['#a78bfa', '#6d28d9'],
  'Snap Circuits': ['#fbbf24', '#b45309'],
  'LEGO Spike Essentials': ['#2dd4bf', '#0f766e'],
  'LEGO Spike Prime': ['#60a5fa', '#1d4ed8'],
  'VEX GO': ['#4ade80', '#15803d'],
  'Ozobot Evo': ['#f472b6', '#be185d'],
  'AI Academy': ['#818cf8', '#4338ca'],
};
const FALLBACK = ['#94a3b8', '#475569'];

// The accent is what the glyph's one highlighted part is painted with. White
// carries most of the drawing; the accent marks a single element so the eye
// has somewhere to land.
//
// FIVE OF THEM, AND FIVE IS LOAD-BEARING. Everything about a badge is a
// function of the same step number, so the number of distinct badges a family
// can make is the lowest common multiple of its own variation periods and the
// accent's. The families vary on 2, 3 and 4; with three accents the weakest of
// them repeated every six steps, and JR Coding is 100 lessons — ten steps —
// so fifty badges in the book were duplicates of another. Five is coprime with
// 2, 3 and 4, which takes the worst family to a period of twenty.
const ACCENTS = ['#fff7ed', '#fde68a', '#bae6fd', '#bbf7d0', '#fecdd3'];

const round = (n) => Math.round(n * 10) / 10;

// The glyph vocabulary. Ten families, each drawn inside a 48-unit box centred
// on (48, 48) of a 96 viewBox, each taking a `v` that walks it through its own
// variations. They are geometric on purpose: a lesson badge cannot illustrate
// its lesson (there are 330 of them and no art budget), so it does not try to
// and pretend. It is a mark, and a mark is allowed to be abstract.
//
// Every family must fill roughly the same optical area, or a shelf of them
// looks like some badges are missing their middle.
const FAMILIES = [
  // Concentric rings, the outermost dashed.
  (v, a) => {
    const n = 2 + (v % 2);
    let out = '';
    for (let i = 0; i < n; i++) {
      const r = 20 - i * 7;
      out += `<circle cx="48" cy="48" r="${r}" fill="none" stroke="${i === 0 ? a : '#fff'}" stroke-width="${i === 0 ? 4 : 3.2}"${i === 0 ? ' stroke-dasharray="7 5"' : ''} opacity="${i === 0 ? 1 : 0.9}"/>`;
    }
    return `${out}<circle cx="48" cy="48" r="4" fill="#fff"/>`;
  },
  // A centre with dots in orbit.
  (v, a) => {
    const n = 4 + (v % 4);
    let out = `<circle cx="48" cy="48" r="20" fill="none" stroke="#fff" stroke-width="2" opacity="0.45"/><circle cx="48" cy="48" r="7" fill="#fff"/>`;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2 - Math.PI / 2;
      out += `<circle cx="${round(48 + Math.cos(t) * 20)}" cy="${round(48 + Math.sin(t) * 20)}" r="4.6" fill="${i === 0 ? a : '#fff'}"/>`;
    }
    return out;
  },
  // Stacked chevrons, pointing whichever way the variant says.
  (v, a) => {
    const n = 2 + (v % 3);
    const up = v % 2 === 0;
    let out = '';
    for (let i = 0; i < n; i++) {
      const y = 48 - ((n - 1) * 11) / 2 + i * 11;
      const d = up
        ? `M30 ${round(y + 6)} L48 ${round(y - 6)} L66 ${round(y + 6)}`
        : `M30 ${round(y - 6)} L48 ${round(y + 6)} L66 ${round(y - 6)}`;
      out += `<path d="${d}" fill="none" stroke="${i === 0 ? a : '#fff'}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return out;
  },
  // A grid of tiles with one lit.
  (v, a) => {
    const n = 2 + (v % 2);
    const size = n === 2 ? 17 : 11.5;
    const gap = n === 2 ? 5 : 4;
    const span = n * size + (n - 1) * gap;
    const x0 = 48 - span / 2;
    const lit = v % (n * n);
    let out = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        out += `<rect x="${round(x0 + c * (size + gap))}" y="${round(x0 + r * (size + gap))}" width="${size}" height="${size}" rx="3.5" fill="${i === lit ? a : '#fff'}" opacity="${i === lit ? 1 : 0.86}"/>`;
      }
    }
    return out;
  },
  // A circuit trace with nodes at the corners.
  (v, a) => {
    const flip = v % 2 === 0 ? 1 : -1;
    const y = 48 + flip * 10;
    const d = `M28 ${round(48 - flip * 12)} H42 V${round(y)} H54 V${round(48 - flip * 12)} H68`;
    return `<path d="${d}" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<circle cx="28" cy="${round(48 - flip * 12)}" r="5" fill="${a}"/><circle cx="68" cy="${round(48 - flip * 12)}" r="5" fill="#fff"/>`;
  },
  // A burst of triangles.
  (v, a) => {
    const n = 3 + (v % 3);
    const spin = (v % 4) * 15;
    let out = `<circle cx="48" cy="48" r="5.5" fill="#fff"/>`;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 360 + spin;
      out += `<path d="M48 26 L53.5 40 L42.5 40 Z" fill="${i === 0 ? a : '#fff'}" opacity="${i === 0 ? 1 : 0.9}" transform="rotate(${round(t)} 48 48)"/>`;
    }
    return out;
  },
  // A signal, two strokes offset.
  (v, a) => {
    const amp = 9 + (v % 3) * 3;
    const wave = (dy, w, col, op) => {
      let d = `M26 ${round(48 + dy)}`;
      for (let i = 0; i <= 4; i++) {
        const x = 26 + (i + 1) * 11;
        d += ` Q ${round(x - 5.5)} ${round(48 + dy + (i % 2 ? amp : -amp))} ${round(x)} ${round(48 + dy)}`;
      }
      return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
    };
    return wave(-7, 4.5, a, 1) + wave(7, 4.5, '#fff', 0.92);
  },
  // Two links, interlocked.
  (v, a) => {
    const off = 8 + (v % 3) * 2;
    return `<rect x="${round(48 - off - 13)}" y="35" width="26" height="26" rx="8" fill="none" stroke="${a}" stroke-width="5"/>`
      + `<rect x="${round(48 + off - 13)}" y="35" width="26" height="26" rx="8" fill="none" stroke="#fff" stroke-width="5"/>`;
  },
  // Steps, climbing.
  (v, a) => {
    const n = 3 + (v % 2);
    const w = 44 / n;
    let out = '';
    for (let i = 0; i < n; i++) {
      const h = 12 + i * (26 / n);
      out += `<rect x="${round(26 + i * w)}" y="${round(66 - h)}" width="${round(w - 3.5)}" height="${round(h)}" rx="3" fill="${i === n - 1 ? a : '#fff'}" opacity="${i === n - 1 ? 1 : 0.88}"/>`;
    }
    return out;
  },
  // Spokes from a hub.
  (v, a) => {
    const n = 5 + (v % 4);
    const spin = (v % 3) * 12;
    let out = '';
    for (let i = 0; i < n; i++) {
      const t = ((i / n) * 360 + spin) * (Math.PI / 180);
      out += `<line x1="${round(48 + Math.cos(t) * 8)}" y1="${round(48 + Math.sin(t) * 8)}" x2="${round(48 + Math.cos(t) * 21)}" y2="${round(48 + Math.sin(t) * 21)}" stroke="${i === 0 ? a : '#fff'}" stroke-width="4.6" stroke-linecap="round"/>`;
    }
    return `${out}<circle cx="48" cy="48" r="6.5" fill="#fff"/>`;
  },
];

// A flat-top hexagon, inset far enough that the white rim below has room to
// sit outside it without being clipped by the viewBox.
const HEX = 'M48 8 L82 28 L82 68 L48 88 L14 68 L14 28 Z';

// The badge for one lesson, as an SVG data URI.
//
// `seat` is the lesson's position within its kit, counted across modules. It
// drives everything: which family draws it, how that family varies, and which
// accent it takes. Because the three radices are coprime with each other over
// the range a kit ever reaches, walking `seat` upward never repeats a
// combination inside one kit.
// Kits do not start at the same glyph.
//
// Without this, lesson 1 of every kit is the same drawing in a different
// colour, and Robotics shelves four kits together — so a parent scrolling the
// book would see the same badge four times in a row and reasonably conclude
// it meant something. The offset is a small hash of the kit name: stable
// across builds, and unrelated to the order kits happen to be listed in.
function kitOffset(kit) {
  let h = 0;
  for (let i = 0; i < String(kit).length; i++) h = (h * 31 + String(kit).charCodeAt(i)) % 9973;
  return h;
}

// Drawn once per (kit, seat) and kept.
//
// The whole book is rebuilt whenever a ninja's logs change, and it holds 330
// of these; without the cache that is 330 SVG strings and 330 URI encodings
// per rebuild for art that cannot have changed. The key space is bounded by
// the curriculum — seven kits, a few hundred lessons — so this never grows
// beyond what the book already holds.
const drawn = new Map();

export function lessonBadge({ kit, seat }) {
  const key = `${kit}|${seat}`;
  const hit = drawn.get(key);
  if (hit) return hit;
  const made = draw(kit, seat);
  drawn.set(key, made);
  return made;
}

function draw(kit, seat) {
  const [light, dark] = KIT_COLORS[kit] || FALLBACK;
  const n = seat + kitOffset(kit);
  const family = FAMILIES[n % FAMILIES.length];
  const step = Math.floor(n / FAMILIES.length);
  const accent = ACCENTS[step % ACCENTS.length];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/>`
    + `</linearGradient>`
    // The top light is a gradient rather than a second shape scaled down. A
    // scaled copy of the hexagon leaves a hard edge across the middle of the
    // face, which at 176px reads as a crease in the badge.
    + `<linearGradient id="s" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="#fff" stop-opacity="0.26"/>`
    + `<stop offset="0.55" stop-color="#fff" stop-opacity="0"/>`
    + `</linearGradient></defs>`
    // The rim is the same path stroked wide and drawn first, which is how the
    // die-cut IMPACT stickers read: a white edge that belongs to the shape
    // rather than a box around it.
    + `<path d="${HEX}" fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>`
    + `<path d="${HEX}" fill="url(#g)" stroke="${dark}" stroke-width="1.5" stroke-linejoin="round"/>`
    + `<path d="${HEX}" fill="url(#s)"/>`
    + family(step, accent)
    + `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const KIT_HAS_COLOR = (kit) => Object.prototype.hasOwnProperty.call(KIT_COLORS, kit);
