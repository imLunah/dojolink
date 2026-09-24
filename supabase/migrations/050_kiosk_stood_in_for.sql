-- 050_kiosk_stood_in_for.sql
--
-- When a kiosk check-in finds a board row a sensei already made for the same
-- class, that row stands in for it rather than a second one being added. The
-- row it used is recorded here, so it stands in for ONE check-in only: a child
-- put on the board by hand and then checked in twice at the kiosk still ends up
-- with two sessions. Kept apart from assignment_id because an undo deletes the
-- assignment_id row, and a sensei's row is not the kiosk's to delete.

ALTER TABLE public.mystudio_kiosk_checkins
  ADD COLUMN IF NOT EXISTS stood_in_for INTEGER
    REFERENCES public.daily_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS mystudio_kiosk_checkins_stood_in_for_idx
  ON public.mystudio_kiosk_checkins (stood_in_for);
