-- 053_mystudio_remembered_until.sql
--
-- How long MyStudio remembers the device a director last typed a code on.
--
-- The session itself lasts a day, but "Remember for 30 days" lets DojoLink
-- sign in again with the saved password and no code until this moment. After
-- it, the next renewal would email a code, so nothing tries past it.
--
-- NULL means there is no remembered device to use (a pasted cookie, or a
-- renewal that MyStudio answered with a code instead).

ALTER TABLE public.mystudio_connections
  ADD COLUMN IF NOT EXISTS remembered_until TIMESTAMPTZ;

-- Every connection with a saved password was made through the code sign-in,
-- which sets the thirty day pair at the same moment the password is saved.
UPDATE public.mystudio_connections
   SET remembered_until = login_saved_at + interval '30 days'
 WHERE login_saved_at IS NOT NULL
   AND remembered_until IS NULL;
