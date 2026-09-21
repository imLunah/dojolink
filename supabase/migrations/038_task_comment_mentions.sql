-- A mention is a notification addressed to one staff member about one task
-- comment. It is stored separately from the prose so the API, not a display
-- name parser, decides who was notified.
CREATE TABLE IF NOT EXISTS public.director_task_comment_mentions (
  id serial PRIMARY KEY,
  comment_id integer NOT NULL REFERENCES public.director_task_comments(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS director_task_comment_mentions_inbox_idx
  ON public.director_task_comment_mentions (user_id, read_at, created_at DESC);

ALTER TABLE public.director_task_comment_mentions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.director_task_comment_mentions;
CREATE POLICY deny_all ON public.director_task_comment_mentions
  AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
