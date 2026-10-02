-- Record HOW a megacode segment result was completed: individually observed
-- vs bulk-confirmed ("mark remaining as passed") at save time. Nullable and
-- additive; NULL = legacy / not recorded. Never auto-filled.
ALTER TABLE adv_cert_segment_results
  ADD COLUMN IF NOT EXISTS completion_source text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adv_cert_segment_results_completion_source_check') THEN
    ALTER TABLE adv_cert_segment_results
      ADD CONSTRAINT adv_cert_segment_results_completion_source_check
      CHECK (completion_source IS NULL OR completion_source IN ('observed', 'bulk_confirmed', 'inferred_at_export'));
  END IF;
END $$;

-- ROLLBACK:
-- ALTER TABLE adv_cert_segment_results DROP CONSTRAINT IF EXISTS adv_cert_segment_results_completion_source_check;
-- ALTER TABLE adv_cert_segment_results DROP COLUMN IF EXISTS completion_source;
