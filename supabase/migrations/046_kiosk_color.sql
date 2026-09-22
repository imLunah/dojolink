-- 046_kiosk_color.sql
--
-- The kiosk's color, per center, set on the Kiosk page: a preset swatch or
-- any color from the picker, stored as #rrggbb. NULL is DojoLink's own blue.

ALTER TABLE public.mystudio_kiosks ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.mystudio_kiosks DROP CONSTRAINT IF EXISTS mystudio_kiosks_color_check;
ALTER TABLE public.mystudio_kiosks ADD CONSTRAINT mystudio_kiosks_color_check
  CHECK (color IS NULL OR color ~ '^#[0-9a-f]{6}$');
