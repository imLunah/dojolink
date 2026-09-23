-- 049_mystudio_feature_kiosk.sql
--
-- A third per-center switch beside the booked list and the roster import (025):
-- whether this connection runs the check-in kiosk here.
--
-- Defaults true because every center already runs the kiosk, so existing
-- connections keep behaving exactly as they did. Off is a deliberate act.
--
-- Enforced on the server: a center with this off reads to every kiosk route as
-- blocked, the same way a lapsed connection does.

ALTER TABLE public.mystudio_connections
  ADD COLUMN IF NOT EXISTS feature_kiosk BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.mystudio_connections.feature_kiosk IS
  'Run the MyStudio check-in kiosk at this center.';
