const ms = require('./mystudio');

// What a MyStudio class means at one center.
//
// Centers name their classes their own way, and the exact-match rule in
// lib/mystudio.js (programForClass) only places a title that IS a program's
// name. A director can say what any other title is: one program, a choice of
// programs (Academies is Robotics Academy or AI Academy), or one of the
// center's clubs. One section of a class (a weekday and time, keyed
// appointment:times) can say something different from its name, because a
// center that runs "Minecraft Club" twice a week keeps two groups of kids as
// two clubs. Section first, then name, then the exact-match rule.
//
// A target is { programs, isClub, clubId, clubName }. programs is the list of
// candidates; pickProgram decides which one a given ninja gets.

// The mappings table keeps `program` beside `programs` so code that only knows
// `program` keeps working on the shared database (migration 061). The list is
// only believed while it still starts with `program`.
function programsOf(row) {
  if (!row.program) return null;
  const list = Array.isArray(row.programs) ? row.programs : null;
  return list && list[0] === row.program ? list : [row.program];
}

function targetOf(row, programs) {
  if (programs && programs.length) return { programs, isClub: false, clubId: null, clubName: null };
  if (row.club_name) return { programs: null, isClub: true, clubId: row.club_id, clubName: row.club_name };
  return null;
}

function automatic(title) {
  const program = ms.programForClass(title);
  return { programs: program ? [program] : null, isClub: ms.isClubClass(title), clubId: null, clubName: null };
}

// "appointment:times" from a kiosk classKey ("appointment:times:occurrence").
function sectionKeyOf(classKey) {
  const m = /^(\d+):(\d+)(?::\d*)?$/.exec(String(classKey || ''));
  return m ? `${m[1]}:${m[2]}` : null;
}

// Everything mapped at a center, read once, for callers placing many classes.
async function loadMappings(pool, locationId) {
  const [{ rows: titles }, { rows: sections }] = await Promise.all([
    pool.query(
      `SELECT m.class_title, m.program, m.programs, m.club_id, cd.name AS club_name
         FROM mystudio_class_mappings m
         LEFT JOIN club_definitions cd ON cd.id = m.club_id
        WHERE m.location_id = $1`,
      [locationId]
    ),
    pool.query(
      `SELECT s.section_key, s.class_title, s.programs, s.club_id, cd.name AS club_name
         FROM mystudio_class_section_mappings s
         LEFT JOIN club_definitions cd ON cd.id = s.club_id
        WHERE s.location_id = $1`,
      [locationId]
    ),
  ]);
  const byTitle = new Map(titles.map((r) => [r.class_title.trim().toLowerCase(), r]));
  const bySection = new Map(sections.map((r) => [r.section_key, r]));

  return {
    titles: byTitle,
    sections: bySection,
    resolve(className, sectionKey) {
      const title = String(className || '').trim();
      const section = sectionKey ? bySection.get(sectionKey) : null;
      const fromSection = section && targetOf(section, section.programs);
      if (fromSection) return fromSection;
      const row = byTitle.get(title.toLowerCase());
      const fromTitle = row && targetOf(row, programsOf(row));
      return fromTitle || automatic(title);
    },
  };
}

async function resolveClass(pool, locationId, className, sectionKey = null) {
  return (await loadMappings(pool, locationId)).resolve(className, sectionKey);
}

// The one program a ninja gets from a list of candidates: the single one they
// are enrolled in, or none. `enrolled` is a Set of their programs.
function pickProgram(programs, enrolled) {
  if (!programs || !programs.length) return null;
  const hits = programs.filter((p) => enrolled.has(p));
  return hits.length === 1 ? hits[0] : null;
}

module.exports = { resolveClass, loadMappings, pickProgram, programsOf, sectionKeyOf };
