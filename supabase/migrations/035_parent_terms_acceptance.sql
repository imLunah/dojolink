-- 035_parent_terms_acceptance.sql
--
-- When a parent agreed to the Terms and the Privacy Policy, and to which
-- version of them.
--
-- The point of a consent record is that it survives the thing being consented
-- to changing, so the VERSION is stored beside the timestamp rather than
-- inferred. `/terms` and `/privacy` carry a "Last Updated" date; that date is
-- the version string, and it is the one thing that tells you later whether a
-- parent agreed to what is on the page today or to something older. Without
-- it a re-consent prompt has nothing to compare against.
--
-- Both columns are NULLABLE and that is deliberate:
--
--   * Parents who onboarded BEFORE this shipped have a profile row and no
--     acceptance. They are not being back-dated to a date they never saw —
--     a consent record you invented is worse than no record. NULL means "we
--     do not have one", which is the truth, and it is what a later prompt
--     would key on.
--   * The settings page saves through the same route as onboarding, and a
--     parent editing their name must not have their acceptance blanked or
--     re-stamped. The write path uses COALESCE for exactly that.
--
-- NOT NULL is therefore not available here and should not be added later
-- without first deciding what to do about the existing rows.

ALTER TABLE public.parent_profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT;

COMMENT ON COLUMN public.parent_profiles.terms_accepted_at IS
  'When this parent agreed to the Terms and Privacy Policy during onboarding. NULL for profiles created before acceptance was recorded.';
COMMENT ON COLUMN public.parent_profiles.terms_version IS
  'The "Last Updated" date of the Terms the parent agreed to, so a later revision can tell who has not seen the current one.';
