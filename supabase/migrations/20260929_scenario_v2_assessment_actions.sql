-- Scenario Format v2: per-section expected-action fields for XABCDE.
-- Additive, nullable, idempotent. Touches no existing rows (incl. AHA cert_course rows).
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS assessment_x_action text;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS assessment_a_action text;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS assessment_b_action text;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS assessment_c_action text;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS assessment_d_action text;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS assessment_e_action text;
-- phases jsonb: new optional per-phase keys (changes, triggers, modifiers, branch) need no DDL.

-- ROLLBACK:
-- ALTER TABLE scenarios DROP COLUMN IF EXISTS assessment_x_action;
-- ALTER TABLE scenarios DROP COLUMN IF EXISTS assessment_a_action;
-- ALTER TABLE scenarios DROP COLUMN IF EXISTS assessment_b_action;
-- ALTER TABLE scenarios DROP COLUMN IF EXISTS assessment_c_action;
-- ALTER TABLE scenarios DROP COLUMN IF EXISTS assessment_d_action;
-- ALTER TABLE scenarios DROP COLUMN IF EXISTS assessment_e_action;
