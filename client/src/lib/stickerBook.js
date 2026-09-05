import { CREATE_STICKERS, stickerRequirement } from './createStickers';
import { stickerProgress } from './stickerProgress';
import { MODULE_STICKERS } from './moduleStickers';
import { earnedModuleStickers, moduleProgress, moduleEarnedOn } from './moduleStickerProgress';
import { allLessonStickers } from './lessonStickers';
import { earnedLessonStickers } from './lessonStickerProgress';

// EVERY sticker DojoLink has, for every program, as one book.
//
// The book used to be CREATE's alone: 43 belt badges, shelved by belt, and it
// only appeared at all for a ninja enrolled in CREATE. A JR ninja had a
// sticker book with nothing in it and no way to see the one they were
// actually filling, because the module stickers only existed inside the
// course page of the kit they belonged to. A book you can only open if you
// happen to be in one particular program is a catalogue, not a book.
//
// So this is the whole catalogue, and it is the same for every ninja: all of
// it, earned and unearned, because the unearned ones are the point of a
// sticker book. What differs between two children is which ones are filled
// in.
//
// ONE SHAPE FOR TWO KINDS OF STICKER, which is the work this file does. The
// two halves are earned by completely different arithmetic — CREATE's come
// off the belt ladder (lib/stickerProgress.js), a module's off every lesson
// in it being logged Completed (lib/moduleStickerProgress.js) — and neither
// of those definitions is duplicated here. This asks both of them and puts
// the answers in one envelope, so the surfaces that draw a sticker do not
// have to know which kind they are holding.
//
// NO BELT OR LEVEL IN THE ENVELOPE, on purpose. A book spanning four
// programs cannot be shelved by CREATE's belts, and "Green belt · Level 3"
// under a badge is a label from a taxonomy three quarters of the book does
// not share. The shelves are programs, and a sticker carries its title, its
// art, whether it is earned and the day it landed.

// The book has THREE KINDS OF STICKER in it, and they are earned by three
// different rules that this file asks rather than reimplements:
//
//   CREATE badge   43, fixed     the belt ladder             stickerProgress
//   module badge   38, fixed     every lesson in it done     moduleStickerProgress
//   lesson badge  330, from      that lesson logged done     lessonStickerProgress
//                  the curriculum
//
// THE TOTAL IS NO LONGER A CONSTANT. It used to be, because both halves were
// committed files whose lengths were known at build time. Lesson stickers are
// derived from the curriculum the browser loaded, so the size of the book is
// whatever the curriculum currently says — a kit added in the admin editor
// makes the book bigger with no code change. `wholeBook` returns `total`;
// there is nothing to import instead.
//
// The 81 that surfaces used to print is now 411 with the seeded curriculum.

// The order the shelves stand in: CREATE first because it is the longest and
// the one most ninjas are in, then the rest as a center introduces them.
const SHELVES = ['CREATE', 'JR', 'Robotics Academy', 'AI Academy'];

// What a locked module sticker says instead of a requirement. A count of the
// lessons already done is more use than a static sentence, and "0 of 10" on a
// module nobody has started is still the truth.
function lessonsLabel({ done, total }) {
  if (!total) return 'Not in the curriculum yet';
  return `${done} of ${total} lesson${total === 1 ? '' : 's'}`;
}

// Earned stickers oldest first.
//
// Sorted by the day they landed, with the undated ones ahead of everything.
// That is not a gap in the data being swept aside, it is the truth about it: a
// ninja who arrived at Green belt through a roster import earned their White
// and Yellow stickers before DojoLink existed for them, so those are the
// oldest things in the book and the log will never say when. The original
// index breaks ties, which keeps one level's badges in curriculum order
// rather than shuffling a set that all landed on the same afternoon.
function oldestFirst(items) {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (a.item.earnedOn || '').localeCompare(b.item.earnedOn || '') || a.i - b.i)
    .map(({ item }) => item);
}

// One program's shelf: its module capstones and every lesson under them, in
// the order they are shown.
//
// Lifted out of `wholeBook` because the course page shows exactly this — one
// program, filtered to the kit it has open — and building it a second time
// there is how a badge ends up locked in the book and earned on the page. The
// book asks for all three programs and puts CREATE in front; the course page
// asks for one.
//
// ORDERED MODULE FIRST, THEN ITS LESSONS, rather than every capstone followed
// by every lesson. The capstone is the heading of the set it caps; separated
// from them it is a badge with nothing under it and a wall of lessons with
// nothing over them.
export function programStickers({ programs, logs = [], curriculum, subPrograms }) {
  const wanted = programs ? new Set([].concat(programs)) : null;
  const inScope = (program) => !wanted || wanted.has(program);

  const earnedModules = earnedModuleStickers({ logs, curriculum });
  const fromModules = MODULE_STICKERS.filter((sticker) => inScope(sticker.program)).map((sticker) => {
    const earned = earnedModules.has(sticker.id);
    const counted = moduleProgress({ sticker, logs, curriculum });
    return {
      id: sticker.id,
      title: sticker.title,
      src: sticker.src,
      program: sticker.program,
      kind: 'module',
      // Carried so the shelf can gather this module's lesson stickers under it.
      subProgram: sticker.subProgram || null,
      moduleName: sticker.moduleName,
      earned,
      earnedOn: earned ? moduleEarnedOn({ sticker, logs }) : null,
      requirement: lessonsLabel(counted),
      // What the zoom fills its level block with. A module has no belt and no
      // level, so it offers what it does have: the kit it belongs to and how
      // many lessons are in it.
      detail: {
        label: sticker.subProgram || sticker.program,
        topic: counted.total ? `${counted.total} lesson${counted.total === 1 ? '' : 's'}` : 'Not in the curriculum yet',
        quest: null,
      },
    };
  });

  const lessonSet = allLessonStickers({ curriculum, subPrograms }).filter((sticker) => inScope(sticker.program));
  const lessonDays = earnedLessonStickers({ stickers: lessonSet, logs });
  const fromLessons = lessonSet.map((sticker) => ({
    id: sticker.id,
    title: sticker.title,
    src: sticker.src,
    program: sticker.program,
    kind: 'lesson',
    earned: lessonDays.has(sticker.id),
    earnedOn: lessonDays.get(sticker.id) || null,
    // A locked lesson says which module it is waiting inside, which is the
    // one fact that places it: 330 lesson titles are meaningless on their own
    // and "0 of 1 lessons" would be a joke.
    requirement: `In ${sticker.moduleName}`,
    detail: {
      label: sticker.subProgram || sticker.program,
      topic: sticker.moduleName,
      quest: null,
    },
    // Kept so a shelf can file a lesson under the module it belongs to.
    subProgram: sticker.subProgram,
    moduleName: sticker.moduleName,
  }));


  // Gather each module's lessons under it.
  const key = (item) => [item.program, item.subProgram || '', item.moduleName].join('|');
  const byModule = new Map();
  for (const lesson of fromLessons) {
    const k = key(lesson);
    if (!byModule.has(k)) byModule.set(k, []);
    byModule.get(k).push(lesson);
  }
  const out = [];
  for (const cap of fromModules) {
    out.push(cap);
    const k = key(cap);
    if (byModule.has(k)) { out.push(...byModule.get(k)); byModule.delete(k); }
  }
  // Lessons in a module with no capstone. The module book covers all 38 today,
  // so this is only reached by a kit added since it was generated, which should
  // still show its lessons rather than silently drop them.
  for (const rest of byModule.values()) out.push(...rest);
  return out;
}


export function wholeBook({ belt, level, logs = [], curriculum, subPrograms }) {
  // CREATE reads the belt ladder, and only CREATE's own sessions count
  // towards it — a Robotics log has no belt in it to be measured against.
  const create = stickerProgress({ belt, level, logs: logs.filter((l) => l.program === 'CREATE') });
  const fromCreate = create.all.map((item) => ({
    // `belt` and `level` ride along unused by anything that draws a shelf.
    // They are here because the zoomed sticker still describes a CREATE badge
    // out of the curriculum it came from, and that is the one place where the
    // belt is the sticker's identity rather than a label on top of it.
    ...item,
    program: 'CREATE',
    kind: 'create',
    requirement: stickerRequirement(item),
    detail: undefined,
  }));

  const rest = programStickers({ logs, curriculum, subPrograms });
  const all = [...fromCreate, ...rest];
  const earned = all.filter((item) => item.earned);

  const shelves = SHELVES
    .map((program) => {
      const stickers = all.filter((item) => item.program === program);
      return {
        program,
        stickers,
        earned: stickers.filter((item) => item.earned).length,
        total: stickers.length,
      };
    })
    .filter((shelf) => shelf.total);

  return {
    all,
    shelves,
    earned,
    total: all.length,
    earnedIds: new Set(earned.map((item) => item.id)),
    // The CREATE count on its own, kept because the one cohort DojoLink can
    // measure a ninja against is a cohort of CREATE belts. A percentile drawn
    // from a whole-book count against that roster would be comparing two
    // different things and calling it a ranking.
    createEarned: create.earned.length,
    next: all.find((item) => !item.earned) || null,
    recent: (count = 5) => oldestFirst(earned).slice(-count).reverse(),
  };
}
