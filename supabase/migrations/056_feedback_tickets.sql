-- 056_feedback_tickets.sql
--
-- Bug reports and feature ideas become tickets instead of emails.
--
-- A ticket arrives as 'new' and is seen only by admins and by whoever sent
-- it. An admin triages it by giving it a title and a status; from then on
-- every staff member sees that title and status on the Issues & roadmap page.
-- The reporter's own words, name, screenshot and browser details never leave
-- the admin view: a parent's report can name a child, and a title written by
-- an admin cannot.
--
-- Reporter is a staff user OR a parent (by email and the center their
-- session was made for). The name and role are a snapshot at submit time, so
-- a ticket still reads sensibly after the account is gone.

CREATE TABLE IF NOT EXISTS public.feedback_tickets (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature')),
  category TEXT NOT NULL DEFAULT 'Other' CHECK (char_length(category) <= 60),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'aware', 'planned', 'in_progress', 'resolved', 'wont_fix')),
  title TEXT CHECK (char_length(title) <= 120),
  reporter_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  reporter_parent_email TEXT,
  reporter_name TEXT,
  reporter_role TEXT,
  location_id INTEGER REFERENCES public.locations(id) ON DELETE SET NULL,
  page_url TEXT,
  user_agent TEXT,
  screen_size TEXT,
  console_errors JSONB,
  screenshot_path TEXT,
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  -- Nothing leaves the inbox without a title for everyone else to read.
  CONSTRAINT feedback_tickets_title_when_triaged CHECK (status = 'new' OR title IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS feedback_tickets_status_idx ON public.feedback_tickets (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS feedback_tickets_user_idx ON public.feedback_tickets (reporter_user_id);
CREATE INDEX IF NOT EXISTS feedback_tickets_parent_idx ON public.feedback_tickets (LOWER(reporter_parent_email), location_id);

ALTER TABLE public.feedback_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.feedback_tickets;
CREATE POLICY deny_all ON public.feedback_tickets
  AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
