-- Mark resolved feedback items from Tasks 17, 18, 19, and scheduling reports
-- Generated: 2026-03-05

-- Task 17: Admin role preview/impersonation mode
UPDATE feedback_reports SET
  status = 'resolved',
  resolution_notes = 'Done 2026-03-05. Task 17 — admin role preview/impersonation mode deployed.',
  resolved_at = NOW()
WHERE id = '575fafa2-3c96-4386-91e0-866a225ccbf4';

-- Task 19: Lab checklist templates with 7 defaults
UPDATE feedback_reports SET
  status = 'resolved',
  resolution_notes = 'Done 2026-03-05. Task 19 — lab checklist templates with 7 defaults.',
  resolved_at = NOW()
WHERE id = 'a144a2f8-b45c-472f-9c40-a6e07632767e';

-- Task 18: Instructor badges and names on schedule list view
UPDATE feedback_reports SET
  status = 'resolved',
  resolution_notes = 'Done 2026-03-05. Task 18 — instructor badges and names on schedule list.',
  resolved_at = NOW()
WHERE id = 'ad31375c-34bc-4218-9425-081244b461ed';

-- Scheduling reports feedback — basic reports functionality built
UPDATE feedback_reports SET
  status = 'resolved',
  resolution_notes = 'Done 2026-03-05. Scheduling reports page with shift coverage, availability patterns, and instructor workload reports.',
  resolved_at = NOW()
WHERE id = 'e4fc6d31-bd9b-4802-9117-ca35fecf408a';
