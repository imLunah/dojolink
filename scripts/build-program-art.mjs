// Builds the art the non-CREATE course pages are drawn with.
//
//   node scripts/build-program-art.mjs [path-to/Code Ninjas IMPACT]
//
// Writes `client/public/tracks/*.png`: one identity icon per named track
// (the four Robotics kits, JR's two tracks, VR's two, AI Academy), and the
// torii "complete" medal in the four program colours.
//
// WHY THIS EXISTS. Robotics, JR, VR and AI Academy have no artwork of their
// own. Their course page was a column of identical empty circles under a
// column of grey numbered squares, which is the same page for every program
// and every kit in it. CREATE reads as a curriculum because it has belt art,
// level medals and project screenshots; the others read as a spreadsheet.
//
// WHAT IS AND IS NOT REUSABLE FROM THE IMPACT SET, and why:
//
//   Level medals: NO. Every one of them prints a level number on a belt
//   colour. `medal-purple-level-03` next to "Ozobot Evo, Module 2" is a false
//   statement with a number on it, and putting one there would be the exact
//   bug the sticker book rebuild removed.
//
//   Belt mastery medals: YES. The torii medal is a gate and a checkmark. It
//   carries no number, no belt name and no level, so all it says is
//   "finished", which is a true thing to say about a finished kit. It is used
//   ONLY when every module in a track is done, never for a track the ninja has
//   merely moved past.
//
//   Achievement icons: YES, but as identity, not as decoration. Each track
//   gets ONE icon, chosen because the picture actually suits the track: a hard
//   hat and wrench for LEGO Spike Essentials, gears for Spike Prime, a wheel
//   for VEX GO, a colour wheel for Ozobot Evo (which is programmed in colour
//   codes), lightbulbs for Snap Circuits. The icons' CREATE titles are NOT
//   shipped and never shown. An uncaptioned picture makes no claim; a
//   captioned one would make a wrong claim.
//
//   NOT this: an icon per module, hashed or keyword-matched out of the
//   leftover pool. Module names come from the database and vary by location,
//   so nothing could be curated, and a birthday cake next to "Sensors" reads
//   as a bug rather than as a design. The module rows keep their status dots,
//   which mean something.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, alphaBounds, crop, resize, quantize, encodeIndexed } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = process.argv[2] || '/Users/john/Documents/Assets/Code Ninjas IMPACT';
const ICONS = path.join(SOURCE, 'impact-icons');
const MEDALS = path.join(SOURCE, 'impact-medals');
// Its OWN folder. `client/public/programs` is the hand-made program logos and
// banners and is NOT this script's to manage: pointing the output there once
// cost every one of them, because the build clears the directory first.
const OUT_DIR = path.join(ROOT, 'client/public/tracks');

// The biggest either is ever drawn is the 44px icon beside the open track's
// name. 120 is that at 3x, and matches how the sticker set was sized.
const MAX_PX = 120;

// Track name -> the IMPACT achievement icon that suits it. Keys must match
// SUB_PROGRAMS in client/src/utils/progressData.js exactly, or the program
// name for a program with no tracks. The comment is what the picture IS, not
// what the source file is called: the source title is a CREATE achievement and
// has nothing to do with the track.
const TRACK_ART = {
  'LEGO Spike Essentials': ['03-orange-belt/level-05/OB_5 - Make Your Own Way.png',   'hard hat and wrench'],
  'LEGO Spike Prime':      ['06-purple-belt/level-05/PB_5 - Feeling Shifty.png',      'gears'],
  'VEX GO':                ['07-brown-belt/level-07/BB_7 - Take it For a Spin.png',   'a wheel'],
  'Ozobot Evo':            ['07-brown-belt/level-05/BB_5 - Color Wheel.png',          'a colour wheel'],
  'JR Coding':             ['01-white-belt/level-01/WB_1 - Painters Palette.png',     'a brush over coloured blocks'],
  'Snap Circuits':         ["07-brown-belt/level-07/BB_7 - It's Alive!.png",          'lightbulbs coming on'],
  'VR CS Breakthroughs':   ['04-green-belt/level-02/GB_2 - Know Your Surroundings.png', 'binoculars'],
  'VR CS Dimensions':      ['06-purple-belt/level-02/PB_2 - Depth Perception.png',    'layers seen edge on'],
  'AI Academy':            ['06-purple-belt/level-03/PB_3 - Search Engine.png',       'a magnifier over shapes'],
};

// The torii medal each program's completed tracks are marked with, picked to
// sit in that program's own identity colour (see PROGRAM_GRADIENTS).
const COMPLETE_MEDALS = { blue: 'blue', purple: 'purple', green: 'green' };

export function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function write(srcFile, outName) {
  if (!fs.existsSync(srcFile)) throw new Error(`Missing source: ${srcFile}`);
  const img = decode(srcFile);
  const out = encodeIndexed(quantize(resize(crop(img, alphaBounds(img)), MAX_PX)));
  fs.writeFileSync(path.join(OUT_DIR, `${outName}.png`), out);
  return out.length;
}

function build() {
  // Clear only what this script wrote last time. A blanket rmSync deletes
  // anything a person put in the folder by hand, and no build script gets to
  // do that to a directory it did not create.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith('.png')) fs.rmSync(path.join(OUT_DIR, f));

  let bytes = 0;
  for (const [track, [file]] of Object.entries(TRACK_ART)) bytes += write(path.join(ICONS, file), slug(track));
  for (const [name, belt] of Object.entries(COMPLETE_MEDALS)) {
    bytes += write(path.join(MEDALS, `0${['white','yellow','orange','green','blue','purple','brown','red','black'].indexOf(belt) + 1}-${belt}-belt/medal-${belt}-mastery.png`), `complete-${name}`);
  }

  const n = Object.keys(TRACK_ART).length + Object.keys(COMPLETE_MEDALS).length;
  console.log(`${n} files  (${Object.keys(TRACK_ART).length} track icons, ${Object.keys(COMPLETE_MEDALS).length} complete medals)`);
  console.log(`${(bytes / 1024).toFixed(0)} kB in ${path.relative(ROOT, OUT_DIR)}`);
}

build();
