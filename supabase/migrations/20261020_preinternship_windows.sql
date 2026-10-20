-- Pre-Internship Self-Assessment: per-cohort open window (RAE R2/3 gate).
-- Additive and idempotent. A cohort's students can reach the self-assessment
-- only while a row exists with opens_at <= now() and (closes_at is null or in
-- the future). No row = closed. RLS on, no policies: service role only.
CREATE TABLE IF NOT EXISTS public.preinternship_windows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id   uuid NOT NULL REFERENCES public.cohorts(id),
  opens_at    timestamptz NOT NULL DEFAULT now(),
  closes_at   timestamptz,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS preinternship_windows_cohort_key
  ON public.preinternship_windows (cohort_id);
ALTER TABLE public.preinternship_windows ENABLE ROW LEVEL SECURITY;

-- ROLLBACK:
-- DROP TABLE IF EXISTS public.preinternship_windows;
