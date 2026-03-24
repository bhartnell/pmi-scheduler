-- Add class_hours, lab_hours, lvfr_hours breakdown columns to pmi_instructor_workload
-- These allow the workload tracker to show hours by source (classes vs labs vs LVFR)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_instructor_workload' AND column_name = 'class_hours'
  ) THEN
    ALTER TABLE pmi_instructor_workload ADD COLUMN class_hours NUMERIC(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_instructor_workload' AND column_name = 'lab_hours'
  ) THEN
    ALTER TABLE pmi_instructor_workload ADD COLUMN lab_hours NUMERIC(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_instructor_workload' AND column_name = 'lvfr_hours'
  ) THEN
    ALTER TABLE pmi_instructor_workload ADD COLUMN lvfr_hours NUMERIC(5,2) DEFAULT 0;
  END IF;
END $$;

-- Verification
DO $$ BEGIN
  RAISE NOTICE 'pmi_instructor_workload breakdown columns added: class_hours, lab_hours, lvfr_hours';
END $$;
