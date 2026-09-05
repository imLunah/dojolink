-- 030_checked_in_at.sql
--
-- When a ninja was actually checked in. created_at is the row's birth, and
-- the two part ways on one path: a check-in that reuses an overdue unlogged
-- session moves that row to today and keeps its old created_at, which then
-- says the ninja arrived at whatever time they arrived the first time. The
-- parent portal's live schedule buckets arrivals by hour, so it needs the
-- arrival, not the row.

ALTER TABLE public.daily_assignments
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.daily_assignments
   SET checked_in_at = created_at
 WHERE created_at IS NOT NULL;
