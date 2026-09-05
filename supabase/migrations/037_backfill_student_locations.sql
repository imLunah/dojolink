-- Every ninja belongs to the center that made them, again.
--
-- 027 created student_locations and backfilled it from students.location_id,
-- and from then on every read of "is this ninja at this center" asks the
-- membership table alone. That is only complete if every creation path writes
-- the membership row, and for a fortnight one did not: production runs an
-- older build than the one 027 shipped alongside, so it kept inserting
-- students with a home column and no membership. Thirty ninjas ended up on
-- nobody's roster, which is why a center with five ninjas checked in read as
-- empty on the parent portal's busy chart.
--
-- This repeats 027's backfill for anyone who arrived since. It is the same
-- rule -- a student's home center is a membership -- and it is idempotent, so
-- running it again after the fixed build ships is a no-op.
INSERT INTO student_locations (student_id, location_id)
SELECT s.id, s.location_id
FROM students s
WHERE s.location_id IS NOT NULL
ON CONFLICT (student_id, location_id) DO NOTHING;
