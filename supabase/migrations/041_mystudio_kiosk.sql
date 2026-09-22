-- 041_mystudio_kiosk.sql
--
-- A check-in kiosk: families check their booked ninja in on a DojoLink tablet,
-- and the check-in lands in MyStudio and on Today's Board.
--
-- mystudio_kiosks holds one check-in portal token per center. The portal is a
-- separate MyStudio app with its own sign-in, and its token is a credential that
-- can check children in, so it is encrypted at rest with MYSTUDIO_ENC_KEY like
-- the connection cookie, never returned by a route and never logged. It is kept
-- apart from mystudio_connections because the two credentials live and die on
-- different schedules: the director session lapses within days and needs an
-- emailed code, the portal token does not.
--
-- mystudio_kiosk_checkins is the record of what the kiosk did, so a family who
-- says "we checked in" and a MyStudio attendance count that disagrees can be
-- settled from our side. It holds ids and a class name, no names or contact
-- details.

CREATE TABLE IF NOT EXISTS public.mystudio_kiosks (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL UNIQUE REFERENCES public.locations(id) ON DELETE CASCADE,
  connected_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  company_id TEXT,
  company_name TEXT,
  login_email TEXT,
  portal_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT mystudio_kiosks_status_check CHECK (status IN ('connected', 'expired'))
);

ALTER TABLE public.mystudio_kiosks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.mystudio_kiosks;
CREATE POLICY deny_all ON public.mystudio_kiosks AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_mystudio_kiosks_connected_by
  ON public.mystudio_kiosks (connected_by);

CREATE TABLE IF NOT EXISTS public.mystudio_kiosk_checkins (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  class_key TEXT NOT NULL,
  class_name TEXT,
  start_time TEXT,
  student_id INTEGER REFERENCES public.students(id) ON DELETE SET NULL,
  assignment_id INTEGER REFERENCES public.daily_assignments(id) ON DELETE SET NULL,
  result TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mystudio_kiosk_checkins_result_check
    CHECK (result IN ('checked_in', 'already', 'refused', 'failed', 'uncertain'))
);

ALTER TABLE public.mystudio_kiosk_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.mystudio_kiosk_checkins;
CREATE POLICY deny_all ON public.mystudio_kiosk_checkins AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_mystudio_kiosk_checkins_location_created
  ON public.mystudio_kiosk_checkins (location_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mystudio_kiosk_checkins_student
  ON public.mystudio_kiosk_checkins (student_id);
CREATE INDEX IF NOT EXISTS idx_mystudio_kiosk_checkins_assignment
  ON public.mystudio_kiosk_checkins (assignment_id);
