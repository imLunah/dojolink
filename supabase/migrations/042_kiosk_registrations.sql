-- 042_kiosk_registrations.sql
--
-- The kiosk can now book a child into a class they had no place in, the way
-- MyStudio's own kiosk does, then check them in. The log names that outcome on
-- its own so a registration made at the tablet can be told apart from an
-- ordinary check-in when a family asks about their membership count.

ALTER TABLE public.mystudio_kiosk_checkins
  DROP CONSTRAINT IF EXISTS mystudio_kiosk_checkins_result_check;
ALTER TABLE public.mystudio_kiosk_checkins
  ADD CONSTRAINT mystudio_kiosk_checkins_result_check
  CHECK (result IN ('checked_in', 'registered', 'already', 'refused', 'failed', 'uncertain'));
