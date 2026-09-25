-- 059_parent_sign_ins.sql
--
-- When a parent last signed in to the portal. A parent_profiles row says a
-- parent finished onboarding, and until now nothing said whether one who had
-- NOT finished had ever got as far as signing in: "never opened it" and
-- "signed in and stopped at the welcome form" looked the same from the desk,
-- and they call for different conversations. Admin > Parents reads this.
--
-- Keyed by email, lowercased, like parent_profiles, because the email is the
-- portal identity and one parent at two centers is one parent.
--
-- Backfilled from the parent sessions still alive in the session table, with
-- no date, because the session row does not say when it was made. A NULL
-- last_signed_in_at means "signed in before this was recorded".

CREATE TABLE IF NOT EXISTS public.parent_sign_ins (
  email TEXT PRIMARY KEY,
  last_signed_in_at TIMESTAMPTZ,
  CONSTRAINT parent_sign_ins_email_lower CHECK (email = lower(email))
);

ALTER TABLE public.parent_sign_ins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.parent_sign_ins;
CREATE POLICY deny_all ON public.parent_sign_ins AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

INSERT INTO public.parent_sign_ins (email)
SELECT DISTINCT lower(sess->>'parentEmail')
  FROM public.session
 WHERE sess->>'parentEmail' IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- Everyone who finished onboarding signed in to do it.
INSERT INTO public.parent_sign_ins (email)
SELECT email FROM public.parent_profiles
ON CONFLICT (email) DO NOTHING;
