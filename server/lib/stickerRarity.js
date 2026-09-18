// GET /api/parent/sticker-rarity and GET /api/curriculum/sticker-rarity
//
// One handler behind two gates: the parent portal asks under its parent
// session, and the staff course pages ask under a staff one. The payload is
// counts only, so it is the same answer for both.
//
// Where every CREATE ninja is standing on the belt ladder, as a histogram of
// (belt, level) -> how many are there. The sticker book turns that into a
// rarity for each sticker: a sticker is rare when few ninjas have walked past
// the level it celebrates.
//
// The counting itself stays on the client, because the two things it needs are
// already there and nowhere else: the belt order (utils/beltConfig) and which
// levels each sticker covers (lib/createStickers). This route knows nothing
// about stickers, so adding one never means touching it.
//
// Every active CREATE ninja, all centers, not just the parent's. "How rare is
// this sticker" is a question about the whole dojo, and one center on its own
// has too few Brown belts to divide into four tiers without the answer
// flipping week to week. Counts only: no names, no ids, nothing that resolves
// to a child, and the totals are never sent as raw numbers to the page (the
// book prints a percentage).
//
// THE OTHER PROGRAMS RIDE ALONG. Their stickers are earned per lesson and per
// module rather than off a belt ladder, so their half of the payload is a
// different shape: how many active ninjas are enrolled in each program (the
// cohort a rarity is measured against), how many distinct ninjas have each
// lesson logged Completed, and how many have completed EVERY curriculum
// lesson of each module. The module count has to be computed here — it is a
// per-ninja AND across lessons, which per-lesson counts cannot reconstruct.
// Roadmap bulk-marks count, the same way they count toward earning the
// sticker itself. Still counts only, and still no sticker knowledge: the
// rows are keyed by curriculum facts, and the client maps them onto its book.
async function stickerRarity(req, res) {
  const pool = req.app.get('db');
  try {
    // belt_sublevel is nullable on a belt a ninja has only just started, and
    // "no level yet" is the first one.
    const { rows } = await pool.query(`
      SELECT sp.belt_level AS belt, COALESCE(sp.belt_sublevel, 1) AS level, COUNT(*)::int AS count
        FROM student_programs sp
        JOIN students s ON s.id = sp.student_id
       WHERE sp.program = 'CREATE' AND s.active = true AND sp.belt_level IS NOT NULL
       GROUP BY 1, 2
    `);
    const ninjas = rows.reduce((sum, row) => sum + row.count, 0);

    const { rows: programRows } = await pool.query(`
      SELECT sp.program, COUNT(*)::int AS count
        FROM student_programs sp
        JOIN students s ON s.id = sp.student_id
       WHERE s.active = true AND sp.program <> 'CREATE'
       GROUP BY 1
    `);

    const { rows: lessons } = await pool.query(`
      SELECT pl.program, pl.sub_program, pl.module_name, pl.lesson_name,
             COUNT(DISTINCT pl.student_id)::int AS count
        FROM progress_logs pl
        JOIN students s ON s.id = pl.student_id
       WHERE s.active = true AND pl.program <> 'CREATE'
         AND pl.status_at = 'Completed'
         AND pl.module_name IS NOT NULL AND pl.lesson_name IS NOT NULL
       GROUP BY 1, 2, 3, 4
    `);

    const { rows: modules } = await pool.query(`
      WITH per_ninja AS (
        SELECT cm.id AS module_id, cm.program, cm.sub_program, cm.module_name,
               pl.student_id, COUNT(DISTINCT cl.id) AS done
          FROM curriculum_modules cm
          JOIN curriculum_lessons cl ON cl.module_id = cm.id
          JOIN progress_logs pl
            ON pl.program = cm.program
           AND pl.sub_program IS NOT DISTINCT FROM cm.sub_program
           AND pl.module_name = cm.module_name
           AND pl.lesson_name = cl.lesson_name
           AND pl.status_at = 'Completed'
          JOIN students s ON s.id = pl.student_id AND s.active = true
         WHERE cm.program <> 'CREATE'
         GROUP BY 1, 2, 3, 4, 5
      )
      SELECT p.program, p.sub_program, p.module_name, COUNT(*)::int AS count
        FROM per_ninja p
       WHERE p.done = (SELECT COUNT(*) FROM curriculum_lessons cl2 WHERE cl2.module_id = p.module_id)
       GROUP BY 1, 2, 3
    `);

    res.json({
      ninjas,
      positions: rows,
      programs: Object.fromEntries(programRows.map((r) => [r.program, r.count])),
      lessons,
      modules,
    });
  } catch (err) {
    console.error('Sticker rarity error:', err);
    res.status(500).json({ error: 'Failed to load sticker rarity' });
  }
}

module.exports = { stickerRarity };
