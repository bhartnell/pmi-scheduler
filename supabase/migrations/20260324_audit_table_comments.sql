-- ============================================================================
-- Audit: Mark orphaned empty tables (no code references as of 2026-03-24)
--
-- These tables have 0 rows AND no references in app/, components/, or lib/.
-- They are candidates for removal in a future cleanup migration.
-- DO NOT delete — just add informational comments.
-- ============================================================================

-- Backup tables (created by prior data migrations, safe to remove)
COMMENT ON TABLE _backup_inventory_adjustments IS 'AUDIT: No code references found as of 2026-03-24. Backup table — candidate for removal.';
COMMENT ON TABLE _backup_inventory_barcodes IS 'AUDIT: No code references found as of 2026-03-24. Backup table — candidate for removal.';
COMMENT ON TABLE _backup_inventory_notifications IS 'AUDIT: No code references found as of 2026-03-24. Backup table — candidate for removal.';

-- Inventory v2 tables (replaced by newer inventory system)
COMMENT ON TABLE inventory_bin_contents IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE inventory_bin_transactions IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE inventory_bins IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE inventory_containers IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE inventory_locations IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE inventory_positions IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';

-- Supply tracking tables (no code references)
COMMENT ON TABLE supply_barcodes IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE supply_categories IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE supply_notifications IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE supply_transactions IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';

-- Printer/3D printing tables (no code references)
COMMENT ON TABLE print_failures IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE printer_hour_adjustments IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE printer_maintenance IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';

-- Case-based learning (partial implementation)
COMMENT ON TABLE case_analytics IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE case_flags IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE case_reviews IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';

-- Cohort tracking extras (no code references)
COMMENT ON TABLE cohort_key_dates IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE cohort_milestones IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE cohort_scenario_completions IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE cohort_skill_completions IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE cohort_tasks IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';

-- Custody/chain-of-custody (never implemented)
COMMENT ON TABLE custody_checkout_items IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE custody_checkouts IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';

-- Lab management extras (no code references)
COMMENT ON TABLE lab_day_checklists IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE lab_day_signups IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE lab_equipment_items IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE lab_equipment_tracking IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE lab_group_history IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';

-- Misc orphaned tables
COMMENT ON TABLE assigned_tasks IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE bin_contents IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE cert_notifications IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE email_templates IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE equipment_assignments IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE field_ride_requests IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE grade_access_log IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE library_checkouts IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE shift_trades IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE skill_drill_cases IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE student_field_rides IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE student_individual_tasks IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
COMMENT ON TABLE student_task_status IS 'AUDIT: No code references found as of 2026-03-24. Candidate for removal.';
