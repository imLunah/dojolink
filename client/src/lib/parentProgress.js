// Turning a child's raw records into what the parent portal shows.
//
// Everything here is derived from data the portal already receives: the
// student's enrolments (belt, sublevel, current project) and the progress log
// (belt_level_at, belt_sublevel_at, project_at, status_at per session). Nothing
// is stored twice. Where a fact is not recorded, the helper says so with a
// null rather than inventing one.

import { lessonTitles } from './lessonStickers';
import { BELTS, BELT_LEVEL_PROJECTS, UPPER_BELTS, getLevels } from '../utils/beltConfig';

export const beltIndex = (name) => BELTS.findIndex((b) => b.name === name);

// A session log entry counts as a real session unless it was the roadmap's
// bulk mark-complete, which the server flags for exactly this reason.
export const realSessions = (logs) => (logs || []).filter((l) => !l.from_roadmap);

// The child's journey through CREATE, one entry per belt they have touched:
// when it started (first log at that belt), how many sessions, and whether it
// is behind them, current, or ahead. Belts with no logs and below the current
// belt are still "earned" (the child arrived at the current belt somehow), but
// with no dates, and the UI must not pretend otherwise.
export function beltJourney(enrollment, logs) {
  const current = enrollment?.belt_level || null;
  const currentIdx = beltIndex(current);
  const perBelt = new Map();
  for (const l of realSessions(logs)) {
    if (!l.belt_level_at) continue;
    const e = perBelt.get(l.belt_level_at) || { sessions: 0, first: null, last: null };
    e.sessions += 1;
    const d = String(l.session_date).split('T')[0];
    if (!e.first || d < e.first) e.first = d;
    if (!e.last || d > e.last) e.last = d;
    perBelt.set(l.belt_level_at, e);
  }
  return BELTS.map((b, i) => {
    const stats = perBelt.get(b.name) || { sessions: 0, first: null, last: null };
    let state = 'ahead';
    if (currentIdx >= 0 && i < currentIdx) state = 'earned';
    if (i === currentIdx) state = 'current';
    return { ...b, index: i, state, ...stats, levels: getLevels(b.name).length };
  });
}

// The projects of one level of one belt, each with the best status the log has
// for it. A project the log never mentions is 'todo'. The order is the
// curriculum's; the last entry of a level is its Adventure.
export function levelProjects(beltName, level, logs) {
  const names = (BELT_LEVEL_PROJECTS[beltName] || {})[level] || [];
  const byProject = new Map();
  for (const l of realSessions(logs)) {
    if (l.belt_level_at !== beltName) continue;
    if (Number(l.belt_sublevel_at) !== Number(level)) continue;
    if (!l.project_at) continue;
    const prev = byProject.get(l.project_at);
    const rank = { Completed: 3, 'Working On': 2, Started: 1 }[l.status_at] || 0;
    if (!prev || rank > prev.rank || (rank === prev.rank && String(l.session_date) > String(prev.date))) {
      byProject.set(l.project_at, { rank, status: l.status_at, date: String(l.session_date).split('T')[0] });
    }
  }
  // Black and the bonus tracks are flat lists of projects, with no
  // Build / Solve / Adventure rhythm to name.
  const flat = UPPER_BELTS.includes(beltName);
  return names.map((name, i) => {
    const hit = byProject.get(name);
    return {
      name,
      // CREATE levels alternate Build → Solve, then close with Adventure.
      // Use that curriculum structure rather than words in the title: a few
      // real Solve entries (for example "Image Functions") do not say
      // "Debugging", so name matching assigns them the wrong role.
      kind: flat ? 'Project' : i === names.length - 1 ? 'Adventure' : (i % 2 === 0 ? 'Build' : 'Solve'),
      status: hit ? (hit.status === 'Completed' ? 'done' : 'working') : 'todo',
      date: hit?.date || null,
    };
  });
}

// Which levels of a belt are behind, current, ahead, given the enrolment.
export function levelStates(beltName, currentLevel) {
  const levels = getLevels(beltName);
  const cur = Number(currentLevel);
  return levels.map((lv) => ({
    level: lv,
    state: lv < cur ? 'done' : lv === cur ? 'current' : 'ahead',
    projectCount: ((BELT_LEVEL_PROJECTS[beltName] || {})[lv] || []).length,
  }));
}

// A short name for a level, taken from its Adventure project ("Creating with
// Index and While Loops!" → "Index and while loops"). Display only; the
// curriculum does not name levels.
export function levelTitle(beltName, level) {
  const names = (BELT_LEVEL_PROJECTS[beltName] || {})[level] || [];
  const adv = names[names.length - 1] || '';
  const m = adv.match(/^Creating with (.+?)!?$/i);
  if (m) {
    const t = m[1].trim();
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }
  if (/belt-up/i.test(adv)) return 'Belt-up project';
  return `Level ${level}`;
}

// Merge sessions and club attendance into one newest-first feed.
export function activityFeed(detail) {
  const logs = realSessions(detail?.session_logs).map((l) => ({ ...l, _type: 'session' }));
  const clubs = (detail?.club_attendance || []).map((c) => ({ ...c, _type: 'club', session_date: c.session_date }));
  return [...logs, ...clubs].sort((a, b) => String(b.session_date).localeCompare(String(a.session_date)));
}

export function fmtDay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(String(dateStr).split('T')[0] + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtLongDay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(String(dateStr).split('T')[0] + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function calcAge(birthday) {
  if (!birthday) return null;
  const dob = new Date(String(birthday).split('T')[0] + 'T00:00:00');
  if (Number.isNaN(dob.getTime())) return null;
  return Math.floor((Date.now() - dob) / (365.25 * 24 * 60 * 60 * 1000));
}

// Programs without belts are tracks of modules: Robotics is four kits, JR is
// JR Coding and Snap Circuits, AI Academy and the rest are one track each.
// This turns the curriculum and the log into that shape so a course card and
// an opened course can read one thing.
//
// A module the log has visited is "done" unless it is the furthest one
// visited in its track, which is "working". A track is current if the
// enrolment says so (last_sub_program), else it is the track of the latest
// session, else the first. Tracks before the current one that have sessions
// are done; the rest are ahead. Nothing here is stored; it is all read off
// what the portal already has.
// WHICH LESSONS A NINJA HAS FINISHED, as a Map from a lesson's full identity
// to the day it was finished.
//
// It lives here, next to `realSessions`, because two very different callers
// need the same answer and neither may be allowed to invent its own: the
// module list on the course page ticks lessons off with it, and the lesson
// stickers in the book are earned by it. A sticker congratulating a ninja for
// a lesson the course page still shows as unticked is exactly the drift this
// prevents.
//
// A log identifies a lesson by four things and all four have to match. The
// same lesson name appears in more than one kit ("1. Introduction"), and a
// module name is only unique inside its own program.
//
// ROADMAP ROWS COUNT HERE, unlike everywhere else in this file. The roadmap's
// bulk mark-complete is not a session — it must not appear in the feed or the
// session counts, which is what realSessions is for — but it IS the staff side
// saying this lesson is finished, and the parent portal contradicting the
// staff roadmap is worse drift than any it was filtered out to prevent. A
// roadmap row carries no date though: its session_date is the day the box was
// checked, not the day the lesson happened, so it completes the lesson as
// "Done" and lets a real session's date claim the day if one ever names it.
//
// THE EARLIEST COMPLETION WINS. A lesson revisited weeks later is still the
// one they finished the first time.
export function lessonKey(program, subProgram, moduleName, lessonName) {
  return [program, subProgram || '', moduleName, lessonName].join('\u0000');
}

export function completedLessonDays(logs) {
  const days = new Map();
  for (const l of logs || []) {
    if (l.status_at !== 'Completed' || !l.lesson_name || !l.module_name) continue;
    const key = lessonKey(l.program, l.sub_program, l.module_name, l.lesson_name);
    const day = !l.from_roadmap && l.session_date ? String(l.session_date).split('T')[0] : null;
    const seen = days.get(key);
    if (seen === undefined || (day && (seen === null || day < seen))) days.set(key, day);
  }
  return days;
}

export function trackModel({ program, enrollment, logs, curriculum, subPrograms, shortNames = {} }) {
  const sessions = realSessions(logs);
  const names = (subPrograms && subPrograms[program]) || [];
  const multi = names.length > 0;
  const keys = multi ? names : [program];

  const done = completedLessonDays(logs);

  const tracks = keys.map((name, i) => {
    const track = (curriculum && curriculum[name]) || [];
    const moduleNames = track.map((m) => m.module);
    // The lessons of each module, so a module row can open and show what is
    // inside it. A module the curriculum has never heard of — the log carries
    // a name no longer in it — gets an empty list and simply does not open.
    const lessonsOf = new Map(track.map((m) => [m.module, m.lessons || []]));
    const sub = multi ? name : null;
    const tlogs = multi ? sessions.filter((l) => l.sub_program === name) : sessions;
    const byModule = new Map();
    for (const l of tlogs) {
      if (!l.module_name) continue;
      const d = String(l.session_date).split('T')[0];
      const e = byModule.get(l.module_name) || { first: d, last: d };
      if (d < e.first) e.first = d;
      if (d > e.last) e.last = d;
      byModule.set(l.module_name, e);
    }
    const order = (m) => { const k = moduleNames.indexOf(m); return k < 0 ? Number.MAX_SAFE_INTEGER : k; };
    let furthest = null;
    for (const m of byModule.keys()) {
      if (furthest === null || order(m) > order(furthest) || (order(m) === order(furthest) && byModule.get(m).last > byModule.get(furthest).last)) furthest = m;
    }
    const all = [...moduleNames, ...[...byModule.keys()].filter((m) => !moduleNames.includes(m))];
    const modules = all.map((m, j) => {
      const hit = byModule.get(m);
      const names = lessonsOf.get(m) || [];
      const titles = lessonTitles(names);
      const lessons = names.map((lesson) => {
        const day = done.get(lessonKey(program, sub, m, lesson));
        return { name: lesson, title: titles.get(lesson), done: done.has(lessonKey(program, sub, m, lesson)), date: day || null };
      });
      return {
        name: m,
        index: j + 1,
        // The module's own status is unchanged: `working` is where the ninja
        // IS, which is not the same as what they have finished. The lesson
        // ticks below it are what they finished, and the two disagreeing on a
        // module skipped past is the honest reading of a skipped module.
        status: hit ? (m === furthest ? 'working' : 'done') : 'todo',
        date: hit ? hit.last : null,
        lessons,
        lessonsDone: lessons.filter((l) => l.done).length,
      };
    });
    const dates = tlogs.map((l) => String(l.session_date).split('T')[0]).sort();
    return {
      name,
      short: shortNames[name] || name,
      index: i + 1,
      modules,
      done: modules.filter((m) => m.status === 'done').length,
      working: modules.find((m) => m.status === 'working') || null,
      sessions: tlogs.length,
      first: dates[0] || null,
      last: dates[dates.length - 1] || null,
      state: 'ahead',
    };
  });

  let curIdx = multi ? keys.indexOf(enrollment?.last_sub_program) : 0;
  if (curIdx < 0) {
    const latest = sessions.find((l) => l.sub_program && keys.includes(l.sub_program));
    curIdx = latest ? keys.indexOf(latest.sub_program) : 0;
  }
  tracks.forEach((t, i) => {
    t.state = i === curIdx ? 'current' : i < curIdx && t.sessions > 0 ? 'done' : 'ahead';
  });

  return { multi, tracks, current: tracks[curIdx] || tracks[0] || null, unit: program === 'Robotics Academy' ? 'Kit' : 'Track' };
}
