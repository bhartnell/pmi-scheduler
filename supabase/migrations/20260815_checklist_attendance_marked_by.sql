-- Fix prod PGRST204 on POST/PATCH /api/lab-management/checklists/attendance
-- (Task Handoff Queue, Claude AI sweep 2026-08-12/15).
--
-- app/api/lab-management/checklists/attendance/route.ts writes both
-- `marked_by` and `marked_at` on every upsert, but neither column existed
-- on checklist_attendance originally. `marked_at` was already added
-- out-of-band directly against prod via the Supabase MCP on 2026-08-14
-- (migration version 20260814163538, never committed to this repo — this
-- statement re-asserts it here, idempotently, so the repo's migration
-- history matches production). `marked_by` was still missing, so writes
-- were still failing with PGRST204 ("Could not find the 'marked_by'
-- column of 'checklist_attendance' in the schema cache").
--
-- Additive, nullable, reversible.

ALTER TABLE checklist_attendance
  ADD COLUMN IF NOT EXISTS marked_at timestamptz;

ALTER TABLE checklist_attendance
  ADD COLUMN IF NOT EXISTS marked_by text;

COMMENT ON COLUMN checklist_attendance.marked_at IS
  'Timestamp when checklist attendance was marked. Added 2026-08-13 (Claude AI) to fix prod PGRST204: route /api/lab-management/checklists/attendance writes this field but the column was missing. Additive, nullable, reversible.';

COMMENT ON COLUMN checklist_attendance.marked_by IS
  'Email of the instructor who marked attendance. Added 2026-08-15 to fix prod PGRST204: route /api/lab-management/checklists/attendance writes this field but the column was missing. Additive, nullable, reversible.';

-- ROLLBACK:
-- ALTER TABLE checklist_attendance DROP COLUMN IF EXISTS marked_by;
-- ALTER TABLE checklist_attendance DROP COLUMN IF EXISTS marked_at;
