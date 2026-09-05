-- 036_location_address.sql
--
-- Where a center actually is.
--
-- `locations` carried a name, a slug and a center code and nothing about the
-- place, so every surface that wanted to say where something is happening
-- could only print the center's name. The parent portal's event page needs it
-- for a directions link; a family pass or a reminder email would want the
-- same string, which is why it goes on the center rather than on an event.
--
-- One free-text line, not parsed parts. A US street address split into
-- street / city / state / zip is four fields a director has to fill in
-- correctly and four ways for it to be half-entered, and nothing here does
-- arithmetic on the pieces — it is handed to a maps app as a search string.
-- One field that reads the way somebody would write it on a flyer.
--
-- NULLABLE, and the callers fall back to searching the center's name. A
-- center that has not filled this in still gets a working directions link,
-- so this can be adopted one center at a time rather than needing all three
-- filled before anything works.
--
-- No latitude/longitude: nothing embeds a map. A directions link takes a
-- search string, and coordinates would be two more columns to keep true with
-- no reader for them.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN public.locations.address IS
  'The center''s street address as one line, for directions links. NULL falls back to searching the center name.';
