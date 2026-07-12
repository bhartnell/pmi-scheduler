-- Migration: lab_days_is_archived
--
-- Task Handoff Queue (Ben approved): adds a lab_days.is_archived flag so
-- superseded/leftover lab_days rows can be archived-not-deleted, per the
-- project's standing archive-don't-delete rule. Same convention as the
-- existing cohorts.is_archived flag.
--
-- Immediate use: 2 known ACLS lab_days rows for cohort
-- 8577fdc3-eff6-4000-9302-1ee6e3043eeb (G14), both verified 0
-- adv_cert_test_attempts, were surfacing as a "free-floating megacode" in
-- the general lab schedule and ACLS hub because neither list query
-- excludes archived rows:
--   5c7f74f6-7d89-4f8e-8f03-e0b9c45b6b37  section 1, "[ARCHIVED] ACLS
--     Certification — Day 2 (superseded)" — the 16-station Day-2 monolith,
--     already relabeled [ARCHIVED] in the 2026-06-19 "Day-2 megacode clean
--     structure" changelog entry (docs/CHANGELOG.md) when it was split into
--     the current Practice Set 1/Set 2 + paired Testing sections.
--   85808c0a-3afe-4fde-a2a6-fc74824ac417  section 3, "ACLS Day 2 — Megacode
--     Testing (Scored)" — the dedicated scored-testing section from that
--     same restructure (still carries 4 real station/instructor
--     assignments: Josh Lomonaco, Michael Schafer, Ben Hartnell, Rae
--     Niedfeldt), but G14's actual 32 recorded adv_cert_test_attempts all
--     came from the two Megacode Practice sections instead (AHA permits
--     practice-as-testing; see 2026-06-23 "resolve the 9 flagged students"
--     changelog entry) — this Testing section was set up but never
--     actually used to record a single attempt.
-- Verified both counts directly against production before writing this
-- migration (adv_cert_test_attempts + lab_stations queries), not inferred
-- from the queue item text alone. Set true on those 2 rows only, in the
-- same session as this migration. Archiving only hides them from the
-- default list views (is_archived filter) — no data is deleted, and either
-- row can be unarchived instantly if that turns out to be wrong.
--
-- Additive + idempotent.

ALTER TABLE "lab_days"
  ADD COLUMN IF NOT EXISTS "is_archived" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "idx_lab_days_archived" ON "lab_days" ("is_archived") WHERE (is_archived = true);

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_lab_days_archived;
-- ALTER TABLE lab_days DROP COLUMN IF EXISTS is_archived;
