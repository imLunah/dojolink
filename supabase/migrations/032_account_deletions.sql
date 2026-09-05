-- 032_account_deletions.sql
--
-- Why people leave. When a parent or a staff member deletes their own
-- account, the one thing kept is the reason they gave: which role, which
-- center, which of the fixed reasons, and whatever they typed. No name, no
-- email, no user id — the row has to outlive the account it describes, and
-- an account deletion that leaves the person identifiable is not one.

CREATE TABLE IF NOT EXISTS public.account_deletions (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('parent', 'sensei', 'manager')),
  location_id INTEGER REFERENCES public.locations(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('leaving', 'not_useful', 'privacy', 'broken', 'other')),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every public table keeps a RESTRICTIVE deny-all policy. The anon key is in
-- the bundle and RLS is the only thing standing in front of these rows.
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.account_deletions;
CREATE POLICY deny_all ON public.account_deletions AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_account_deletions_location_id ON public.account_deletions (location_id);
