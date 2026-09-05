import { MODULE_STICKERS } from './moduleStickers';
import { realSessions } from './parentProgress';

// Which module stickers a ninja has earned, for JR, Robotics and AI.
//
// The one definition, the way `stickerProgress.js` is the one definition for
// CREATE. Two copies of "has this module been finished" is exactly the kind of
// thing that drifts: one screen congratulates a kid for a sticker another
// still shows locked.
//
// EARNED MEANS EVERY LESSON IN THE MODULE IS LOGGED COMPLETED. Not "the ninja
// has moved past it" — `trackModel` marks a module `done` the moment a later
// one becomes current, which is where they ARE, not what they finished, and a
// sticker that says finished has to mean it. A kit skipped over on the way to
// the next one earns nothing, which is correct.
//
// It matches the server's own arithmetic: `recomputePercentComplete` counts
// `COUNT(DISTINCT lesson_name) WHERE status_at = 'Completed'` against the
// module's lesson count. Same question, same answer, so a sticker cannot
// appear on a module the progress bar calls unfinished.

// The curriculum's lessons for one module, or [] when the module is not in the
// curriculum this browser loaded. An empty list can never be complete, which
// is the safe direction: a missing curriculum shows nothing earned rather than
// everything.
function lessonsOf(curriculum, sticker) {
  const track = (curriculum && curriculum[sticker.subProgram || sticker.program]) || [];
  const hit = track.find((m) => m.module === sticker.moduleName);
  return (hit && hit.lessons) || [];
}

// Completed lesson names for one module, off the ninja's own logs.
//
// Keyed on the module's REAL name rather than the sticker's title, because
// that is what a log carries: `progress_logs.module_name` is written as text
// when a sensei logs the session, which is also why the database was never
// renamed to the friendlier titles.
function completedIn(logs, sticker) {
  const done = new Set();
  for (const l of logs) {
    if (l.program !== sticker.program) continue;
    if (sticker.subProgram && l.sub_program !== sticker.subProgram) continue;
    if (l.module_name !== sticker.moduleName) continue;
    if (l.status_at !== 'Completed' || !l.lesson_name) continue;
    done.add(l.lesson_name);
  }
  return done;
}

// Every module sticker earned in one program, as a Set of sticker ids.
//
// ROADMAP ROWS COUNT. They are not sessions — realSessions keeps them out of
// the feed and the counts — but a lesson checked off on the staff roadmap is
// finished, and a sticker the staff side has earned staying locked on the
// parent side is exactly the drift this file exists to prevent. It also
// matches the server's own arithmetic: recomputePercentComplete counts
// roadmap rows too.
export function earnedModuleStickers({ program, logs, curriculum }) {
  const earned = new Set();
  for (const sticker of MODULE_STICKERS) {
    if (program && sticker.program !== program) continue;
    const lessons = lessonsOf(curriculum, sticker);
    if (!lessons.length) continue;
    const done = completedIn(logs || [], sticker);
    if (lessons.every((name) => done.has(name))) earned.add(sticker.id);
  }
  return earned;
}

// How far through a module a ninja is, for the ones they have not finished.
// Returns { done, total } so a card can say "6 of 10" instead of just locked.
export function moduleProgress({ sticker, logs, curriculum }) {
  const lessons = lessonsOf(curriculum, sticker);
  if (!lessons.length) return { done: 0, total: 0 };
  const done = completedIn(logs || [], sticker);
  return { done: lessons.filter((name) => done.has(name)).length, total: lessons.length };
}

// The day the module was finished: the last completed lesson's date.
//
// Unlike the CREATE book, this one CAN be honest per sticker — a module is
// finished by a session that DojoLink actually saw, so the date is read
// rather than invented. It is still only a label; a ninja imported onto the
// roster mid-program has no logs behind them and gets no date. Roadmap rows
// stay out of it on purpose: they earn the sticker, but their session_date is
// the day the box was checked, so a module finished that way says "Earned"
// with no day rather than wearing the wrong one.
export function moduleEarnedOn({ sticker, logs }) {
  const dates = realSessions(logs)
    .filter((l) => l.program === sticker.program
      && (!sticker.subProgram || l.sub_program === sticker.subProgram)
      && l.module_name === sticker.moduleName
      && l.status_at === 'Completed' && l.session_date)
    .map((l) => String(l.session_date).split('T')[0])
    .sort();
  return dates.length ? dates[dates.length - 1] : null;
}
