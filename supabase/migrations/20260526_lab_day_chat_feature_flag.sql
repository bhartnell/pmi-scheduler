-- Feature flag for LabDayChat. Default OFF (false) after the
-- 2026-05-26 perf incident where the realtime subscription was
-- pinned as the suspect cause of widespread sluggishness during
-- a live lab. The chat component was stubbed out in commit
-- fcfd4ec5 as an emergency mitigation; this migration moves that
-- decision to a runtime flag so admins can flip it on for specific
-- lab days (e.g. NREMT testing days where the cohort wants chat
-- visible) without redeploying.
--
-- When 'false' (default): LabDayChat renders null.
-- When 'true':            LabDayChat renders the full realtime chat.
--
-- Toggle from /admin/settings.

INSERT INTO system_settings (key, value)
VALUES ('feature.lab_day_chat', 'false')
ON CONFLICT (key) DO NOTHING;
