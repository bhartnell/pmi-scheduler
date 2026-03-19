-- Delete excess lab days for PM14 Thursday, EMT5 Monday, PM15 Monday
-- These are cleanup deletions of incorrectly generated lab days

-- Set permission for critical deletes
SET LOCAL app.allow_critical_delete = 'true';

-- Log counts before
DO $$
DECLARE
  pm14_thu INT;
  emt5_mon INT;
  pm15_mon INT;
BEGIN
  SELECT COUNT(*) INTO pm14_thu
  FROM lab_days
  WHERE cohort_id IN (SELECT id FROM cohorts WHERE cohort_number = 14)
    AND EXTRACT(DOW FROM date) = 4;

  SELECT COUNT(*) INTO emt5_mon
  FROM lab_days
  WHERE cohort_id IN (
    SELECT c.id FROM cohorts c JOIN programs p ON c.program_id = p.id
    WHERE c.cohort_number = 5 AND p.abbreviation LIKE '%EMT%'
  )
  AND EXTRACT(DOW FROM date) = 1;

  SELECT COUNT(*) INTO pm15_mon
  FROM lab_days
  WHERE cohort_id IN (SELECT id FROM cohorts WHERE cohort_number = 15)
    AND EXTRACT(DOW FROM date) = 1;

  RAISE NOTICE 'BEFORE DELETE — PM14 Thursday: %, EMT5 Monday: %, PM15 Monday: %', pm14_thu, emt5_mon, pm15_mon;
END $$;

-- Delete PM14 Thursday labs
DELETE FROM lab_days
WHERE cohort_id IN (SELECT id FROM cohorts WHERE cohort_number = 14)
  AND EXTRACT(DOW FROM date) = 4;

-- Delete EMT5 Monday labs
DELETE FROM lab_days
WHERE cohort_id IN (
  SELECT c.id FROM cohorts c JOIN programs p ON c.program_id = p.id
  WHERE c.cohort_number = 5 AND p.abbreviation LIKE '%EMT%'
)
AND EXTRACT(DOW FROM date) = 1;

-- Delete PM15 Monday labs
DELETE FROM lab_days
WHERE cohort_id IN (SELECT id FROM cohorts WHERE cohort_number = 15)
  AND EXTRACT(DOW FROM date) = 1;

-- Log counts after
DO $$
DECLARE
  pm14_thu INT;
  emt5_mon INT;
  pm15_mon INT;
BEGIN
  SELECT COUNT(*) INTO pm14_thu
  FROM lab_days
  WHERE cohort_id IN (SELECT id FROM cohorts WHERE cohort_number = 14)
    AND EXTRACT(DOW FROM date) = 4;

  SELECT COUNT(*) INTO emt5_mon
  FROM lab_days
  WHERE cohort_id IN (
    SELECT c.id FROM cohorts c JOIN programs p ON c.program_id = p.id
    WHERE c.cohort_number = 5 AND p.abbreviation LIKE '%EMT%'
  )
  AND EXTRACT(DOW FROM date) = 1;

  SELECT COUNT(*) INTO pm15_mon
  FROM lab_days
  WHERE cohort_id IN (SELECT id FROM cohorts WHERE cohort_number = 15)
    AND EXTRACT(DOW FROM date) = 1;

  RAISE NOTICE 'AFTER DELETE — PM14 Thursday: %, EMT5 Monday: %, PM15 Monday: %', pm14_thu, emt5_mon, pm15_mon;
END $$;
