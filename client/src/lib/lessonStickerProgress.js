import { completedLessonDays, lessonKey } from './parentProgress';

// Has this ninja finished this lesson?
//
// The reading itself lives in parentProgress.js, next to `realSessions`,
// because the module list on the course page ticks its lessons off with the
// same Map. This file is only the sticker-shaped view of it. A sticker
// congratulating a ninja for a lesson the course page still shows as unticked
// is the drift that sharing it prevents.
//
// It is deliberately the same test the module book already applies lesson by
// lesson, so a module capstone can never land while one of its own lesson
// stickers is locked.

// Which lesson stickers are earned, and when.
//
// Returns a Map from sticker id to the day it was earned, which may be null: a
// ninja whose completed session carries no date still earned the sticker, and
// the caption falls back to "Earned" rather than the sticker going away.
export function earnedLessonStickers({ stickers, logs }) {
  const days = completedLessonDays(logs);
  const earned = new Map();
  for (const s of stickers) {
    const key = lessonKey(s.program, s.subProgram, s.moduleName, s.lessonName);
    if (days.has(key)) earned.set(s.id, days.get(key));
  }
  return earned;
}
