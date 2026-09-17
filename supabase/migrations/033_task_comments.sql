-- Comments on a task card, and the reason the board needed them: the card's
-- words now belong to whoever wrote them. A director carrying someone else's
-- card can move it and tick its checklist, but the note itself is not theirs
-- to rewrite -- so what they have to say goes under the card, signed, instead
-- of silently inside prose someone else is on record as having written.
--
-- A child table rather than jsonb, unlike the checklist one migration up:
-- a checklist item has no identity outside its card, but a comment has an
-- author, and "who said this" is a join, not a field to keep honest by hand.
-- The FK is what makes a purged card take its thread with it.
CREATE TABLE IF NOT EXISTS public.director_task_comments (
  id serial PRIMARY KEY,
  task_id integer NOT NULL REFERENCES public.director_tasks(id) ON DELETE CASCADE,
  author_id integer REFERENCES public.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (btrim(body) <> '' AND char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Always read as "the thread under this card", oldest first.
CREATE INDEX IF NOT EXISTS director_task_comments_task_idx
  ON public.director_task_comments (task_id, created_at);

-- Same posture as every other table this app owns: the API is the only door.
-- RESTRICTIVE deny-all, so a future permissive policy cannot quietly open one.
ALTER TABLE public.director_task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.director_task_comments;
CREATE POLICY deny_all ON public.director_task_comments
  AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
