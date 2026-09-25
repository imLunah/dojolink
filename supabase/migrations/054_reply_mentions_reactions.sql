-- 054_reply_mentions_reactions.sql
--
-- Replies on progress logs and club sessions work like chat messages: they can
-- name a colleague with @, carry emoji reactions, and say when they were
-- edited.
--
-- Mentions are records, not parsed names, exactly as on task comments (038):
-- the server decides who was addressed and re-checks each one belongs to the
-- center. read_at is there for the day mentions notify somebody; nothing reads
-- it yet.
--
-- Reactions follow the rule in server/lib/reactions.js: one table per subject,
-- so a real foreign key takes a reply's reactions with it when it is deleted.
-- The emoji CHECK is the same backstop every reaction table carries.

ALTER TABLE public.progress_log_comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.club_session_comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE TABLE IF NOT EXISTS public.progress_log_comment_mentions (
  id serial PRIMARY KEY,
  comment_id integer NOT NULL REFERENCES public.progress_log_comments(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS progress_log_comment_mentions_inbox_idx
  ON public.progress_log_comment_mentions (user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS public.club_session_comment_mentions (
  id serial PRIMARY KEY,
  comment_id integer NOT NULL REFERENCES public.club_session_comments(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS club_session_comment_mentions_inbox_idx
  ON public.club_session_comment_mentions (user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS public.progress_log_comment_reactions (
  id serial PRIMARY KEY,
  comment_id integer NOT NULL REFERENCES public.progress_log_comments(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 24 AND emoji !~ '[A-Za-z0-9[:space:]]'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progress_log_comment_reactions_unique UNIQUE (comment_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.club_session_comment_reactions (
  id serial PRIMARY KEY,
  comment_id integer NOT NULL REFERENCES public.club_session_comments(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 24 AND emoji !~ '[A-Za-z0-9[:space:]]'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_session_comment_reactions_unique UNIQUE (comment_id, user_id, emoji)
);

ALTER TABLE public.progress_log_comment_mentions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.progress_log_comment_mentions;
CREATE POLICY deny_all ON public.progress_log_comment_mentions
  AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE public.club_session_comment_mentions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.club_session_comment_mentions;
CREATE POLICY deny_all ON public.club_session_comment_mentions
  AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE public.progress_log_comment_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.progress_log_comment_reactions;
CREATE POLICY deny_all ON public.progress_log_comment_reactions
  AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE public.club_session_comment_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all ON public.club_session_comment_reactions;
CREATE POLICY deny_all ON public.club_session_comment_reactions
  AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
