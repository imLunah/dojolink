-- 052_student_support.sql
--
-- "Needs extra support": a staff-only mark on a ninja who needs a sensei
-- beside them more than most, so Reports can show when those ninjas are in
-- the room and a center can argue for staffing with numbers.
--
-- Its own table, not a column on students, on purpose: staff routes select
-- s.* from students, and a mark about a child must never ride along into the
-- parent portal or the kiosk by accident. One row per ninja; no row means no
-- mark. The reason is a fixed list so it stays factual and countable, with no
-- free text to turn into opinions about a child.

CREATE TABLE IF NOT EXISTS public.student_support (
  student_id INTEGER PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('one_to_one', 'settling_in', 'focus', 'learning')),
  set_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_support ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.student_support;
CREATE POLICY deny_all ON public.student_support
  AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
