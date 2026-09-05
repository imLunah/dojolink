// Builds the JR / Robotics / AI sticker book out of the leftover IMPACT icons.
//
//   node scripts/build-module-stickers.mjs [path-to/Code Ninjas IMPACT]
//   node scripts/build-module-stickers.mjs --pool     # list what is unused
//
// Writes `client/public/modules/*.png` and regenerates
// `client/src/lib/moduleStickers.js`. Both outputs are committed, so this only
// needs running when the source folder or the table below changes.
//
// ONE BADGE PER MODULE, 38 of them: 9 AI Academy, 11 JR, 18 Robotics Academy.
// A module is the unit because it is the thing with a shape — a handful of
// lessons that finish together — where a lesson is too small (330 of them) and
// a track too big (7). VR Coding is deliberately absent; it was not asked for
// and its two tracks are 27 lessons total.
//
// WHERE THE NAMES COME FROM, and this is the part to read before editing.
// The curriculum's own module names are placeholders — "Module 6", "VG 2",
// "E 1", "Elenco" — so unlike the CREATE book, which reads real Code Ninjas
// achievement names, these titles were WRITTEN, from the lessons inside each
// module, in the voice the CREATE set uses ("Fork in the Road", "Card
// Catalog"). That is a licence the CREATE set does not have and should not be
// taken further: a title here names the MODULE, it does not claim to be an
// award Code Ninjas gives. Nothing in the UI calls these achievements.
//
// THE DATABASE IS NOT RENAMED, on purpose. `progress_logs.module_name` stores
// the module's name as text at the moment a session is logged, and
// `recomputePercentComplete` joins on that text. Renaming
// `curriculum_modules.module_name` would orphan every log already written.
// So the title here is a presentation layer, keyed by the module's real name.
//
// THE ART is a Code Ninjas IMPACT achievement icon that the CREATE book did
// not take — 176 of the 218 are spare. It is used UNCAPTIONED: its own
// achievement title belongs to a CREATE level and has nothing to do with a
// Robotics module, so it never appears. The icon is chosen for what it
// depicts, by hand, in MODULE_BADGES below. That is the same editorial rule
// the CREATE set follows and for the same reason: a keyword score puts the
// wrong picture on things.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, alphaBounds, crop, resize, quantize, encodeIndexed } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = process.argv.find((a) => !a.startsWith('--') && a.includes('IMPACT'))
  || '/Users/john/Documents/Assets/Code Ninjas IMPACT';
const ICONS = path.join(SOURCE, 'impact-icons');
const OUT_DIR = path.join(ROOT, 'client/public/modules');
const OUT_DATA = path.join(ROOT, 'client/src/lib/moduleStickers.js');

// Same ceiling as the CREATE stickers: the biggest one is ever drawn is the
// 176px record, scaled 1.05 under the pointer.
const MAX_PX = 200;

const BELT_ORDER = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black'];

// module key -> the badge.
//
// The key is `program | sub_program | module_name` exactly as the curriculum
// stores it, so this table breaks loudly if a module is renamed rather than
// quietly badging the wrong thing. `title` is what a parent reads. `icon` is
// an IMPACT achievement title, matched against the icons the CREATE book left
// behind; run with --pool to see what is still available.
const MODULE_BADGES = {
  // AI Academy. Nine modules, no tracks.
  'AI Academy || Module 1': { title: 'Behind the Curtain',        icon: 'Functional Thinking' },
  'AI Academy || Module 2': { title: 'Painting by Numbers',       icon: 'Painters Palette' },
  'AI Academy || Module 3': { title: 'Ghostwriter',               icon: 'Wall of Text' },
  'AI Academy || Module 4': { title: 'Out in the Wild',           icon: 'Search Engine' },
  'AI Academy || Module 5': { title: 'Vibe Check',                icon: 'Read the Manual' },
  'AI Academy || Module 6': { title: 'Player Two',                icon: 'Gaming the System' },
  'AI Academy || Module 7': { title: 'Brains on Board',           icon: "It's Alive!" },
  'AI Academy || Module 8': { title: 'Trust, but Verify',         icon: 'Reliable Narrator' },
  'AI Academy || Module 9': { title: 'Back to the Drawing Board', icon: 'Points of View' },

  // JR Coding. Each module's concept is spelled out in its own lesson names
  // ("Loops Lesson 3.1", "Decomposition 4.2"), so the subject was read rather
  // than guessed even though the title over it is written.
  'JR |JR Coding| Module 1':  { title: 'One Step at a Time',      icon: 'Charting a Course' },
  'JR |JR Coding| Module 2':  { title: 'Bug Hunt',                icon: 'Lets Try That Again' },
  'JR |JR Coding| Module 3':  { title: 'Round and Round',         icon: 'On and On and On And' },
  'JR |JR Coding| Module 4':  { title: 'Break It Down',           icon: 'Group By Theme' },
  'JR |JR Coding| Module 5':  { title: 'Step by Step by Step',    icon: 'One Direction' },
  'JR |JR Coding| Module 6':  { title: 'On Your Signal',          icon: 'Wait for the Signal' },
  'JR |JR Coding| Module 7':  { title: 'If You Say So',           icon: 'Fork in the Road' },
  'JR |JR Coding| Module 8':  { title: 'First In, First Out',     icon: 'Ducks in a Row (Or Column)' },
  'JR |JR Coding| Module 9':  { title: 'Two Heads, One Keyboard', icon: 'Joined at the Hip' },
  'JR |JR Coding| Module 10': { title: 'Now You Make One',        icon: 'Make Your Own Way' },

  // Snap Circuits is one module of 24 numbered projects. "Elenco" is the kit
  // manufacturer, which is not a thing a ninja finished.
  'JR |Snap Circuits| Elenco': { title: 'Complete the Circuit',   icon: 'Making a Connection' },

  // LEGO Spike Essentials. The five numbered adventures keep the curriculum's
  // OWN names — "Animal Friends" is what LEGO calls it, and a pun invented
  // over a real name is the one thing this set is not allowed to do. Only the
  // three lettered modules, which have no name to lose, get one written.
  'Robotics Academy |LEGO Spike Essentials| E 1':                       { title: 'Planes, Trains and Swamp Boats', icon: 'Atlas' },
  'Robotics Academy |LEGO Spike Essentials| E 2':                       { title: 'A Machine for That',             icon: 'Take it For a Spin' },
  'Robotics Academy |LEGO Spike Essentials| E 3':                       { title: 'Step Right Up',                  icon: 'Game On' },
  'Robotics Academy |LEGO Spike Essentials| 1. Great Adventure':        { title: 'Great Adventure',                icon: 'Setting the Scene' },
  'Robotics Academy |LEGO Spike Essentials| 2. Amazing Amusement Park': { title: 'Amazing Amusement Park',         icon: 'Life of the Party' },
  'Robotics Academy |LEGO Spike Essentials| 3. Reimagine the World':    { title: 'Reimagine the World',            icon: 'Nice Change of Scenery' },
  'Robotics Academy |LEGO Spike Essentials| 4. Useful Inventions':      { title: 'Useful Inventions',              icon: 'Well Rounded Character' },
  'Robotics Academy |LEGO Spike Essentials| 5. Animal Friends':         { title: 'Animal Friends',                 icon: 'Neighbors' },

  // LEGO Spike Prime.
  'Robotics Academy |LEGO Spike Prime| P 1': { title: 'Ready, Set, Build',         icon: 'About Yay High' },
  'Robotics Academy |LEGO Spike Prime| P 2': { title: 'Reading the Room',          icon: 'Know Your Surroundings' },
  'Robotics Academy |LEGO Spike Prime| P 3': { title: 'Signed, Sealed, Delivered', icon: 'Package Deal' },
  'Robotics Academy |LEGO Spike Prime| P 4': { title: 'Boot Camp',                 icon: 'And the Winner Is' },

  // Ozobot Evo. Both modules are colour codes; the second adds timers, line
  // switching and the missions built on them — hence a title about lines.
  'Robotics Academy |Ozobot Evo| O 1': { title: 'Color Me Coded',            icon: 'Color Wheel' },
  'Robotics Academy |Ozobot Evo| O 2': { title: 'Reading Between the Lines', icon: 'Red Light Green Light' },

  // VEX GO.
  'Robotics Academy |VEX GO| VG 1': { title: 'The Simple Life',          icon: 'Gravity of the Situation' },
  'Robotics Academy |VEX GO| VG 2': { title: 'Life on Mars',             icon: 'Defying Gravity' },
  'Robotics Academy |VEX GO| VG 3': { title: 'Look, No Hands',           icon: 'Path of Least Resistance' },
  'Robotics Academy |VEX GO| VG 4': { title: "Somebody's Got to Do It",  icon: 'Chain of Command' },
};

// Titles the CREATE book already spent. Read off its output rather than kept
// as a second list, so the two sets cannot both claim the same icon.
function usedIds() {
  const dir = path.join(ROOT, 'client/public/impact');
  return new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')));
}

const slug = (s) => String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// A sticker's id, which is also its file name. Parts that do not exist are
// dropped rather than joined: AI Academy has no kit, and a program with no
// sub-program used to slug down to a stray separator here and to the word
// "null" in the data file, which is how nine stickers ended up pointing at
// art nobody had written. The id is now computed ONCE, here, and printed
// into the data file as a literal, so there is nothing left to disagree.
const stickerId = (program, subProgram, moduleName) =>
  slug([program, subProgram, moduleName].filter(Boolean).join('-'));

function readAchievements() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ICONS, 'manifest.json'), 'utf8'));
  const out = [];
  for (const belt of manifest.belts) {
    const entries = [
      ...(belt.levels || []).flatMap((lvl) => lvl.items.map((it) => ({ ...it, dir: lvl.folder, level: lvl.level }))),
      ...(belt.files || []).map((it) => ({ ...it, dir: belt.folder })),
    ];
    for (const item of entries) {
      if (item.type !== 'achievement') continue;
      const title = (item.title ?? '').trim();
      if (!title) continue;
      out.push({ belt: belt.belt, level: Number(item.level), title, file: path.join(ICONS, item.dir, item.file) });
    }
  }
  return out;
}

// Everything the CREATE book did not take.
function spare() {
  const used = usedIds();
  return readAchievements().filter((a) => !used.has(`${a.belt.toLowerCase()}-${a.level}-${slug(a.title)}`));
}

// Resolve one MODULE_BADGES icon to a source file.
//
// Throws on a miss AND on an ambiguity rather than picking one, because two
// belts do share a title ("Depth Perception" is Purple and Brown) and a silent
// choice between them is how the wrong picture ships. Disambiguate by writing
// "Brown 4 Depth Perception" instead of the bare title.
function findIcon(spec, pool) {
  const m = String(spec).match(/^(\w+)\s+(\d+)\s+(.+)$/);
  const [belt, level, title] = m ? [m[1], Number(m[2]), m[3]] : [null, null, spec];
  const hits = pool.filter((a) => a.title === title && (!belt || (a.belt === belt && a.level === level)));
  if (!hits.length) {
    const near = pool.filter((a) => slug(a.title).includes(slug(title).slice(0, 8))).map((a) => `${a.belt} ${a.level} ${a.title}`);
    throw new Error(`No spare icon titled "${spec}".${near.length ? `\n  Did you mean: ${near.join(' | ')}` : ''}`);
  }
  if (hits.length > 1) {
    throw new Error(`"${spec}" matches ${hits.length} icons: ${hits.map((h) => `${h.belt} ${h.level}`).join(', ')}.\n  Disambiguate as "<Belt> <level> <title>".`);
  }
  return hits[0];
}

function build() {
  const pool = spare();
  const keys = Object.keys(MODULE_BADGES);

  // One icon may not badge two modules.
  const claimed = new Map();
  const picked = keys.map((key) => {
    const { title, icon } = MODULE_BADGES[key];
    const hit = findIcon(icon, pool);
    const id = `${hit.belt.toLowerCase()}-${hit.level}-${slug(hit.title)}`;
    if (claimed.has(id)) throw new Error(`Icon "${icon}" is on both "${claimed.get(id)}" and "${key}".`);
    claimed.set(id, key);
    const [program, subProgram, moduleName] = key.split('|').map((s) => s.trim());
    const sub = subProgram || null;
    return { key, program, subProgram: sub, moduleName, title, file: hit.file, id: stickerId(program, sub, moduleName) };
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Clear only what this script wrote last time. A blanket rmSync deletes
  // anything a person put in the folder by hand, and no build script gets to
  // do that to a directory it did not create.
  for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith('.png')) fs.rmSync(path.join(OUT_DIR, f));

  let bytes = 0;
  for (const b of picked) {
    const img = decode(b.file);
    const out = encodeIndexed(quantize(resize(crop(img, alphaBounds(img)), MAX_PX)));
    fs.writeFileSync(path.join(OUT_DIR, `${b.id}.png`), out);
    bytes += out.length;
  }

  // Every sticker must have art at the path the data file will point at.
  // The bug this catches shipped once: the art was fine and the pointer was
  // wrong, so nothing failed until a parent opened the book.
  const missing = picked.filter((b) => !fs.existsSync(path.join(OUT_DIR, `${b.id}.png`)));
  if (missing.length) throw new Error(`No art written for: ${missing.map((b) => b.id).join(', ')}`);

  fs.writeFileSync(OUT_DATA, dataFile(picked));
  const byProgram = [...new Set(picked.map((p) => p.program))]
    .map((p) => `${p} ${picked.filter((x) => x.program === p).length}`).join(', ');
  console.log(`${picked.length} module stickers  (${byProgram})`);
  console.log(`${(bytes / 1024).toFixed(0)} KB in ${path.relative(ROOT, OUT_DIR)}`);
  console.log(`wrote ${path.relative(ROOT, OUT_DATA)}`);
  console.log(`${pool.length - picked.length} spare icons left`);
}

function dataFile(picked) {
  const lines = [];
  let group = null;
  for (const p of picked) {
    const g = `${p.program}${p.subProgram ? ` · ${p.subProgram}` : ''}`;
    if (g !== group) { group = g; lines.push(`\n  // ${g}`); }
    lines.push(`  m(${JSON.stringify(p.id)}, ${JSON.stringify(p.program)}, ${JSON.stringify(p.subProgram)}, ${JSON.stringify(p.moduleName)}, ${JSON.stringify(p.title)}),`);
  }

  return `// GENERATED by scripts/build-module-stickers.mjs. Do not edit by hand.
//
// One sticker per module of JR, Robotics Academy and AI Academy: ${picked.length} in all.
//
// NOT ACHIEVEMENTS, and the difference matters. The CREATE book's badges are
// real Code Ninjas achievements, awarded in MakeCode, under the names Code
// Ninjas gave them. There is no equivalent list for these three programs, so
// these are DojoLink's own: the title names the MODULE, written from the
// lessons inside it, and the art is an IMPACT icon the CREATE book did not
// take, shown without its own title because that title belongs to a CREATE
// level. Nothing in the UI calls them achievements.
//
// WHAT A STICKER CLAIMS: that the module is finished — every lesson in it
// logged as Completed. See lib/moduleStickerProgress.js for the one
// definition of "earned".
//
// \`moduleName\` is the curriculum's real name, placeholders and all ("Module 6",
// "VG 2"), because it is the key: \`progress_logs\` stores it as text and the
// database is deliberately not renamed. \`title\` is what a parent reads.

// \`id\` IS THE FILE NAME, written out rather than rebuilt from the parts. It
// used to be derived here, from the same three fields the build script slugs,
// and the two expressions did not agree about a program with no kit: the
// build wrote ai-academy-module-1.png and this asked for
// ai-academy-null-module-1.png. Nine broken stickers, and nothing that could
// have caught it, because both sides looked right on their own.
const m = (id, program, subProgram, moduleName, title) => ({
  id,
  program,
  subProgram,
  moduleName,
  title,
  get src() { return \`/modules/\${this.id}.png\`; },
});

export const MODULE_STICKERS = [
${lines.join('\n')}
];

// Every sticker a program has, in curriculum order.
export function stickersForProgram(program) {
  return MODULE_STICKERS.filter((s) => s.program === program);
}
`;
}

if (process.argv.includes('--pool')) {
  const pool = spare();
  const byBelt = {};
  for (const a of pool) (byBelt[a.belt] ||= []).push(`${a.level} ${a.title}`);
  console.log(`${pool.length} spare icons\n`);
  for (const b of BELT_ORDER) if (byBelt[b]) console.log(`${b} (${byBelt[b].length}):\n  ${byBelt[b].join('\n  ')}\n`);
} else {
  build();
}
