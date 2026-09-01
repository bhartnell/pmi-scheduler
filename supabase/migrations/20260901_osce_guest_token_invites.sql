-- OSCE Guest Token Invites: add the columns needed to actually email an
-- evaluator their unique guest-token link (the INVITE + LINKS stage).
--
-- osce_guest_tokens previously stored only evaluator_name/evaluator_role —
-- there was nowhere to put the evaluator's email address, so a token could
-- never be turned into a "send this person their link" action. This adds
-- email + agency (for display/context) and invite-send tracking so the
-- admin UI can show whether/when an invite actually went out.
--
-- Additive only — new nullable columns / columns with safe defaults on an
-- existing table. No backfill, no data loss, no --backup needed.
--
-- Already applied directly to production via Supabase MCP apply_migration
-- on 2026-09-01 (local `scripts/run-migration.js` had no DB credentials
-- available in this sandbox — SUPABASE_DB_URL was not set in .env.local).
-- This file documents that change for the migration history; running it
-- again is a safe no-op (IF NOT EXISTS throughout).

ALTER TABLE osce_guest_tokens ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE osce_guest_tokens ADD COLUMN IF NOT EXISTS agency TEXT;
ALTER TABLE osce_guest_tokens ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE osce_guest_tokens ADD COLUMN IF NOT EXISTS invite_send_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE osce_guest_tokens ADD COLUMN IF NOT EXISTS invite_last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_osce_guest_tokens_email ON osce_guest_tokens(email);

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_osce_guest_tokens_email;
-- ALTER TABLE osce_guest_tokens DROP COLUMN IF EXISTS invite_last_error;
-- ALTER TABLE osce_guest_tokens DROP COLUMN IF EXISTS invite_send_count;
-- ALTER TABLE osce_guest_tokens DROP COLUMN IF EXISTS invited_at;
-- ALTER TABLE osce_guest_tokens DROP COLUMN IF EXISTS agency;
-- ALTER TABLE osce_guest_tokens DROP COLUMN IF EXISTS email;
