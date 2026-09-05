const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const pool = require('./pool');
const { addMembership } = require('../lib/studentScope');

const BELT_MAP = {
  'White Belt': 'White',
  'Yellow Belt': 'Yellow',
  'Orange Belt': 'Orange',
  'Green Belt': 'Green',
  'Blue Belt': 'Blue',
  'Purple Belt': 'Purple',
  'Brown Belt': 'Brown',
  'Red Belt': 'Red',
  'Black Belt': 'Black',
};

function parseProgram(membership) {
  if (membership.includes('CODE NINJAS: CREATE')) return 'CREATE';
  if (membership.includes('CODE NINJAS: JR')) return 'JR';
  if (membership.includes('Robotics')) return 'Robotics Academy';
  if (membership.includes('AI')) return 'AI Academy';
  if (membership.includes('VR')) return 'VR Coding';
  return null;
}

function parseBirthday(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d)) return null;
  return d.toISOString().split('T')[0];
}

async function run() {
  const csvPath = process.argv[2];
  const locationSlug = process.argv[3];

  if (!csvPath || !locationSlug) {
    console.error('Usage: node server/db/import.js <csv-path> <location-slug>');
    console.error('  location-slug: use the slug from the locations table (e.g. yorba-linda)');
    process.exit(1);
  }

  const { rows: locs } = await pool.query('SELECT id FROM locations WHERE slug = $1', [locationSlug]);
  if (!locs.length) {
    console.error(`Location not found: ${locationSlug}`);
    process.exit(1);
  }
  const locationId = locs[0].id;

  const content = fs.readFileSync(csvPath, 'utf8');
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });

  let added = 0;
  let skipped = 0;

  for (const row of records) {
    const fullName = `${row['Participant First Name']} ${row['Participant Last Name']}`.trim();
    const birthday = parseBirthday(row['Birthday']);
    const parentName = `${row['Customer First Name']} ${row['Customer Last Name']}`.trim();
    const parentEmail = row['Email']?.trim() || null;
    const parentPhone = row['Mobile Phone']?.trim() || null;
    const program = parseProgram(row['Membership']);
    const beltRaw = row['Rank']?.trim();
    const beltLevel = BELT_MAP[beltRaw] || null;

    if (!program) {
      console.log(`  SKIP (unknown program): ${fullName} — ${row['Membership']}`);
      skipped++;
      continue;
    }

    // Check if student already exists at this location
    const { rows: existing } = await pool.query(
      `SELECT id FROM students WHERE LOWER(full_name) = LOWER($1) AND active = true
         AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2)`,
      [fullName, locationId]
    );

    let studentId;
    if (existing.length) {
      studentId = existing[0].id;
      console.log(`  EXISTS (skipping): ${fullName}`);
      skipped++;
    } else {
      const { rows: inserted } = await pool.query(
        `INSERT INTO students (full_name, birthday, location_id, parent_name, parent_email, parent_phone)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [fullName, birthday, locationId, parentName || null, parentEmail, parentPhone]
      );
      studentId = inserted[0].id;
      // Home and membership go in together. Every read of "is this ninja at
      // this center" asks student_locations alone, so a student row without
      // the membership row is a ninja who exists on nobody's roster.
      await addMembership(pool, studentId, locationId);
      added++;
      console.log(`  ADDED: ${fullName} (${program}${beltLevel ? ', ' + beltLevel : ''})`);
    }

    // Add program enrollment if not already there
    const { rows: existingProgram } = await pool.query(
      'SELECT id FROM student_programs WHERE student_id = $1 AND program = $2',
      [studentId, program]
    );

    if (!existingProgram.length) {
      await pool.query(
        `INSERT INTO student_programs (student_id, program, belt_level, belt_sublevel)
         VALUES ($1, $2, $3, $4)`,
        [studentId, program, beltLevel, beltLevel ? 1 : null]
      );
    }
  }

  console.log(`\nDone. Added: ${added}, Skipped/Existing: ${skipped}`);
  await pool.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
