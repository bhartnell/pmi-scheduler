-- Auto-recalculate total_hours and total_shifts on student_clinical_hours
-- Trigger fires BEFORE INSERT OR UPDATE so the computed columns are always consistent.

CREATE OR REPLACE FUNCTION recalc_clinical_hours_totals()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_hours := COALESCE(NEW.ed_hours, 0)
    + COALESCE(NEW.psych_hours, 0)
    + COALESCE(NEW.icu_hours, 0)
    + COALESCE(NEW.ob_hours, 0)
    + COALESCE(NEW.or_hours, 0)
    + COALESCE(NEW.peds_ed_hours, 0)
    + COALESCE(NEW.peds_icu_hours, 0)
    + COALESCE(NEW.ems_field_hours, 0)
    + COALESCE(NEW.cardiology_hours, 0)
    + COALESCE(NEW.ems_ridealong_hours, 0);

  NEW.total_shifts := COALESCE(NEW.ed_shifts, 0)
    + COALESCE(NEW.psych_shifts, 0)
    + COALESCE(NEW.icu_shifts, 0)
    + COALESCE(NEW.ob_shifts, 0)
    + COALESCE(NEW.or_shifts, 0)
    + COALESCE(NEW.peds_ed_shifts, 0)
    + COALESCE(NEW.peds_icu_shifts, 0)
    + COALESCE(NEW.ems_field_shifts, 0)
    + COALESCE(NEW.cardiology_shifts, 0)
    + COALESCE(NEW.ems_ridealong_shifts, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_recalc_clinical_hours ON student_clinical_hours;

-- Create trigger
CREATE TRIGGER trg_recalc_clinical_hours
  BEFORE INSERT OR UPDATE ON student_clinical_hours
  FOR EACH ROW
  EXECUTE FUNCTION recalc_clinical_hours_totals();

-- Backfill: recalculate all existing records so they match the trigger logic
UPDATE student_clinical_hours SET
  total_hours = COALESCE(ed_hours, 0)
    + COALESCE(psych_hours, 0)
    + COALESCE(icu_hours, 0)
    + COALESCE(ob_hours, 0)
    + COALESCE(or_hours, 0)
    + COALESCE(peds_ed_hours, 0)
    + COALESCE(peds_icu_hours, 0)
    + COALESCE(ems_field_hours, 0)
    + COALESCE(cardiology_hours, 0)
    + COALESCE(ems_ridealong_hours, 0),
  total_shifts = COALESCE(ed_shifts, 0)
    + COALESCE(psych_shifts, 0)
    + COALESCE(icu_shifts, 0)
    + COALESCE(ob_shifts, 0)
    + COALESCE(or_shifts, 0)
    + COALESCE(peds_ed_shifts, 0)
    + COALESCE(peds_icu_shifts, 0)
    + COALESCE(ems_field_shifts, 0)
    + COALESCE(cardiology_shifts, 0)
    + COALESCE(ems_ridealong_shifts, 0);
