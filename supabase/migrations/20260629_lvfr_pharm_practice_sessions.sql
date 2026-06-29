-- Migration: lvfr_aemt_pharm_practice_sessions
-- Unauthenticated pharm practice sessions — store name, identifier, and scoring
-- so Ben can view results in-app without requiring student Azure login.

CREATE TABLE IF NOT EXISTS "lvfr_aemt_pharm_practice_sessions" (
  "id"                 uuid      DEFAULT gen_random_uuid() NOT NULL,
  "student_name"       text      NOT NULL,
  "student_identifier" text      NOT NULL,
  "difficulty_level"   integer   NOT NULL DEFAULT 1,
  "score_percent"      numeric,
  "passed"             boolean,
  "responses"          jsonb,
  "ip_address"         text,
  "submitted_at"       timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_lvfr_pharm_practice_identifier"
  ON "lvfr_aemt_pharm_practice_sessions" ("student_identifier");

CREATE INDEX IF NOT EXISTS "idx_lvfr_pharm_practice_submitted_at"
  ON "lvfr_aemt_pharm_practice_sessions" ("submitted_at" DESC);

-- RLS: service key (used by the API) bypasses RLS.
-- Enable RLS to block direct client reads/writes.
ALTER TABLE "lvfr_aemt_pharm_practice_sessions" ENABLE ROW LEVEL SECURITY;

-- ROLLBACK:
-- DROP TABLE IF EXISTS lvfr_aemt_pharm_practice_sessions;
