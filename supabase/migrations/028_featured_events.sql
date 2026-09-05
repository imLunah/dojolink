-- 028: a calendar event can be featured on the Parent Portal.
-- A CD ticks "Feature on the Parent Portal" in the event form; the parent
-- home shows a banner for the soonest featured event until its day passes.
-- Only the title, date, time and type ever reach a parent — the description
-- is the staff notes field and stays out of the parent route on purpose.
ALTER TABLE events ADD COLUMN featured boolean NOT NULL DEFAULT false;
