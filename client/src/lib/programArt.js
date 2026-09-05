// The art a non-CREATE course page is drawn with.
//
// Files are built by `scripts/build-program-art.mjs` from the franchise IMPACT
// set and live in `client/public/tracks`. That script's header records which
// picture each track got and why, and which parts of the IMPACT set were ruled
// out. The short version, because it decides what may be added here later:
//
//   A track's icon is IDENTITY, one per track, chosen because the picture
//   suits the track. It is never captioned, because its source title is a
//   CREATE achievement and has nothing to do with this program.
//
//   The complete medal is the belt mastery torii: a gate and a checkmark, no
//   number and no belt name. It is the only IMPACT medal that can leave CREATE
//   without saying something false.
//
// Track keys must match SUB_PROGRAMS in utils/progressData.js. A program with
// no tracks is keyed by its own name. Anything unlisted returns null and the
// caller keeps whatever it drew before, so a new kit is a missing picture and
// never a wrong one.

const TRACK_ART = new Set([
  'LEGO Spike Essentials',
  'LEGO Spike Prime',
  'VEX GO',
  'Ozobot Evo',
  'JR Coding',
  'Snap Circuits',
  'VR CS Breakthroughs',
  'VR CS Dimensions',
  'AI Academy',
]);

// The torii's colour follows the program's own identity colour, the same one
// PROGRAM_GRADIENTS paints the hero with, so a finished kit is marked in the
// colour the page is already wearing.
const COMPLETE_COLOR = {
  'Robotics Academy': 'blue',
  'AI Academy': 'blue',
  'JR': 'purple',
  'VR Coding': 'green',
};

function slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function trackArt(name) {
  return TRACK_ART.has(name) ? `/tracks/${slug(name)}.png` : null;
}

export function completeMedal(program) {
  return `/tracks/complete-${COMPLETE_COLOR[program] || 'blue'}.png`;
}

// A track is COMPLETE when no module in it is still to do. It is not enough
// that the ninja has moved on to the next kit: trackModel marks a track 'done'
// the moment a later one becomes current, which is where they are, not what
// they finished. The medal says finished, so it has to mean it.
//
// The test is "nothing left", not `done === modules.length`, which can never
// be true: trackModel marks the furthest logged module 'working' and leaves it
// there, so a kit with every module logged reads as n-1 done and one in
// progress.
export function trackComplete(track) {
  return !!track && track.modules.length > 0 && track.modules.every((m) => m.status !== 'todo');
}
