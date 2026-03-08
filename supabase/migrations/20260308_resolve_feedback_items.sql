-- Task 91 Bug 8: Mark previously fixed feedback items as resolved

-- Dashboard hover glitch (fixed Task 49)
UPDATE feedback_reports SET status = 'resolved', resolution_notes = 'Fixed 2026-03-06. Task 49 — ResizableWidget editMode gate.', resolved_at = NOW() WHERE id = (SELECT id FROM feedback_reports WHERE description ILIKE '%cells pop up and block%' AND status != 'resolved' LIMIT 1);

-- OSCE breadcrumb (fixed Task 59)
UPDATE feedback_reports SET status = 'resolved', resolution_notes = 'Fixed 2026-03-06. Task 59 — Breadcrumbs added to OSCE pages.', resolved_at = NOW() WHERE id = (SELECT id FROM feedback_reports WHERE description ILIKE '%breadcrumb from osce%' AND status != 'resolved' LIMIT 1);

-- Checklist item failure (fixed Task 49)
UPDATE feedback_reports SET status = 'resolved', resolution_notes = 'Fixed 2026-03-06. Task 49 — Table name corrected to lab_day_checklist_items.', resolved_at = NOW() WHERE id = (SELECT id FROM feedback_reports WHERE description ILIKE '%failure to add checklist item%' AND status != 'resolved' LIMIT 1);

-- Skill sheets level filter (fixed Task 57)
UPDATE feedback_reports SET status = 'resolved', resolution_notes = 'Fixed 2026-03-06. Task 57 — Program level segmented filter added.', resolved_at = NOW() WHERE id = (SELECT id FROM feedback_reports WHERE description ILIKE '%drop down to select level%' AND status != 'resolved' LIMIT 1);

-- Site visit check-in (fixed Task 58)
UPDATE feedback_reports SET status = 'resolved', resolution_notes = 'Fixed 2026-03-06. Task 58 — Defaults to specific students.', resolved_at = NOW() WHERE id = (SELECT id FROM feedback_reports WHERE description ILIKE '%autoselects whole class%' AND status != 'resolved' LIMIT 1);

-- mCE tracker (fixed Task 73)
UPDATE feedback_reports SET status = 'resolved', resolution_notes = 'Fixed 2026-03-07. Task 73 — Redesigned as clearance tracker.', resolved_at = NOW() WHERE id = (SELECT id FROM feedback_reports WHERE description ILIKE '%mCE module tracker%' AND status != 'resolved' LIMIT 1);
