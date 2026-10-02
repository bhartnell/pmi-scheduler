-- Task Handoff Queue: "Lab rotation timer bar flickers..." ticket, 2026-09-14.
-- lab_timer_state.updated_at has a `now()` DEFAULT but nothing set it on
-- UPDATE, so it stayed frozen at row-creation time no matter how many
-- times the row was patched (observed: version=10, updated_at ===
-- created_at to the microsecond). Anything reading updated_at for
-- staleness/"is this timer live" checks was reading a stale value.
-- Reuses the existing generic update_updated_at_column() trigger function
-- (see 00000000_baseline.sql / 20260324_ride_along_tables.sql) rather than
-- defining a per-table copy.

DROP TRIGGER IF EXISTS lab_timer_state_updated_at ON lab_timer_state;
CREATE TRIGGER lab_timer_state_updated_at
  BEFORE UPDATE ON lab_timer_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ROLLBACK:
-- DROP TRIGGER IF EXISTS lab_timer_state_updated_at ON lab_timer_state;
