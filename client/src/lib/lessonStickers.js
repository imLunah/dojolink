import { lessonBadge } from './lessonBadgeArt';

// One sticker per LESSON, for JR, Robotics Academy and AI Academy.
//
// The module book (lib/moduleStickers.js) picked a module as its unit because
// a lesson was too small to be worth a hand-chosen franchise icon and there
// were only 138 icons spare against 330 lessons. That reasoning was about the
// ART, not about the lesson: a lesson is a real afternoon's work that a sensei
// logs by name, and it is the finest thing DojoLink actually knows happened.
// Now that the art is drawn rather than borrowed (lib/lessonBadgeArt.js) the
// unit can be the lesson, and the module sticker stays on as the capstone over
// the top of them.
//
// DERIVED FROM THE CURRICULUM, NOT GENERATED INTO A FILE. moduleStickers.js is
// a committed build artefact because its titles were written by hand and had
// to be reviewed; a lesson already has a name in `curriculum_lessons`, which
// the browser has loaded by the time any of this renders. Building the list
// here means a lesson added in the admin curriculum editor has a sticker the
// moment it is saved, with no script to re-run and no 330 PNGs to commit.
//
// CREATE IS NOT HERE. Its book is the belt ladder, its lessons are belt
// projects, and 43 IMPACT badges already stand for them.

// The programs whose lessons earn stickers.
//
// ROBOTICS ACADEMY IS NOT ONE OF THEM, by decision: its badge is the module
// and stays the module, so its eighteen capstones across four kits are the
// whole of what it awards. Its lessons are still listed under each module on
// the course page — that is a different question from whether they earn
// anything — they just do not carry a badge.
//
// VR Coding is absent for the same reason it is absent from the module book:
// it was not asked for.
//
// Adding a program back is this line and nothing else. The book's size, the
// shelves, the course-page album and the badge art all read from it.
export const LESSON_PROGRAMS = ['JR', 'AI Academy'];

const slug = (s) => String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Lesson names are stored with their position on the front — "2. River Ferry",
// "1. Intro to Lego Spike Essentials". That prefix is how a sensei finds the
// row in a dropdown and it stays in the database untouched, but on a sticker
// it is usually noise: the badge is not a table of contents. The name matched
// against the log is always the full one.
function stripped(name) {
  return String(name).replace(/^\s*\d+\s*[.)]\s*/, '').trim() || String(name);
}

// SOMETIMES THE NUMBER IS THE NAME. JR Coding repeats a lesson name inside one
// module and lets the prefix do the distinguishing — "4. Algorithms and
// Sequencing Lesson 1.2" and "6. Algorithms and Sequencing Lesson 1.2" are two
// different afternoons. Sixteen modules do this. Dropping the prefix there
// would put two identical badges side by side in the book with no way to tell
// which one the ninja earned, so it is kept exactly where it carries meaning
// and dropped everywhere else.
export function lessonTitles(lessons) {
  const seen = new Map();
  for (const name of lessons) {
    const s = stripped(name);
    seen.set(s, (seen.get(s) || 0) + 1);
  }
  const out = new Map();
  for (const name of lessons) {
    const s = stripped(name);
    out.set(name, seen.get(s) > 1 ? String(name).trim() : s);
  }
  return out;
}

// The kits of a program, or the program itself when it has none.
//
// AI Academy has no sub-programs, so its modules hang directly off the program
// and `curriculum` is keyed by the program name. Same shape trackModel uses.
function kitsOf(program, subPrograms) {
  const names = (subPrograms && subPrograms[program]) || [];
  return names.length ? names : [program];
}

// Every lesson sticker in one program, in curriculum order.
//
// `seat` is the lesson's position within its KIT, counted across that kit's
// modules, and it is what the badge art walks its shapes with. It is not the
// position within the module: two modules of ten lessons would then draw the
// same ten badges, and a shelf of Spike Essentials would repeat itself eight
// times over.
export function lessonStickersFor({ program, curriculum, subPrograms }) {
  // The gate is here rather than only in `allLessonStickers`, because the
  // course page asks for one program by name and must get the same answer the
  // book would give it. A program that does not award lesson badges returns
  // nothing, and every surface downstream draws nothing.
  if (!LESSON_PROGRAMS.includes(program)) return [];
  const out = [];
  for (const kit of kitsOf(program, subPrograms)) {
    const modules = (curriculum && curriculum[kit]) || [];
    let seat = 0;
    modules.forEach((m, moduleIndex) => {
      const lessons = m.lessons || [];
      const titles = lessonTitles(lessons);
      for (const lessonName of lessons) {
        const subProgram = kit === program ? null : kit;
        out.push({
          id: `l-${slug([program, subProgram, m.module, lessonName].filter(Boolean).join('-'))}`,
          kind: 'lesson',
          program,
          subProgram,
          moduleName: m.module,
          moduleIndex: moduleIndex + 1,
          lessonName,
          title: titles.get(lessonName),
          src: lessonBadge({ kit, seat }),
          seat,
        });
        seat += 1;
      }
    });
  }
  return out;
}

// Every lesson sticker across the three programs.
export function allLessonStickers({ curriculum, subPrograms }) {
  return LESSON_PROGRAMS.flatMap((program) => lessonStickersFor({ program, curriculum, subPrograms }));
}
