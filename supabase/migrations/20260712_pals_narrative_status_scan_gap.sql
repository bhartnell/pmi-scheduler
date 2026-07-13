-- The AHA-2025 narrative seed (Cowork, 2026-07-12) introduced a 4th
-- scenarios.narrative_status value: 'INCOMPLETE_SCAN_GAP' — a card that was
-- started but whose source PDF pages are missing (Practice 07 / 15). It must
-- NOT display (same gate as pending_extraction: only 'complete' is shown).
-- Widen the CHECK to accept it. Additive (widening); no existing rows change.

ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS scenarios_narrative_status_check;
ALTER TABLE scenarios ADD CONSTRAINT scenarios_narrative_status_check
  CHECK (narrative_status IS NULL OR narrative_status IN
    ('complete','pending_extraction','not_indexed','INCOMPLETE_SCAN_GAP'));

-- ROLLBACK: (restore the original 3-value set — only safe once no rows use the 4th value)
--   ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS scenarios_narrative_status_check;
--   ALTER TABLE scenarios ADD CONSTRAINT scenarios_narrative_status_check
--     CHECK (narrative_status IS NULL OR narrative_status IN
--       ('complete','pending_extraction','not_indexed'));
