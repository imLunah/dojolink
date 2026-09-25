const ms = require('./mystudio');

// What a MyStudio class name means at one center.
//
// Centers name their classes their own way, and the exact-match rule in
// lib/mystudio.js (programForClass) only places a title that IS a program's
// name. A director can say what any other title is: a program, or one of the
// center's clubs. A title nobody has mapped keeps the exact-match rule.
//
// Returns { program, isClub, clubId, clubName }.
async function resolveClass(pool, locationId, className) {
  const title = String(className || '').trim();
  if (title) {
    const { rows } = await pool.query(
      `SELECT m.program, m.club_id, cd.name AS club_name
         FROM mystudio_class_mappings m
         LEFT JOIN club_definitions cd ON cd.id = m.club_id
        WHERE m.location_id = $1 AND lower(m.class_title) = lower($2)`,
      [locationId, title]
    );
    const row = rows[0];
    if (row && row.program) return { program: row.program, isClub: false, clubId: null, clubName: null };
    if (row && row.club_name) return { program: null, isClub: true, clubId: row.club_id, clubName: row.club_name };
  }
  return { program: ms.programForClass(title), isClub: ms.isClubClass(title), clubId: null, clubName: null };
}

// Every mapping at a center, keyed by lowercased title, for callers placing a
// whole day of classes at once.
async function mappingsFor(pool, locationId) {
  const { rows } = await pool.query(
    `SELECT m.class_title, m.program, m.club_id, cd.name AS club_name
       FROM mystudio_class_mappings m
       LEFT JOIN club_definitions cd ON cd.id = m.club_id
      WHERE m.location_id = $1`,
    [locationId]
  );
  return new Map(rows.map((r) => [r.class_title.trim().toLowerCase(), r]));
}

module.exports = { resolveClass, mappingsFor };
