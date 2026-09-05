-- 029_event_listings.sql
--
-- Event listings: what a center is promoting to families, written for
-- families. A CD builds a listing (title, subtitle, link, banner image,
-- description) on its own page; the parent portal home shows the published
-- ones as a slideshow. This replaces the short-lived "featured" tick on
-- calendar events (028): a calendar event is staff-facing operational data,
-- and its notes field was never written for parents, so promoting one meant
-- either leaking the notes or showing a bare title. A listing is authored
-- for its audience from the first keystroke.
--
-- event_date is optional: set, the listing leaves the slideshow once the day
-- passes; unset, it stays until unpublished (an evergreen "join our club"
-- style promo).

CREATE TABLE IF NOT EXISTS public.event_listings (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  event_url TEXT,
  image_url TEXT,
  event_date DATE,
  event_time TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every public table keeps a RESTRICTIVE deny-all policy. The anon key is in
-- the bundle and RLS is the only thing standing in front of these rows.
ALTER TABLE public.event_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.event_listings;
CREATE POLICY deny_all ON public.event_listings AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

-- FK indexes, matching the posture of 013_fk_indexes.sql.
CREATE INDEX IF NOT EXISTS idx_event_listings_location_id ON public.event_listings (location_id);
CREATE INDEX IF NOT EXISTS idx_event_listings_created_by ON public.event_listings (created_by);

-- The calendar-side flag this feature replaces.
ALTER TABLE public.events DROP COLUMN IF EXISTS featured;
