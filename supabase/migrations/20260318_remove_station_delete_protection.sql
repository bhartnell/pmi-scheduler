-- Remove delete protection triggers from planning/transient tables
-- These tables are edited constantly during lab setup and should be freely deletable

-- lab_stations: stations are created/deleted during lab planning
DROP TRIGGER IF EXISTS prevent_mass_delete_lab_stations ON lab_stations;
DROP TRIGGER IF EXISTS prevent_delete_lab_stations ON lab_stations;

-- lab_days: lab days need to be deletable during schedule management
DROP TRIGGER IF EXISTS prevent_mass_delete_lab_days ON lab_days;
DROP TRIGGER IF EXISTS prevent_delete_lab_days ON lab_days;

-- lab_day_student_queue: testing queue entries are transient
DROP TRIGGER IF EXISTS prevent_mass_delete_lab_day_student_queue ON lab_day_student_queue;
DROP TRIGGER IF EXISTS prevent_delete_lab_day_student_queue ON lab_day_student_queue;

-- station_completions: these track transient lab day progress, not permanent records
-- NOTE: keeping the trigger on station_completions since it tracks student achievement data
-- If deletion issues arise there too, revisit.
