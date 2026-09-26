-- 063_impact_connections.sql
--
-- Experimental: read who is in the dojo right now out of IMPACT, Code Ninjas'
-- own sensei platform, so DojoLink can draw the Live Ninjas countdown and keep
-- it current on its own.
--
-- One connection per location, like mystudio_connections. A director signs in
-- with their IMPACT email and password once; the password is kept (encrypted)
-- because an IMPACT refresh token only lives 24 hours, and a center nobody
-- looks at over a weekend would otherwise need signing in again every Monday.
--
-- login_secret, access_token and refresh_token are live credentials for a
-- system holding children's records. All three are AES-256-GCM under
-- MYSTUDIO_ENC_KEY, never returned by a route, never logged. RLS below is what
-- keeps them away from the anon key in the client bundle.

CREATE TABLE IF NOT EXISTS public.impact_connections (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL UNIQUE REFERENCES public.locations(id) ON DELETE CASCADE,
  connected_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  facility_guid TEXT NOT NULL,
  facility_name TEXT,
  login_email TEXT NOT NULL,
  login_secret TEXT NOT NULL,
  access_token TEXT,
  access_expires_at TIMESTAMPTZ,
  refresh_token TEXT,
  refresh_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected',
  last_error TEXT,
  last_verified_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT impact_connections_status_check CHECK (status IN ('connected', 'expired'))
);

ALTER TABLE public.impact_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.impact_connections;
CREATE POLICY deny_all ON public.impact_connections AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_impact_connections_connected_by
  ON public.impact_connections (connected_by);
