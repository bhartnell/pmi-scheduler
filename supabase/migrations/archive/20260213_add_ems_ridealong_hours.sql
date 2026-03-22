-- Add EMS (ride-along) hours columns to student_clinical_hours
-- Separate from the existing ems_field (Elective) column

ALTER TABLE student_clinical_hours
ADD COLUMN IF NOT EXISTS ems_ridealong_hours NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ems_ridealong_shifts INTEGER DEFAULT 0;

-- Update total hours trigger to include EMS ride-along hours
CREATE OR REPLACE FUNCTION update_clinical_hours_totals()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_hours := COALESCE(NEW.psych_hours, 0) +
                     COALESCE(NEW.ed_hours, 0) +
                     COALESCE(NEW.icu_hours, 0) +
                     COALESCE(NEW.ob_hours, 0) +
                     COALESCE(NEW.or_hours, 0) +
                     COALESCE(NEW.peds_ed_hours, 0) +
                     COALESCE(NEW.peds_icu_hours, 0) +
                     COALESCE(NEW.ems_field_hours, 0) +
                     COALESCE(NEW.cardiology_hours, 0) +
                     COALESCE(NEW.ems_ridealong_hours, 0);
  NEW.total_shifts := COALESCE(NEW.psych_shifts, 0) +
                      COALESCE(NEW.ed_shifts, 0) +
                      COALESCE(NEW.icu_shifts, 0) +
                      COALESCE(NEW.ob_shifts, 0) +
                      COALESCE(NEW.or_shifts, 0) +
                      COALESCE(NEW.peds_ed_shifts, 0) +
                      COALESCE(NEW.peds_icu_shifts, 0) +
                      COALESCE(NEW.ems_field_shifts, 0) +
                      COALESCE(NEW.cardiology_shifts, 0) +
                      COALESCE(NEW.ems_ridealong_shifts, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
