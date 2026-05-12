-- Clean up "behind on clinicals" / internship-milestone notifications
-- that were generated for students in S1/S2 cohorts before the cron's
-- current_semester gate was added.
--
-- The crons fan out notifications keyed by user_email, then a separate
-- "instructor alert" version goes to admin/superadmin users. Both
-- flavours need to be cleaned for affected cohorts.
--
-- Detection: any user_notifications row whose reference_type is one of
-- the clinical/internship cron types AND whose owning user is a
-- student in a cohort with current_semester < 3. For the instructor-
-- alert flavour, reference_id is the cohort id directly, so we can
-- filter by cohort_id.
--
-- Safe to re-run. Logs the deleted count for audit.

DO $$
DECLARE
  deleted_student_rows int := 0;
  deleted_admin_rows int := 0;
BEGIN
  -- 1. Student-facing reminders: join through students.email → cohorts.
  WITH premature_student_notifs AS (
    SELECT n.id
      FROM user_notifications n
      JOIN students s   ON LOWER(s.email) = LOWER(n.user_email)
      JOIN cohorts c    ON c.id = s.cohort_id
     WHERE n.reference_type IN (
             'clinical_hours_reminder',
             'internship_milestone',
             'internship_milestone_instructor'
           )
       AND COALESCE(c.current_semester, 1) < 3
  )
  DELETE FROM user_notifications
   WHERE id IN (SELECT id FROM premature_student_notifs);
  GET DIAGNOSTICS deleted_student_rows = ROW_COUNT;

  -- 2. Instructor-facing alerts: reference_id is the cohort uuid for
  --    clinical_hours_instructor_alert; same idea for any future
  --    cohort-scoped admin alerts.
  WITH premature_admin_notifs AS (
    SELECT n.id
      FROM user_notifications n
      JOIN cohorts c ON c.id = n.reference_id
     WHERE n.reference_type IN (
             'clinical_hours_instructor_alert',
             'internship_milestone_instructor'
           )
       AND COALESCE(c.current_semester, 1) < 3
  )
  DELETE FROM user_notifications
   WHERE id IN (SELECT id FROM premature_admin_notifs);
  GET DIAGNOSTICS deleted_admin_rows = ROW_COUNT;

  RAISE NOTICE 'Cleaned % student + % instructor clinical notifications for S1/S2 cohorts.',
    deleted_student_rows, deleted_admin_rows;
END $$;
