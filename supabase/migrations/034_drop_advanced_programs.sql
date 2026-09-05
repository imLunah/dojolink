-- Drop the Silver, Gold Unity and Gold Godot PROGRAMS.
--
-- They were the advanced tracks as memberships, and they duplicated the top of
-- the CREATE ladder, which already carries Bronze, Silver, Platinum and Gold as
-- belts with their own seeded projects. `AGENTS.md` had carried "Gold belt vs
-- Gold Unity/Gold Godot programs — unresolved; both exist" since session 29;
-- this resolves it in favour of the belts.
--
-- NOTHING IS BEING REMOVED FROM THE BELT LADDER. Silver and Gold stay in
-- `BELTS`, their 17 and 6 levels stay in `belt_projects`, and a ninja's
-- `belt_level` is untouched by this file. What goes is the program of the same
-- name, which is a different column on a different table.
--
-- Data: one row, `student_programs` for student 339 ("ninja spider", a seeded
-- test record with no Gold Unity session ever logged). `progress_logs` and
-- `daily_assignments` had none for any of the three, checked before writing
-- this. The three CHECK lists must stay in sync with each other and with
-- PROGRAMS in `client/src/utils/beltConfig.js`.

BEGIN;

DELETE FROM student_programs WHERE program IN ('Silver', 'Gold Unity', 'Gold Godot');

ALTER TABLE student_programs DROP CONSTRAINT IF EXISTS student_programs_program_check;
ALTER TABLE student_programs ADD CONSTRAINT student_programs_program_check
  CHECK (program = ANY (ARRAY['CREATE', 'Robotics Academy', 'AI Academy', 'JR', 'VR Coding']));

ALTER TABLE progress_logs DROP CONSTRAINT IF EXISTS progress_logs_program_check;
ALTER TABLE progress_logs ADD CONSTRAINT progress_logs_program_check
  CHECK (program IS NULL OR program = ANY (ARRAY['CREATE', 'Robotics Academy', 'AI Academy', 'JR', 'VR Coding']));

ALTER TABLE daily_assignments DROP CONSTRAINT IF EXISTS daily_assignments_program_check;
ALTER TABLE daily_assignments ADD CONSTRAINT daily_assignments_program_check
  CHECK (program IS NULL OR program = ANY (ARRAY['CREATE', 'Robotics Academy', 'AI Academy', 'JR', 'VR Coding']));

COMMIT;
