-- 060_mystudio_class_mappings.sql
--
-- What a MyStudio class name means at one center. Each center names its
-- classes its own way ("Robotics" at one, "Robotics Academy" at another,
-- "CREATE - Coding", "CLUBS: Minecraft"), and the kiosk can only place a
-- check-in whose class title matches a program exactly. Anything else landed on
-- Today's Board with no program. A director now says, once per name, which
-- program or which club it is.
--
-- A name points at a program OR a club, never both. Clearing it deletes the
-- row, and the kiosk goes back to its own exact-match rule.
--
-- The club is held by id, not by name, so renaming a club keeps the mapping.
--
-- mystudio_kiosk_checkins.club_session_id records the club session the kiosk
-- added a ninja to, so an undo takes them back off it.

CREATE TABLE IF NOT EXISTS public.mystudio_class_mappings (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  class_title TEXT NOT NULL,
  program TEXT,
  club_id INTEGER REFERENCES public.club_definitions(id) ON DELETE CASCADE,
  updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mystudio_class_mappings_title_len CHECK (char_length(class_title) BETWEEN 1 AND 120),
  CONSTRAINT mystudio_class_mappings_program_check
    CHECK (program IS NULL OR program IN ('CREATE', 'Robotics Academy', 'AI Academy', 'JR', 'VR Coding')),
  CONSTRAINT mystudio_class_mappings_one_target CHECK (num_nonnulls(program, club_id) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS mystudio_class_mappings_location_title
  ON public.mystudio_class_mappings (location_id, lower(class_title));
CREATE INDEX IF NOT EXISTS idx_mystudio_class_mappings_club
  ON public.mystudio_class_mappings (club_id);
CREATE INDEX IF NOT EXISTS idx_mystudio_class_mappings_updated_by
  ON public.mystudio_class_mappings (updated_by);

ALTER TABLE public.mystudio_class_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.mystudio_class_mappings;
CREATE POLICY deny_all ON public.mystudio_class_mappings AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE public.mystudio_kiosk_checkins
  ADD COLUMN IF NOT EXISTS club_session_id INTEGER REFERENCES public.club_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_mystudio_kiosk_checkins_club_session
  ON public.mystudio_kiosk_checkins (club_session_id);
