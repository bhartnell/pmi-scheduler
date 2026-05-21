-- Audit trail for lab_day_templates writes.
--
-- Motivation: on 2026-05-21 the paramedic S2 templates silently
-- reverted to "Content Pending" placeholders mid-day. Investigation
-- was painful — updated_at told us WHEN but not WHO/WHAT. This
-- migration plugs that gap.
--
-- Two pieces:
--   1. updated_by column on lab_day_templates — writer routes set
--      this explicitly with an identifier like 'import-route:admin@pmi.edu'
--      or 'seed-route:admin@pmi.edu' or 'script:reimport-paramedic-s2'.
--   2. lab_day_template_audit table + trigger — captures every
--      INSERT/UPDATE/DELETE so we can reconstruct the timeline even
--      when a row is overwritten multiple times in one day.
--
-- The trigger is AFTER row-level. It does not rely on session-local
-- settings (current_setting) so it works with the Supabase admin
-- client without needing per-request SET LOCAL plumbing — writers
-- just put their identity into NEW.updated_by and the trigger
-- propagates it.

-- 1. Column on lab_day_templates.
ALTER TABLE lab_day_templates
  ADD COLUMN IF NOT EXISTS updated_by text;

COMMENT ON COLUMN lab_day_templates.updated_by IS 'Identifier for the actor that last wrote this row. Format: "<source>:<actor>" e.g. "import-route:admin@pmi.edu". Captured by the audit trigger.';

-- 2. Audit table. No FK back to lab_day_templates — we want audit
--    rows to outlive the template they describe (e.g. capturing
--    accidental deletions).
CREATE TABLE IF NOT EXISTS lab_day_template_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid,                          -- soft reference
  template_program text,
  template_semester integer,
  template_week integer,
  template_day integer,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  changed_by text,                           -- copied from updated_by at write time
  change_type text NOT NULL CHECK (change_type IN ('insert','update','delete')),
  old_name text,
  new_name text,
  old_station_count integer
);

CREATE INDEX IF NOT EXISTS lab_day_template_audit_template_idx
  ON lab_day_template_audit (template_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS lab_day_template_audit_when_idx
  ON lab_day_template_audit (changed_at DESC);

COMMENT ON TABLE lab_day_template_audit IS 'Insert/update/delete history for lab_day_templates. Populated by trigger lab_day_template_audit_trg.';

-- 3. Trigger function. Skips no-op updates (where only updated_at
--    moved) so the table doesn't fill with churn from routes that
--    touch but don't actually change anything visible.
CREATE OR REPLACE FUNCTION lab_day_template_audit_trigger() RETURNS TRIGGER AS $$
DECLARE
  stn_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO lab_day_template_audit (
      template_id, template_program, template_semester, template_week, template_day,
      changed_by, change_type, new_name
    ) VALUES (
      NEW.id, NEW.program, NEW.semester, NEW.week_number, NEW.day_number,
      NEW.updated_by, 'insert', NEW.name
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Skip pure updated_at bumps. We care about anything that
    -- changes visible content: name, category, anchor flags, and
    -- review status. Station changes are handled implicitly because
    -- /import deletes+reinserts stations after the template UPDATE,
    -- so the old_station_count snapshot is meaningful even though
    -- we don't audit the station rows themselves.
    IF OLD.name IS NOT DISTINCT FROM NEW.name
       AND OLD.category IS NOT DISTINCT FROM NEW.category
       AND OLD.is_anchor IS NOT DISTINCT FROM NEW.is_anchor
       AND OLD.anchor_type IS NOT DISTINCT FROM NEW.anchor_type
       AND OLD.requires_review IS NOT DISTINCT FROM NEW.requires_review
       AND OLD.review_notes IS NOT DISTINCT FROM NEW.review_notes
       AND OLD.updated_by IS NOT DISTINCT FROM NEW.updated_by
    THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO stn_count
    FROM lab_template_stations
    WHERE template_id = OLD.id;

    INSERT INTO lab_day_template_audit (
      template_id, template_program, template_semester, template_week, template_day,
      changed_by, change_type, old_name, new_name, old_station_count
    ) VALUES (
      NEW.id, NEW.program, NEW.semester, NEW.week_number, NEW.day_number,
      NEW.updated_by, 'update', OLD.name, NEW.name, stn_count
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO lab_day_template_audit (
      template_id, template_program, template_semester, template_week, template_day,
      changed_by, change_type, old_name
    ) VALUES (
      OLD.id, OLD.program, OLD.semester, OLD.week_number, OLD.day_number,
      OLD.updated_by, 'delete', OLD.name
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lab_day_template_audit_trg ON lab_day_templates;
CREATE TRIGGER lab_day_template_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON lab_day_templates
  FOR EACH ROW EXECUTE FUNCTION lab_day_template_audit_trigger();
