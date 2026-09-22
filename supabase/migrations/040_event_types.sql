-- Event types belong to a center, and its directors make their own. Each has
-- a colour picked from a fixed palette (validated by the API, so every chip
-- keeps white text readable). events.type stays the label text; a type that
-- is deleted leaves its events labelled and drawn in the neutral grey.
CREATE TABLE IF NOT EXISTS public.event_types (
  id serial PRIMARY KEY,
  location_id integer NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
  color text NOT NULL CHECK (color ~ '^#[0-9a-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS event_types_location_label_idx
  ON public.event_types (location_id, lower(label));

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.event_types;
CREATE POLICY deny_all ON public.event_types
  AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

-- Every existing center starts with the same six. A center created later gets
-- them the first time its calendar asks (server/routes/events.js).
INSERT INTO public.event_types (location_id, label, color)
SELECT l.id, d.label, d.color
FROM public.locations l
CROSS JOIN (VALUES
  ('Create Game Building', '#2563eb'),
  ('JR Game Building',     '#0284c7'),
  ('Parents'' Night Out',  '#db2777'),
  ('Tournament',           '#ca8a04'),
  ('Holiday',              '#dc2626'),
  ('Other',                '#64748b')
) AS d(label, color)
ON CONFLICT DO NOTHING;

-- The game building variants fold into Create Game Building, which is what
-- they all were. JR Game Building and Parents' Night Out already match.
UPDATE public.events SET type = 'Create Game Building'
WHERE type IN ('Game Building', 'Walk-in Game Building');
