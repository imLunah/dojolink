// Builds the CREATE sticker book out of the IMPACT achievement icons.
//
//   node scripts/build-impact-stickers.mjs [path-to/Code Ninjas IMPACT]
//
// Writes `client/public/impact/*.png` (cropped, downscaled) and regenerates
// `client/src/lib/createStickers.js`. Both outputs are committed, so this only
// needs running when the source folder changes; it is here so the next person
// can see exactly where 218 stickers came from rather than trusting a blob.
//
// The source is the shared franchise Canva account, exported to a local assets
// folder with a manifest (see that folder's README). It is deliberately NOT in
// this repo: it is 271 icons plus 486 ninjas at full resolution, most of which
// this app has no use for.
//
// What this replaces: the sticker book used to be 35 pieces of belt spot art
// under invented titles, mapped to levels by hand. All four of the White
// belt's stickers came from a level other than the one they claimed (`white-1`
// is the Level 2 achievement "That Belongs in a Museum", shown as "First
// Coder" for Level 1). The achievements are real, named, and already belong
// to a level, so the mapping is now read rather than authored.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, alphaBounds, crop, resize, quantize, encodeIndexed } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = process.argv[2] || '/Users/john/Documents/Assets/Code Ninjas IMPACT';
const ICONS = path.join(SOURCE, 'impact-icons');
const OUT_DIR = path.join(ROOT, 'client/public/impact');
const OUT_DATA = path.join(ROOT, 'client/src/lib/createStickers.js');

// The biggest a sticker is ever drawn is the 176px record on the sticker book,
// and it scales to 1.05 under the pointer. 200 covers that with a little room
// and matches the Code.AI sticker set already in `public/stickers`.
const MAX_PX = 200;

// Canva filenames are the only names these icons have, and some of them are
// wrong. Everything here is either a plain misspelling or an apostrophe the
// uploader dropped; nothing is a rewrite. Apostrophes ARE legal in the source
// ("It's Alive!", "Hey I'm Walking Here" both have one), so a missing one is
// a slip rather than a filesystem restriction.
//
// "Say What Now-" is the exception that IS a filename artifact: a trailing
// dash where a question mark could not go.
//
// Delete a line here and the franchise's own spelling comes back.
const TITLE_FIXES = {
  'Painters Palette': "Painter's Palette",
  'Whats in a Name': "What's in a Name",
  'Lets Try That Again': "Let's Try That Again",
  'Checkin It Twice': "Checkin' It Twice",
  'Free Fallin': "Free Fallin'",
  'The Times, They are a Changin': "The Times, They Are a Changin'",
  'Say What Now-': 'Say What Now?',
  'Effective Immedieatley': 'Effective Immediately',
  'Asset Depriciation': 'Asset Depreciation',
  'Comparitively Speaking': 'Comparatively Speaking',
  'Reasses the Situation': 'Reassess the Situation',
};

// ONE BADGE PER LEVEL. 43 levels, 43 stickers.
//
// The source has 218 named achievements, four to nine per level, and they are
// awarded inside MakeCode for specific in-game actions that never reach us.
// Unlocking a level's whole set together made finishing one level pay out nine
// rewards at once, which is not what a sticker is for. So each level puts one
// icon forward and the rest stay in the source folder.
//
// The pick is editorial and it is written down here rather than computed. A
// keyword score against the level's poster topic was tried first and it is not
// good enough: most levels scored zero and fell through to alphabetical, which
// put "Layer Cake" on Events! and "Area Rug" on Tilemap Location. These are
// chosen by reading the level's topic and quest and taking the achievement
// that pictures it. Change any line and rerun; nothing else needs to move.
//
// Keys are `Belt Level`. Values are titles AFTER `TITLE_FIXES` is applied.
const LEVEL_BADGES = {
  'White 1': 'First Words',
  'White 2': 'Story Teller',
  'White 3': 'Taking Control',
  'White 4': 'A Whole New Kind of Sprite',

  'Yellow 1': 'Keeping Track',
  'Yellow 2': 'I Like to Move It, Move It',
  'Yellow 3': 'To Be or Not to Be',
  'Yellow 4': 'Saturday Morning Cartoons',

  'Orange 1': 'X and Y Marks the Spot',
  'Orange 2': 'New Tile Who Dis',
  'Orange 3': 'Making a List',
  'Orange 4': 'Once More, With Feeling',
  'Orange 5': "Don't Forget to Call",

  'Green 1': 'Hop, Skip and a Jump',
  'Green 2': 'All or Nothing',
  'Green 3': 'Card Catalog',
  'Green 4': 'GPS',
  'Green 5': 'Setting the Bar',

  'Blue 1': 'Opening Line',
  'Blue 2': 'Comment, Like and Subscribe',
  'Blue 3': 'Framing the Discussion',
  'Blue 4': 'Nestled Brackets',
  'Blue 5': 'Let There Be Variables',
  'Blue 6': 'Comparatively Speaking',

  'Purple 1': 'A Meeting of the Kinds',
  'Purple 2': 'Here We Go Again',
  'Purple 3': 'Array of Sunshine',
  'Purple 4': 'Arrays All the Way Down',
  'Purple 5': 'Calling All Functions',
  'Purple 6': 'Earworm',

  'Brown 1': 'Carefully Curated',
  'Brown 2': 'A Glyph in the System',
  'Brown 3': "Checkin' It Twice",
  'Brown 4': 'Swatch and Learn',
  'Brown 5': 'Work of Art',
  'Brown 6': "The Gang's All Here!",
  'Brown 7': 'Frame by Frame',
  'Brown 8': 'A Whole New World',
  'Brown 9': 'Choose Your Adventure',
  'Brown 10': 'Birds Eye View',

  'Red 1': 'Hole in One',
  'Red 2': 'Tower Power!',

  'Black 1': 'Something to be Proud Of',
};

// One Blue Level 4 icon is uploaded as `BB_4 -.png` with no name at all. It is
// real artwork (a game screen, a donut, a cursor), but a book that prints a
// franchise name under every sticker cannot carry one whose name we would have
// to invent — inventing names is the thing this build exists to stop. It is
// left out until someone reads the name off Canva and adds it.
const SKIP_UNTITLED = true;

const BELT_ORDER = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black'];

const slug = (title) => title
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ICONS, 'manifest.json'), 'utf8'));
  const out = [];
  for (const belt of manifest.belts) {
    // White through Brown keep their achievements in per-level folders; Red and
    // Black have no level folders in Canva and sit at the belt root, with the
    // level carried on the entry instead.
    const entries = [
      ...(belt.levels || []).flatMap((lvl) => lvl.items.map((it) => ({ ...it, dir: lvl.folder, level: lvl.level }))),
      ...(belt.files || []).map((it) => ({ ...it, dir: belt.folder })),
    ];
    for (const item of entries) {
      if (item.type !== 'achievement') continue;
      const title = (TITLE_FIXES[item.title] ?? item.title ?? '').trim();
      if (!title) {
        if (SKIP_UNTITLED) continue;
        throw new Error(`Untitled achievement: ${item.dir}/${item.file}`);
      }
      out.push({
        belt: belt.belt,
        level: Number(item.level),
        title,
        file: path.join(ICONS, item.dir, item.file),
      });
    }
  }
  out.sort((a, b) => BELT_ORDER.indexOf(a.belt) - BELT_ORDER.indexOf(b.belt)
    || a.level - b.level
    || a.title.localeCompare(b.title));
  return out;
}

// The 43 the book actually ships, one per level, in curriculum order. Throws
// rather than falling back if a `LEVEL_BADGES` title does not match the source:
// a silent fallback is how a badge ends up on a level it was never chosen for,
// and a typo in that table would be invisible otherwise.
function chooseBadges(items) {
  const wanted = new Map(Object.entries(LEVEL_BADGES));
  const picked = [];

  for (const [key, title] of wanted) {
    const [belt, level] = [key.slice(0, key.lastIndexOf(' ')), Number(key.slice(key.lastIndexOf(' ') + 1))];
    const hit = items.find((it) => it.belt === belt && it.level === level && it.title === title);
    if (!hit) {
      const options = items.filter((it) => it.belt === belt && it.level === level).map((it) => it.title);
      throw new Error(`LEVEL_BADGES["${key}"] = "${title}" is not an achievement of that level.\n  Options: ${options.join(', ') || '(none)'}`);
    }
    picked.push(hit);
  }

  // Every level the curriculum has must put a badge forward, or a ninja walks
  // past a level and collects nothing.
  const levels = new Set(items.map((it) => `${it.belt} ${it.level}`));
  const missing = [...levels].filter((key) => !wanted.has(key));
  if (missing.length) throw new Error(`Levels with no badge chosen: ${missing.join(', ')}`);

  picked.sort((a, b) => BELT_ORDER.indexOf(a.belt) - BELT_ORDER.indexOf(b.belt) || a.level - b.level);
  return picked;
}

function build() {
  const items = chooseBadges(readManifest());

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const seen = new Set();
  const stickers = [];
  let bytes = 0;

  for (const item of items) {
    const id = `${item.belt.toLowerCase()}-${item.level}-${slug(item.title)}`;
    if (seen.has(id)) throw new Error(`Duplicate sticker id ${id} (${item.file})`);
    seen.add(id);

    const img = decode(item.file);
    const out = encodeIndexed(quantize(resize(crop(img, alphaBounds(img)), MAX_PX)));
    fs.writeFileSync(path.join(OUT_DIR, `${id}.png`), out);
    bytes += out.length;

    stickers.push({ id, belt: item.belt, level: item.level, title: item.title, src: `/impact/${id}.png` });
  }

  fs.writeFileSync(OUT_DATA, dataFile(stickers));

  const perBelt = BELT_ORDER.map((b) => `${b} ${stickers.filter((s) => s.belt === b).length}`).join(', ');
  console.log(`${stickers.length} stickers  (${perBelt})`);
  console.log(`${(bytes / 1024 / 1024).toFixed(2)} MB in ${path.relative(ROOT, OUT_DIR)}`);
  console.log(`wrote ${path.relative(ROOT, OUT_DATA)}`);
}

function dataFile(stickers) {
  const lines = [];
  let belt = null;
  for (const s of stickers) {
    if (s.belt !== belt) {
      belt = s.belt;
      lines.push(`\n  // ${belt} belt`);
    }
    lines.push(`  a('${s.belt}', ${s.level}, ${JSON.stringify(s.title)}),`);
  }

  return `// GENERATED by scripts/build-impact-stickers.mjs. Do not edit by hand.
//
// One badge per CREATE level: ${stickers.length} levels, ${stickers.length} stickers, in curriculum order.
//
// Each is a real Code Ninjas IMPACT achievement icon, under the name Code
// Ninjas gave it, taken from the level it belongs to. The source has 218
// achievements, four to nine per level; each level puts one forward and the
// rest stay in the assets folder. Which one is an editorial choice recorded in
// the build script's LEVEL_BADGES table, made by reading the level's poster
// topic and quest — not computed, because a keyword score put "Layer Cake" on
// Events! and that is how the old set went wrong.
//
// This file used to hold 35 hand-written milestones over belt spot art, with
// invented titles ("First Coder") on artwork that came from a different level
// than the one it claimed. Those are gone.
//
// WHAT A STICKER CLAIMS: that the level is finished. Nothing more. The
// achievements themselves are awarded inside MakeCode for specific in-game
// actions that never reach DojoLink, so no surface says a ninja personally
// unlocked this one — the badge stands for the level, and every requirement
// line says so ("Complete White Belt Level 1").
// See lib/stickerProgress.js for the one definition of "earned".

const a = (belt, level, title) => {
  const id = \`\${belt.toLowerCase()}-\${level}-\${title.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}\`;
  return { id, belt, level, title, src: \`/impact/\${id}.png\` };
};

export const CREATE_STICKERS = [${lines.join('\n')}
];

// Belt order is the order of the array, which is curriculum order.
export const STICKER_BELTS = [...new Set(CREATE_STICKERS.map((item) => item.belt))];

export function stickersForBelt(belt) {
  return CREATE_STICKERS.filter((item) => item.belt === belt);
}

export function stickerRequirement({ belt, level }) {
  return \`Complete \${belt} Belt Level \${level}\`;
}
`;
}

build();
