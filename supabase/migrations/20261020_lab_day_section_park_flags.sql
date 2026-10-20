-- Park five lab day page sections (card 3ff5cd1c). Keys are section flags, not routes:
-- /section/lab-day/<name>. enabled=false hides that section on app/labs/schedule/[id]/page.tsx.
-- Additive, idempotent; no business data touched. Flip enabled=true on /admin/module-flags to restore.
INSERT INTO module_flags (key, enabled, parked_at, note, updated_by) VALUES
  ('/section/lab-day/lab-costs',          false, now(), 'Parked from lab day page 2026-10-20 (Ben)', 'claude-code:lab-day-section-trim'),
  ('/section/lab-day/equipment',          false, now(), 'Parked from lab day page 2026-10-20 (Ben)', 'claude-code:lab-day-section-trim'),
  ('/section/lab-day/learning-style',     false, now(), 'Parked from lab day page 2026-10-20 (Ben)', 'claude-code:lab-day-section-trim'),
  ('/section/lab-day/performance-ratings',false, now(), 'Parked from lab day page 2026-10-20 (Ben)', 'claude-code:lab-day-section-trim'),
  ('/section/lab-day/self-check-in',      false, now(), 'Parked from lab day page 2026-10-20 (Ben)', 'claude-code:lab-day-section-trim')
ON CONFLICT (key) DO NOTHING;

-- ROLLBACK:
-- DELETE FROM module_flags WHERE updated_by = 'claude-code:lab-day-section-trim';  -- or UPDATE ... SET enabled = true
