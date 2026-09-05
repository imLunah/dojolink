-- 027_student_locations.sql
--
-- A ninja can belong to more than one center.
--
-- Until now a student was bound to exactly one center through
-- students.location_id, and every roster, board, report and parent view was
-- scoped by that one column. A family that attends two centers, or a ninja a
-- director wants on their roster while another center stays their home, had no
-- way to exist except as two records for one child, which the MyStudio import
-- already treats as a fault.
--
-- This mirrors what staff got in 010: users.location_id stayed as the HOME
-- center and user_locations carried membership. Here students.location_id
-- stays as the home center and student_locations carries membership. Home is
-- where the ninja was created and the one center that can archive them
-- outright; every other center can only add or remove its own membership row.
--
-- The backfill makes every existing ninja a member of their current center, so
-- membership = home ∪ these rows holds from the first read, and a route that
-- checks only this table sees exactly what it saw before.

CREATE TABLE IF NOT EXISTS public.student_locations (
  student_id  INTEGER NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  added_by    INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_student_locations_location ON public.student_locations (location_id);

INSERT INTO public.student_locations (student_id, location_id)
SELECT id, location_id FROM public.students WHERE location_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Same posture as every other table: the anon key ships in the bundle and RLS is
-- the only thing between it and this row. RESTRICTIVE deny_all for all roles.
ALTER TABLE public.student_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.student_locations;
CREATE POLICY deny_all ON public.student_locations AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.student_locations IS
  'Centers a ninja belongs to. students.location_id is their home; membership is home plus these rows.';
