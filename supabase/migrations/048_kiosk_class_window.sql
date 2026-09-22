-- 048_kiosk_class_window.sql
--
-- How far from now a class's start can be and still show on the kiosk, in
-- minutes either side. NULL shows every class left today (how the kiosk has
-- behaved). 70 at 4:00 PM shows classes starting 2:50 to 5:10.

ALTER TABLE public.mystudio_kiosks ADD COLUMN IF NOT EXISTS class_window_minutes INTEGER;
ALTER TABLE public.mystudio_kiosks DROP CONSTRAINT IF EXISTS mystudio_kiosks_class_window_check;
ALTER TABLE public.mystudio_kiosks ADD CONSTRAINT mystudio_kiosks_class_window_check
  CHECK (class_window_minutes IS NULL OR class_window_minutes BETWEEN 5 AND 720);
