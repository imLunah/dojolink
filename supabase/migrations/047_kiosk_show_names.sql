-- 047_kiosk_show_names.sql
--
-- Whether the kiosk lists names before anyone searches. true (the default,
-- and how the kiosk has behaved) shows the center's list, or a class's roster,
-- as soon as the screen opens; false shows nobody until a family types at
-- least two letters. Enforced on the server, so a hidden list is never sent.

ALTER TABLE public.mystudio_kiosks
  ADD COLUMN IF NOT EXISTS show_names BOOLEAN NOT NULL DEFAULT true;
