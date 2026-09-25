-- 055_task_assignment_notifications.sql
--
-- Being put on a task is a notification, like being @mentioned. The
-- assignment row already says who and when; it gains who did the assigning
-- (for "Sam assigned you ...") and when the assignee read it.
--
-- Every assignment that exists before this is marked read, so switching the
-- feature on does not greet everybody with a backlog of cards they already
-- know about.

ALTER TABLE public.director_task_assignees
  ADD COLUMN IF NOT EXISTS assigned_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

UPDATE public.director_task_assignees SET read_at = now() WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS director_task_assignees_inbox_idx
  ON public.director_task_assignees (user_id, read_at, assigned_at DESC);
