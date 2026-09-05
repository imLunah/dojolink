// Builds the parent portal's ninja art, in three skin tones.
//
//   node scripts/build-ninjas.mjs [path-to/Code Ninjas IMPACT]
//
// Writes `client/public/ninjas/<belt>-<pose>-<tone>.png`: 9 belts x 2 poses x
// 3 tones = 54 files. Only two are ever fetched for a given page (the wave and
// the cheer of one ninja), so the set is wide on disk and unchanged on the
// wire.
//
// WHICH SOURCE FILES THESE ARE, and how that was established rather than
// guessed: the shipped art was 18 files named `<belt>-wave` and `<belt>-cheer`
// with nothing recording where they came from, and the source ships 18 poses
// per belt per tone under numbers only (`ninja-white-light-pose04`). Matching
// on the alpha silhouette — the pose is the shape, the belt is a small sash
// and the tone is a few hundred pixels — put every one of the nine waves on
// pose04 and every one of the nine cheers on pose05, at a distance of 0.0027
// where the next candidate was an order of magnitude away. A per-pixel colour
// comparison then put the shipped tone at MEDIUM (3.4 against 37 for light and
// 54 for dark).
//
// So medium is the default below, and a ninja with no tone set keeps exactly
// the art they had.
//
// No resize. The shipped files were 1:1 crops of the source canvas (their
// alpha threshold was a little higher than ours, which is the whole difference
// between their 532x665 and our 553x671), and both poses are cut from one
// 551x800 canvas. Scaling each to a common maximum would quietly change how
// big the cheer is against the wave, and `NinjaHero` is built around that
// difference: "the cheer pose is a wider picture than the wave".

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, alphaBounds, crop, quantize, encodeIndexed } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = process.argv[2] || '/Users/john/Documents/Assets/Code Ninjas IMPACT';
const NINJAS = path.join(SOURCE, 'impact-ninjas');
const OUT_DIR = path.join(ROOT, 'client/public/ninjas');

// Folder names in the source, in curriculum order. The four Degrees belts have
// no ninja art and never did; `NinjaHero` already sends anything past Black to
// the Black ninja.
const BELTS = {
  white: '01-white-belt',
  yellow: '02-yellow-belt',
  orange: '03-orange-belt',
  green: '04-green-belt',
  blue: '05-blue-belt',
  purple: '06-purple-belt',
  brown: '07-brown-belt',
  red: '08-red-belt',
  black: '09-black-belt',
};

const POSES = { wave: '04', cheer: '05' };
export const TONES = ['light', 'medium', 'dark'];

function build() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let bytes = 0;
  let count = 0;

  for (const [belt, folder] of Object.entries(BELTS)) {
    for (const [pose, number] of Object.entries(POSES)) {
      for (const tone of TONES) {
        const file = path.join(NINJAS, folder, tone, `ninja-${belt}-${tone}-pose${number}.png`);
        if (!fs.existsSync(file)) throw new Error(`Missing source ninja: ${file}`);

        const img = decode(file);
        const out = encodeIndexed(quantize(crop(img, alphaBounds(img))));
        fs.writeFileSync(path.join(OUT_DIR, `${belt}-${pose}-${tone}.png`), out);
        bytes += out.length;
        count += 1;
      }
    }
  }

  console.log(`${count} ninjas  (${Object.keys(BELTS).length} belts x ${Object.keys(POSES).length} poses x ${TONES.length} tones)`);
  console.log(`${(bytes / 1024 / 1024).toFixed(2)} MB in ${path.relative(ROOT, OUT_DIR)}`);
}

build();
