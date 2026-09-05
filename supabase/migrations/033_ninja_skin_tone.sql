-- The ninja on a parent's profile page comes in three skin tones. Which one a
-- ninja gets is stored here, per student.
--
-- NULL means "not set" and every surface falls back to 'medium', which is the
-- tone the app shipped as its only one. So an untouched roster looks exactly
-- as it did before this column existed, and nobody is assigned a tone by us.
--
-- The three values match the source artwork (light / medium / dark) and the
-- filenames in client/public/ninjas. Keep the CHECK, NINJA_TONES in
-- server/routes/students.js and NINJA_TONES in client/src/utils/ninjas.js in
-- step; adding a fourth tone means all three plus new art.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS ninja_skin_tone TEXT
  CHECK (ninja_skin_tone IS NULL OR ninja_skin_tone IN ('light', 'medium', 'dark'));
