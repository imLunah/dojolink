-- 057_ticket_status_notifications.sql
--
-- When an admin moves a ticket to a new status, the staff member who sent it
-- hears about it on their bell. The ticket carries the notification itself,
-- the same way a task assignment row does (055): when the status last
-- changed, who changed it, and when the reporter read that. A change resets
-- the read, so each move rings once.

ALTER TABLE public.feedback_tickets
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reporter_read_at timestamptz;

CREATE INDEX IF NOT EXISTS feedback_tickets_reporter_inbox_idx
  ON public.feedback_tickets (reporter_user_id, reporter_read_at, status_changed_at DESC)
  WHERE status_changed_at IS NOT NULL;
