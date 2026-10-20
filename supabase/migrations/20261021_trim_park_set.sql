-- TRIM 2/5: park the PARK set from the 1b dependency table. Keys are route prefixes (cover sub-routes).
-- Additive, idempotent; no business data touched. Parked pages stay in app/ and stay reachable from
-- /admin/module-flags as a switch (parked_at + note). NOT parked on purpose: academics/skill-sheets (canonical),
-- /skill-sheets and admin/skill-sheets (linked from the canonical skill-sheets pages), admin/config (fold into
-- admin/settings first), admin/skill-drills (import tool used by station editing).
INSERT INTO module_flags (key, enabled, parked_at, note, updated_by) VALUES
  ('/cases',                     false, now(), 'Parked 2026-10-21 (TRIM 2/5): case studies not in use. Includes cases/[id], leaderboard, session.', 'claude-code:trim-2-5'),
  ('/admin/cases',               false, now(), 'Parked 2026-10-21 (TRIM 2/5): goes with case studies.', 'claude-code:trim-2-5'),
  ('/onboarding',                false, now(), 'Parked 2026-10-21 (TRIM 2/5): instructor onboarding module not in use.', 'claude-code:trim-2-5'),
  ('/labs/debrief-review',       false, now(), 'Parked 2026-10-21 (TRIM 2/5).', 'claude-code:trim-2-5'),
  ('/labs/skills',               false, now(), 'Parked 2026-10-21 (TRIM 2/5): skill proficiency tracking belongs to Platinum Planner.', 'claude-code:trim-2-5'),
  ('/labs/stations',             false, now(), 'Parked 2026-10-21 (TRIM 2/5): station log and pool pages.', 'claude-code:trim-2-5'),
  ('/labs/protocol-tracking',    false, now(), 'Parked 2026-10-21 (TRIM 2/5): no protocol completions ever recorded.', 'claude-code:trim-2-5'),
  ('/labs/skill-sheets',         false, now(), 'Parked 2026-10-21 (TRIM 2/5): duplicate of academics/skill-sheets (canonical).', 'claude-code:trim-2-5'),
  ('/reports/lab-progress',      false, now(), 'Parked 2026-10-21 (TRIM 2/5).', 'claude-code:trim-2-5'),
  ('/reports/onboarding-status', false, now(), 'Parked 2026-10-21 (TRIM 2/5): goes with onboarding.', 'claude-code:trim-2-5'),
  ('/reports/program-overview',  false, now(), 'Parked 2026-10-21 (TRIM 2/5).', 'claude-code:trim-2-5'),
  ('/reports/scenario-analytics',false, now(), 'Parked 2026-10-21 (TRIM 2/5).', 'claude-code:trim-2-5'),
  ('/reports/skill-trends',      false, now(), 'Parked 2026-10-21 (TRIM 2/5).', 'claude-code:trim-2-5'),
  ('/reports/student-progress',  false, now(), 'Parked 2026-10-21 (TRIM 2/5).', 'claude-code:trim-2-5'),
  ('/scheduling/reports',        false, now(), 'Parked 2026-10-21 (TRIM 2/5).', 'claude-code:trim-2-5')
ON CONFLICT (key) DO NOTHING;

-- ROLLBACK:
-- UPDATE module_flags SET enabled = true, parked_at = NULL WHERE updated_by = 'claude-code:trim-2-5';
-- (or DELETE FROM module_flags WHERE updated_by = 'claude-code:trim-2-5'; table holds park toggles only)
