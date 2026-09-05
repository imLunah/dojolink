-- 031_parent_profiles.sql
--
-- A parent's own record. Until now a parent was three columns copied onto
-- each ninja's row (parent_name, parent_email, parent_phone), typed by the
-- front desk, and the portal printed whatever was there. First sign-in now
-- walks the parent through onboarding: their name, phone and relationship
-- to the ninja, printed on their own ID card. Keyed by email, lowercased,
-- because the email is the identity the portal signs in with and one parent
-- at two centers is still one parent. A row existing is what "onboarded"
-- means; the portal sends a parent without one to /parent/welcome.

CREATE TABLE IF NOT EXISTS public.parent_profiles (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  relationship TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT parent_profiles_email_lower CHECK (email = lower(email)),
  CONSTRAINT parent_profiles_relationship_check CHECK (
    relationship IS NULL OR relationship IN ('Mom', 'Dad', 'Guardian', 'Grandparent', 'Other')
  )
);

-- Every public table keeps a RESTRICTIVE deny-all policy. The anon key is in
-- the bundle and RLS is the only thing standing in front of these rows.
ALTER TABLE public.parent_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.parent_profiles;
CREATE POLICY deny_all ON public.parent_profiles AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
