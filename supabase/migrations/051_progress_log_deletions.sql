-- 051_progress_log_deletions.sql
--
-- Any staff member at a center may delete a progress log there, not only the
-- sensei who wrote it. The delete is still a real delete, so this table keeps
-- a copy of what went and who removed it: a log deleted by mistake, or by
-- someone who should not have, can be read back and restored by hand.
--
-- `log` is the whole progress_logs row as it was, and `comments` the thread
-- that cascaded away with it. No foreign keys on purpose: the log is gone, and
-- the record has to outlive the student or the user it names.

CREATE TABLE IF NOT EXISTS public.progress_log_deletions (
  id SERIAL PRIMARY KEY,
  log_id INTEGER NOT NULL,
  student_id INTEGER,
  location_id INTEGER,
  deleted_by INTEGER,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  log JSONB NOT NULL,
  comments JSONB
);

CREATE INDEX IF NOT EXISTS progress_log_deletions_student_idx
  ON public.progress_log_deletions (student_id, deleted_at DESC);

ALTER TABLE public.progress_log_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.progress_log_deletions;
CREATE POLICY deny_all ON public.progress_log_deletions
  AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
