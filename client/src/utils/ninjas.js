// The parent portal's ninja art: nine belts, two poses, three skin tones.
//
// Files are built by `scripts/build-ninjas.mjs` from the franchise source and
// live in `client/public/ninjas` as `<belt>-<pose>-<tone>.png`. Tone names must
// match the `students.ninja_skin_tone` CHECK and NINJA_TONES in
// server/routes/students.js.

export const NINJA_TONES = ['light', 'medium', 'dark'];

// What a ninja with no tone set gets. It is the tone the app shipped when
// there was only one, so an untouched roster looks exactly as it did.
export const DEFAULT_TONE = 'medium';

// What a family reads under each ninja. The keys name a skin tone because the
// files and the database column have to; the labels do not, and they should
// not. Printing "Light / Medium / Dark" under three pictures of a child's
// ninja asks a seven year old to pick a word for their own skin, when the only
// question being asked is which ninja they want to be. They are numbered in
// the order they are shown.
export const NINJA_TONE_LABELS = {
  light: 'Ninja 1',
  medium: 'Ninja 2',
  dark: 'Ninja 3',
};

// Only the nine CREATE belts were ever drawn. A ninja past Black (the four
// Degrees belts) keeps the Black ninja rather than losing their art, and no
// enrolment at all gets White, which is where everyone starts.
const NINJA_BELTS = new Set(['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black']);

export function ninjaBelt(belt) {
  if (NINJA_BELTS.has(belt)) return belt;
  return belt ? 'Black' : 'White';
}

export function ninjaTone(tone) {
  return NINJA_TONES.includes(tone) ? tone : DEFAULT_TONE;
}

export function ninjaSrc(belt, pose, tone) {
  return `/ninjas/${ninjaBelt(belt).toLowerCase()}-${pose}-${ninjaTone(tone)}.png`;
}
