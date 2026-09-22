-- 045_kiosk_flow.sql
--
-- How the kiosk starts: 'name' (find your ninja, then pick a class) or 'class'
-- (pick today's class, then find your ninja in it). Per center, set by a
-- director on the Kiosk page.

ALTER TABLE public.mystudio_kiosks
  ADD COLUMN IF NOT EXISTS flow TEXT NOT NULL DEFAULT 'name';
ALTER TABLE public.mystudio_kiosks DROP CONSTRAINT IF EXISTS mystudio_kiosks_flow_check;
ALTER TABLE public.mystudio_kiosks ADD CONSTRAINT mystudio_kiosks_flow_check
  CHECK (flow IN ('name', 'class'));
