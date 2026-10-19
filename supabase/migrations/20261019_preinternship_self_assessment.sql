-- Pre-Internship Self-Assessment storage (Rae's tool, RAE R1/3).
-- Additive and idempotent. RLS on, no public policies: all access goes through
-- the API routes (service role), which enforce who may read/write what.
-- Rows are soft-deleted (deleted_at), never hard-deleted by the app.

CREATE TABLE IF NOT EXISTS public.preinternship_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.lab_users(id),
  cohort_id     uuid REFERENCES public.cohorts(id),
  v             integer NOT NULL DEFAULT 1,
  name          text,
  cohort        text,
  email         text,
  ratings       jsonb NOT NULL DEFAULT '{}'::jsonb,
  scenarios     jsonb NOT NULL DEFAULT '{}'::jsonb,
  reflections   jsonb NOT NULL DEFAULT '{}'::jsonb,
  prefs         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ack           boolean NOT NULL DEFAULT false,
  submitted_at  timestamptz,
  locked        boolean NOT NULL DEFAULT false,
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One response per student (the signed-in user's id is the response id).
CREATE UNIQUE INDEX IF NOT EXISTS preinternship_responses_user_key
  ON public.preinternship_responses (user_id);
CREATE INDEX IF NOT EXISTS idx_preinternship_responses_cohort
  ON public.preinternship_responses (cohort_id);

CREATE TABLE IF NOT EXISTS public.preinternship_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_key    text NOT NULL,            -- 'r-' || response user_id
  response_id   uuid NOT NULL REFERENCES public.preinternship_responses(id),
  instr         jsonb NOT NULL DEFAULT '{}'::jsonb,
  academic      jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary       jsonb NOT NULL DEFAULT '{}'::jsonb,
  prepared_by   text,
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS preinternship_reviews_record_key_key
  ON public.preinternship_reviews (record_key);
CREATE UNIQUE INDEX IF NOT EXISTS preinternship_reviews_response_key
  ON public.preinternship_reviews (response_id);

ALTER TABLE public.preinternship_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preinternship_reviews ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: anon/authenticated roles get nothing; the service
-- role used by the API routes bypasses RLS.

-- ROLLBACK:
-- DROP TABLE IF EXISTS public.preinternship_reviews;
-- DROP TABLE IF EXISTS public.preinternship_responses;
