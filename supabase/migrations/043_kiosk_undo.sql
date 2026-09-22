-- 043_kiosk_undo.sql
--
-- A family can take back a kiosk check-in made by mistake, for a short while
-- after making it. The log row it undoes is stamped rather than deleted, so
-- the record still shows the check-in happened and was taken back.

ALTER TABLE public.mystudio_kiosk_checkins
  ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ;
