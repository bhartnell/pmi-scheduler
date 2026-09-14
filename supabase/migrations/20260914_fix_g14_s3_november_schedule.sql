-- Fix G14 S3 November schedule to match Ben's authoritative course outlines
-- (EMS 211 / EMS 221 Group 14 Fall 2026 outlines). The app schedule had
-- drifted from the outlines in 4 places; the outlines are correct.
--
-- Source: Task Handoff Queue ticket "Correct G14 S3 November schedule to
-- match course outlines (OSCE Thursdays + Thanksgiving)", posted 2026-09-14.
-- Ben confirmed the outlines in chat 2026-09-14, including "no school 27th".
--
-- Cohort: G14 (8577fdc3-eff6-4000-9302-1ee6e3043eeb), S3 program schedule
-- (86992083-6715-4c82-b5ff-c3500a214c12), semester (2a4c3da6-3aae-4cce-b2f6-2a53256e64cd).
--
-- Changes:
--   1. Cancel (status='cancelled', not hard-deleted) the 3 EMS 211/221 lecture
--      + S3 Lab blocks on Fri 2026-11-13 and Fri 2026-11-20 — both Fridays are
--      replaced by a Thursday OSCE day, not additional class days.
--   2. Cancel the S3 Lab block on Fri 2026-11-27 — Thanksgiving, no school.
--   3. Archive (is_archived=true, not hard-deleted) the 3 lab_days rows that
--      were linked to those cancelled lab blocks. Verified before archiving:
--      0 lab_stations had an instructor assigned, 0 lab_day_roles,
--      0 volunteer_lab_tokens, 0 coverage_requests referenced any of the 3 —
--      safe, no in-flight coordination data lost.
--   4. Add two new one-off blocks for Thu 2026-11-12 and Thu 2026-11-19
--      ("OSCE Day 1/2 / Internship Prep Practical" — agency day, Thursday is
--      deliberate: fire agency observers work 4/10s Mon-Thu, so Thursday is
--      the only day they can attend). Start/end time (08:00-15:30) is NOT
--      guessed — it's read from the already-built osce_time_blocks rows for
--      osce_events.slug='fall-2026' (4 blocks: Day 1/2 AM 08:00-12:00, PM
--      12:45-15:30), the authoritative existing structure for this event.
--
-- Explicitly NOT touched (per ticket item 4 — flagged back to Ben instead of
-- changed unilaterally): the Dec 4 "S3 Week 14 - OSCE Review Board" / Dec 11
-- "S3 Week 15 - No Lab (Semester Close)" naming-drift rows vs. the outline's
-- "Internship Prep / Protocol Test Prep" / "Presentations" wording.
--
-- Calendar-sync note: verified live (Supabase query) that no
-- google_calendar_events or shared_calendar_events rows exist yet for this
-- recurring group (bb00648d-e542-4dd8-9fa5-a66d891dcd07) or these block ids —
-- no instructor is currently assigned to the S3 Lab blocks, and the shared
-- "push to shared calendar" flow has never been run for this group. So this
-- data fix alone is sufficient; nothing has synced to any staff calendar yet
-- for these dates, and any future sync/push reads current (now correct) data.
--
-- Applied directly via Supabase MCP execute_sql in a Claude Code cloud
-- session (no local SUPABASE_DB_URL available in that environment to run
-- this file through scripts/run-migration.js) after a full-table snapshot of
-- both affected tables:
--   _backup_pmi_schedule_blocks_20260914171806 (753 rows)
--   _backup_lab_days_20260914171806 (192 rows)
-- This file is checked in unapplied-by-the-script for the repo's migration
-- history/audit trail; the statements below are exactly what ran in prod.

BEGIN;

-- Cancel Fri 2026-11-13 (EMS 211 lecture, EMS 221 lecture, S3 Lab) — replaced by Thu 11/12 OSCE day
UPDATE pmi_schedule_blocks
SET status = 'cancelled', updated_at = now()
WHERE id IN (
  '4a163a17-d8d2-450c-9f3b-a7f8339bf4d0',
  '8c50c105-f535-4d75-aa77-03ffdcf8e5b2',
  'e1710a61-3c25-4aa2-919c-d99f0fedd676'
);

-- Cancel Fri 2026-11-20 (EMS 211 lecture, EMS 221 lecture, S3 Lab) — replaced by Thu 11/19 OSCE day
UPDATE pmi_schedule_blocks
SET status = 'cancelled', updated_at = now()
WHERE id IN (
  '6ce76a69-1011-4208-8c0e-232db8a36177',
  'a3af96e4-c67e-480c-a11a-286f06204859',
  '68b32e09-e3e4-4ef1-ade8-ed2baf7ee7bb'
);

-- Cancel Fri 2026-11-27 (Thanksgiving, no school)
UPDATE pmi_schedule_blocks
SET status = 'cancelled', updated_at = now()
WHERE id = 'a8f588c1-d3c2-4914-90e0-b89d6a0b577c';

-- Archive the 3 orphaned lab_days rows (verified 0 instructor/station/volunteer/coverage assignments)
UPDATE lab_days
SET is_archived = true
WHERE id IN (
  '397bcbd2-ba9d-4f93-b578-02eda84cb3a9',
  '68f690a0-7c4e-4d78-bfd4-8431f2ac7110',
  '6dbf0fc6-2d20-4c55-8470-8fd302e848c9'
);

-- Add Thu 2026-11-12: OSCE Day 1 / Internship Prep Practical (times sourced from osce_time_blocks for osce_events.fall-2026)
INSERT INTO pmi_schedule_blocks (
  program_schedule_id, semester_id, day_of_week, start_time, end_time,
  block_type, title, course_name, is_recurring, specific_date, date,
  week_number, status, content_notes
) VALUES (
  '86992083-6715-4c82-b5ff-c3500a214c12', '2a4c3da6-3aae-4cce-b2f6-2a53256e64cd', 4, '08:00:00', '15:30:00',
  'exam', 'OSCE Day 1 / Internship Prep Practical', 'S3 OSCE / Internship Prep', false, '2026-11-12', '2026-11-12',
  11, 'published',
  'Agency day; replaces Fri 11/13 class. Fire agency observers attend (4/10 schedule) — do not move off Thursday. See osce_events (fall-2026) / osce_time_blocks for observer-facing detail.'
);

-- Add Thu 2026-11-19: OSCE Day 2 / Internship Prep Practical
INSERT INTO pmi_schedule_blocks (
  program_schedule_id, semester_id, day_of_week, start_time, end_time,
  block_type, title, course_name, is_recurring, specific_date, date,
  week_number, status, content_notes
) VALUES (
  '86992083-6715-4c82-b5ff-c3500a214c12', '2a4c3da6-3aae-4cce-b2f6-2a53256e64cd', 4, '08:00:00', '15:30:00',
  'exam', 'OSCE Day 2 / Internship Prep Practical', 'S3 OSCE / Internship Prep', false, '2026-11-19', '2026-11-19',
  12, 'published',
  'Agency day; replaces Fri 11/20 class. Fire agency observers attend (4/10 schedule) — do not move off Thursday. See osce_events (fall-2026) / osce_time_blocks for observer-facing detail.'
);

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- UPDATE pmi_schedule_blocks SET status = 'published', updated_at = now()
--   WHERE id IN ('4a163a17-d8d2-450c-9f3b-a7f8339bf4d0','8c50c105-f535-4d75-aa77-03ffdcf8e5b2',
--                'e1710a61-3c25-4aa2-919c-d99f0fedd676','6ce76a69-1011-4208-8c0e-232db8a36177',
--                'a3af96e4-c67e-480c-a11a-286f06204859','68b32e09-e3e4-4ef1-ade8-ed2baf7ee7bb',
--                'a8f588c1-d3c2-4914-90e0-b89d6a0b577c');
-- UPDATE lab_days SET is_archived = false
--   WHERE id IN ('397bcbd2-ba9d-4f93-b578-02eda84cb3a9','68f690a0-7c4e-4d78-bfd4-8431f2ac7110',
--                '6dbf0fc6-2d20-4c55-8470-8fd302e848c9');
-- DELETE FROM pmi_schedule_blocks WHERE date IN ('2026-11-12','2026-11-19') AND course_name = 'S3 OSCE / Internship Prep';
-- COMMIT;
-- Full pre-migration snapshot also available for a hard restore:
--   INSERT INTO pmi_schedule_blocks SELECT * FROM "_backup_pmi_schedule_blocks_20260914171806";
--   INSERT INTO lab_days SELECT * FROM "_backup_lab_days_20260914171806";
-- (only needed if the targeted rollback above is insufficient; the backup
-- tables are additive snapshots and can be dropped once this migration has
-- been verified live for a few weeks: DROP TABLE "_backup_pmi_schedule_blocks_20260914171806";
-- DROP TABLE "_backup_lab_days_20260914171806";)
