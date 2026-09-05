--
-- PostgreSQL database dump
--

\restrict Oi8MtR0VzRW1wm3hbWBU2ZsfRqnq5VADASgC873dTUb4ceW8fR0OJqKdhADNl93

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Debian 17.10-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id integer NOT NULL,
    location_id integer NOT NULL,
    title character varying(100) NOT NULL,
    message text NOT NULL,
    visible_from date DEFAULT CURRENT_DATE NOT NULL,
    visible_until date,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value text,
    updated_by integer,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: belt_level_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.belt_level_projects (
    id integer NOT NULL,
    belt_name text NOT NULL,
    sublevel integer NOT NULL,
    project_name text NOT NULL,
    project_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: belt_level_projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.belt_level_projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: belt_level_projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.belt_level_projects_id_seq OWNED BY public.belt_level_projects.id;


--
-- Name: club_attendees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_attendees (
    id integer NOT NULL,
    club_session_id integer NOT NULL,
    student_id integer NOT NULL
);


--
-- Name: club_attendees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.club_attendees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: club_attendees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.club_attendees_id_seq OWNED BY public.club_attendees.id;


--
-- Name: club_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_definitions (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    color_key text DEFAULT 'blue'::text NOT NULL,
    location_id integer,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    schedule text,
    cover_image_url text
);


--
-- Name: club_definitions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.club_definitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: club_definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.club_definitions_id_seq OWNED BY public.club_definitions.id;


--
-- Name: club_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_members (
    id integer NOT NULL,
    club_name text NOT NULL,
    location_id integer,
    student_id integer,
    joined_at timestamp with time zone DEFAULT now()
);


--
-- Name: club_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.club_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: club_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.club_members_id_seq OWNED BY public.club_members.id;


--
-- Name: club_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_profiles (
    id integer NOT NULL,
    club_name text NOT NULL,
    location_id integer NOT NULL,
    pinned_note text,
    pinned_note_author text,
    pinned_note_updated_at timestamp with time zone
);


--
-- Name: club_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.club_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: club_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.club_profiles_id_seq OWNED BY public.club_profiles.id;


--
-- Name: club_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_resources (
    id integer NOT NULL,
    club_name text NOT NULL,
    location_id integer NOT NULL,
    title text NOT NULL,
    url text NOT NULL,
    added_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    resource_type text DEFAULT 'url'::text NOT NULL,
    file_name text
);


--
-- Name: club_resources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.club_resources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: club_resources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.club_resources_id_seq OWNED BY public.club_resources.id;


--
-- Name: club_session_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_session_comments (
    id integer NOT NULL,
    session_id integer NOT NULL,
    user_id integer,
    user_name text,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: club_session_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.club_session_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: club_session_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.club_session_comments_id_seq OWNED BY public.club_session_comments.id;


--
-- Name: club_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_sessions (
    id integer NOT NULL,
    club_name text NOT NULL,
    session_date date DEFAULT CURRENT_DATE NOT NULL,
    location_id integer NOT NULL,
    sensei_id integer,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: club_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.club_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: club_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.club_sessions_id_seq OWNED BY public.club_sessions.id;


--
-- Name: curriculum_lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.curriculum_lessons (
    id integer NOT NULL,
    module_id integer NOT NULL,
    lesson_name text NOT NULL,
    lesson_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: curriculum_lessons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.curriculum_lessons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: curriculum_lessons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.curriculum_lessons_id_seq OWNED BY public.curriculum_lessons.id;


--
-- Name: curriculum_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.curriculum_modules (
    id integer NOT NULL,
    program text NOT NULL,
    sub_program text,
    module_name text NOT NULL,
    module_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    description text
);


--
-- Name: curriculum_modules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.curriculum_modules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: curriculum_modules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.curriculum_modules_id_seq OWNED BY public.curriculum_modules.id;


--
-- Name: daily_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parent_profiles (
    id integer NOT NULL,
    email text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text,
    relationship text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parent_profiles_email_lower CHECK ((email = lower(email))),
    CONSTRAINT parent_profiles_relationship_check CHECK (((relationship IS NULL) OR (relationship = ANY (ARRAY['Mom'::text, 'Dad'::text, 'Guardian'::text, 'Grandparent'::text, 'Other'::text]))))
);

CREATE SEQUENCE public.parent_profiles_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.parent_profiles_id_seq OWNED BY public.parent_profiles.id;
ALTER TABLE ONLY public.parent_profiles ALTER COLUMN id SET DEFAULT nextval('public.parent_profiles_id_seq'::regclass);
ALTER TABLE ONLY public.parent_profiles ADD CONSTRAINT parent_profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.parent_profiles ADD CONSTRAINT parent_profiles_email_key UNIQUE (email);


CREATE TABLE public.account_deletions (
    id integer NOT NULL,
    role text NOT NULL,
    location_id integer,
    reason text NOT NULL,
    details text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_deletions_role_check CHECK ((role = ANY (ARRAY['parent'::text, 'sensei'::text, 'manager'::text]))),
    CONSTRAINT account_deletions_reason_check CHECK ((reason = ANY (ARRAY['leaving'::text, 'not_useful'::text, 'privacy'::text, 'broken'::text, 'other'::text])))
);

CREATE SEQUENCE public.account_deletions_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.account_deletions_id_seq OWNED BY public.account_deletions.id;
ALTER TABLE ONLY public.account_deletions ALTER COLUMN id SET DEFAULT nextval('public.account_deletions_id_seq'::regclass);
ALTER TABLE ONLY public.account_deletions ADD CONSTRAINT account_deletions_pkey PRIMARY KEY (id);


CREATE TABLE public.daily_assignments (
    id integer NOT NULL,
    student_id integer NOT NULL,
    sensei_id integer,
    session_date date NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    program text,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT daily_assignments_program_check CHECK (((program IS NULL) OR (program = ANY (ARRAY['CREATE'::text, 'Robotics Academy'::text, 'AI Academy'::text, 'JR'::text, 'VR Coding'::text]))))
);


--
-- Name: daily_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_assignments_id_seq OWNED BY public.daily_assignments.id;


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    active boolean DEFAULT true NOT NULL
);


--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- Name: onboarding_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_steps (
    id integer NOT NULL,
    title text NOT NULL,
    body_md text DEFAULT ''::text NOT NULL,
    media jsonb DEFAULT '[]'::jsonb NOT NULL,
    audience text DEFAULT 'all'::text NOT NULL,
    step_order integer DEFAULT 0 NOT NULL,
    published boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT onboarding_steps_audience_check CHECK ((audience = ANY (ARRAY['all'::text, 'sensei'::text, 'manager'::text])))
);


--
-- Name: onboarding_steps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.onboarding_steps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: onboarding_steps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.onboarding_steps_id_seq OWNED BY public.onboarding_steps.id;


--
-- Name: progress_log_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progress_log_comments (
    id integer NOT NULL,
    log_id integer NOT NULL,
    user_id integer,
    user_name text,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: progress_log_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.progress_log_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: progress_log_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.progress_log_comments_id_seq OWNED BY public.progress_log_comments.id;


--
-- Name: progress_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progress_logs (
    id integer NOT NULL,
    student_id integer NOT NULL,
    sensei_id integer,
    session_date date NOT NULL,
    belt_level_at text,
    belt_sublevel_at integer,
    project_at text,
    status_at text,
    notes text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    program text,
    sub_program text,
    module_name text,
    lesson_name text,
    CONSTRAINT progress_logs_program_check CHECK (((program IS NULL) OR (program = ANY (ARRAY['CREATE'::text, 'Robotics Academy'::text, 'AI Academy'::text, 'JR'::text, 'VR Coding'::text]))))
);


--
-- Name: progress_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.progress_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: progress_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.progress_logs_id_seq OWNED BY public.progress_logs.id;


--
-- Name: releases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.releases (
    id integer NOT NULL,
    title text NOT NULL,
    version text,
    body_md text DEFAULT ''::text NOT NULL,
    media jsonb DEFAULT '[]'::jsonb NOT NULL,
    published boolean DEFAULT false,
    published_at timestamp with time zone,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: releases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.releases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: releases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.releases_id_seq OWNED BY public.releases.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: student_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_programs (
    id integer NOT NULL,
    student_id integer NOT NULL,
    program text NOT NULL,
    belt_level text,
    belt_sublevel integer,
    current_project text,
    project_status text,
    created_at timestamp with time zone DEFAULT now(),
    last_sub_program text,
    last_module_name text,
    last_lesson_name text,
    last_session_date date,
    percent_complete integer DEFAULT 0,
    CONSTRAINT student_programs_program_check CHECK ((program = ANY (ARRAY['CREATE'::text, 'Robotics Academy'::text, 'AI Academy'::text, 'JR'::text, 'VR Coding'::text]))),
    CONSTRAINT student_programs_project_status_check CHECK ((project_status = ANY (ARRAY['Started'::text, 'Working On'::text, 'Completed'::text])))
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id integer NOT NULL,
    full_name text NOT NULL,
    birthday date,
    active boolean DEFAULT true NOT NULL,
    location_id integer,
    created_at timestamp with time zone DEFAULT now(),
    pinned_note text,
    parent_name text,
    parent_email text,
    parent_phone text,
    special_instructions text,
    parent_note text,
    codeorg_sticker text,
    CONSTRAINT students_codeorg_sticker_check CHECK (((codeorg_sticker IS NULL) OR (codeorg_sticker = ANY (ARRAY['alien'::text, 'bat'::text, 'bird'::text, 'cat'::text, 'dinosaur'::text, 'dog'::text, 'dragon'::text, 'ghost'::text, 'knight'::text, 'monster'::text, 'ninja'::text, 'ninja2'::text, 'octopus'::text, 'penguin'::text, 'pirate'::text, 'princess'::text, 'robot'::text, 'spacebot'::text, 'squirrel'::text, 'unicorn'::text, 'witch'::text, 'wizard'::text, 'zombie'::text]))))
);


--
-- Name: student_monthly_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.student_monthly_summary WITH (security_invoker='on') AS
 SELECT s.id AS student_id,
    s.full_name,
    s.parent_name,
    s.parent_email,
    s.location_id,
    l.name AS location_name,
    create_p.belt_level AS create_belt,
    create_p.belt_sublevel AS create_belt_sublevel,
        CASE
            WHEN (create_p.belt_level = 'White'::text) THEN round((((create_p.belt_sublevel)::double precision / (8)::double precision) * (100)::double precision))
            WHEN (create_p.belt_level = 'Yellow'::text) THEN round((((create_p.belt_sublevel)::double precision / (10)::double precision) * (100)::double precision))
            WHEN (create_p.belt_level = 'Orange'::text) THEN round((((create_p.belt_sublevel)::double precision / (12)::double precision) * (100)::double precision))
            WHEN (create_p.belt_level = 'Green'::text) THEN round((((create_p.belt_sublevel)::double precision / (10)::double precision) * (100)::double precision))
            WHEN (create_p.belt_level = 'Blue'::text) THEN round((((create_p.belt_sublevel)::double precision / (3)::double precision) * (100)::double precision))
            ELSE NULL::double precision
        END AS create_belt_percent,
    create_p.current_project AS create_current_project,
    create_p.project_status AS create_project_status,
    create_p.last_session_date AS create_last_session_date,
    ( SELECT count(DISTINCT progress_logs.session_date) AS count
           FROM public.progress_logs
          WHERE ((progress_logs.student_id = s.id) AND (progress_logs.program = 'CREATE'::text) AND (progress_logs.session_date >= date_trunc('month'::text, now())))) AS create_sessions_this_month,
    jr_p.last_sub_program AS jr_last_sub_program,
    jr_p.last_module_name AS jr_last_module,
    jr_p.last_lesson_name AS jr_last_lesson,
    jr_p.last_session_date AS jr_last_session_date,
    ( SELECT count(DISTINCT progress_logs.session_date) AS count
           FROM public.progress_logs
          WHERE ((progress_logs.student_id = s.id) AND (progress_logs.program = 'JR'::text) AND (progress_logs.session_date >= date_trunc('month'::text, now())))) AS jr_sessions_this_month,
    ro_p.last_sub_program AS robotics_last_sub_program,
    ro_p.last_module_name AS robotics_last_module,
    ro_p.last_lesson_name AS robotics_last_lesson,
    ro_p.last_session_date AS robotics_last_session_date,
    ( SELECT count(DISTINCT progress_logs.session_date) AS count
           FROM public.progress_logs
          WHERE ((progress_logs.student_id = s.id) AND (progress_logs.program = 'Robotics Academy'::text) AND (progress_logs.session_date >= date_trunc('month'::text, now())))) AS robotics_sessions_this_month,
    ai_p.last_sub_program AS ai_last_sub_program,
    ai_p.last_module_name AS ai_last_module,
    ai_p.last_lesson_name AS ai_last_lesson,
    ai_p.last_session_date AS ai_last_session_date,
    ( SELECT count(DISTINCT progress_logs.session_date) AS count
           FROM public.progress_logs
          WHERE ((progress_logs.student_id = s.id) AND (progress_logs.program = 'AI Academy'::text) AND (progress_logs.session_date >= date_trunc('month'::text, now())))) AS ai_sessions_this_month,
    ( SELECT count(*) AS count
           FROM ( SELECT DISTINCT progress_logs.program,
                    progress_logs.session_date
                   FROM public.progress_logs
                  WHERE ((progress_logs.student_id = s.id) AND (progress_logs.session_date >= date_trunc('month'::text, now())))) x) AS total_sessions_this_month,
    ( SELECT string_agg(DISTINCT cs.club_name, ', '::text ORDER BY cs.club_name) AS string_agg
           FROM (public.club_attendees ca
             JOIN public.club_sessions cs ON ((ca.club_session_id = cs.id)))
          WHERE ((ca.student_id = s.id) AND (cs.session_date >= date_trunc('month'::text, now())))) AS clubs_attended_this_month,
    ( SELECT count(DISTINCT cs.session_date) AS count
           FROM (public.club_attendees ca
             JOIN public.club_sessions cs ON ((ca.club_session_id = cs.id)))
          WHERE ((ca.student_id = s.id) AND (cs.session_date >= date_trunc('month'::text, now())))) AS club_sessions_this_month,
    ro_p.percent_complete AS robotics_percent_complete,
    ai_p.percent_complete AS ai_percent_complete,
    create_p.current_project AS create_last_lesson,
    jr_p.percent_complete AS jr_percent_complete
   FROM (((((public.students s
     JOIN public.locations l ON ((l.id = s.location_id)))
     LEFT JOIN public.student_programs create_p ON (((create_p.student_id = s.id) AND (create_p.program = 'CREATE'::text))))
     LEFT JOIN public.student_programs jr_p ON (((jr_p.student_id = s.id) AND (jr_p.program = 'JR'::text))))
     LEFT JOIN public.student_programs ro_p ON (((ro_p.student_id = s.id) AND (ro_p.program = 'Robotics Academy'::text))))
     LEFT JOIN public.student_programs ai_p ON (((ai_p.student_id = s.id) AND (ai_p.program = 'AI Academy'::text))))
  WHERE ((s.active = true) AND (s.parent_email IS NOT NULL) AND (s.parent_email <> ''::text) AND ((EXISTS ( SELECT 1
           FROM public.progress_logs pl
          WHERE ((pl.student_id = s.id) AND (pl.session_date >= date_trunc('month'::text, now()))))) OR (EXISTS ( SELECT 1
           FROM (public.club_attendees ca
             JOIN public.club_sessions cs ON ((ca.club_session_id = cs.id)))
          WHERE ((ca.student_id = s.id) AND (cs.session_date >= date_trunc('month'::text, now())))))));


--
-- Name: student_programs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.student_programs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: student_programs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.student_programs_id_seq OWNED BY public.student_programs.id;


--
-- Name: student_progress_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.student_progress_summary WITH (security_invoker='on') AS
 SELECT s.id AS student_id,
    s.full_name,
    s.parent_name,
    s.parent_email,
    s.location_id,
    l.name AS location_name,
    sp.program,
    sp.belt_level,
    sp.belt_sublevel,
    sp.current_project,
    sp.project_status,
        CASE
            WHEN ((sp.belt_level IS NULL) OR (sp.belt_sublevel IS NULL)) THEN NULL::double precision
            WHEN (sp.belt_level = 'White'::text) THEN round((((sp.belt_sublevel)::double precision / (8)::double precision) * (100)::double precision))
            WHEN (sp.belt_level = 'Yellow'::text) THEN round((((sp.belt_sublevel)::double precision / (10)::double precision) * (100)::double precision))
            WHEN (sp.belt_level = 'Orange'::text) THEN round((((sp.belt_sublevel)::double precision / (12)::double precision) * (100)::double precision))
            WHEN (sp.belt_level = 'Green'::text) THEN round((((sp.belt_sublevel)::double precision / (10)::double precision) * (100)::double precision))
            WHEN (sp.belt_level = 'Blue'::text) THEN round((((sp.belt_sublevel)::double precision / (3)::double precision) * (100)::double precision))
            ELSE NULL::double precision
        END AS belt_percent_complete,
    ( SELECT count(*) AS count
           FROM public.progress_logs pl
          WHERE ((pl.student_id = s.id) AND (pl.session_date >= date_trunc('month'::text, now())))) AS sessions_this_month,
    ( SELECT max(pl.session_date) AS max
           FROM public.progress_logs pl
          WHERE (pl.student_id = s.id)) AS last_session_date,
    ( SELECT count(*) AS count
           FROM (public.club_attendees ca
             JOIN public.club_sessions cs ON ((ca.club_session_id = cs.id)))
          WHERE ((ca.student_id = s.id) AND (cs.session_date >= date_trunc('month'::text, now())))) AS club_sessions_this_month,
    ( SELECT string_agg(DISTINCT cs.club_name, ', '::text ORDER BY cs.club_name) AS string_agg
           FROM (public.club_attendees ca
             JOIN public.club_sessions cs ON ((ca.club_session_id = cs.id)))
          WHERE ((ca.student_id = s.id) AND (cs.session_date >= date_trunc('month'::text, now())))) AS clubs_attended_this_month
   FROM ((public.students s
     JOIN public.locations l ON ((l.id = s.location_id)))
     JOIN public.student_programs sp ON ((sp.student_id = s.id)))
  WHERE ((s.active = true) AND (s.parent_email IS NOT NULL) AND (s.parent_email <> ''::text));


--
-- Name: students_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.students_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: students_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;


--
-- Name: user_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_locations (
    user_id integer NOT NULL,
    location_id integer NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    display_name text NOT NULL,
    role text NOT NULL,
    location_id integer,
    created_at timestamp with time zone DEFAULT now(),
    active boolean DEFAULT true NOT NULL,
    profile_pic_url text,
    must_reset_password boolean DEFAULT false,
    last_seen_release_at timestamp with time zone,
    onboarded_at timestamp with time zone,
    theme_mode text,
    theme_accent text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['manager'::text, 'sensei'::text, 'admin'::text])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: belt_level_projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.belt_level_projects ALTER COLUMN id SET DEFAULT nextval('public.belt_level_projects_id_seq'::regclass);


--
-- Name: club_attendees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_attendees ALTER COLUMN id SET DEFAULT nextval('public.club_attendees_id_seq'::regclass);


--
-- Name: club_definitions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_definitions ALTER COLUMN id SET DEFAULT nextval('public.club_definitions_id_seq'::regclass);


--
-- Name: club_members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_members ALTER COLUMN id SET DEFAULT nextval('public.club_members_id_seq'::regclass);


--
-- Name: club_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_profiles ALTER COLUMN id SET DEFAULT nextval('public.club_profiles_id_seq'::regclass);


--
-- Name: club_resources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_resources ALTER COLUMN id SET DEFAULT nextval('public.club_resources_id_seq'::regclass);


--
-- Name: club_session_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_session_comments ALTER COLUMN id SET DEFAULT nextval('public.club_session_comments_id_seq'::regclass);


--
-- Name: club_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_sessions ALTER COLUMN id SET DEFAULT nextval('public.club_sessions_id_seq'::regclass);


--
-- Name: curriculum_lessons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_lessons ALTER COLUMN id SET DEFAULT nextval('public.curriculum_lessons_id_seq'::regclass);


--
-- Name: curriculum_modules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_modules ALTER COLUMN id SET DEFAULT nextval('public.curriculum_modules_id_seq'::regclass);


--
-- Name: daily_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_assignments ALTER COLUMN id SET DEFAULT nextval('public.daily_assignments_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- Name: onboarding_steps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_steps ALTER COLUMN id SET DEFAULT nextval('public.onboarding_steps_id_seq'::regclass);


--
-- Name: progress_log_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_log_comments ALTER COLUMN id SET DEFAULT nextval('public.progress_log_comments_id_seq'::regclass);


--
-- Name: progress_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_logs ALTER COLUMN id SET DEFAULT nextval('public.progress_logs_id_seq'::regclass);


--
-- Name: releases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releases ALTER COLUMN id SET DEFAULT nextval('public.releases_id_seq'::regclass);


--
-- Name: student_programs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_programs ALTER COLUMN id SET DEFAULT nextval('public.student_programs_id_seq'::regclass);


--
-- Name: students id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: belt_level_projects belt_level_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.belt_level_projects
    ADD CONSTRAINT belt_level_projects_pkey PRIMARY KEY (id);


--
-- Name: club_attendees club_attendees_club_session_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_attendees
    ADD CONSTRAINT club_attendees_club_session_id_student_id_key UNIQUE (club_session_id, student_id);


--
-- Name: club_attendees club_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_attendees
    ADD CONSTRAINT club_attendees_pkey PRIMARY KEY (id);


--
-- Name: club_definitions club_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_definitions
    ADD CONSTRAINT club_definitions_pkey PRIMARY KEY (id);


--
-- Name: club_members club_members_club_name_location_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_club_name_location_id_student_id_key UNIQUE (club_name, location_id, student_id);


--
-- Name: club_members club_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_pkey PRIMARY KEY (id);


--
-- Name: club_profiles club_profiles_club_name_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_profiles
    ADD CONSTRAINT club_profiles_club_name_location_id_key UNIQUE (club_name, location_id);


--
-- Name: club_profiles club_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_profiles
    ADD CONSTRAINT club_profiles_pkey PRIMARY KEY (id);


--
-- Name: club_resources club_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_resources
    ADD CONSTRAINT club_resources_pkey PRIMARY KEY (id);


--
-- Name: club_session_comments club_session_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_session_comments
    ADD CONSTRAINT club_session_comments_pkey PRIMARY KEY (id);


--
-- Name: club_sessions club_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_sessions
    ADD CONSTRAINT club_sessions_pkey PRIMARY KEY (id);


--
-- Name: curriculum_lessons curriculum_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_lessons
    ADD CONSTRAINT curriculum_lessons_pkey PRIMARY KEY (id);


--
-- Name: curriculum_modules curriculum_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_modules
    ADD CONSTRAINT curriculum_modules_pkey PRIMARY KEY (id);


--
-- Name: daily_assignments daily_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_assignments
    ADD CONSTRAINT daily_assignments_pkey PRIMARY KEY (id);


--
-- Name: locations locations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_name_key UNIQUE (name);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: locations locations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_slug_key UNIQUE (slug);


--
-- Name: onboarding_steps onboarding_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_steps
    ADD CONSTRAINT onboarding_steps_pkey PRIMARY KEY (id);


--
-- Name: progress_log_comments progress_log_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_log_comments
    ADD CONSTRAINT progress_log_comments_pkey PRIMARY KEY (id);


--
-- Name: progress_logs progress_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_logs
    ADD CONSTRAINT progress_logs_pkey PRIMARY KEY (id);


--
-- Name: releases releases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releases
    ADD CONSTRAINT releases_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: student_programs student_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_programs
    ADD CONSTRAINT student_programs_pkey PRIMARY KEY (id);


--
-- Name: student_programs student_programs_student_id_program_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_programs
    ADD CONSTRAINT student_programs_student_id_program_key UNIQUE (student_id, program);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: user_locations user_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_locations
    ADD CONSTRAINT user_locations_pkey PRIMARY KEY (user_id, location_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: belt_level_projects_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX belt_level_projects_idx ON public.belt_level_projects USING btree (belt_name, sublevel);


--
-- Name: club_attendees_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_attendees_student_idx ON public.club_attendees USING btree (student_id);


--
-- Name: club_definitions_global_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX club_definitions_global_name ON public.club_definitions USING btree (name) WHERE (location_id IS NULL);


--
-- Name: club_definitions_global_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX club_definitions_global_slug ON public.club_definitions USING btree (slug) WHERE (location_id IS NULL);


--
-- Name: club_definitions_local_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX club_definitions_local_name ON public.club_definitions USING btree (name, location_id) WHERE (location_id IS NOT NULL);


--
-- Name: club_definitions_local_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX club_definitions_local_slug ON public.club_definitions USING btree (slug, location_id) WHERE (location_id IS NOT NULL);


--
-- Name: club_resources_club_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_resources_club_location_idx ON public.club_resources USING btree (club_name, location_id);


--
-- Name: club_session_comments_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_session_comments_session_id_idx ON public.club_session_comments USING btree (session_id);


--
-- Name: club_sessions_location_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_sessions_location_date_idx ON public.club_sessions USING btree (location_id, session_date DESC);


--
-- Name: idx_announcements_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_created_by ON public.announcements USING btree (created_by);


--
-- Name: idx_announcements_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_location ON public.announcements USING btree (location_id);


--
-- Name: idx_app_settings_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_settings_updated_by ON public.app_settings USING btree (updated_by);


--
-- Name: idx_club_definitions_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_club_definitions_created_by ON public.club_definitions USING btree (created_by);


--
-- Name: idx_club_definitions_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_club_definitions_location_id ON public.club_definitions USING btree (location_id);


--
-- Name: idx_club_members_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_club_members_location_id ON public.club_members USING btree (location_id);


--
-- Name: idx_club_members_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_club_members_student_id ON public.club_members USING btree (student_id);


--
-- Name: idx_club_profiles_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_club_profiles_location_id ON public.club_profiles USING btree (location_id);


--
-- Name: idx_club_resources_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_club_resources_location_id ON public.club_resources USING btree (location_id);


--
-- Name: idx_club_session_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_club_session_comments_user_id ON public.club_session_comments USING btree (user_id);


--
-- Name: idx_club_sessions_sensei_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_club_sessions_sensei_id ON public.club_sessions USING btree (sensei_id);


--
-- Name: idx_curriculum_lessons_module_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_curriculum_lessons_module_id ON public.curriculum_lessons USING btree (module_id);


--
-- Name: idx_daily_assignments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_assignments_date ON public.daily_assignments USING btree (session_date);


--
-- Name: idx_daily_assignments_sensei_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_assignments_sensei_id ON public.daily_assignments USING btree (sensei_id);


--
-- Name: idx_daily_assignments_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_assignments_student_id ON public.daily_assignments USING btree (student_id);


--
-- Name: idx_progress_log_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_log_comments_user_id ON public.progress_log_comments USING btree (user_id);


--
-- Name: idx_progress_logs_sensei_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_logs_sensei_id ON public.progress_logs USING btree (sensei_id);


--
-- Name: idx_progress_logs_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_logs_student_id ON public.progress_logs USING btree (student_id);


--
-- Name: idx_releases_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_releases_created_by ON public.releases USING btree (created_by);


--
-- Name: idx_student_programs_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_programs_student_id ON public.student_programs USING btree (student_id);


--
-- Name: idx_students_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_location_id ON public.students USING btree (location_id);


--
-- Name: idx_user_locations_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_locations_location ON public.user_locations USING btree (location_id);


--
-- Name: idx_users_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_location_id ON public.users USING btree (location_id);


--
-- Name: onboarding_steps_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX onboarding_steps_order_idx ON public.onboarding_steps USING btree (published, audience, step_order);


--
-- Name: progress_log_comments_log_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX progress_log_comments_log_id_idx ON public.progress_log_comments USING btree (log_id);


--
-- Name: releases_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX releases_published_idx ON public.releases USING btree (published, published_at DESC);


--
-- Name: announcements announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: announcements announcements_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: app_settings app_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: club_attendees club_attendees_club_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_attendees
    ADD CONSTRAINT club_attendees_club_session_id_fkey FOREIGN KEY (club_session_id) REFERENCES public.club_sessions(id) ON DELETE CASCADE;


--
-- Name: club_attendees club_attendees_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_attendees
    ADD CONSTRAINT club_attendees_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: club_definitions club_definitions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_definitions
    ADD CONSTRAINT club_definitions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: club_definitions club_definitions_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_definitions
    ADD CONSTRAINT club_definitions_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: club_members club_members_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: club_members club_members_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: club_profiles club_profiles_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_profiles
    ADD CONSTRAINT club_profiles_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: club_resources club_resources_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_resources
    ADD CONSTRAINT club_resources_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: club_session_comments club_session_comments_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_session_comments
    ADD CONSTRAINT club_session_comments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.club_sessions(id) ON DELETE CASCADE;


--
-- Name: club_session_comments club_session_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_session_comments
    ADD CONSTRAINT club_session_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: club_sessions club_sessions_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_sessions
    ADD CONSTRAINT club_sessions_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: club_sessions club_sessions_sensei_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_sessions
    ADD CONSTRAINT club_sessions_sensei_id_fkey FOREIGN KEY (sensei_id) REFERENCES public.users(id);


--
-- Name: curriculum_lessons curriculum_lessons_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_lessons
    ADD CONSTRAINT curriculum_lessons_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.curriculum_modules(id) ON DELETE CASCADE;


--
-- Name: daily_assignments daily_assignments_sensei_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_assignments
    ADD CONSTRAINT daily_assignments_sensei_id_fkey FOREIGN KEY (sensei_id) REFERENCES public.users(id);


--
-- Name: daily_assignments daily_assignments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_assignments
    ADD CONSTRAINT daily_assignments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: progress_log_comments progress_log_comments_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_log_comments
    ADD CONSTRAINT progress_log_comments_log_id_fkey FOREIGN KEY (log_id) REFERENCES public.progress_logs(id) ON DELETE CASCADE;


--
-- Name: progress_log_comments progress_log_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_log_comments
    ADD CONSTRAINT progress_log_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: progress_logs progress_logs_sensei_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_logs
    ADD CONSTRAINT progress_logs_sensei_id_fkey FOREIGN KEY (sensei_id) REFERENCES public.users(id);


--
-- Name: progress_logs progress_logs_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_logs
    ADD CONSTRAINT progress_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: releases releases_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releases
    ADD CONSTRAINT releases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: student_programs student_programs_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_programs
    ADD CONSTRAINT student_programs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: students students_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: user_locations user_locations_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_locations
    ADD CONSTRAINT user_locations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: user_locations user_locations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_locations
    ADD CONSTRAINT user_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: belt_level_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.belt_level_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: club_attendees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.club_attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: club_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.club_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: club_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

--
-- Name: club_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.club_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: club_resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.club_resources ENABLE ROW LEVEL SECURITY;

--
-- Name: club_session_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.club_session_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: club_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.club_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: curriculum_lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.curriculum_lessons ENABLE ROW LEVEL SECURITY;

--
-- Name: curriculum_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.curriculum_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.announcements AS RESTRICTIVE USING (false);


--
-- Name: app_settings deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.app_settings AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: belt_level_projects deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.belt_level_projects AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: club_attendees deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.club_attendees AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: club_definitions deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.club_definitions AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: club_members deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.club_members AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: club_profiles deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.club_profiles AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: club_resources deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.club_resources AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: club_session_comments deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.club_session_comments AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: club_sessions deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.club_sessions AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: curriculum_lessons deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.curriculum_lessons AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: curriculum_modules deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.curriculum_modules AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: daily_assignments deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.daily_assignments AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: locations deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.locations AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: progress_log_comments deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.progress_log_comments AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: progress_logs deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.progress_logs AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: session deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.session AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: student_programs deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.student_programs AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: students deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.students AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: user_locations deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.user_locations AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: users deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.users AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: onboarding_steps deny_all_onboarding_steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all_onboarding_steps ON public.onboarding_steps AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: releases deny_all_releases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all_releases ON public.releases AS RESTRICTIVE USING (false) WITH CHECK (false);


--
-- Name: locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: progress_log_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.progress_log_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: progress_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: releases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

--
-- Name: session; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;

--
-- Name: student_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- Name: user_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
--
-- Migration 027 (student_locations), appended after the dump was taken so the
-- test database matches production. Re-dump prod-schema.sql to fold it in.
--
CREATE TABLE IF NOT EXISTS public.student_locations (
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    location_id integer NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    added_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (student_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_student_locations_location ON public.student_locations USING btree (location_id);
ALTER TABLE public.student_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_all ON public.student_locations AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

-- PostgreSQL database dump complete
--

\unrestrict Oi8MtR0VzRW1wm3hbWBU2ZsfRqnq5VADASgC873dTUb4ceW8fR0OJqKdhADNl93

