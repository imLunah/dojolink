-- 064_impact_scan_ins.sql
--
-- IMPACT scan-ins, kept. A scan-in is a ninja logging into a dojo computer, so
-- it is the real moment they sat down, and a removal is when a sensei took
-- them off the board. Reports reads these for the hour-by-hour view instead of
-- assuming an hour from the board check-in.
--
-- IMPACT keeps no history we can read back (its per-ninja endpoints come back
-- empty), so this table only fills from the day it was created: every Live
-- Ninjas poll writes what it sees, and a nightly job after close writes the
-- whole day for centers nobody watched.
--
-- No names are stored. impact_user_id is IMPACT's opaque account id, and
-- student_id is set only when the scan-in's name matched exactly one ninja on
-- the center's roster at the time it was recorded.

CREATE TABLE IF NOT EXISTS public.impact_scan_ins (
  id BIGINT PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  impact_user_id TEXT NOT NULL,
  student_id INTEGER REFERENCES public.students(id) ON DELETE SET NULL,
  program TEXT,
  session_date DATE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  session_minutes INTEGER NOT NULL,
  removed_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT impact_scan_ins_program_check CHECK (program IS NULL OR program IN ('JR', 'CREATE')),
  CONSTRAINT impact_scan_ins_minutes_check CHECK (session_minutes BETWEEN 0 AND 600)
);

ALTER TABLE public.impact_scan_ins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.impact_scan_ins;
CREATE POLICY deny_all ON public.impact_scan_ins AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_impact_scan_ins_location_date
  ON public.impact_scan_ins (location_id, session_date);
CREATE INDEX IF NOT EXISTS idx_impact_scan_ins_student
  ON public.impact_scan_ins (student_id, session_date)
  WHERE student_id IS NOT NULL;
