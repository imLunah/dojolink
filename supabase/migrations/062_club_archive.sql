-- 062_club_archive.sql
--
-- A club that has stopped running can be archived instead of deleted. It
-- leaves the club list, the pickers used to log and check in a club session,
-- and the kiosk's class-name dropdown, and a kiosk class still mapped to it
-- stops filing check-ins into it. Its sessions, attendance, notes and board
-- stay, and its page still opens from an old session. Restoring clears it.

ALTER TABLE public.club_definitions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
