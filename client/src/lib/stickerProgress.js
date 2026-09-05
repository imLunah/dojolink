import { BELTS } from '../utils/beltConfig';
import { levelProjects } from './parentProgress';
import { CREATE_STICKERS } from './createStickers';

// Which stickers a ninja has actually earned, worked out from where they are
// on the belt ladder and what the log says about the level they are on.
//
// This lived inside CourseDetail until the profile page grew a sticker book,
// and two copies of "has this level been finished" is exactly the kind of
// thing that drifts: one screen would start congratulating a kid for a
// sticker the other still showed locked. There is no achievement table behind
// any of it, deliberately (see createStickers.js), so this file is the only
// definition.

export function isLevelComplete(targetBelt, targetLevel, currentBelt, currentLevel, logs) {
  const targetIdx = BELTS.findIndex((item) => item.name === targetBelt);
  const currentIdx = BELTS.findIndex((item) => item.name === currentBelt);
  if (targetIdx < 0 || currentIdx < 0) return false;
  if (targetIdx < currentIdx) return true;
  if (targetIdx > currentIdx) return false;
  if (Number(targetLevel) < Number(currentLevel)) return true;
  if (Number(targetLevel) > Number(currentLevel)) return false;

  // The level they are standing on: earned only once its last project is done.
  const projects = levelProjects(targetBelt, targetLevel, logs);
  return projects.length > 0 && projects[projects.length - 1].status === 'done';
}

// The day a sticker landed, where the log knows it. A ninja who arrived at
// Green belt through a roster import has no logs behind White through Yellow,
// so their early stickers are earned with no date at all — which is why
// nothing here sorts by this. It is a label, not an index.
//
// Every achievement in a level shares one date, because they share one event:
// the level being finished. That is the honest thing to print. DojoLink never
// sees the individual in-game achievements (they are awarded inside MakeCode),
// so a per-sticker date would be a number we made up.
export function stickerEarnedOn(item, logs) {
  const dates = levelProjects(item.belt, item.level, logs)
    .filter((p) => p.status === 'done' && p.date)
    .map((p) => String(p.date).split('T')[0])
    .sort();
  return dates[dates.length - 1] || null;
}

// Every sticker, in curriculum order, with its earned state and date.
//
// `CREATE_STICKERS` is declared White through Black and level by level, and a
// ninja walks that ladder in one direction, so its order IS the order the
// stickers were earned in. That is what "most recent" means below: the tail of
// the earned list, not a date sort, so a ninja whose early belts predate the
// log still gets their newest sticker in the right place.
//
// Finishing a level lands that level's whole set at once, so "most recent" is
// a slice out of one level rather than a run of separate occasions. That is
// what actually happened, and the surfaces that show a handful say "newest
// first" rather than claiming each one was its own day.
export function stickerProgress({ belt, level, logs = [] }) {
  const all = CREATE_STICKERS.map((item) => {
    const earned = isLevelComplete(item.belt, item.level, belt, level, logs);
    return { ...item, earned, earnedOn: earned ? stickerEarnedOn(item, logs) : null };
  });
  const earned = all.filter((item) => item.earned);
  return {
    all,
    earned,
    earnedIds: new Set(earned.map((item) => item.id)),
    next: all.find((item) => !item.earned) || null,
    recent: (count = 5) => earned.slice(-count).reverse(),
  };
}
