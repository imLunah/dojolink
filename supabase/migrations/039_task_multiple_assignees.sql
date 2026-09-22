-- A task may be carried by several staff members. The old assignee_id column
-- stays during the sandbox rollout because production and preview share this
-- database; a trigger mirrors legacy single-person writes into this table.
CREATE TABLE IF NOT EXISTS public.director_task_assignees (
  task_id integer NOT NULL REFERENCES public.director_tasks(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS director_task_assignees_user_idx
  ON public.director_task_assignees (user_id, task_id);

INSERT INTO public.director_task_assignees (task_id, user_id)
SELECT id, assignee_id
FROM public.director_tasks
WHERE assignee_id IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

-- Old builds still write director_tasks.assignee_id. Mirror those writes so a
-- task edited there remains a truthful single-person assignment in new builds.
-- New builds write the legacy column first, then replace the mirrored row with
-- their complete set in the same transaction.
CREATE OR REPLACE FUNCTION public.sync_legacy_task_assignee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.director_task_assignees WHERE task_id = NEW.id;
  IF NEW.assignee_id IS NOT NULL THEN
    INSERT INTO public.director_task_assignees (task_id, user_id)
    VALUES (NEW.id, NEW.assignee_id)
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_legacy_task_assignee ON public.director_tasks;
CREATE TRIGGER sync_legacy_task_assignee
AFTER INSERT OR UPDATE OF assignee_id ON public.director_tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_task_assignee();

ALTER TABLE public.director_task_assignees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.director_task_assignees;
CREATE POLICY deny_all ON public.director_task_assignees
  AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
