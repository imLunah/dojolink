-- 061_mystudio_class_sections.sql
--
-- Two things directors asked for once class names could be mapped (060):
--
-- 1. One MyStudio class name can run as several sections: "Minecraft Club" on
--    Tuesday and again on Friday, two groups of kids that DojoLink keeps as two
--    clubs. mystudio_class_section_mappings says what ONE section is, keyed by
--    MyStudio's class_appointment_id:class_appointment_times_id (a class at
--    its weekday and time, the same every week). A section mapping outranks
--    the name's mapping, which stays the default for every other section.
--
-- 2. "Academies" is one class for Robotics Academy and AI Academy kids. A
--    mapping can now name several programs; a check-in takes the one the ninja
--    is enrolled in, and none when it is not exactly one.
--
-- mystudio_class_mappings.programs is added beside program rather than
-- replacing it, because the deployed code that reads program shares this
-- database. program keeps holding the first choice. A programs array is only
-- believed while programs[1] = program, so a later save by code that only
-- knows program cannot leave a stale list behind.

ALTER TABLE public.mystudio_class_mappings
  ADD COLUMN IF NOT EXISTS programs TEXT[];
ALTER TABLE public.mystudio_class_mappings
  DROP CONSTRAINT IF EXISTS mystudio_class_mappings_programs_check;
ALTER TABLE public.mystudio_class_mappings
  ADD CONSTRAINT mystudio_class_mappings_programs_check
  CHECK (programs IS NULL OR (
    cardinality(programs) BETWEEN 1 AND 5
    AND programs <@ ARRAY['CREATE', 'Robotics Academy', 'AI Academy', 'JR', 'VR Coding']::text[]
  ));

CREATE TABLE IF NOT EXISTS public.mystudio_class_section_mappings (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  class_title TEXT NOT NULL,
  programs TEXT[],
  club_id INTEGER REFERENCES public.club_definitions(id) ON DELETE CASCADE,
  updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mystudio_class_section_mappings_key CHECK (section_key ~ '^[0-9]{1,20}:[0-9]{1,20}$'),
  CONSTRAINT mystudio_class_section_mappings_title_len CHECK (char_length(class_title) BETWEEN 1 AND 120),
  CONSTRAINT mystudio_class_section_mappings_programs_check
    CHECK (programs IS NULL OR (
      cardinality(programs) BETWEEN 1 AND 5
      AND programs <@ ARRAY['CREATE', 'Robotics Academy', 'AI Academy', 'JR', 'VR Coding']::text[]
    )),
  CONSTRAINT mystudio_class_section_mappings_one_target CHECK (num_nonnulls(programs, club_id) = 1),
  CONSTRAINT mystudio_class_section_mappings_unique UNIQUE (location_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_mystudio_class_section_mappings_club
  ON public.mystudio_class_section_mappings (club_id);
CREATE INDEX IF NOT EXISTS idx_mystudio_class_section_mappings_updated_by
  ON public.mystudio_class_section_mappings (updated_by);

ALTER TABLE public.mystudio_class_section_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.mystudio_class_section_mappings;
CREATE POLICY deny_all ON public.mystudio_class_section_mappings AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
