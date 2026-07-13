-- PALS scenario narrative content (the display card), loaded verbatim from the
-- Cowork AHA-2025 narrative files (docs/pals/pals_card_narratives_PRACTICE.json,
-- pals_card_narratives_TESTING.json) + the PRACTICE_03 exemplar.
--
-- Kept as jsonb (not coerced into typed columns) so nothing is fabricated: the
-- card is a rich, nested object (lead_in by setting, initial_vitals, flow,
-- objectives, instructor_note, debrief_question, paramedic_scope_na_candidates).
-- Display remains gated on scenarios.narrative_status = 'complete'. Additive.

ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS pals_narrative jsonb;

COMMENT ON COLUMN scenarios.pals_narrative IS 'PALS display-card narrative (lead-in, initial_vitals, flow, objectives, instructor_note, debrief), loaded verbatim from the AHA 2025 narrative files. Rendered by the Phase-2 card UI; gated on narrative_status = complete.';

-- ROLLBACK:
--   ALTER TABLE scenarios DROP COLUMN IF EXISTS pals_narrative;
