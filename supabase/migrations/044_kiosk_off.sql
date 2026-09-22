-- 044_kiosk_off.sql
--
-- The kiosk now signs itself in with the center's saved MyStudio login, so a
-- center that has connected MyStudio never has to sign the kiosk in again.
-- That makes "disconnect" need a state of its own: deleting the row would
-- only have the next page load sign it straight back in. 'off' is a kiosk a
-- director switched off, and the token is dropped with it.

ALTER TABLE public.mystudio_kiosks ALTER COLUMN portal_token DROP NOT NULL;
ALTER TABLE public.mystudio_kiosks DROP CONSTRAINT IF EXISTS mystudio_kiosks_status_check;
ALTER TABLE public.mystudio_kiosks ADD CONSTRAINT mystudio_kiosks_status_check
  CHECK (status IN ('connected', 'expired', 'off'));
