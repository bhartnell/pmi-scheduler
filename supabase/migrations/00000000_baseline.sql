-- ============================================================
-- BASELINE SCHEMA — Auto-generated 2026-03-22
-- Complete schema snapshot of the PMI EMS Scheduler database.
-- This file is for reference and new installations.
-- DO NOT run against an existing production database.
-- ============================================================

-- ===================
-- Extensions
-- ===================
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================
-- Tables
-- ===================
-- Table: _backup_checkouts
CREATE TABLE IF NOT EXISTS "_backup_checkouts" (
  "id" uuid,
  "student_id" uuid,
  "library_item_id" uuid,
  "checked_out_at" timestamptz,
  "due_date" date,
  "checked_in_at" timestamptz,
  "checked_out_by" uuid,
  "checked_in_by" uuid,
  "notes" text,
  "created_at" timestamptz
);

-- Table: _backup_inventory_adjustments
CREATE TABLE IF NOT EXISTS "_backup_inventory_adjustments" (
  "id" uuid,
  "item_id" uuid,
  "adjusted_by" uuid,
  "old_quantity" integer,
  "new_quantity" integer,
  "reason" text,
  "notes" text,
  "created_at" timestamptz
);

-- Table: _backup_inventory_barcodes
CREATE TABLE IF NOT EXISTS "_backup_inventory_barcodes" (
  "id" uuid,
  "item_id" uuid,
  "barcode" text,
  "barcode_type" text,
  "created_at" timestamptz
);

-- Table: _backup_inventory_categories
CREATE TABLE IF NOT EXISTS "_backup_inventory_categories" (
  "id" uuid,
  "name" text,
  "parent_category_id" uuid,
  "description" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "item_type" text,
  "sort_order" integer
);

-- Table: _backup_inventory_items
CREATE TABLE IF NOT EXISTS "_backup_inventory_items" (
  "id" uuid,
  "name" text,
  "sku" text,
  "category_id" uuid,
  "description" text,
  "manufacturer" text,
  "model_number" text,
  "total_quantity" integer,
  "available_quantity" integer,
  "reorder_point" integer,
  "reorder_quantity" integer,
  "unit_of_measure" text,
  "unit_cost" numeric(10,2),
  "tracks_expiration" boolean,
  "notes" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "isbn" text,
  "author" text,
  "publisher" text,
  "publication_year" integer,
  "edition" text,
  "page_count" integer,
  "cover_image_url" text,
  "is_library_item" boolean,
  "item_type" text,
  "is_active" boolean,
  "created_by" uuid,
  "updated_by" uuid
);

-- Table: _backup_inventory_notifications
CREATE TABLE IF NOT EXISTS "_backup_inventory_notifications" (
  "id" uuid,
  "item_id" uuid,
  "notification_type" text,
  "message" text,
  "read_at" timestamptz,
  "created_at" timestamptz
);

-- Table: _backup_library_items
CREATE TABLE IF NOT EXISTS "_backup_library_items" (
  "id" uuid,
  "isbn" text,
  "title" text,
  "author" text,
  "publisher" text,
  "edition" text,
  "publication_year" integer,
  "total_copies" integer,
  "available_copies" integer,
  "category" text,
  "subject" text,
  "cover_image_url" text,
  "description" text,
  "notes" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "barcode" text,
  "item_number" integer,
  "status" text,
  "condition" text,
  "location" text,
  "needs_label" boolean,
  "label_printed_at" timestamptz,
  "label_printed_by" uuid,
  "inventory_item_id" uuid
);

-- Table: access_cards
CREATE TABLE IF NOT EXISTS "access_cards" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "card_uid" text NOT NULL,
  "card_type" text DEFAULT 'standard'::text NOT NULL,
  "label" text,
  "lab_user_id" uuid,
  "student_id" uuid,
  "visitor_name" text,
  "visitor_organization" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "activated_at" timestamptz DEFAULT now(),
  "deactivated_at" timestamptz,
  "expires_at" timestamptz,
  "notes" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  PRIMARY KEY ("id")
);

-- Table: access_device_heartbeats
CREATE TABLE IF NOT EXISTS "access_device_heartbeats" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "access_device_id" uuid NOT NULL,
  "reported_at" timestamptz DEFAULT now() NOT NULL,
  "ip_address" text,
  "cpu_temp_c" numeric(5,2),
  "memory_used_mb" integer,
  "disk_used_percent" integer,
  "uptime_seconds" bigint,
  "sqlite_record_count" integer,
  "firmware_version" text,
  "wifi_signal_dbm" integer,
  PRIMARY KEY ("id")
);

-- Table: access_devices
CREATE TABLE IF NOT EXISTS "access_devices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "door_id" uuid NOT NULL,
  "device_name" text NOT NULL,
  "hardware_id" text,
  "ip_address" text,
  "firmware_version" text,
  "last_heartbeat_at" timestamptz,
  "last_sync_at" timestamptz,
  "is_online" boolean DEFAULT false,
  "config_version" integer DEFAULT 1,
  "force_sync" boolean DEFAULT false,
  "notes" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "force_restart" boolean DEFAULT false,
  "last_restart_requested_at" timestamptz,
  "last_restart_completed_at" timestamptz,
  PRIMARY KEY ("id")
);

-- Table: access_doors
CREATE TABLE IF NOT EXISTS "access_doors" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "location" text,
  "location_id" uuid,
  "description" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "unlock_duration_seconds" integer DEFAULT 5 NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  PRIMARY KEY ("id")
);

-- Table: access_logs
CREATE TABLE IF NOT EXISTS "access_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "access_door_id" uuid,
  "access_device_id" uuid,
  "card_uid" text,
  "access_card_id" uuid,
  "result" text NOT NULL,
  "leaf" integer,
  "event_at" timestamptz DEFAULT now() NOT NULL,
  "door_unlocked_at" timestamptz,
  "door_locked_at" timestamptz,
  "synced_at" timestamptz,
  "pi_event_id" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: access_requests
CREATE TABLE IF NOT EXISTS "access_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "requested_role" text DEFAULT 'volunteer_instructor'::text,
  "reason" text,
  "status" text DEFAULT 'pending'::text,
  "reviewed_by" text,
  "reviewed_at" timestamptz,
  "denial_reason" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: access_rules
CREATE TABLE IF NOT EXISTS "access_rules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "access_card_id" uuid NOT NULL,
  "access_door_id" uuid NOT NULL,
  "access_schedule_id" uuid,
  "priority" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  PRIMARY KEY ("id")
);

-- Table: access_schedules
CREATE TABLE IF NOT EXISTS "access_schedules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "monday" boolean DEFAULT true,
  "tuesday" boolean DEFAULT true,
  "wednesday" boolean DEFAULT true,
  "thursday" boolean DEFAULT true,
  "friday" boolean DEFAULT true,
  "saturday" boolean DEFAULT false,
  "sunday" boolean DEFAULT false,
  "start_time" time without time zone DEFAULT '06:00:00'::time without time zone NOT NULL,
  "end_time" time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
  "timezone" text DEFAULT 'America/Los_Angeles'::text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  PRIMARY KEY ("id")
);

-- Table: aemt_student_tracking
CREATE TABLE IF NOT EXISTS "aemt_student_tracking" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "cohort_id" uuid,
  "mce_complete" boolean DEFAULT false,
  "mce_date" date,
  "vax_uploaded" boolean DEFAULT false,
  "vax_received_date" date,
  "ridealong_completed_date" date,
  "ridealong_scanned" boolean DEFAULT false,
  "clinical_1_complete" boolean DEFAULT false,
  "clinical_1_date" date,
  "clinical_1_site" text,
  "clinical_2_complete" boolean DEFAULT false,
  "clinical_2_date" date,
  "clinical_2_site" text,
  "clinical_3_complete" boolean DEFAULT false,
  "clinical_3_date" date,
  "clinical_3_site" text,
  "vitals_tracker_date" date,
  "status" text DEFAULT 'active'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: affiliation_notifications_log
CREATE TABLE IF NOT EXISTS "affiliation_notifications_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "affiliation_id" uuid NOT NULL,
  "notification_type" text NOT NULL,
  "sent_date" date DEFAULT CURRENT_DATE NOT NULL,
  "sent_at" timestamptz DEFAULT now(),
  "recipients" text[],
  PRIMARY KEY ("id")
);

-- Table: agencies
CREATE TABLE IF NOT EXISTS "agencies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "abbreviation" text,
  "type" text NOT NULL,
  "address" text,
  "phone" text,
  "website" text,
  "notes" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "max_students_per_day" integer DEFAULT 2,
  "max_students_per_rotation" integer,
  "capacity_notes" text,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: agency_contacts
CREATE TABLE IF NOT EXISTS "agency_contacts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "agency_id" uuid,
  "name" text NOT NULL,
  "title" text,
  "department" text,
  "email" text,
  "phone" text,
  "is_primary" boolean DEFAULT false,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: ai_prompt_templates
CREATE TABLE IF NOT EXISTS "ai_prompt_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "prompt_text" text NOT NULL,
  "version" integer DEFAULT 1,
  "is_active" boolean DEFAULT true,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: alumni
CREATE TABLE IF NOT EXISTS "alumni" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "graduation_date" date,
  "program" text,
  "employer" text,
  "job_title" text,
  "employment_status" text,
  "continuing_education" text,
  "notes" text,
  "last_contact_date" date,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "first_name" text,
  "last_name" text,
  "cohort_id" uuid,
  PRIMARY KEY ("id")
);

-- Table: announcement_reads
CREATE TABLE IF NOT EXISTS "announcement_reads" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "announcement_id" uuid,
  "user_email" text NOT NULL,
  "read_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: announcements
CREATE TABLE IF NOT EXISTS "announcements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "priority" text DEFAULT 'info'::text,
  "audience" text DEFAULT 'all'::text,
  "start_date" timestamptz DEFAULT now(),
  "end_date" timestamptz,
  "is_active" boolean DEFAULT true,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "body" text,
  "target_audience" text DEFAULT 'all'::text,
  "starts_at" timestamptz DEFAULT now(),
  "ends_at" timestamptz,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: app_deep_links
CREATE TABLE IF NOT EXISTS "app_deep_links" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "route_pattern" text NOT NULL,
  "app_scheme" text DEFAULT 'pmi'::text,
  "description" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: approved_external_emails
CREATE TABLE IF NOT EXISTS "approved_external_emails" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "domain" text NOT NULL,
  "organization" text NOT NULL,
  "default_role" text DEFAULT 'pending'::text,
  "default_scope" text[],
  "approved_by" text NOT NULL,
  "approved_at" timestamptz DEFAULT now(),
  "revoked_at" timestamptz,
  "is_active" boolean DEFAULT true,
  "notes" text,
  PRIMARY KEY ("id")
);

-- Table: assessment_rubrics
CREATE TABLE IF NOT EXISTS "assessment_rubrics" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "rating_scale" text DEFAULT 'numeric_5'::text,
  "is_active" boolean DEFAULT true,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: assigned_tasks
CREATE TABLE IF NOT EXISTS "assigned_tasks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "assigned_by_email" text NOT NULL,
  "assigned_to_email" text NOT NULL,
  "status" text DEFAULT 'pending'::text,
  "priority" text DEFAULT 'medium'::text,
  "due_date" date,
  "completed_at" timestamptz,
  "completed_by_email" text,
  "related_url" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: attendance_appeals
CREATE TABLE IF NOT EXISTS "attendance_appeals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "absence_date" date NOT NULL,
  "reason" text NOT NULL,
  "documentation_url" text,
  "status" text DEFAULT 'pending'::text,
  "reviewed_by" text,
  "reviewed_at" timestamptz,
  "review_notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: audit_log
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "user_email" text,
  "user_role" text,
  "action" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" uuid,
  "resource_description" text,
  "ip_address" text,
  "user_agent" text,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: bin_contents
CREATE TABLE IF NOT EXISTS "bin_contents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "bin_id" uuid NOT NULL,
  "inventory_item_id" uuid NOT NULL,
  "quantity" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: bookable_resources
CREATE TABLE IF NOT EXISTS "bookable_resources" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "resource_type" text,
  "location" text,
  "capacity" integer,
  "requires_approval" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: broadcast_history
CREATE TABLE IF NOT EXISTS "broadcast_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "audience_type" text NOT NULL,
  "audience_filter" jsonb,
  "recipient_count" integer DEFAULT 0,
  "delivery_method" text NOT NULL,
  "priority" text DEFAULT 'normal'::text,
  "scheduled_at" timestamptz,
  "sent_at" timestamptz,
  "sent_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: bulk_operations_history
CREATE TABLE IF NOT EXISTS "bulk_operations_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "operation_type" text NOT NULL,
  "target_table" text NOT NULL,
  "affected_count" integer DEFAULT 0,
  "filters" jsonb,
  "changes" jsonb,
  "rollback_data" jsonb,
  "is_dry_run" boolean DEFAULT false,
  "executed_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: calendar_sync_log
CREATE TABLE IF NOT EXISTS "calendar_sync_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "run_at" timestamptz DEFAULT now() NOT NULL,
  "run_type" text DEFAULT 'cron'::text NOT NULL,
  "users_processed" integer DEFAULT 0 NOT NULL,
  "events_created" integer DEFAULT 0 NOT NULL,
  "events_updated" integer DEFAULT 0 NOT NULL,
  "events_deleted" integer DEFAULT 0 NOT NULL,
  "events_verified" integer DEFAULT 0 NOT NULL,
  "failures" integer DEFAULT 0 NOT NULL,
  "duration_ms" integer,
  "error_details" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: canonical_skills
CREATE TABLE IF NOT EXISTS "canonical_skills" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "canonical_name" text NOT NULL,
  "skill_category" text NOT NULL,
  "programs" text[] NOT NULL,
  "scope_notes" text,
  "paramedic_only" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: case_analytics
CREATE TABLE IF NOT EXISTS "case_analytics" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL,
  "question_id" text NOT NULL,
  "phase_id" text,
  "total_attempts" integer DEFAULT 0,
  "correct_attempts" integer DEFAULT 0,
  "avg_time_seconds" numeric(8,2) DEFAULT 0,
  "answer_distribution" jsonb DEFAULT '{}'::jsonb,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: case_assignments
CREATE TABLE IF NOT EXISTS "case_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL,
  "cohort_id" uuid NOT NULL,
  "assigned_by" uuid,
  "due_date" timestamptz,
  "min_score_threshold" numeric(5,2),
  "grading_mode" text DEFAULT 'best_attempt'::text,
  "gradebook_category" text DEFAULT 'Case Studies'::text,
  "points_possible" integer DEFAULT 100,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: case_briefs
CREATE TABLE IF NOT EXISTS "case_briefs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "category" text NOT NULL,
  "subcategory" text NOT NULL,
  "difficulty" text NOT NULL,
  "programs" text[] NOT NULL,
  "scenario" text NOT NULL,
  "special_instructions" text,
  "batch_name" text,
  "status" text DEFAULT 'pending'::text,
  "generated_case_id" uuid,
  "error_message" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: case_flags
CREATE TABLE IF NOT EXISTS "case_flags" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL,
  "flagged_by" uuid NOT NULL,
  "reason" text NOT NULL,
  "details" text,
  "status" text DEFAULT 'pending'::text,
  "reviewed_by" uuid,
  "reviewed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: case_practice_progress
CREATE TABLE IF NOT EXISTS "case_practice_progress" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "case_id" uuid NOT NULL,
  "attempt_number" integer DEFAULT 1 NOT NULL,
  "variant_seed" text,
  "current_phase" integer DEFAULT 0,
  "current_question" integer DEFAULT 0,
  "total_points" integer DEFAULT 0,
  "max_points" integer DEFAULT 0,
  "status" text DEFAULT 'in_progress'::text,
  "responses" jsonb DEFAULT '[]'::jsonb,
  "started_at" timestamptz DEFAULT now(),
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "practitioner_email" text,
  PRIMARY KEY ("id")
);

-- Table: case_responses
CREATE TABLE IF NOT EXISTS "case_responses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid,
  "case_id" uuid NOT NULL,
  "student_id" uuid,
  "student_email" text,
  "student_name" text,
  "student_initials" text,
  "phase_id" text NOT NULL,
  "question_id" text NOT NULL,
  "response" jsonb,
  "is_correct" boolean,
  "points_earned" integer DEFAULT 0,
  "time_taken_seconds" integer,
  "hints_used" integer DEFAULT 0,
  "attempt_number" integer DEFAULT 1,
  "submitted_at" timestamptz DEFAULT now(),
  "practitioner_email" text,
  PRIMARY KEY ("id")
);

-- Table: case_reviews
CREATE TABLE IF NOT EXISTS "case_reviews" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL,
  "reviewed_by" uuid NOT NULL,
  "status" text NOT NULL,
  "notes" text,
  "reviewed_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: case_sessions
CREATE TABLE IF NOT EXISTS "case_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL,
  "session_code" text NOT NULL,
  "instructor_email" text NOT NULL,
  "cohort_id" uuid,
  "status" text DEFAULT 'waiting'::text,
  "current_phase" integer DEFAULT 0,
  "current_question" integer DEFAULT 0,
  "settings" jsonb DEFAULT '{"anonymous": false, "time_limit": null, "allow_hints": true, "speed_bonus": false, "show_leaderboard": true, "show_results_live": false}'::jsonb,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: case_studies
CREATE TABLE IF NOT EXISTS "case_studies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "chief_complaint" text,
  "category" text,
  "subcategory" text,
  "difficulty" text DEFAULT 'intermediate'::text,
  "applicable_programs" text[] DEFAULT '{Paramedic}'::text[],
  "estimated_duration_minutes" integer DEFAULT 30,
  "patient_age" text,
  "patient_sex" text,
  "patient_weight" text,
  "patient_medical_history" text[],
  "patient_medications" text[],
  "patient_allergies" text,
  "dispatch_info" jsonb DEFAULT '{}'::jsonb,
  "scene_info" jsonb DEFAULT '{}'::jsonb,
  "phases" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "variables" jsonb DEFAULT '{}'::jsonb,
  "learning_objectives" text[] DEFAULT '{}'::text[],
  "critical_actions" text[] DEFAULT '{}'::text[],
  "common_errors" text[] DEFAULT '{}'::text[],
  "debrief_points" text[] DEFAULT '{}'::text[],
  "equipment_needed" text[] DEFAULT '{}'::text[],
  "author" text,
  "created_by" uuid,
  "visibility" text DEFAULT 'private'::text,
  "is_verified" boolean DEFAULT false,
  "flag_count" integer DEFAULT 0,
  "community_rating" numeric(3,2) DEFAULT 0,
  "usage_count" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "is_published" boolean DEFAULT false,
  "generated_by_ai" boolean DEFAULT false,
  "generation_prompt" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "content_review_status" text DEFAULT 'not_applicable'::text,
  "generation_brief_id" uuid,
  PRIMARY KEY ("id")
);

-- Table: ce_records
CREATE TABLE IF NOT EXISTS "ce_records" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "instructor_id" uuid NOT NULL,
  "certification_id" uuid NOT NULL,
  "title" text NOT NULL,
  "provider" text,
  "hours" numeric(5,2) NOT NULL,
  "category" text,
  "completion_date" date NOT NULL,
  "certificate_image_url" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: ce_requirements
CREATE TABLE IF NOT EXISTS "ce_requirements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cert_type" text NOT NULL,
  "display_name" text NOT NULL,
  "issuing_body" text NOT NULL,
  "cycle_years" integer DEFAULT 2 NOT NULL,
  "total_hours_required" integer NOT NULL,
  "category_requirements" jsonb,
  "notes" text,
  "source_url" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: cert_notifications
CREATE TABLE IF NOT EXISTS "cert_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "certification_id" uuid NOT NULL,
  "instructor_id" uuid NOT NULL,
  "notification_type" text NOT NULL,
  "sent_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: classrooms
CREATE TABLE IF NOT EXISTS "classrooms" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "rows" integer NOT NULL,
  "tables_per_row" integer NOT NULL,
  "seats_per_table" integer NOT NULL,
  "layout_config" jsonb,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: clinical_affiliations
CREATE TABLE IF NOT EXISTS "clinical_affiliations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "site_name" text NOT NULL,
  "agreement_status" text DEFAULT 'active'::text NOT NULL,
  "start_date" date,
  "expiration_date" date NOT NULL,
  "responsible_person" text,
  "responsible_person_email" text,
  "notes" text,
  "document_url" text,
  "auto_renew" boolean DEFAULT false,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: clinical_rotations
CREATE TABLE IF NOT EXISTS "clinical_rotations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "site_id" uuid,
  "rotation_date" date NOT NULL,
  "shift_start" time without time zone,
  "shift_end" time without time zone,
  "status" text DEFAULT 'scheduled'::text,
  "notes" text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: clinical_site_departments
CREATE TABLE IF NOT EXISTS "clinical_site_departments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "department" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: clinical_site_schedules
CREATE TABLE IF NOT EXISTS "clinical_site_schedules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "clinical_site_id" uuid,
  "institution" text DEFAULT 'PMI'::text NOT NULL,
  "days_of_week" text[] DEFAULT '{}'::text[] NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date,
  "notes" text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: clinical_site_visits
CREATE TABLE IF NOT EXISTS "clinical_site_visits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid,
  "departments" text[] DEFAULT '{}'::text[] NOT NULL,
  "visitor_id" uuid,
  "visitor_name" text NOT NULL,
  "visit_date" date NOT NULL,
  "visit_time" time without time zone,
  "cohort_id" uuid,
  "entire_class" boolean DEFAULT false,
  "comments" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" text,
  "agency_id" uuid,
  PRIMARY KEY ("id")
);

-- Table: clinical_sites
CREATE TABLE IF NOT EXISTS "clinical_sites" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "abbreviation" text NOT NULL,
  "system" text,
  "address" text,
  "phone" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "max_students_per_day" integer DEFAULT 2,
  "max_students_per_rotation" integer,
  "capacity_notes" text,
  "visit_monitoring_enabled" boolean DEFAULT true,
  "visit_alert_days" integer DEFAULT 14,
  "visit_urgent_days" integer DEFAULT 28,
  PRIMARY KEY ("id")
);

-- Table: clinical_task_definitions
CREATE TABLE IF NOT EXISTS "clinical_task_definitions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid,
  "phase" text NOT NULL,
  "task_name" text NOT NULL,
  "task_description" text,
  "due_date_type" text DEFAULT 'relative_start'::text,
  "due_date_offset" integer DEFAULT 0,
  "due_date_milestone" text,
  "source_table" text,
  "source_field" text,
  "source_condition" text,
  "is_required" boolean DEFAULT true,
  "notify_days_before" integer DEFAULT 7,
  "notify_on_due" boolean DEFAULT true,
  "notify_when_overdue" boolean DEFAULT true,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: clinical_task_templates
CREATE TABLE IF NOT EXISTS "clinical_task_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "program_type" text DEFAULT 'paramedic'::text,
  "is_default" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: clinical_visit_students
CREATE TABLE IF NOT EXISTS "clinical_visit_students" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "visit_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: closeout_documents
CREATE TABLE IF NOT EXISTS "closeout_documents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "internship_id" uuid NOT NULL,
  "doc_type" text NOT NULL,
  "file_url" text,
  "uploaded_by" text,
  "uploaded_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: closeout_surveys
CREATE TABLE IF NOT EXISTS "closeout_surveys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "internship_id" uuid,
  "survey_type" text NOT NULL,
  "preceptor_name" text,
  "agency_name" text,
  "responses" jsonb NOT NULL,
  "submitted_by" text,
  "submitted_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: cohort_key_dates
CREATE TABLE IF NOT EXISTS "cohort_key_dates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cohort_id" uuid,
  "cohort_start" date,
  "immunizations_due" date,
  "clinical_docs_due" date,
  "clinicals_begin" date,
  "clinicals_end" date,
  "internship_start_window" date,
  "phase_1_evals_due" date,
  "phase_2_evals_due" date,
  "snhd_paperwork_due" date,
  "graduation_date" date,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: cohort_milestones
CREATE TABLE IF NOT EXISTS "cohort_milestones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cohort_id" uuid,
  "milestone_type" text NOT NULL,
  "milestone_name" text,
  "due_date" date NOT NULL,
  "warning_days" integer DEFAULT 14,
  "critical_days" integer DEFAULT 7,
  "applies_to" text DEFAULT 'all'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: cohort_scenario_completions
CREATE TABLE IF NOT EXISTS "cohort_scenario_completions" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "cohort_id" uuid NOT NULL,
  "scenario_id" uuid NOT NULL,
  "lab_day_id" uuid,
  "station_id" uuid,
  "completed_date" date DEFAULT CURRENT_DATE,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: cohort_skill_completions
CREATE TABLE IF NOT EXISTS "cohort_skill_completions" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "cohort_id" uuid NOT NULL,
  "skill_id" uuid NOT NULL,
  "lab_day_id" uuid,
  "station_id" uuid,
  "completed_date" date DEFAULT CURRENT_DATE,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: cohort_tasks
CREATE TABLE IF NOT EXISTS "cohort_tasks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cohort_id" uuid,
  "template_id" uuid,
  "task_definition_id" uuid,
  "phase" text NOT NULL,
  "task_name" text NOT NULL,
  "task_description" text,
  "due_date" date,
  "source_table" text,
  "source_field" text,
  "is_required" boolean DEFAULT true,
  "is_active" boolean DEFAULT true,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: cohorts
CREATE TABLE IF NOT EXISTS "cohorts" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "program_id" uuid NOT NULL,
  "cohort_number" numeric(5,1) NOT NULL,
  "start_date" date,
  "expected_end_date" date,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "current_semester" integer DEFAULT 1,
  "semester_start_date" date,
  "semester_end_date" date,
  "semester" text,
  "end_date" date,
  "is_archived" boolean DEFAULT false,
  "archived_at" timestamptz,
  "archived_by" text,
  "archive_summary" jsonb,
  "track_clinical_hours" boolean DEFAULT false,
  PRIMARY KEY ("id")
);

-- Table: compliance_audit_log
CREATE TABLE IF NOT EXISTS "compliance_audit_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "audit_id" uuid,
  "completed_at" timestamptz DEFAULT now(),
  "completed_by" text NOT NULL,
  "result" text NOT NULL,
  "findings" text,
  "actions_taken" text,
  "script_output" jsonb,
  "next_due_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: compliance_audits
CREATE TABLE IF NOT EXISTS "compliance_audits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "audit_type" text NOT NULL,
  "frequency" text NOT NULL,
  "tool_method" text,
  "description" text,
  "last_completed_at" timestamptz,
  "last_completed_by" text,
  "last_result" text,
  "last_findings" text,
  "last_actions" text,
  "next_due_at" timestamptz,
  "is_overdue" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: compliance_document_types
CREATE TABLE IF NOT EXISTS "compliance_document_types" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_required" boolean DEFAULT true,
  "expiration_months" integer,
  "sort_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: custody_checkout_items
CREATE TABLE IF NOT EXISTS "custody_checkout_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "custody_checkout_id" uuid NOT NULL,
  "inventory_item_id" uuid NOT NULL,
  "quantity_checked_out" integer NOT NULL,
  "quantity_returned" integer DEFAULT 0,
  "quantity_consumed" integer,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: custody_checkouts
CREATE TABLE IF NOT EXISTS "custody_checkouts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "item_id" uuid,
  "student_id" uuid,
  "quantity" integer DEFAULT 1 NOT NULL,
  "checked_out_by" uuid,
  "checked_out_at" timestamptz DEFAULT now(),
  "due_date" date,
  "returned_at" timestamptz,
  "returned_to" uuid,
  "quantity_returned" integer,
  "status" text DEFAULT 'checked_out'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: custom_skills
CREATE TABLE IF NOT EXISTS "custom_skills" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "station_id" uuid,
  "name" text NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: dashboard_layout_defaults
CREATE TABLE IF NOT EXISTS "dashboard_layout_defaults" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "role" text NOT NULL,
  "layout" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_by" text,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: dashboard_layouts
CREATE TABLE IF NOT EXISTS "dashboard_layouts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_email" text NOT NULL,
  "layout" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: data_consent_agreements
CREATE TABLE IF NOT EXISTS "data_consent_agreements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_email" text NOT NULL,
  "user_role" text NOT NULL,
  "agreement_type" text NOT NULL,
  "agreement_version" integer DEFAULT 1,
  "accepted" boolean NOT NULL,
  "accepted_at" timestamptz,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: data_export_archives
CREATE TABLE IF NOT EXISTS "data_export_archives" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "export_type" text NOT NULL,
  "label" text,
  "cohort_id" uuid,
  "folder_path" text NOT NULL,
  "files" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "total_size" bigint DEFAULT 0,
  "total_records" integer DEFAULT 0,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "expires_at" timestamptz,
  "status" text DEFAULT 'completed'::text,
  PRIMARY KEY ("id")
);

-- Table: data_export_history
CREATE TABLE IF NOT EXISTS "data_export_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "export_type" text NOT NULL,
  "format" text NOT NULL,
  "filters" jsonb,
  "row_count" integer,
  "file_size" integer,
  "exported_by" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: deletion_requests
CREATE TABLE IF NOT EXISTS "deletion_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "item_type" text NOT NULL,
  "item_id" text NOT NULL,
  "item_name" text,
  "reason" text,
  "requested_by" uuid,
  "requested_at" timestamptz DEFAULT now(),
  "status" text DEFAULT 'pending'::text,
  "reviewed_by" uuid,
  "reviewed_at" timestamptz,
  PRIMARY KEY ("id")
);

-- Table: departments
CREATE TABLE IF NOT EXISTS "departments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "abbreviation" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: document_requests
CREATE TABLE IF NOT EXISTS "document_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "document_type" text NOT NULL,
  "requested_by" text,
  "due_date" date,
  "status" text DEFAULT 'pending'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: ekg_warmup_scores
CREATE TABLE IF NOT EXISTS "ekg_warmup_scores" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "score" integer NOT NULL,
  "max_score" integer DEFAULT 10,
  "is_baseline" boolean DEFAULT false,
  "is_self_reported" boolean DEFAULT false,
  "missed_rhythms" text[],
  "logged_by" uuid,
  "date" date DEFAULT CURRENT_DATE NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: email_log
CREATE TABLE IF NOT EXISTS "email_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "to_email" text NOT NULL,
  "subject" text NOT NULL,
  "notification_type" text,
  "sent_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: email_queue
CREATE TABLE IF NOT EXISTS "email_queue" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "to_email" text NOT NULL,
  "subject" text NOT NULL,
  "body_html" text NOT NULL,
  "status" text DEFAULT 'pending'::text,
  "attempts" integer DEFAULT 0,
  "sent_at" timestamptz,
  "error" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: email_template_customizations
CREATE TABLE IF NOT EXISTS "email_template_customizations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_key" text NOT NULL,
  "subject" text,
  "body_html" text,
  "is_active" boolean DEFAULT true,
  "updated_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: email_templates
CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "category" text,
  "is_active" boolean DEFAULT true,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: employment_verifications
CREATE TABLE IF NOT EXISTS "employment_verifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "internship_id" uuid,
  "student_name" text,
  "ssn_last4" text,
  "program" text,
  "phone" text,
  "email" text,
  "address" text,
  "company_name" text,
  "job_title" text,
  "company_address" text,
  "company_email" text,
  "company_phone" text,
  "company_fax" text,
  "start_date" date,
  "salary" text,
  "employment_status" text,
  "verifying_staff" text,
  "is_draft" boolean DEFAULT true,
  "submitted_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: emt_student_tracking
CREATE TABLE IF NOT EXISTS "emt_student_tracking" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "cohort_id" uuid,
  "mce_complete" boolean DEFAULT false,
  "mce_date" date,
  "vax_uploaded" boolean DEFAULT false,
  "vax_received_date" date,
  "ridealong_completed_date" date,
  "ridealong_scanned" boolean DEFAULT false,
  "vitals_tracker_date" date,
  "status" text DEFAULT 'active'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "vax_complete" boolean DEFAULT false,
  PRIMARY KEY ("id")
);

-- Table: equipment
CREATE TABLE IF NOT EXISTS "equipment" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "quantity" integer DEFAULT 1,
  "available_quantity" integer DEFAULT 1,
  "condition" text DEFAULT 'good'::text,
  "location" text,
  "last_maintenance" date,
  "next_maintenance" date,
  "low_stock_threshold" integer DEFAULT 1,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "maintenance_interval_days" integer,
  "is_out_of_service" boolean DEFAULT false,
  "out_of_service_at" timestamptz,
  "out_of_service_reason" text,
  PRIMARY KEY ("id")
);

-- Table: equipment_assignments
CREATE TABLE IF NOT EXISTS "equipment_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "equipment_item_id" uuid NOT NULL,
  "assigned_to_type" text NOT NULL,
  "assigned_to_name" text NOT NULL,
  "assigned_to_id" uuid,
  "assigned_by" uuid,
  "assigned_at" timestamptz DEFAULT now(),
  "expected_return_date" date,
  "returned_at" timestamptz,
  "returned_to" uuid,
  "status" text DEFAULT 'active'::text,
  "purpose" text,
  "condition_at_checkout" text,
  "condition_at_return" text,
  "notes" text,
  PRIMARY KEY ("id")
);

-- Table: equipment_categories
CREATE TABLE IF NOT EXISTS "equipment_categories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "parent_category_id" uuid,
  "sort_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: equipment_checkouts
CREATE TABLE IF NOT EXISTS "equipment_checkouts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "equipment_id" uuid NOT NULL,
  "lab_day_id" uuid,
  "quantity" integer DEFAULT 1,
  "checked_out_by" text,
  "checked_out_at" timestamptz DEFAULT now(),
  "checked_in_at" timestamptz,
  "checked_in_by" text,
  "condition_on_return" text,
  "notes" text,
  PRIMARY KEY ("id")
);

-- Table: equipment_items
CREATE TABLE IF NOT EXISTS "equipment_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "asset_tag" text,
  "serial_number" text,
  "category_id" uuid,
  "manufacturer" text,
  "model_number" text,
  "description" text,
  "status" text DEFAULT 'available'::text,
  "condition" text DEFAULT 'good'::text,
  "location_id" uuid,
  "purchase_date" date,
  "purchase_price" numeric(10,2),
  "warranty_expires" date,
  "last_maintenance_date" date,
  "next_maintenance_due" date,
  "assigned_to" text,
  "assigned_at" timestamptz,
  "notes" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  PRIMARY KEY ("id")
);

-- Table: equipment_maintenance
CREATE TABLE IF NOT EXISTS "equipment_maintenance" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "equipment_item_id" uuid NOT NULL,
  "maintenance_type" text NOT NULL,
  "description" text NOT NULL,
  "performed_by" text,
  "performed_at" date NOT NULL,
  "cost" numeric(10,2),
  "next_due_date" date,
  "parts_replaced" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "completed_by" uuid,
  "completed_at" timestamptz,
  "scheduled_date" date,
  "completed_date" date,
  "status" text DEFAULT 'scheduled'::text,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: error_logs
CREATE TABLE IF NOT EXISTS "error_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text,
  "user_email" text,
  "error_message" text NOT NULL,
  "error_stack" text,
  "page_url" text,
  "component_name" text,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: feedback_reports
CREATE TABLE IF NOT EXISTS "feedback_reports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "report_type" text DEFAULT 'bug'::text NOT NULL,
  "description" text NOT NULL,
  "page_url" text,
  "user_email" text,
  "user_agent" text,
  "status" text DEFAULT 'new'::text,
  "resolution_notes" text,
  "created_at" timestamptz DEFAULT now(),
  "resolved_at" timestamptz,
  "resolved_by" text,
  "priority" text DEFAULT 'medium'::text,
  "read_at" timestamptz,
  "read_by" text,
  "archived_at" timestamptz,
  "updated_at" timestamptz DEFAULT now(),
  "screenshot_url" text,
  PRIMARY KEY ("id")
);

-- Table: field_preceptors
CREATE TABLE IF NOT EXISTS "field_preceptors" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text,
  "phone" text,
  "agency_id" uuid,
  "agency_name" text,
  "station" text,
  "normal_schedule" text,
  "snhd_trained_date" date,
  "snhd_cert_expires" date,
  "max_students" integer DEFAULT 1,
  "is_active" boolean DEFAULT true,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "credentials" text,
  PRIMARY KEY ("id")
);

-- Table: field_ride_requests
CREATE TABLE IF NOT EXISTS "field_ride_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_name" text NOT NULL,
  "student_email" text NOT NULL,
  "student_cohort" text,
  "agency" text NOT NULL,
  "date_requested" date NOT NULL,
  "start_time" text,
  "duration" text,
  "unit_requested" text,
  "hours_category" text NOT NULL,
  "status" text DEFAULT 'pending'::text,
  "reviewed_by" uuid,
  "reviewed_at" timestamptz,
  "admin_notes" text,
  "public_link_id" text,
  "submitted_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: field_trip_attendance
CREATE TABLE IF NOT EXISTS "field_trip_attendance" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "field_trip_id" uuid,
  "student_id" uuid,
  "attended" boolean DEFAULT false,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: field_trips
CREATE TABLE IF NOT EXISTS "field_trips" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cohort_id" uuid,
  "title" text NOT NULL,
  "destination" text,
  "trip_date" date,
  "departure_time" time without time zone,
  "return_time" time without time zone,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "is_active" boolean DEFAULT true,
  PRIMARY KEY ("id")
);

-- Table: filament_adjustments
CREATE TABLE IF NOT EXISTS "filament_adjustments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "filament_type_id" uuid NOT NULL,
  "adjustment_type" text NOT NULL,
  "grams" integer NOT NULL,
  "quantity_before" integer NOT NULL,
  "quantity_after" integer NOT NULL,
  "reason" text NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  PRIMARY KEY ("id")
);

-- Table: filament_purchases
CREATE TABLE IF NOT EXISTS "filament_purchases" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "filament_type_id" uuid NOT NULL,
  "purchase_date" date DEFAULT CURRENT_DATE NOT NULL,
  "spool_count" integer NOT NULL,
  "grams_per_spool" integer NOT NULL,
  "total_grams" integer,
  "cost_per_spool" numeric(10,2) NOT NULL,
  "total_cost" numeric(10,2),
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  PRIMARY KEY ("id")
);

-- Table: filament_types
CREATE TABLE IF NOT EXISTS "filament_types" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "material" text DEFAULT 'PLA'::text NOT NULL,
  "cost_per_unit" numeric(10,2) DEFAULT 20.00 NOT NULL,
  "unit_weight_grams" integer DEFAULT 1000 NOT NULL,
  "cost_per_kg" numeric(10,2),
  "color" text NOT NULL,
  "notes" text,
  "is_active" boolean DEFAULT true,
  "quantity_grams" numeric DEFAULT 0,
  "low_stock_threshold_grams" integer DEFAULT 200,
  "is_archived" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "color_hex" text,
  PRIMARY KEY ("id")
);

-- Table: google_calendar_events
CREATE TABLE IF NOT EXISTS "google_calendar_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_email" text NOT NULL,
  "google_event_id" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "lab_day_id" uuid,
  "shift_id" uuid,
  "event_summary" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: grade_access_log
CREATE TABLE IF NOT EXISTS "grade_access_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_email" text NOT NULL,
  "user_role" text NOT NULL,
  "student_id" uuid,
  "data_type" text,
  "action" text,
  "ip_address" text,
  "accessed_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: guest_access
CREATE TABLE IF NOT EXISTS "guest_access" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "access_code" text,
  "lab_day_id" uuid,
  "assigned_role" text,
  "expires_at" date,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: import_history
CREATE TABLE IF NOT EXISTS "import_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "import_type" text NOT NULL,
  "file_name" text,
  "records_total" integer,
  "records_imported" integer,
  "records_failed" integer,
  "error_log" jsonb,
  "imported_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: incidents
CREATE TABLE IF NOT EXISTS "incidents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "incident_date" date NOT NULL,
  "incident_time" time without time zone,
  "location" text,
  "severity" text,
  "description" text NOT NULL,
  "people_involved" text[],
  "witnesses" text[],
  "actions_taken" text,
  "follow_up_required" boolean DEFAULT false,
  "follow_up_notes" text,
  "status" text DEFAULT 'open'::text,
  "resolved_by" text,
  "resolved_at" timestamptz,
  "osha_reportable" boolean DEFAULT false,
  "reported_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: instructor_availability
CREATE TABLE IF NOT EXISTS "instructor_availability" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "instructor_id" uuid,
  "date" date NOT NULL,
  "start_time" time without time zone,
  "end_time" time without time zone,
  "is_all_day" boolean DEFAULT false,
  "notes" text,
  "recurrence_rule" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: instructor_certifications
CREATE TABLE IF NOT EXISTS "instructor_certifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "instructor_id" uuid NOT NULL,
  "cert_name" text NOT NULL,
  "cert_number" text,
  "issuing_body" text,
  "issue_date" date,
  "expiration_date" date NOT NULL,
  "card_image_url" text,
  "ce_requirement_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "verification_status" text DEFAULT 'pending'::text,
  "verified_by" text,
  "verified_at" timestamptz,
  "verification_notes" text,
  "document_url" text,
  PRIMARY KEY ("id")
);

-- Table: instructor_daily_notes
CREATE TABLE IF NOT EXISTS "instructor_daily_notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "instructor_id" uuid,
  "note_date" date NOT NULL,
  "content" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "instructor_email" text,
  PRIMARY KEY ("id")
);

-- Table: instructor_tasks
CREATE TABLE IF NOT EXISTS "instructor_tasks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "assigned_by" uuid,
  "assigned_to" uuid,
  "due_date" date,
  "priority" text DEFAULT 'medium'::text,
  "status" text DEFAULT 'pending'::text,
  "completed_at" timestamptz,
  "completion_notes" text,
  "attachment_url" text,
  "related_link" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "completion_mode" text DEFAULT 'any'::text,
  "created_by" uuid,
  PRIMARY KEY ("id")
);

-- Table: instructor_time_entries
CREATE TABLE IF NOT EXISTS "instructor_time_entries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "instructor_email" text NOT NULL,
  "lab_day_id" uuid,
  "clock_in" timestamptz NOT NULL,
  "clock_out" timestamptz,
  "status" text DEFAULT 'pending'::text,
  "approved_by" text,
  "approved_at" timestamptz,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: internship_meetings
CREATE TABLE IF NOT EXISTS "internship_meetings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_internship_id" uuid,
  "student_id" uuid,
  "meeting_type" text NOT NULL,
  "scheduled_date" date,
  "scheduled_time" time without time zone,
  "location" text,
  "attendees" text[],
  "status" text DEFAULT 'scheduled'::text,
  "completed_at" timestamptz,
  "notes" text,
  "action_items" text[],
  "follow_up_needed" boolean DEFAULT false,
  "follow_up_date" date,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: inventory_bin_contents
CREATE TABLE IF NOT EXISTS "inventory_bin_contents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "bin_id" uuid,
  "item_id" uuid,
  "quantity" integer DEFAULT 0 NOT NULL,
  "expiration_date" date,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: inventory_bin_transactions
CREATE TABLE IF NOT EXISTS "inventory_bin_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "bin_content_id" uuid,
  "transaction_type" text NOT NULL,
  "quantity" integer NOT NULL,
  "performed_by" uuid,
  "reason" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: inventory_bins
CREATE TABLE IF NOT EXISTS "inventory_bins" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "bin_code" text NOT NULL,
  "location_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "barcode" text,
  "is_active" boolean DEFAULT true,
  "inventory_item_id" uuid,
  "color" text,
  "notes" text,
  "bin_type" text DEFAULT 'single_item'::text,
  PRIMARY KEY ("id")
);

-- Table: inventory_containers
CREATE TABLE IF NOT EXISTS "inventory_containers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "room_id" uuid NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: inventory_locations
CREATE TABLE IF NOT EXISTS "inventory_locations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: inventory_positions
CREATE TABLE IF NOT EXISTS "inventory_positions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "container_id" uuid NOT NULL,
  "name" text NOT NULL,
  "qr_code_url" text,
  "sort_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: inventory_rooms
CREATE TABLE IF NOT EXISTS "inventory_rooms" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_checklist_templates
CREATE TABLE IF NOT EXISTS "lab_checklist_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "station_type" text NOT NULL,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_default" boolean DEFAULT false,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_day_attendance
CREATE TABLE IF NOT EXISTS "lab_day_attendance" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "status" text NOT NULL,
  "notes" text,
  "recorded_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "marked_by" text,
  PRIMARY KEY ("id")
);

-- Table: lab_day_checklist_items
CREATE TABLE IF NOT EXISTS "lab_day_checklist_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "title" text NOT NULL,
  "is_completed" boolean DEFAULT false,
  "completed_by" uuid,
  "completed_at" timestamptz,
  "is_auto_generated" boolean DEFAULT false,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_day_checklists
CREATE TABLE IF NOT EXISTS "lab_day_checklists" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "item_text" text NOT NULL,
  "is_completed" boolean DEFAULT false,
  "completed_by" text,
  "completed_at" timestamptz,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_day_costs
CREATE TABLE IF NOT EXISTS "lab_day_costs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "category" text NOT NULL,
  "description" text NOT NULL,
  "amount" numeric(10,2) NOT NULL,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_day_debrief_notes
CREATE TABLE IF NOT EXISTS "lab_day_debrief_notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "author_id" uuid,
  "author_name" text,
  "category" text DEFAULT 'general'::text,
  "content" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz,
  PRIMARY KEY ("id")
);

-- Table: lab_day_debriefs
CREATE TABLE IF NOT EXISTS "lab_day_debriefs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "content" text,
  "author" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_day_equipment
CREATE TABLE IF NOT EXISTS "lab_day_equipment" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "name" text NOT NULL,
  "quantity" integer DEFAULT 1,
  "status" text DEFAULT 'needed'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "checked_out_by" text,
  "checked_out_at" timestamptz,
  "returned_by" text,
  "returned_at" timestamptz,
  "condition_notes" text,
  "checked_out_by_name" text,
  PRIMARY KEY ("id")
);

-- Table: lab_day_roles
CREATE TABLE IF NOT EXISTS "lab_day_roles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid,
  "instructor_id" uuid,
  "role" text NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_day_signups
CREATE TABLE IF NOT EXISTS "lab_day_signups" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "status" text DEFAULT 'registered'::text,
  "registered_at" timestamptz DEFAULT now(),
  "cancelled_at" timestamptz,
  PRIMARY KEY ("id")
);

-- Table: lab_day_student_queue
CREATE TABLE IF NOT EXISTS "lab_day_student_queue" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid,
  "student_id" uuid,
  "station_id" uuid,
  "status" text DEFAULT 'queued'::text,
  "queued_at" timestamptz DEFAULT now(),
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "result" text,
  "evaluation_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_day_templates
CREATE TABLE IF NOT EXISTS "lab_day_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "template_data" jsonb NOT NULL,
  "is_shared" boolean DEFAULT false,
  "created_by" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "category" text DEFAULT 'other'::text,
  "program" text,
  "semester" integer,
  "week_number" integer,
  "day_number" integer,
  "instructor_count" integer,
  "is_anchor" boolean DEFAULT false,
  "anchor_type" text,
  "requires_review" boolean DEFAULT false,
  "review_notes" text,
  PRIMARY KEY ("id")
);

-- Table: lab_days
CREATE TABLE IF NOT EXISTS "lab_days" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "date" date NOT NULL,
  "cohort_id" uuid NOT NULL,
  "semester" integer,
  "week_number" integer,
  "day_number" integer,
  "num_rotations" integer DEFAULT 4,
  "rotation_duration" integer DEFAULT 30,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "title" varchar(255),
  "start_time" time without time zone,
  "end_time" time without time zone,
  "assigned_timer_id" uuid,
  "needs_coverage" boolean DEFAULT false,
  "coverage_needed" integer DEFAULT 0,
  "coverage_note" text,
  "source_template_id" uuid,
  "checkin_token" text,
  "checkin_enabled" boolean DEFAULT false,
  "lab_mode" text DEFAULT 'group_rotations'::text,
  PRIMARY KEY ("id")
);

-- Table: lab_equipment_items
CREATE TABLE IF NOT EXISTS "lab_equipment_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "name" text NOT NULL,
  "quantity" integer DEFAULT 1,
  "status" text DEFAULT 'checked_out'::text NOT NULL,
  "station_id" uuid,
  "notes" text,
  "checked_out_by" uuid,
  "returned_by" uuid,
  "returned_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_equipment_tracking
CREATE TABLE IF NOT EXISTS "lab_equipment_tracking" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "station_id" uuid,
  "item_name" text NOT NULL,
  "quantity" integer DEFAULT 1,
  "status" text DEFAULT 'checked_out'::text,
  "notes" text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_group_assignment_history
CREATE TABLE IF NOT EXISTS "lab_group_assignment_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid,
  "student_id" uuid,
  "action" text,
  "from_group_id" uuid,
  "to_group_id" uuid,
  "changed_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_group_history
CREATE TABLE IF NOT EXISTS "lab_group_history" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "student_id" uuid NOT NULL,
  "from_group_id" uuid,
  "to_group_id" uuid,
  "changed_at" timestamptz DEFAULT now(),
  "changed_by" text,
  "reason" text,
  PRIMARY KEY ("id")
);

-- Table: lab_group_members
CREATE TABLE IF NOT EXISTS "lab_group_members" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "lab_group_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "assigned_at" timestamptz DEFAULT now(),
  "assigned_by" text,
  PRIMARY KEY ("id")
);

-- Table: lab_groups
CREATE TABLE IF NOT EXISTS "lab_groups" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "cohort_id" uuid NOT NULL,
  "name" text NOT NULL,
  "display_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "is_locked" boolean DEFAULT false,
  "locked_by" text,
  "locked_at" timestamptz,
  PRIMARY KEY ("id")
);

-- Table: lab_stations
CREATE TABLE IF NOT EXISTS "lab_stations" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "station_number" integer NOT NULL,
  "scenario_id" uuid,
  "skill_name" text,
  "custom_title" text,
  "station_details" text,
  "instructor_id" uuid,
  "additional_instructor_id" uuid,
  "location" text,
  "equipment_needed" text,
  "documentation_required" boolean DEFAULT false,
  "platinum_required" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "instructor_name" text,
  "instructor_email" text,
  "room" text,
  "rotation_minutes" integer DEFAULT 30,
  "num_rotations" integer DEFAULT 4,
  "station_type" text DEFAULT 'scenario'::text,
  "notes" text,
  "skill_sheet_url" text,
  "instructions_url" text,
  "station_notes" text,
  "metadata" jsonb,
  "drill_ids" uuid[] DEFAULT '{}'::uuid[],
  PRIMARY KEY ("id")
);

-- Table: lab_template_stations
CREATE TABLE IF NOT EXISTS "lab_template_stations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "station_type" text NOT NULL,
  "station_name" text,
  "skills" jsonb DEFAULT '[]'::jsonb,
  "scenario_id" uuid,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "scenario_title" text,
  "difficulty" text,
  "notes" text,
  "metadata" jsonb,
  PRIMARY KEY ("id")
);

-- Table: lab_template_versions
CREATE TABLE IF NOT EXISTS "lab_template_versions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "version_number" integer DEFAULT 1 NOT NULL,
  "snapshot" jsonb NOT NULL,
  "change_summary" text,
  "source_lab_day_id" uuid,
  "created_by" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_timer_ready_status
CREATE TABLE IF NOT EXISTS "lab_timer_ready_status" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid,
  "station_id" uuid,
  "user_email" text NOT NULL,
  "user_name" text,
  "is_ready" boolean DEFAULT false,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lab_timer_state
CREATE TABLE IF NOT EXISTS "lab_timer_state" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid,
  "rotation_number" integer DEFAULT 1,
  "status" text DEFAULT 'stopped'::text,
  "started_at" timestamptz,
  "paused_at" timestamptz,
  "elapsed_when_paused" integer DEFAULT 0,
  "duration_seconds" integer NOT NULL,
  "debrief_seconds" integer DEFAULT 300,
  "mode" text DEFAULT 'countdown'::text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "rotation_acknowledged" boolean DEFAULT true,
  "version" integer DEFAULT 0,
  PRIMARY KEY ("id")
);

-- Table: lab_users
CREATE TABLE IF NOT EXISTS "lab_users" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "role" text DEFAULT 'instructor'::text,
  "avatar_url" text,
  "is_active" boolean DEFAULT true,
  "last_login" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "approved_at" timestamptz,
  "approved_by" uuid,
  "department_id" uuid,
  "status" text DEFAULT 'active'::text,
  "totp_secret" text,
  "totp_enabled" boolean DEFAULT false,
  "totp_backup_codes" text[],
  "totp_verified_at" timestamptz,
  "is_part_time" boolean DEFAULT false,
  "google_refresh_token" text,
  "google_token_expires_at" timestamptz,
  "google_calendar_connected" boolean DEFAULT false,
  "google_calendar_scope" text DEFAULT 'freebusy'::text,
  "google_calendar_ids" text[] DEFAULT '{}'::text[],
  "agency_affiliation" text,
  "agency_scope" text[] DEFAULT '{}'::text[],
  "auth_provider" text DEFAULT 'google'::text,
  PRIMARY KEY ("id")
);

-- Table: lab_week_templates
CREATE TABLE IF NOT EXISTS "lab_week_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "program_id" uuid,
  "semester" text,
  "week_number" integer,
  "num_days" integer DEFAULT 5,
  "days" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_default" boolean DEFAULT false,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: learning_plan_notes
CREATE TABLE IF NOT EXISTS "learning_plan_notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL,
  "note" text NOT NULL,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: learning_plans
CREATE TABLE IF NOT EXISTS "learning_plans" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "goals" text,
  "accommodations" jsonb DEFAULT '[]'::jsonb,
  "review_date" date,
  "is_active" boolean DEFAULT true,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: library_checkouts
CREATE TABLE IF NOT EXISTS "library_checkouts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "library_copy_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "checked_out_by" uuid,
  "checked_out_at" timestamptz DEFAULT now(),
  "due_date" date NOT NULL,
  "returned_at" timestamptz,
  "returned_to" uuid,
  "status" text DEFAULT 'active'::text NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: library_copies
CREATE TABLE IF NOT EXISTS "library_copies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "library_item_id" uuid NOT NULL,
  "barcode" text NOT NULL,
  "copy_number" integer NOT NULL,
  "status" text DEFAULT 'available'::text NOT NULL,
  "condition" text DEFAULT 'good'::text,
  "location" text,
  "notes" text,
  "needs_label" boolean DEFAULT false,
  "label_printed_at" timestamptz,
  "label_printed_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: library_items
CREATE TABLE IF NOT EXISTS "library_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "isbn" text,
  "title" text NOT NULL,
  "author" text,
  "publisher" text,
  "edition" text,
  "publication_year" integer,
  "subject" text,
  "category" text,
  "cover_image_url" text,
  "description" text,
  "notes" text,
  "total_copies" integer DEFAULT 0 NOT NULL,
  "available_copies" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: library_scanning_sessions
CREATE TABLE IF NOT EXISTS "library_scanning_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_type" text NOT NULL,
  "user_id" uuid NOT NULL,
  "started_at" timestamptz DEFAULT now(),
  "completed_at" timestamptz,
  "student_id" uuid,
  "due_date" date,
  "scanned_items" jsonb DEFAULT '[]'::jsonb,
  "notes" text,
  PRIMARY KEY ("id")
);

-- Table: locations
CREATE TABLE IF NOT EXISTS "locations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "parent_id" uuid,
  "name" text NOT NULL,
  "qr_code" text NOT NULL,
  "full_path" text,
  "location_type" text NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "is_lab_room" boolean DEFAULT false,
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_assessments
CREATE TABLE IF NOT EXISTS "lvfr_aemt_assessments" (
  "id" text NOT NULL,
  "category" text NOT NULL,
  "day_number" integer,
  "date" date,
  "title" text NOT NULL,
  "question_count" integer,
  "chapters" text[],
  "pass_score" integer DEFAULT 80,
  "note" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_chapters
CREATE TABLE IF NOT EXISTS "lvfr_aemt_chapters" (
  "id" text NOT NULL,
  "number" integer NOT NULL,
  "title" text NOT NULL,
  "module_id" text,
  "teaching_day" jsonb,
  "estimated_lecture_min" integer DEFAULT 0,
  "estimated_lab_min" integer DEFAULT 0,
  "key_topics" text[],
  "note" text,
  "status" text DEFAULT 'not_started'::text,
  "completed_date" date,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_content_blocks
CREATE TABLE IF NOT EXISTS "lvfr_aemt_content_blocks" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "duration_min" integer NOT NULL,
  "block_type" text NOT NULL,
  "min_instructors" integer DEFAULT 1,
  "equipment" text[],
  "chapter_id" text,
  "module_id" text,
  "can_split" boolean DEFAULT false,
  "notes" text,
  "color" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_course_days
CREATE TABLE IF NOT EXISTS "lvfr_aemt_course_days" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "day_number" integer NOT NULL,
  "date" date NOT NULL,
  "day_of_week" text NOT NULL,
  "week_number" integer NOT NULL,
  "module_id" text,
  "day_type" text NOT NULL,
  "title" text,
  "chapters_covered" text[],
  "has_lab" boolean DEFAULT false,
  "lab_name" text,
  "has_exam" boolean DEFAULT false,
  "exam_name" text,
  "exam_module" text,
  "has_quiz" boolean DEFAULT false,
  "quiz_chapters" text[],
  "time_blocks" jsonb,
  "reinforcement_activities" jsonb,
  "status" text DEFAULT 'scheduled'::text,
  "completion_notes" text,
  "completed_by" text,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_files
CREATE TABLE IF NOT EXISTS "lvfr_aemt_files" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "file_url" text NOT NULL,
  "file_type" text,
  "file_size" integer,
  "module_id" text,
  "chapter_id" text,
  "day_number" integer,
  "uploaded_by" uuid,
  "uploaded_at" timestamptz DEFAULT now(),
  "visible_to_students" boolean DEFAULT true,
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_grades
CREATE TABLE IF NOT EXISTS "lvfr_aemt_grades" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "assessment_id" text,
  "date_taken" date,
  "score_percent" numeric,
  "passed" boolean,
  "questions_correct" integer,
  "questions_total" integer,
  "source" text DEFAULT 'manual'::text,
  "imported_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_instructor_assignments
CREATE TABLE IF NOT EXISTS "lvfr_aemt_instructor_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "day_number" integer NOT NULL,
  "date" date NOT NULL,
  "primary_instructor_id" uuid,
  "secondary_instructor_id" uuid,
  "additional_instructors" uuid[],
  "min_instructors" integer DEFAULT 1,
  "notes" text,
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_instructor_availability
CREATE TABLE IF NOT EXISTS "lvfr_aemt_instructor_availability" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "instructor_id" uuid,
  "date" date NOT NULL,
  "am1_available" boolean DEFAULT false,
  "mid_available" boolean DEFAULT false,
  "pm1_available" boolean DEFAULT false,
  "pm2_available" boolean DEFAULT false,
  "status" text DEFAULT 'available'::text,
  "notes" text,
  "source" text DEFAULT 'manual'::text,
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_medications
CREATE TABLE IF NOT EXISTS "lvfr_aemt_medications" (
  "id" text NOT NULL,
  "generic_name" text NOT NULL,
  "brand_names" text[],
  "drug_class" text,
  "mechanism_of_action" text,
  "indications" text[],
  "contraindications" text[],
  "dose_adult" text,
  "dose_pediatric" text,
  "route" text[],
  "onset" text,
  "duration" text,
  "side_effects" text[],
  "special_considerations" text,
  "snhd_formulary" boolean DEFAULT false,
  "checkpoint_blanks" text[],
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_modules
CREATE TABLE IF NOT EXISTS "lvfr_aemt_modules" (
  "id" text NOT NULL,
  "number" integer NOT NULL,
  "name" text NOT NULL,
  "chapters" text[],
  "exam_day" integer,
  "week_range" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_pharm_checkpoints
CREATE TABLE IF NOT EXISTS "lvfr_aemt_pharm_checkpoints" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "practitioner_email" text,
  "checkpoint_date" date,
  "difficulty_level" integer,
  "medications_tested" text[],
  "responses" jsonb,
  "score_percent" numeric,
  "passed" boolean,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_plan_instances
CREATE TABLE IF NOT EXISTS "lvfr_aemt_plan_instances" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid,
  "name" text NOT NULL,
  "start_date" date NOT NULL,
  "status" text DEFAULT 'draft'::text,
  "published_at" timestamptz,
  "published_by" uuid,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_plan_placements
CREATE TABLE IF NOT EXISTS "lvfr_aemt_plan_placements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid,
  "content_block_id" text,
  "day_number" integer NOT NULL,
  "date" date,
  "start_time" time without time zone NOT NULL,
  "end_time" time without time zone NOT NULL,
  "duration_min" integer NOT NULL,
  "instructor_id" uuid,
  "instructor_name" text,
  "confirmed" boolean DEFAULT false,
  "confirmed_by" text,
  "confirmed_at" timestamptz,
  "custom_title" text,
  "custom_notes" text,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_plan_templates
CREATE TABLE IF NOT EXISTS "lvfr_aemt_plan_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "total_weeks" integer DEFAULT 10,
  "days_per_week" integer DEFAULT 3,
  "class_days" text[] DEFAULT ARRAY['Tuesday'::text, 'Wednesday'::text, 'Thursday'::text],
  "day_start_time" time without time zone DEFAULT '07:30:00'::time without time zone,
  "day_end_time" time without time zone DEFAULT '15:30:00'::time without time zone,
  "lunch_start" time without time zone DEFAULT '12:00:00'::time without time zone,
  "lunch_end" time without time zone DEFAULT '13:00:00'::time without time zone,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "placement_snapshot" jsonb,
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_prerequisites
CREATE TABLE IF NOT EXISTS "lvfr_aemt_prerequisites" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "block_id" text NOT NULL,
  "requires_block_id" text NOT NULL,
  "rule_type" text DEFAULT 'must_precede'::text,
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_shift_patterns
CREATE TABLE IF NOT EXISTS "lvfr_aemt_shift_patterns" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "instructor_id" uuid,
  "pattern_type" text,
  "pattern_config" jsonb,
  "effective_start" date,
  "effective_end" date,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_skill_attempts
CREATE TABLE IF NOT EXISTS "lvfr_aemt_skill_attempts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "skill_id" text,
  "attempt_number" integer DEFAULT 1,
  "date" date,
  "evaluator_id" uuid,
  "result" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_skill_status
CREATE TABLE IF NOT EXISTS "lvfr_aemt_skill_status" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "skill_id" text,
  "status" text DEFAULT 'not_started'::text,
  "total_attempts" integer DEFAULT 0,
  "last_attempt_date" date,
  "completed_date" date,
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_skills
CREATE TABLE IF NOT EXISTS "lvfr_aemt_skills" (
  "id" text NOT NULL,
  "category" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "nremt_tested" boolean DEFAULT false,
  "introduced_day" integer,
  "practice_days" int4[],
  "evaluation_day" integer,
  "min_practice_attempts" integer DEFAULT 1,
  "equipment_needed" text[],
  "safety_note" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: lvfr_aemt_supplementary_days
CREATE TABLE IF NOT EXISTS "lvfr_aemt_supplementary_days" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "day_number" integer,
  "date" date NOT NULL,
  "day_of_week" text,
  "week_number" integer,
  "title" text,
  "description" text,
  "time_start" text,
  "time_end" text,
  "type" text DEFAULT 'supplementary'::text,
  "instructor" text,
  "instructor_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: medications
CREATE TABLE IF NOT EXISTS "medications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "generic_name" text,
  "drug_class" text,
  "indications" text,
  "contraindications" text,
  "side_effects" text,
  "dosing" jsonb DEFAULT '{}'::jsonb,
  "routes" text[],
  "notes" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: mentorship_logs
CREATE TABLE IF NOT EXISTS "mentorship_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "pair_id" uuid NOT NULL,
  "meeting_date" date NOT NULL,
  "duration_minutes" integer,
  "topics" text,
  "notes" text,
  "logged_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: mentorship_pairs
CREATE TABLE IF NOT EXISTS "mentorship_pairs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "mentor_id" uuid NOT NULL,
  "mentee_id" uuid NOT NULL,
  "goals" text,
  "start_date" date DEFAULT CURRENT_DATE,
  "end_date" date,
  "status" text DEFAULT 'active'::text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: notifications_log
CREATE TABLE IF NOT EXISTS "notifications_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "type" text NOT NULL,
  "recipient_email" text NOT NULL,
  "recipient_name" text,
  "subject" text,
  "calendar_event_id" text,
  "calendar_event_link" text,
  "event_start_time" timestamptz,
  "event_end_time" timestamptz,
  "email_template" text,
  "email_body" text,
  "poll_id" uuid,
  "internship_id" uuid,
  "status" text DEFAULT 'sent'::text NOT NULL,
  "error_message" text,
  "sent_by_email" text NOT NULL,
  "sent_by_name" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: onboarding_assignments
CREATE TABLE IF NOT EXISTS "onboarding_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "instructor_email" text NOT NULL,
  "assigned_by" text NOT NULL,
  "mentor_email" text,
  "start_date" date DEFAULT CURRENT_DATE NOT NULL,
  "target_completion_date" date,
  "status" text DEFAULT 'active'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "completed_at" timestamptz,
  "total_elapsed_days" integer,
  "instructor_type" text DEFAULT 'full_time'::text,
  "actual_completion_date" date,
  PRIMARY KEY ("id")
);

-- Table: onboarding_events
CREATE TABLE IF NOT EXISTS "onboarding_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_type" text NOT NULL,
  "assignment_id" uuid,
  "task_id" uuid,
  "phase_id" uuid,
  "actor_email" text NOT NULL,
  "actor_role" text,
  "target_email" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: onboarding_evidence
CREATE TABLE IF NOT EXISTS "onboarding_evidence" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_progress_id" uuid NOT NULL,
  "file_name" text NOT NULL,
  "file_type" text,
  "file_size_bytes" integer,
  "storage_path" text NOT NULL,
  "uploaded_by" text NOT NULL,
  "uploaded_at" timestamptz DEFAULT now(),
  "notes" text,
  PRIMARY KEY ("id")
);

-- Table: onboarding_phase_progress
CREATE TABLE IF NOT EXISTS "onboarding_phase_progress" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "assignment_id" uuid NOT NULL,
  "phase_id" uuid NOT NULL,
  "status" text DEFAULT 'pending'::text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "elapsed_days" integer,
  "total_task_minutes" integer,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: onboarding_phases
CREATE TABLE IF NOT EXISTS "onboarding_phases" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "target_days_start" integer DEFAULT 0,
  "target_days_end" integer,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: onboarding_task_dependencies
CREATE TABLE IF NOT EXISTS "onboarding_task_dependencies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "depends_on_task_id" uuid NOT NULL,
  "gate_type" text DEFAULT 'hard'::text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: onboarding_task_progress
CREATE TABLE IF NOT EXISTS "onboarding_task_progress" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "assignment_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "status" text DEFAULT 'pending'::text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "signed_off_by" text,
  "signed_off_at" timestamptz,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "time_spent_minutes" integer,
  "reopened_count" integer DEFAULT 0,
  "sign_off_requested_at" timestamptz,
  "sign_off_turnaround_minutes" integer,
  "blocked_reason" text,
  "blocked_at" timestamptz,
  "unblocked_at" timestamptz,
  PRIMARY KEY ("id")
);

-- Table: onboarding_tasks
CREATE TABLE IF NOT EXISTS "onboarding_tasks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "phase_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "task_type" text NOT NULL,
  "resource_url" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_required" boolean DEFAULT true,
  "estimated_minutes" integer,
  "requires_sign_off" boolean DEFAULT false,
  "sign_off_role" text,
  "created_at" timestamptz DEFAULT now(),
  "lane" text DEFAULT 'operational'::text,
  "applicable_types" text[] DEFAULT '{full_time,part_time,lab_only,adjunct}'::text[],
  "requires_evidence" boolean DEFAULT false,
  "requires_director" boolean DEFAULT false,
  PRIMARY KEY ("id")
);

-- Table: onboarding_templates
CREATE TABLE IF NOT EXISTS "onboarding_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "instructor_type" text DEFAULT 'all'::text,
  "is_active" boolean DEFAULT true,
  "created_by" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: open_shifts
CREATE TABLE IF NOT EXISTS "open_shifts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "date" date NOT NULL,
  "start_time" time without time zone NOT NULL,
  "end_time" time without time zone NOT NULL,
  "location" text,
  "department" text,
  "created_by" uuid,
  "min_instructors" integer DEFAULT 1,
  "max_instructors" integer,
  "is_filled" boolean DEFAULT false,
  "is_cancelled" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "lab_day_id" uuid,
  PRIMARY KEY ("id")
);

-- Table: osce_events
CREATE TABLE IF NOT EXISTS "osce_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "subtitle" text,
  "slug" text NOT NULL,
  "description" text,
  "location" text,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "max_observers_per_block" integer DEFAULT 4,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: osce_observer_blocks
CREATE TABLE IF NOT EXISTS "osce_observer_blocks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "observer_id" uuid NOT NULL,
  "block_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "calendar_invite_sent_at" timestamptz,
  PRIMARY KEY ("id")
);

-- Table: osce_observers
CREATE TABLE IF NOT EXISTS "osce_observers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "title" text NOT NULL,
  "agency" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "role" text,
  "agency_preference" boolean DEFAULT false,
  "agency_preference_note" text,
  "created_at" timestamptz DEFAULT now(),
  "event_id" uuid NOT NULL,
  PRIMARY KEY ("id")
);

-- Table: osce_student_agencies
CREATE TABLE IF NOT EXISTS "osce_student_agencies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_name" text NOT NULL,
  "agency" text NOT NULL,
  "relationship" text,
  "event_id" uuid NOT NULL,
  PRIMARY KEY ("id")
);

-- Table: osce_student_schedule
CREATE TABLE IF NOT EXISTS "osce_student_schedule" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "time_block_id" uuid NOT NULL,
  "student_name" text NOT NULL,
  "slot_number" integer NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "event_id" uuid NOT NULL,
  PRIMARY KEY ("id")
);

-- Table: osce_time_blocks
CREATE TABLE IF NOT EXISTS "osce_time_blocks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "day_number" integer NOT NULL,
  "label" text NOT NULL,
  "date" date NOT NULL,
  "start_time" time without time zone NOT NULL,
  "end_time" time without time zone NOT NULL,
  "max_observers" integer DEFAULT 4,
  "sort_order" integer DEFAULT 0,
  "event_id" uuid NOT NULL,
  PRIMARY KEY ("id")
);

-- Table: peer_evaluations
CREATE TABLE IF NOT EXISTS "peer_evaluations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "evaluator_id" uuid NOT NULL,
  "evaluated_id" uuid NOT NULL,
  "communication_score" integer,
  "teamwork_score" integer,
  "leadership_score" integer,
  "is_self_eval" boolean DEFAULT false,
  "comments" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: pmi_block_instructors
CREATE TABLE IF NOT EXISTS "pmi_block_instructors" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "schedule_block_id" uuid NOT NULL,
  "instructor_id" uuid NOT NULL,
  "role" text DEFAULT 'primary'::text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: pmi_course_templates
CREATE TABLE IF NOT EXISTS "pmi_course_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "program_type" text NOT NULL,
  "semester_number" integer,
  "course_code" text NOT NULL,
  "course_name" text NOT NULL,
  "duration_type" text DEFAULT 'full'::text,
  "day_index" integer NOT NULL,
  "start_time" time without time zone NOT NULL,
  "end_time" time without time zone NOT NULL,
  "block_type" text DEFAULT 'lecture'::text,
  "is_online" boolean DEFAULT false,
  "replaces_course_id" uuid,
  "color" text,
  "notes" text,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "default_instructor_id" uuid,
  "default_instructor_name" text,
  "active_weeks" text DEFAULT 'all'::text,
  "default_instructor_ids" uuid[] DEFAULT '{}'::uuid[],
  "lab_day_index" text DEFAULT 'day2'::text,
  PRIMARY KEY ("id")
);

-- Table: pmi_instructor_workload
CREATE TABLE IF NOT EXISTS "pmi_instructor_workload" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "semester_id" uuid NOT NULL,
  "instructor_id" uuid NOT NULL,
  "week_number" integer NOT NULL,
  "week_start_date" date NOT NULL,
  "total_hours" numeric(5,2) DEFAULT 0,
  "block_count" integer DEFAULT 0,
  "programs" text[],
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: pmi_program_schedules
CREATE TABLE IF NOT EXISTS "pmi_program_schedules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "semester_id" uuid NOT NULL,
  "cohort_id" uuid NOT NULL,
  "class_days" int4[] NOT NULL,
  "color" text DEFAULT '#3B82F6'::text,
  "label" text,
  "notes" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: pmi_room_availability
CREATE TABLE IF NOT EXISTS "pmi_room_availability" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "room_id" uuid NOT NULL,
  "day_of_week" integer,
  "start_time" time without time zone,
  "end_time" time without time zone,
  "rule_type" text NOT NULL,
  "label" text,
  "semester_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: pmi_rooms
CREATE TABLE IF NOT EXISTS "pmi_rooms" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "room_type" text NOT NULL,
  "capacity" integer,
  "notes" text,
  "is_active" boolean DEFAULT true,
  "display_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: pmi_schedule_blocks
CREATE TABLE IF NOT EXISTS "pmi_schedule_blocks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "program_schedule_id" uuid,
  "room_id" uuid,
  "day_of_week" integer,
  "start_time" time without time zone NOT NULL,
  "end_time" time without time zone NOT NULL,
  "block_type" text DEFAULT 'class'::text,
  "title" text,
  "is_recurring" boolean DEFAULT true,
  "specific_date" date,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "course_name" text,
  "content_notes" text,
  "semester_id" uuid NOT NULL,
  "color" text,
  "date" date,
  "week_number" integer,
  "recurring_group_id" uuid,
  "linked_lab_day_id" uuid,
  PRIMARY KEY ("id")
);

-- Table: pmi_semesters
CREATE TABLE IF NOT EXISTS "pmi_semesters" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: polls
CREATE TABLE IF NOT EXISTS "polls" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "mode" text NOT NULL,
  "start_date" date NOT NULL,
  "num_weeks" integer NOT NULL,
  "weekdays_only" boolean DEFAULT true,
  "created_by" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "participant_link" text NOT NULL,
  "admin_link" text NOT NULL,
  "available_slots" jsonb DEFAULT '[]'::jsonb,
  PRIMARY KEY ("id")
);

-- Table: preceptor_eval_tokens
CREATE TABLE IF NOT EXISTS "preceptor_eval_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "internship_id" uuid,
  "student_id" uuid,
  "preceptor_email" text NOT NULL,
  "token" text NOT NULL,
  "status" text DEFAULT 'active'::text,
  "expires_at" timestamptz NOT NULL,
  "submitted_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: preceptor_feedback
CREATE TABLE IF NOT EXISTS "preceptor_feedback" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "internship_id" uuid,
  "student_id" uuid,
  "preceptor_id" uuid,
  "clinical_skills" integer,
  "professionalism" integer,
  "communication" integer,
  "overall" integer,
  "comments" text,
  "flagged" boolean DEFAULT false,
  "submitted_by" text,
  "created_at" timestamptz DEFAULT now(),
  "preceptor_name" text,
  "preceptor_email" text,
  "clinical_site" text,
  "shift_date" date,
  "clinical_skills_rating" integer,
  "professionalism_rating" integer,
  "communication_rating" integer,
  "overall_rating" integer,
  "strengths" text,
  "areas_for_improvement" text,
  "is_flagged" boolean DEFAULT false,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: print_failures
CREATE TABLE IF NOT EXISTS "print_failures" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid,
  "printer_id" uuid,
  "filament_type_id" uuid,
  "failure_type" text NOT NULL,
  "description" text NOT NULL,
  "waste_grams" numeric DEFAULT 0 NOT NULL,
  "waste_cost" numeric(10,2),
  "failed_at" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: print_notifications
CREATE TABLE IF NOT EXISTS "print_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "request_id" uuid,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "read_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: print_request_history
CREATE TABLE IF NOT EXISTS "print_request_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid NOT NULL,
  "old_status" text,
  "new_status" text NOT NULL,
  "changed_by" uuid,
  "note" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: print_request_materials
CREATE TABLE IF NOT EXISTS "print_request_materials" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid NOT NULL,
  "filament_type_id" uuid NOT NULL,
  "estimated_grams" numeric,
  "estimated_cost" numeric(10,2),
  "actual_grams" numeric,
  "actual_cost" numeric(10,2),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: print_requests
CREATE TABLE IF NOT EXISTS "print_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "reorder_of" uuid,
  "title" text NOT NULL,
  "file_link" text,
  "file_url" text,
  "quantity" integer DEFAULT 1 NOT NULL,
  "needed_by" date,
  "purpose" text NOT NULL,
  "department" text NOT NULL,
  "material_preference_id" uuid,
  "material_other" text,
  "special_instructions" text,
  "comparable_link" text,
  "comparable_value" numeric(10,2),
  "comparable_quantity" integer DEFAULT 1,
  "priority_score" integer DEFAULT 50 NOT NULL,
  "status" text DEFAULT 'submitted'::text NOT NULL,
  "operator_id" uuid,
  "acknowledged_at" timestamptz,
  "filament_type_id" uuid,
  "filament_grams" numeric,
  "print_cost" numeric(10,2),
  "estimated_print_minutes" integer,
  "sliced_at" timestamptz,
  "is_multi_material" boolean DEFAULT false,
  "printer_id" uuid,
  "print_started_at" timestamptz,
  "print_eta" timestamptz,
  "quantity_completed" integer,
  "actual_print_minutes" integer,
  "actual_filament_grams" numeric,
  "final_print_cost" numeric(10,2),
  "savings" numeric(10,2),
  "quality_notes" text,
  "completion_photo_url" text,
  "completed_at" timestamptz,
  "delayed_at" timestamptz,
  "delay_reason" text,
  "total_waste_grams" numeric DEFAULT 0,
  "total_waste_cost" numeric(10,2) DEFAULT 0,
  "picked_up_at" timestamptz,
  "cancelled_at" timestamptz,
  "cancellation_reason" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "cost_type" text DEFAULT 'cost_savings'::text,
  PRIMARY KEY ("id")
);

-- Table: printer_hour_adjustments
CREATE TABLE IF NOT EXISTS "printer_hour_adjustments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "printer_id" uuid NOT NULL,
  "adjustment_type" text NOT NULL,
  "hours" numeric(10,2) NOT NULL,
  "hours_before" numeric(10,2) NOT NULL,
  "hours_after" numeric(10,2) NOT NULL,
  "reason" text NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  PRIMARY KEY ("id")
);

-- Table: printer_maintenance
CREATE TABLE IF NOT EXISTS "printer_maintenance" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "printer_id" uuid NOT NULL,
  "maintenance_type" text NOT NULL,
  "description" text NOT NULL,
  "parts_replaced" text,
  "cost" numeric(10,2),
  "performed_by" text,
  "print_hours_at_service" numeric,
  "maintenance_date" date DEFAULT CURRENT_DATE NOT NULL,
  "next_maintenance_due" date,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: printers
CREATE TABLE IF NOT EXISTS "printers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "model" text NOT NULL,
  "location" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "total_print_hours" numeric DEFAULT 0,
  "last_maintenance_date" timestamptz,
  "next_maintenance_date" timestamptz,
  "maintenance_interval_hours" integer DEFAULT 500,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: program_outcomes
CREATE TABLE IF NOT EXISTS "program_outcomes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cohort_id" uuid,
  "program" text,
  "graduation_rate" numeric(5,2),
  "cert_pass_rate" numeric(5,2),
  "placement_rate" numeric(5,2),
  "avg_time_to_completion" integer,
  "report_date" date DEFAULT CURRENT_DATE,
  "notes" text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "year" integer,
  PRIMARY KEY ("id")
);

-- Table: program_requirements
CREATE TABLE IF NOT EXISTS "program_requirements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "program" text NOT NULL,
  "requirement_type" text NOT NULL,
  "category" text,
  "required_value" integer DEFAULT 0 NOT NULL,
  "version" integer DEFAULT 1,
  "effective_date" date DEFAULT CURRENT_DATE,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: programs
CREATE TABLE IF NOT EXISTS "programs" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "name" text NOT NULL,
  "display_name" text NOT NULL,
  "abbreviation" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "department_id" uuid,
  PRIMARY KEY ("id")
);

-- Table: protocol_completions
CREATE TABLE IF NOT EXISTS "protocol_completions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "protocol_category" text NOT NULL,
  "case_count" integer DEFAULT 1,
  "completed_at" timestamptz DEFAULT now(),
  "logged_by" uuid,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: record_access_log
CREATE TABLE IF NOT EXISTS "record_access_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_email" text NOT NULL,
  "user_role" text NOT NULL,
  "student_id" uuid,
  "data_type" text NOT NULL,
  "action" text NOT NULL,
  "route" text,
  "details" jsonb,
  "accessed_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: report_templates
CREATE TABLE IF NOT EXISTS "report_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "data_source" text NOT NULL,
  "columns" text[] NOT NULL,
  "filters" jsonb DEFAULT '[]'::jsonb,
  "sort_by" text,
  "sort_order" text DEFAULT 'asc'::text,
  "group_by" text,
  "is_scheduled" boolean DEFAULT false,
  "schedule_frequency" text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "is_shared" boolean DEFAULT false,
  PRIMARY KEY ("id")
);

-- Table: resource_bookings
CREATE TABLE IF NOT EXISTS "resource_bookings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "resource_id" uuid NOT NULL,
  "booked_by" text NOT NULL,
  "booking_date" date NOT NULL,
  "start_time" time without time zone NOT NULL,
  "end_time" time without time zone NOT NULL,
  "purpose" text,
  "status" text DEFAULT 'pending'::text,
  "approved_by" text,
  "approved_at" timestamptz,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: resource_versions
CREATE TABLE IF NOT EXISTS "resource_versions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "resource_id" uuid,
  "version" integer,
  "file_url" text,
  "uploaded_by" text,
  "created_at" timestamptz DEFAULT now(),
  "file_path" text,
  "file_name" text,
  "url" text,
  "notes" text,
  PRIMARY KEY ("id")
);

-- Table: resources
CREATE TABLE IF NOT EXISTS "resources" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "category" text,
  "file_url" text,
  "external_url" text,
  "version" integer DEFAULT 1,
  "min_role" text DEFAULT 'instructor'::text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "resource_type" text,
  "url" text,
  "file_path" text,
  "file_name" text,
  "file_size" integer,
  "uploaded_by" text,
  "linked_skill_ids" text[],
  "linked_scenario_ids" text[],
  "is_active" boolean DEFAULT true,
  PRIMARY KEY ("id")
);

-- Table: rubric_criteria
CREATE TABLE IF NOT EXISTS "rubric_criteria" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "rubric_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "points" integer DEFAULT 1,
  "sort_order" integer DEFAULT 0,
  PRIMARY KEY ("id")
);

-- Table: rubric_scenario_assignments
CREATE TABLE IF NOT EXISTS "rubric_scenario_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "rubric_id" uuid NOT NULL,
  "scenario_id" uuid NOT NULL,
  "assigned_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: scenario_assessments
CREATE TABLE IF NOT EXISTS "scenario_assessments" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "lab_station_id" uuid,
  "lab_day_id" uuid,
  "cohort_id" uuid NOT NULL,
  "rotation_number" integer,
  "assessment_score" integer,
  "treatment_score" integer,
  "communication_score" integer,
  "team_lead_id" uuid,
  "team_lead_issues" text,
  "skills_performed" text[],
  "comments" text,
  "graded_by" uuid,
  "assessed_at" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  "lab_group_id" uuid,
  "station_id" uuid,
  "criteria_ratings" jsonb DEFAULT '[]'::jsonb,
  "critical_actions_completed" jsonb DEFAULT '{}'::jsonb,
  "satisfactory_count" integer DEFAULT 0,
  "phase1_pass" boolean DEFAULT false,
  "phase2_pass" boolean DEFAULT false,
  "overall_comments" text,
  "issue_level" text DEFAULT 'none'::text,
  "flag_categories" text[],
  "flagged_for_review" boolean DEFAULT false,
  "flag_resolved" boolean DEFAULT false,
  "flag_resolution_notes" text,
  "flag_resolved_by" uuid,
  "flag_resolved_at" timestamptz,
  "overall_score" integer,
  "email_status" text DEFAULT 'pending'::text,
  "status" text DEFAULT 'complete'::text,
  PRIMARY KEY ("id")
);

-- Table: scenario_favorites
CREATE TABLE IF NOT EXISTS "scenario_favorites" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_email" text NOT NULL,
  "scenario_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: scenario_participation
CREATE TABLE IF NOT EXISTS "scenario_participation" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "student_id" uuid,
  "scenario_id" uuid,
  "role" text,
  "score" numeric,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "instructor_id" uuid,
  "created_by_id" uuid,
  "date" date DEFAULT CURRENT_DATE,
  PRIMARY KEY ("id")
);

-- Table: scenario_ratings
CREATE TABLE IF NOT EXISTS "scenario_ratings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "scenario_id" uuid NOT NULL,
  "user_email" text NOT NULL,
  "rating" integer,
  "comment" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: scenario_tags
CREATE TABLE IF NOT EXISTS "scenario_tags" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "scenario_id" uuid NOT NULL,
  "tag" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: scenario_versions
CREATE TABLE IF NOT EXISTS "scenario_versions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "scenario_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "data" jsonb NOT NULL,
  "change_summary" text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: scenarios
CREATE TABLE IF NOT EXISTS "scenarios" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "title" text NOT NULL,
  "applicable_programs" text[] DEFAULT ARRAY['EMT'::text, 'AEMT'::text, 'Paramedic'::text],
  "category" text NOT NULL,
  "subcategory" text,
  "difficulty" text DEFAULT 'intermediate'::text,
  "dispatch_time" text,
  "dispatch_location" text,
  "chief_complaint" text,
  "dispatch_notes" text,
  "patient_name" text,
  "patient_age" integer,
  "patient_sex" text,
  "patient_weight" text,
  "medical_history" text[],
  "medications" text[],
  "allergies" text,
  "general_impression" text,
  "environment_notes" text,
  "assessment_x" text,
  "assessment_a" text,
  "assessment_b" text,
  "assessment_c" text,
  "assessment_d" text,
  "assessment_e" text,
  "avpu" text,
  "initial_vitals" jsonb,
  "sample_history" jsonb,
  "opqrst" jsonb,
  "phases" jsonb,
  "learning_objectives" text[],
  "critical_actions" text[],
  "debrief_points" text[],
  "instructor_notes" text,
  "equipment_needed" text[],
  "medications_to_administer" text[],
  "estimated_duration" integer,
  "documentation_required" boolean DEFAULT false,
  "platinum_required" boolean DEFAULT false,
  "created_by" uuid,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "patient_presentation" text,
  "history" text,
  "vitals" jsonb,
  "expected_interventions" text[],
  "gcs" text,
  "pupils" text,
  "secondary_survey" jsonb,
  "ekg_findings" jsonb,
  "legacy_data" jsonb,
  "ai_generated_fields" text[] DEFAULT '{}'::text[],
  "content_review_status" text DEFAULT 'approved'::text,
  "dispatch_info" text,
  PRIMARY KEY ("id")
);

-- Table: scheduled_exports
CREATE TABLE IF NOT EXISTS "scheduled_exports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "report_type" text NOT NULL,
  "schedule_type" text NOT NULL,
  "recipients" text[] NOT NULL,
  "is_active" boolean DEFAULT true,
  "last_run_at" timestamptz,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "next_run_at" timestamptz,
  PRIMARY KEY ("id")
);

-- Table: seat_assignments
CREATE TABLE IF NOT EXISTS "seat_assignments" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "seating_chart_id" uuid,
  "student_id" uuid,
  "table_number" integer NOT NULL,
  "seat_position" integer NOT NULL,
  "row_number" integer NOT NULL,
  "is_overflow" boolean DEFAULT false,
  "is_manual_override" boolean DEFAULT false,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: seating_charts
CREATE TABLE IF NOT EXISTS "seating_charts" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "cohort_id" uuid,
  "classroom_id" uuid,
  "name" text,
  "is_active" boolean DEFAULT true,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: seating_preferences
CREATE TABLE IF NOT EXISTS "seating_preferences" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "student_id" uuid,
  "other_student_id" uuid,
  "preference_type" text,
  "reason" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: shift_signups
CREATE TABLE IF NOT EXISTS "shift_signups" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shift_id" uuid,
  "instructor_id" uuid,
  "signup_start_time" time without time zone,
  "signup_end_time" time without time zone,
  "is_partial" boolean DEFAULT false,
  "status" text DEFAULT 'pending'::text,
  "confirmed_by" uuid,
  "confirmed_at" timestamptz,
  "declined_reason" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: shift_swap_interest
CREATE TABLE IF NOT EXISTS "shift_swap_interest" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "swap_request_id" uuid NOT NULL,
  "interested_by" text NOT NULL,
  "status" text DEFAULT 'interested'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: shift_trade_requests
CREATE TABLE IF NOT EXISTS "shift_trade_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "requester_id" uuid NOT NULL,
  "requester_shift_id" uuid NOT NULL,
  "target_shift_id" uuid,
  "target_user_id" uuid,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "reason" text,
  "response_note" text,
  "approved_by" uuid,
  "approved_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: shift_trades
CREATE TABLE IF NOT EXISTS "shift_trades" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "original_shift_id" uuid NOT NULL,
  "original_instructor_email" text NOT NULL,
  "accepting_instructor_email" text,
  "reason" text,
  "status" text DEFAULT 'pending'::text,
  "approved_by" text,
  "approved_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: skill_assessments
CREATE TABLE IF NOT EXISTS "skill_assessments" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "lab_station_id" uuid,
  "lab_day_id" uuid NOT NULL,
  "skill_name" text NOT NULL,
  "student_id" uuid NOT NULL,
  "cohort_id" uuid NOT NULL,
  "preparation_safety" integer,
  "technical_performance" integer,
  "critical_thinking" integer,
  "time_management" integer,
  "overall_competency" integer,
  "narrative_feedback" text,
  "graded_by" uuid,
  "assessed_at" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: skill_competencies
CREATE TABLE IF NOT EXISTS "skill_competencies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "skill_id" uuid NOT NULL,
  "level" text DEFAULT 'introduced'::text,
  "updated_by" text,
  "updated_at" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: skill_documents
CREATE TABLE IF NOT EXISTS "skill_documents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "skill_id" uuid,
  "document_name" text NOT NULL,
  "document_url" text NOT NULL,
  "document_type" text,
  "display_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "file_type" text,
  "drill_id" uuid,
  PRIMARY KEY ("id")
);

-- Table: skill_drill_cases
CREATE TABLE IF NOT EXISTS "skill_drill_cases" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "skill_drill_id" uuid,
  "case_id" text NOT NULL,
  "case_data" jsonb NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: skill_drills
CREATE TABLE IF NOT EXISTS "skill_drills" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "estimated_duration_minutes" integer,
  "equipment_needed" text,
  "instructions" text,
  "is_active" boolean DEFAULT true,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "drill_data" jsonb,
  "station_id" text,
  "program" text,
  "semester" integer,
  "format" text,
  "estimated_duration" integer DEFAULT 15,
  PRIMARY KEY ("id")
);

-- Table: skill_sheet_assignments
CREATE TABLE IF NOT EXISTS "skill_sheet_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "skill_sheet_id" uuid NOT NULL,
  "skill_name" text NOT NULL,
  "program" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: skill_sheet_steps
CREATE TABLE IF NOT EXISTS "skill_sheet_steps" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "skill_sheet_id" uuid NOT NULL,
  "step_number" integer NOT NULL,
  "phase" text NOT NULL,
  "instruction" text NOT NULL,
  "is_critical" boolean DEFAULT false,
  "detail_notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: skill_sheets
CREATE TABLE IF NOT EXISTS "skill_sheets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "canonical_skill_id" uuid,
  "skill_name" text NOT NULL,
  "program" text NOT NULL,
  "source" text NOT NULL,
  "source_priority" integer,
  "version" text,
  "equipment" jsonb,
  "overview" text,
  "critical_criteria" jsonb,
  "critical_failures" jsonb,
  "notes" text,
  "platinum_skill_type" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "is_active" boolean DEFAULT true NOT NULL,
  PRIMARY KEY ("id")
);

-- Table: skill_signoffs
CREATE TABLE IF NOT EXISTS "skill_signoffs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "skill_id" uuid NOT NULL,
  "lab_day_id" uuid,
  "signed_off_by" text NOT NULL,
  "signed_off_at" timestamptz DEFAULT now(),
  "revoked_by" text,
  "revoked_at" timestamptz,
  "revoke_reason" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: skills
CREATE TABLE IF NOT EXISTS "skills" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "name" text NOT NULL,
  "category" text,
  "certification_levels" text[] DEFAULT ARRAY['EMT'::text, 'AEMT'::text, 'Paramedic'::text],
  "description" text,
  "required_count" integer DEFAULT 1,
  "is_active" boolean DEFAULT true,
  "display_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "cert_levels" text[] DEFAULT ARRAY['PM'::text],
  PRIMARY KEY ("id")
);

-- Table: station_completions
CREATE TABLE IF NOT EXISTS "station_completions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "station_id" uuid,
  "result" text NOT NULL,
  "completed_at" timestamptz DEFAULT now(),
  "logged_by" uuid,
  "lab_day_id" uuid,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: station_instructors
CREATE TABLE IF NOT EXISTS "station_instructors" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid,
  "user_id" uuid,
  "user_email" text,
  "is_primary" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "user_name" text,
  PRIMARY KEY ("id")
);

-- Table: station_pool
CREATE TABLE IF NOT EXISTS "station_pool" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_code" text NOT NULL,
  "station_name" text NOT NULL,
  "category" text,
  "description" text,
  "semester" integer DEFAULT 3,
  "cohort_id" uuid,
  "is_active" boolean DEFAULT true,
  "display_order" integer DEFAULT 0,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: station_skills
CREATE TABLE IF NOT EXISTS "station_skills" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "station_id" uuid NOT NULL,
  "skill_id" uuid NOT NULL,
  "display_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_achievements
CREATE TABLE IF NOT EXISTS "student_achievements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "achievement_type" text NOT NULL,
  "achievement_name" text NOT NULL,
  "earned_at" timestamptz DEFAULT now(),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "practitioner_email" text,
  PRIMARY KEY ("id")
);

-- Table: student_case_stats
CREATE TABLE IF NOT EXISTS "student_case_stats" (
  "student_id" uuid NOT NULL,
  "cohort_id" uuid NOT NULL,
  "cases_completed" integer DEFAULT 0,
  "cases_attempted" integer DEFAULT 0,
  "total_points_earned" integer DEFAULT 0,
  "total_points_possible" integer DEFAULT 0,
  "average_score" numeric(5,2) DEFAULT 0,
  "best_score" numeric(5,2) DEFAULT 0,
  "badges_earned" integer DEFAULT 0,
  "total_time_seconds" integer DEFAULT 0,
  "last_activity_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("student_id", "cohort_id")
);

-- Table: student_clinical_hours
CREATE TABLE IF NOT EXISTS "student_clinical_hours" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "cohort_id" uuid,
  "hospital_orientation_hours" numeric(4,1) DEFAULT 0,
  "hospital_orientation_complete" boolean DEFAULT false,
  "psych_shifts" integer DEFAULT 0,
  "psych_hours" numeric(5,1) DEFAULT 0,
  "cardiology_shifts" integer DEFAULT 0,
  "cardiology_hours" numeric(5,1) DEFAULT 0,
  "ed_shifts" integer DEFAULT 0,
  "ed_hours" numeric(5,1) DEFAULT 0,
  "ems_field_shifts" integer DEFAULT 0,
  "ems_field_hours" numeric(5,1) DEFAULT 0,
  "icu_shifts" integer DEFAULT 0,
  "icu_hours" numeric(5,1) DEFAULT 0,
  "ob_shifts" integer DEFAULT 0,
  "ob_hours" numeric(5,1) DEFAULT 0,
  "or_shifts" integer DEFAULT 0,
  "or_hours" numeric(5,1) DEFAULT 0,
  "peds_ed_shifts" integer DEFAULT 0,
  "peds_ed_hours" numeric(5,1) DEFAULT 0,
  "peds_icu_shifts" integer DEFAULT 0,
  "peds_icu_hours" numeric(5,1) DEFAULT 0,
  "total_shifts" integer DEFAULT 0,
  "total_hours" numeric(6,1) DEFAULT 0,
  "mulligan_notes" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "ems_hours" integer DEFAULT 0,
  "ems_ridealong_hours" numeric DEFAULT 0,
  "ems_ridealong_shifts" integer DEFAULT 0,
  PRIMARY KEY ("id")
);

-- Table: student_communications
CREATE TABLE IF NOT EXISTS "student_communications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "type" text NOT NULL,
  "summary" text NOT NULL,
  "details" text,
  "flagged" boolean DEFAULT false,
  "follow_up_needed" boolean DEFAULT false,
  "follow_up_date" date,
  "follow_up_completed" boolean DEFAULT false,
  "created_by" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_compliance_docs
CREATE TABLE IF NOT EXISTS "student_compliance_docs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "cohort_id" uuid,
  "complio_complete" boolean DEFAULT false,
  "mce_complete" boolean DEFAULT false,
  "mmr_complete" boolean DEFAULT false,
  "mmr_date" date,
  "vzv_complete" boolean DEFAULT false,
  "vzv_date" date,
  "hep_b_complete" boolean DEFAULT false,
  "hep_b_date" date,
  "hep_b_declination" boolean DEFAULT false,
  "tdap_complete" boolean DEFAULT false,
  "tdap_date" date,
  "covid_complete" boolean DEFAULT false,
  "covid_date" date,
  "covid_exemption" boolean DEFAULT false,
  "tb_test_1_complete" boolean DEFAULT false,
  "tb_test_1_date" date,
  "tb_test_2_complete" boolean DEFAULT false,
  "tb_test_2_date" date,
  "tb_questionnaire" boolean DEFAULT false,
  "physical_complete" boolean DEFAULT false,
  "physical_date" date,
  "health_insurance_complete" boolean DEFAULT false,
  "health_insurance_date" date,
  "bls_complete" boolean DEFAULT false,
  "bls_expiration" date,
  "flu_shot_complete" boolean DEFAULT false,
  "flu_shot_date" date,
  "flu_declination" boolean DEFAULT false,
  "hospital_orientation_complete" boolean DEFAULT false,
  "hospital_orientation_date" date,
  "background_check_complete" boolean DEFAULT false,
  "background_check_date" date,
  "drug_test_complete" boolean DEFAULT false,
  "drug_test_date" date,
  "attestation_complete" boolean DEFAULT false,
  "attestation_date" date,
  "exhibit_complete" boolean DEFAULT false,
  "docs_shared_with_sites" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "doc_type" text,
  "completed" boolean DEFAULT false,
  "completion_date" date,
  "expiration_date" date,
  "notes" text,
  PRIMARY KEY ("id")
);

-- Table: student_compliance_records
CREATE TABLE IF NOT EXISTS "student_compliance_records" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "doc_type_id" uuid NOT NULL,
  "status" text DEFAULT 'missing'::text NOT NULL,
  "expiration_date" date,
  "file_path" text,
  "file_name" text,
  "notes" text,
  "verified_by" text,
  "verified_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_documents
CREATE TABLE IF NOT EXISTS "student_documents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "document_type" text NOT NULL,
  "file_url" text,
  "file_name" text,
  "status" text DEFAULT 'pending'::text,
  "reviewed_by" text,
  "reviewed_at" timestamptz,
  "review_notes" text,
  "expires_at" date,
  "uploaded_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_field_rides
CREATE TABLE IF NOT EXISTS "student_field_rides" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "cohort_id" uuid,
  "chh_or_complete" boolean DEFAULT false,
  "chh_or_date" date,
  "svh_or_complete" boolean DEFAULT false,
  "svh_or_date" date,
  "siena_or_complete" boolean DEFAULT false,
  "siena_or_date" date,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_group_assignments
CREATE TABLE IF NOT EXISTS "student_group_assignments" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "group_id" uuid,
  "student_id" uuid,
  "role" text DEFAULT 'member'::text,
  "assigned_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_groups
CREATE TABLE IF NOT EXISTS "student_groups" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "cohort_id" uuid,
  "name" text NOT NULL,
  "group_number" integer,
  "description" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_import_history
CREATE TABLE IF NOT EXISTS "student_import_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cohort_id" uuid,
  "imported_count" integer DEFAULT 0,
  "skipped_count" integer DEFAULT 0,
  "updated_count" integer DEFAULT 0,
  "import_mode" text,
  "imported_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_individual_tasks
CREATE TABLE IF NOT EXISTS "student_individual_tasks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "cohort_id" uuid,
  "phase" text,
  "task_name" text NOT NULL,
  "task_description" text,
  "task_type" text DEFAULT 'custom'::text,
  "due_date" date,
  "status" text DEFAULT 'pending'::text,
  "completed_at" timestamptz,
  "completed_by" uuid,
  "assigned_by" uuid,
  "assigned_at" timestamptz DEFAULT now(),
  "is_required" boolean DEFAULT true,
  "is_urgent" boolean DEFAULT false,
  "show_on_dashboard" boolean DEFAULT true,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_internships
CREATE TABLE IF NOT EXISTS "student_internships" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "cohort_id" uuid,
  "preceptor_id" uuid,
  "agency_id" uuid,
  "agency_name" text,
  "shift_type" text DEFAULT '12_hour'::text,
  "placement_date" date,
  "orientation_date" date,
  "internship_start_date" date,
  "expected_end_date" date,
  "actual_end_date" date,
  "current_phase" text DEFAULT 'pre_internship'::text,
  "phase_1_start_date" date,
  "phase_1_end_date" date,
  "phase_1_eval_scheduled" date,
  "phase_1_eval_completed" boolean DEFAULT false,
  "phase_1_eval_notes" text,
  "phase_2_start_date" date,
  "phase_2_end_date" date,
  "phase_2_eval_scheduled" date,
  "phase_2_eval_completed" boolean DEFAULT false,
  "phase_2_eval_notes" text,
  "closeout_meeting_date" date,
  "closeout_completed" boolean DEFAULT false,
  "status" text DEFAULT 'not_started'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "provisional_date" date,
  "oriented" boolean DEFAULT false,
  "shift_schedule" text,
  "phase_1_complete_date" date,
  "phase_2_complete_date" date,
  "exams_passed" boolean DEFAULT false,
  "exams_passed_date" date,
  "snhd_paperwork_submitted" boolean DEFAULT false,
  "snhd_paperwork_date" date,
  "snhd_course_complete" boolean DEFAULT false,
  "snhd_course_date" date,
  "cleared_for_nremt" boolean DEFAULT false,
  "cleared_for_nremt_date" date,
  "nremt_notification_sent" boolean DEFAULT false,
  "nremt_notification_date" date,
  "orientation_completed" boolean DEFAULT false,
  "liability_form_completed" boolean DEFAULT false,
  "background_check_completed" boolean DEFAULT false,
  "drug_screen_completed" boolean DEFAULT false,
  "immunizations_verified" boolean DEFAULT false,
  "cpr_card_verified" boolean DEFAULT false,
  "uniform_issued" boolean DEFAULT false,
  "badge_issued" boolean DEFAULT false,
  "ryan_notified" boolean DEFAULT false,
  "ryan_notified_date" date,
  "written_exam_date" date,
  "written_exam_passed" boolean DEFAULT false,
  "psychomotor_exam_date" date,
  "psychomotor_exam_passed" boolean DEFAULT false,
  "phase_1_meeting_poll_id" text,
  "phase_1_meeting_scheduled" date,
  "phase_2_meeting_poll_id" text,
  "phase_2_meeting_scheduled" date,
  "final_exam_poll_id" text,
  "final_exam_scheduled" date,
  "course_completion_date" date,
  "internship_completed" boolean DEFAULT false,
  "internship_completed_date" date,
  "closeout_meeting_scheduled" date,
  "internship_completion_date" date,
  "snhd_submitted" boolean DEFAULT false,
  "snhd_submitted_date" date,
  "nremt_clearance_date" date,
  "is_extended" boolean DEFAULT false,
  "extension_reason" text,
  "extension_date" date,
  "original_expected_end_date" date,
  "extension_eval_completed" boolean DEFAULT false,
  "extension_eval_date" date,
  "extension_eval_notes" text,
  "phase_1_extended" boolean DEFAULT false,
  "phase_1_extension_reason" text,
  "phase_1_extended_until" date,
  "mce_complete" boolean DEFAULT false,
  "mce_completed_date" date,
  "snhd_field_docs_submitted_at" timestamptz,
  "snhd_course_completion_submitted_at" timestamptz,
  "completed_at" timestamptz,
  "completed_by" text,
  "snhd_course_completion_submitted_date" date,
  "field_internship_docs_submitted_date" date,
  "closeout_overrides" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("id")
);

-- Table: student_lab_ratings
CREATE TABLE IF NOT EXISTS "student_lab_ratings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "instructor_email" text NOT NULL,
  "rating" integer,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_lab_signups
CREATE TABLE IF NOT EXISTS "student_lab_signups" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "status" text DEFAULT 'confirmed'::text,
  "waitlist_position" integer,
  "signed_up_at" timestamptz DEFAULT now(),
  "cancelled_at" timestamptz,
  "cancel_reason" text,
  PRIMARY KEY ("id")
);

-- Table: student_learning_styles
CREATE TABLE IF NOT EXISTS "student_learning_styles" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "student_id" uuid,
  "primary_style" text,
  "social_style" text,
  "processing_style" text,
  "structure_style" text,
  "assessment_data" jsonb,
  "assessed_date" date,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_mce_clearance
CREATE TABLE IF NOT EXISTS "student_mce_clearance" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "mce_provider" text DEFAULT 'Platinum Planner'::text,
  "modules_required" integer DEFAULT 0,
  "modules_completed" integer DEFAULT 0,
  "clearance_status" text DEFAULT 'not_started'::text,
  "clearance_date" timestamptz,
  "cleared_by" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_mce_modules
CREATE TABLE IF NOT EXISTS "student_mce_modules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "cohort_id" uuid,
  "bg_check" boolean DEFAULT false,
  "drug_test" boolean DEFAULT false,
  "physical" boolean DEFAULT false,
  "insurance" boolean DEFAULT false,
  "photo" boolean DEFAULT false,
  "tb" boolean DEFAULT false,
  "mmr" boolean DEFAULT false,
  "flu" boolean DEFAULT false,
  "hep_b" boolean DEFAULT false,
  "tdap" boolean DEFAULT false,
  "vzv" boolean DEFAULT false,
  "covid" boolean DEFAULT false,
  "bls" boolean DEFAULT false,
  "confidentiality" boolean DEFAULT false,
  "flu_declination" boolean DEFAULT false,
  "hep_b_declination" boolean DEFAULT false,
  "mmr_declination" boolean DEFAULT false,
  "tdap_declination" boolean DEFAULT false,
  "vzv_declination" boolean DEFAULT false,
  "cultural_competency" boolean DEFAULT false,
  "parking" boolean DEFAULT false,
  "eta_module" boolean DEFAULT false,
  "attestation_lgs" boolean DEFAULT false,
  "wpvp" boolean DEFAULT false,
  "orientation" boolean DEFAULT false,
  "conduct" boolean DEFAULT false,
  "all_complete" boolean DEFAULT false,
  "completion_date" date,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_milestones
CREATE TABLE IF NOT EXISTS "student_milestones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "milestone_type" text NOT NULL,
  "milestone_name" text NOT NULL,
  "semester" integer,
  "status" text DEFAULT 'complete'::text,
  "completed_date" date,
  "expiration_date" date,
  "recorded_by" uuid,
  "recorded_at" timestamptz DEFAULT now(),
  "auto_recorded" boolean DEFAULT false,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: student_notes
CREATE TABLE IF NOT EXISTS "student_notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "category" text DEFAULT 'other'::text,
  "content" text NOT NULL,
  "flag_level" text,
  "created_by" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "author_id" uuid,
  "author_email" text,
  "is_flagged" boolean DEFAULT false,
  PRIMARY KEY ("id")
);

-- Table: student_preceptor_assignments
CREATE TABLE IF NOT EXISTS "student_preceptor_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "internship_id" uuid NOT NULL,
  "preceptor_id" uuid NOT NULL,
  "role" text DEFAULT 'primary'::text NOT NULL,
  "assigned_date" date DEFAULT CURRENT_DATE,
  "end_date" date,
  "is_active" boolean DEFAULT true,
  "notes" text,
  "assigned_by" text,
  "created_at" timestamptz DEFAULT now(),
  "created_by" text,
  "updated_at" timestamptz DEFAULT now(),
  "start_date" date DEFAULT CURRENT_DATE,
  PRIMARY KEY ("id")
);

-- Table: student_skill_evaluations
CREATE TABLE IF NOT EXISTS "student_skill_evaluations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "skill_sheet_id" uuid NOT NULL,
  "lab_day_id" uuid,
  "evaluation_type" text NOT NULL,
  "result" text NOT NULL,
  "evaluator_id" uuid NOT NULL,
  "notes" text,
  "flagged_items" jsonb,
  "created_at" timestamptz DEFAULT now(),
  "step_details" jsonb,
  "email_status" text DEFAULT 'pending'::text,
  "step_marks" jsonb,
  "status" text DEFAULT 'complete'::text,
  "attempt_number" integer DEFAULT 1,
  PRIMARY KEY ("id")
);

-- Table: student_task_status
CREATE TABLE IF NOT EXISTS "student_task_status" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid,
  "cohort_task_id" uuid,
  "status" text DEFAULT 'pending'::text,
  "completed_at" timestamptz,
  "completed_by" uuid,
  "auto_completed" boolean DEFAULT false,
  "manually_set" boolean DEFAULT false,
  "waived_reason" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: students
CREATE TABLE IF NOT EXISTS "students" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text,
  "cohort_id" uuid,
  "photo_url" text,
  "status" text DEFAULT 'active'::text,
  "agency" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "prior_cert_level" text,
  "years_ems_experience" numeric,
  "prior_work_setting" text,
  "prior_employer" text,
  "scrub_top_size" text,
  "scrub_bottom_size" text,
  "student_id" text,
  "max_checkouts" integer DEFAULT 3,
  "has_hold" boolean DEFAULT false,
  "hold_reason" text,
  "barcode" text,
  "phone" text,
  "address" text,
  "emergency_contact_relationship" text,
  "student_number" text,
  "enrollment_date" date,
  "preferred_contact_method" text,
  "best_contact_times" text[],
  "language_preference" text DEFAULT 'en'::text,
  "opt_out_non_essential" boolean DEFAULT false,
  "emergency_contact_name" text,
  "emergency_contact_phone" text,
  "learning_style" text,
  "ferpa_agency_release" boolean DEFAULT false,
  "ferpa_release_date" date,
  "ferpa_release_agency" text,
  "emstesting_id" text,
  PRIMARY KEY ("id")
);

-- Table: submissions
CREATE TABLE IF NOT EXISTS "submissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "poll_id" uuid,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "agency" text NOT NULL,
  "meeting_type" text,
  "availability" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "respondent_role" text,
  PRIMARY KEY ("id")
);

-- Table: substitute_requests
CREATE TABLE IF NOT EXISTS "substitute_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "requester_email" text NOT NULL,
  "reason" text NOT NULL,
  "reason_details" text,
  "status" text DEFAULT 'pending'::text,
  "reviewed_by" text,
  "reviewed_at" timestamptz,
  "review_notes" text,
  "covered_by" text,
  "covered_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: summative_evaluation_scores
CREATE TABLE IF NOT EXISTS "summative_evaluation_scores" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "evaluation_id" uuid,
  "student_id" uuid,
  "leadership_scene_score" integer,
  "patient_assessment_score" integer,
  "patient_management_score" integer,
  "interpersonal_score" integer,
  "integration_score" integer,
  "total_score" integer,
  "critical_criteria_failed" boolean DEFAULT false,
  "critical_fails_mandatory" boolean DEFAULT false,
  "critical_harmful_intervention" boolean DEFAULT false,
  "critical_unprofessional" boolean DEFAULT false,
  "critical_criteria_notes" text,
  "passed" boolean,
  "examiner_notes" text,
  "grading_complete" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "start_time" time without time zone,
  "end_time" time without time zone,
  "feedback_provided" text,
  "graded_at" timestamptz,
  "graded_by" uuid,
  PRIMARY KEY ("id")
);

-- Table: summative_evaluations
CREATE TABLE IF NOT EXISTS "summative_evaluations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "scenario_id" uuid,
  "cohort_id" uuid,
  "internship_id" uuid,
  "evaluation_date" date NOT NULL,
  "start_time" time without time zone,
  "examiner_name" text NOT NULL,
  "examiner_email" text,
  "location" text,
  "status" text DEFAULT 'in_progress'::text,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: summative_scenarios
CREATE TABLE IF NOT EXISTS "summative_scenarios" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "scenario_number" integer NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "patient_presentation" text,
  "expected_interventions" text[],
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "linked_scenario_id" uuid,
  PRIMARY KEY ("id")
);

-- Table: supply_barcodes
CREATE TABLE IF NOT EXISTS "supply_barcodes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "barcode_value" text NOT NULL,
  "supply_item_id" uuid,
  "item_name" text,
  "ndc" text,
  "strength" text,
  "drug_form" text,
  "manufacturer" text,
  "default_item_type" text DEFAULT 'medication'::text,
  "is_ndc" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  PRIMARY KEY ("id")
);

-- Table: supply_categories
CREATE TABLE IF NOT EXISTS "supply_categories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "parent_category_id" uuid,
  "sort_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: supply_items
CREATE TABLE IF NOT EXISTS "supply_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "sku" text,
  "category_id" uuid,
  "description" text,
  "item_type" text DEFAULT 'supply'::text NOT NULL,
  "quantity" integer DEFAULT 0 NOT NULL,
  "unit_of_measure" text DEFAULT 'each'::text,
  "reorder_level" integer DEFAULT 5,
  "reorder_quantity" integer DEFAULT 50,
  "lot_number" text,
  "expiration_date" date,
  "expiration_warning_days" integer DEFAULT 30,
  "ndc" text,
  "strength" text,
  "drug_form" text,
  "manufacturer" text,
  "donor" text,
  "location_id" uuid,
  "bin_id" uuid,
  "notes" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  PRIMARY KEY ("id")
);

-- Table: supply_notifications
CREATE TABLE IF NOT EXISTS "supply_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "supply_item_id" uuid,
  "notification_type" text NOT NULL,
  "severity" text DEFAULT 'warning'::text,
  "message" text NOT NULL,
  "acknowledged" boolean DEFAULT false,
  "acknowledged_by" uuid,
  "acknowledged_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: supply_transactions
CREATE TABLE IF NOT EXISTS "supply_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "supply_item_id" uuid NOT NULL,
  "transaction_type" text NOT NULL,
  "quantity_change" integer NOT NULL,
  "quantity_before" integer NOT NULL,
  "quantity_after" integer NOT NULL,
  "reason" text,
  "reference_id" uuid,
  "reference_type" text,
  "performed_by" uuid,
  "performed_at" timestamptz DEFAULT now(),
  "notes" text,
  PRIMARY KEY ("id")
);

-- Table: system_alerts
CREATE TABLE IF NOT EXISTS "system_alerts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "alert_type" text NOT NULL,
  "severity" text NOT NULL,
  "title" text NOT NULL,
  "message" text,
  "metadata" jsonb,
  "is_resolved" boolean DEFAULT false,
  "resolved_by" text,
  "resolved_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: system_config
CREATE TABLE IF NOT EXISTS "system_config" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  "category" text,
  "description" text,
  "updated_by" text,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: system_settings
CREATE TABLE IF NOT EXISTS "system_settings" (
  "key" text NOT NULL,
  "value" text,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("key")
);

-- Table: task_assignees
CREATE TABLE IF NOT EXISTS "task_assignees" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid,
  "assignee_id" uuid,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "status" text DEFAULT 'pending'::text,
  "completion_notes" text,
  PRIMARY KEY ("id")
);

-- Table: task_comments
CREATE TABLE IF NOT EXISTS "task_comments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid,
  "author_id" uuid,
  "comment" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: teaching_log
CREATE TABLE IF NOT EXISTS "teaching_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "instructor_id" uuid NOT NULL,
  "certification_id" uuid,
  "course_name" text NOT NULL,
  "course_type" text,
  "date_taught" date NOT NULL,
  "hours" numeric(5,2) NOT NULL,
  "location" text,
  "student_count" integer,
  "cohort_id" uuid,
  "lab_day_id" uuid,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: team_availability_views
CREATE TABLE IF NOT EXISTS "team_availability_views" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "instructor_emails" text[] NOT NULL,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: team_lead_log
CREATE TABLE IF NOT EXISTS "team_lead_log" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "student_id" uuid NOT NULL,
  "cohort_id" uuid NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "lab_station_id" uuid,
  "scenario_id" uuid,
  "date" date NOT NULL,
  "scenario_assessment_id" uuid,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: template_review_comments
CREATE TABLE IF NOT EXISTS "template_review_comments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "review_item_id" uuid NOT NULL,
  "author_email" text NOT NULL,
  "comment" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: template_review_items
CREATE TABLE IF NOT EXISTS "template_review_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "review_id" uuid NOT NULL,
  "lab_day_id" uuid NOT NULL,
  "template_id" uuid,
  "disposition" text DEFAULT 'pending'::text NOT NULL,
  "revised_data" jsonb,
  "reviewer_notes" text,
  "reviewed_by" text,
  "reviewed_at" timestamptz,
  PRIMARY KEY ("id")
);

-- Table: template_reviews
CREATE TABLE IF NOT EXISTS "template_reviews" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cohort_id" uuid NOT NULL,
  "semester" text NOT NULL,
  "title" text NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "created_by" text NOT NULL,
  "reviewers" text[] DEFAULT '{}'::text[],
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "completed_at" timestamptz,
  PRIMARY KEY ("id")
);

-- Table: timer_display_tokens
CREATE TABLE IF NOT EXISTS "timer_display_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "token" text DEFAULT encode(gen_random_bytes(16), 'hex'::text) NOT NULL,
  "room_name" text NOT NULL,
  "lab_room_id" uuid,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "last_used_at" timestamptz,
  "created_by" uuid,
  "timer_type" text DEFAULT 'fixed'::text,
  PRIMARY KEY ("id")
);

-- Table: user_activity
CREATE TABLE IF NOT EXISTS "user_activity" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_email" text NOT NULL,
  "page_path" text NOT NULL,
  "user_agent" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: user_departments
CREATE TABLE IF NOT EXISTS "user_departments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "department_id" uuid,
  "is_primary" boolean DEFAULT false,
  "granted_by" text,
  "granted_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: user_endorsements
CREATE TABLE IF NOT EXISTS "user_endorsements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "endorsement_type" text NOT NULL,
  "title" text,
  "department_id" uuid,
  "granted_by" text,
  "granted_at" timestamptz DEFAULT now(),
  "expires_at" timestamptz,
  "is_active" boolean DEFAULT true,
  PRIMARY KEY ("id")
);

-- Table: user_notifications
CREATE TABLE IF NOT EXISTS "user_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_email" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" text DEFAULT 'general'::text NOT NULL,
  "link_url" text,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "read_at" timestamptz,
  "reference_type" text,
  "reference_id" uuid,
  "category" text DEFAULT 'system'::text,
  "digest_sent_at" timestamptz,
  "archived_at" timestamptz,
  "is_archived" boolean DEFAULT false,
  PRIMARY KEY ("id")
);

-- Table: user_preferences
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_email" text NOT NULL,
  "dashboard_widgets" jsonb DEFAULT '["notifications", "my_labs", "quick_links"]'::jsonb,
  "quick_links" jsonb DEFAULT '["scenarios", "students", "schedule"]'::jsonb,
  "notification_settings" jsonb DEFAULT '{"email_lab_reminders": true, "email_lab_assignments": true, "email_feedback_updates": false, "show_desktop_notifications": false}'::jsonb,
  "preferences" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "email_preferences" jsonb DEFAULT '{"mode": "immediate", "enabled": false, "categories": {}}'::jsonb,
  "tour_completed" boolean DEFAULT false,
  "tour_step" integer DEFAULT 0,
  "tour_completed_at" timestamptz,
  PRIMARY KEY ("id")
);

-- Table: user_roles
CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: user_sessions
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_email" text NOT NULL,
  "session_token" text NOT NULL,
  "device_info" jsonb,
  "ip_address" text,
  "last_active" timestamptz DEFAULT now(),
  "expires_at" timestamptz,
  "is_revoked" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: webhook_deliveries
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "webhook_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb,
  "response_status" integer,
  "response_body" text,
  "success" boolean,
  "retry_count" integer DEFAULT 0,
  "delivered_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: webhooks
CREATE TABLE IF NOT EXISTS "webhooks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "events" text[] NOT NULL,
  "secret" text,
  "is_active" boolean DEFAULT true,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ===================
-- Foreign Keys
-- ===================
DO $$ BEGIN ALTER TABLE "access_cards" ADD CONSTRAINT "access_cards_lab_user_id_fkey" FOREIGN KEY ("lab_user_id") REFERENCES "lab_users" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_cards" ADD CONSTRAINT "access_cards_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_device_heartbeats" ADD CONSTRAINT "access_device_heartbeats_access_device_id_fkey" FOREIGN KEY ("access_device_id") REFERENCES "access_devices" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_devices" ADD CONSTRAINT "access_devices_door_id_fkey" FOREIGN KEY ("door_id") REFERENCES "access_doors" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_doors" ADD CONSTRAINT "access_doors_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_access_card_id_fkey" FOREIGN KEY ("access_card_id") REFERENCES "access_cards" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_access_device_id_fkey" FOREIGN KEY ("access_device_id") REFERENCES "access_devices" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_access_door_id_fkey" FOREIGN KEY ("access_door_id") REFERENCES "access_doors" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_rules" ADD CONSTRAINT "access_rules_access_card_id_fkey" FOREIGN KEY ("access_card_id") REFERENCES "access_cards" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_rules" ADD CONSTRAINT "access_rules_access_door_id_fkey" FOREIGN KEY ("access_door_id") REFERENCES "access_doors" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_rules" ADD CONSTRAINT "access_rules_access_schedule_id_fkey" FOREIGN KEY ("access_schedule_id") REFERENCES "access_schedules" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "aemt_student_tracking" ADD CONSTRAINT "aemt_student_tracking_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "aemt_student_tracking" ADD CONSTRAINT "aemt_student_tracking_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "affiliation_notifications_log" ADD CONSTRAINT "affiliation_notifications_log_affiliation_id_fkey" FOREIGN KEY ("affiliation_id") REFERENCES "clinical_affiliations" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "agency_contacts" ADD CONSTRAINT "agency_contacts_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "alumni" ADD CONSTRAINT "alumni_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "alumni" ADD CONSTRAINT "alumni_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "attendance_appeals" ADD CONSTRAINT "attendance_appeals_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab_users" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "bin_contents" ADD CONSTRAINT "bin_contents_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory_bins" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_analytics" ADD CONSTRAINT "case_analytics_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case_studies" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case_studies" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_briefs" ADD CONSTRAINT "case_briefs_generated_case_id_fkey" FOREIGN KEY ("generated_case_id") REFERENCES "case_studies" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_flags" ADD CONSTRAINT "case_flags_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case_studies" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_flags" ADD CONSTRAINT "case_flags_flagged_by_fkey" FOREIGN KEY ("flagged_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_flags" ADD CONSTRAINT "case_flags_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_practice_progress" ADD CONSTRAINT "case_practice_progress_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case_studies" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_practice_progress" ADD CONSTRAINT "case_practice_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_responses" ADD CONSTRAINT "case_responses_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case_studies" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_responses" ADD CONSTRAINT "case_responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "case_sessions" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_responses" ADD CONSTRAINT "case_responses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_reviews" ADD CONSTRAINT "case_reviews_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case_studies" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_reviews" ADD CONSTRAINT "case_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_sessions" ADD CONSTRAINT "case_sessions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case_studies" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_sessions" ADD CONSTRAINT "case_sessions_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_generation_brief_id_fkey" FOREIGN KEY ("generation_brief_id") REFERENCES "case_briefs" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ce_records" ADD CONSTRAINT "ce_records_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "instructor_certifications" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ce_records" ADD CONSTRAINT "ce_records_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cert_notifications" ADD CONSTRAINT "cert_notifications_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "instructor_certifications" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cert_notifications" ADD CONSTRAINT "cert_notifications_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_rotations" ADD CONSTRAINT "clinical_rotations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "clinical_sites" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_rotations" ADD CONSTRAINT "clinical_rotations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_site_departments" ADD CONSTRAINT "clinical_site_departments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "clinical_sites" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_site_schedules" ADD CONSTRAINT "clinical_site_schedules_clinical_site_id_fkey" FOREIGN KEY ("clinical_site_id") REFERENCES "clinical_sites" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_site_visits" ADD CONSTRAINT "clinical_site_visits_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_site_visits" ADD CONSTRAINT "clinical_site_visits_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_site_visits" ADD CONSTRAINT "clinical_site_visits_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "clinical_sites" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_site_visits" ADD CONSTRAINT "clinical_site_visits_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "lab_users" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_task_definitions" ADD CONSTRAINT "clinical_task_definitions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "clinical_task_templates" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_task_templates" ADD CONSTRAINT "clinical_task_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_visit_students" ADD CONSTRAINT "clinical_visit_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_visit_students" ADD CONSTRAINT "clinical_visit_students_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "clinical_site_visits" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "closeout_documents" ADD CONSTRAINT "closeout_documents_internship_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "student_internships" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "closeout_surveys" ADD CONSTRAINT "closeout_surveys_internship_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "student_internships" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_key_dates" ADD CONSTRAINT "cohort_key_dates_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_milestones" ADD CONSTRAINT "cohort_milestones_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_scenario_completions" ADD CONSTRAINT "cohort_scenario_completions_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_scenario_completions" ADD CONSTRAINT "cohort_scenario_completions_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_scenario_completions" ADD CONSTRAINT "cohort_scenario_completions_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_scenario_completions" ADD CONSTRAINT "cohort_scenario_completions_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "lab_stations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_skill_completions" ADD CONSTRAINT "cohort_skill_completions_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_skill_completions" ADD CONSTRAINT "cohort_skill_completions_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_skill_completions" ADD CONSTRAINT "cohort_skill_completions_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_skill_completions" ADD CONSTRAINT "cohort_skill_completions_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "lab_stations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_tasks" ADD CONSTRAINT "cohort_tasks_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_tasks" ADD CONSTRAINT "cohort_tasks_task_definition_id_fkey" FOREIGN KEY ("task_definition_id") REFERENCES "clinical_task_definitions" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_tasks" ADD CONSTRAINT "cohort_tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "clinical_task_templates" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "compliance_audit_log" ADD CONSTRAINT "compliance_audit_log_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "compliance_audits" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "custody_checkout_items" ADD CONSTRAINT "custody_checkout_items_custody_checkout_id_fkey" FOREIGN KEY ("custody_checkout_id") REFERENCES "custody_checkouts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "custody_checkouts" ADD CONSTRAINT "custody_checkouts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "custom_skills" ADD CONSTRAINT "custom_skills_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "lab_stations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "data_export_archives" ADD CONSTRAINT "data_export_archives_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ekg_warmup_scores" ADD CONSTRAINT "ekg_warmup_scores_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ekg_warmup_scores" ADD CONSTRAINT "ekg_warmup_scores_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "employment_verifications" ADD CONSTRAINT "employment_verifications_internship_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "student_internships" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "emt_student_tracking" ADD CONSTRAINT "emt_student_tracking_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "emt_student_tracking" ADD CONSTRAINT "emt_student_tracking_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_equipment_item_id_fkey" FOREIGN KEY ("equipment_item_id") REFERENCES "equipment_items" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "equipment_categories" ADD CONSTRAINT "equipment_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "equipment_categories" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "equipment_checkouts" ADD CONSTRAINT "equipment_checkouts_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "equipment_checkouts" ADD CONSTRAINT "equipment_checkouts_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "equipment_categories" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "equipment_maintenance" ADD CONSTRAINT "equipment_maintenance_equipment_item_id_fkey" FOREIGN KEY ("equipment_item_id") REFERENCES "equipment_items" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "field_preceptors" ADD CONSTRAINT "field_preceptors_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "field_ride_requests" ADD CONSTRAINT "field_ride_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "field_trip_attendance" ADD CONSTRAINT "field_trip_attendance_field_trip_id_fkey" FOREIGN KEY ("field_trip_id") REFERENCES "field_trips" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "field_trip_attendance" ADD CONSTRAINT "field_trip_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "field_trips" ADD CONSTRAINT "field_trips_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "field_trips" ADD CONSTRAINT "field_trips_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "filament_adjustments" ADD CONSTRAINT "filament_adjustments_filament_type_id_fkey" FOREIGN KEY ("filament_type_id") REFERENCES "filament_types" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "filament_purchases" ADD CONSTRAINT "filament_purchases_filament_type_id_fkey" FOREIGN KEY ("filament_type_id") REFERENCES "filament_types" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "guest_access" ADD CONSTRAINT "guest_access_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "guest_access" ADD CONSTRAINT "guest_access_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "instructor_availability" ADD CONSTRAINT "instructor_availability_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "instructor_certifications" ADD CONSTRAINT "fk_ce_requirement" FOREIGN KEY ("ce_requirement_id") REFERENCES "ce_requirements" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "instructor_certifications" ADD CONSTRAINT "instructor_certifications_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "instructor_daily_notes" ADD CONSTRAINT "instructor_daily_notes_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "instructor_tasks" ADD CONSTRAINT "instructor_tasks_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "instructor_tasks" ADD CONSTRAINT "instructor_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "instructor_tasks" ADD CONSTRAINT "instructor_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "instructor_time_entries" ADD CONSTRAINT "instructor_time_entries_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "internship_meetings" ADD CONSTRAINT "internship_meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "internship_meetings" ADD CONSTRAINT "internship_meetings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "internship_meetings" ADD CONSTRAINT "internship_meetings_student_internship_id_fkey" FOREIGN KEY ("student_internship_id") REFERENCES "student_internships" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "inventory_bin_contents" ADD CONSTRAINT "inventory_bin_contents_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory_bins" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "inventory_bin_transactions" ADD CONSTRAINT "inventory_bin_transactions_bin_content_id_fkey" FOREIGN KEY ("bin_content_id") REFERENCES "inventory_bin_contents" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "inventory_bins" ADD CONSTRAINT "inventory_bins_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_locations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "inventory_containers" ADD CONSTRAINT "inventory_containers_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "inventory_rooms" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "inventory_positions" ADD CONSTRAINT "inventory_positions_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "inventory_containers" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_attendance" ADD CONSTRAINT "lab_day_attendance_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_attendance" ADD CONSTRAINT "lab_day_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_checklist_items" ADD CONSTRAINT "lab_day_checklist_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_checklist_items" ADD CONSTRAINT "lab_day_checklist_items_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_checklists" ADD CONSTRAINT "lab_day_checklists_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_costs" ADD CONSTRAINT "lab_day_costs_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_debrief_notes" ADD CONSTRAINT "lab_day_debrief_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_debrief_notes" ADD CONSTRAINT "lab_day_debrief_notes_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_debriefs" ADD CONSTRAINT "lab_day_debriefs_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_equipment" ADD CONSTRAINT "lab_day_equipment_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_roles" ADD CONSTRAINT "lab_day_roles_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_roles" ADD CONSTRAINT "lab_day_roles_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_signups" ADD CONSTRAINT "lab_day_signups_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_signups" ADD CONSTRAINT "lab_day_signups_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_student_queue" ADD CONSTRAINT "lab_day_student_queue_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "student_skill_evaluations" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_student_queue" ADD CONSTRAINT "lab_day_student_queue_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_student_queue" ADD CONSTRAINT "lab_day_student_queue_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "lab_stations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_student_queue" ADD CONSTRAINT "lab_day_student_queue_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_days" ADD CONSTRAINT "lab_days_assigned_timer_id_fkey" FOREIGN KEY ("assigned_timer_id") REFERENCES "timer_display_tokens" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_days" ADD CONSTRAINT "lab_days_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_days" ADD CONSTRAINT "lab_days_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_days" ADD CONSTRAINT "lab_days_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "lab_day_templates" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_equipment_items" ADD CONSTRAINT "lab_equipment_items_checked_out_by_fkey" FOREIGN KEY ("checked_out_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_equipment_items" ADD CONSTRAINT "lab_equipment_items_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_equipment_items" ADD CONSTRAINT "lab_equipment_items_returned_by_fkey" FOREIGN KEY ("returned_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_equipment_items" ADD CONSTRAINT "lab_equipment_items_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "lab_stations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_equipment_tracking" ADD CONSTRAINT "lab_equipment_tracking_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_equipment_tracking" ADD CONSTRAINT "lab_equipment_tracking_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "lab_stations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_group_assignment_history" ADD CONSTRAINT "lab_group_assignment_history_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "lab_groups" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_group_assignment_history" ADD CONSTRAINT "lab_group_assignment_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_group_history" ADD CONSTRAINT "lab_group_history_from_group_id_fkey" FOREIGN KEY ("from_group_id") REFERENCES "lab_groups" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_group_history" ADD CONSTRAINT "lab_group_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_group_history" ADD CONSTRAINT "lab_group_history_to_group_id_fkey" FOREIGN KEY ("to_group_id") REFERENCES "lab_groups" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_group_members" ADD CONSTRAINT "lab_group_members_lab_group_id_fkey" FOREIGN KEY ("lab_group_id") REFERENCES "lab_groups" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_group_members" ADD CONSTRAINT "lab_group_members_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_groups" ADD CONSTRAINT "lab_groups_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_stations" ADD CONSTRAINT "lab_stations_additional_instructor_id_fkey" FOREIGN KEY ("additional_instructor_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_stations" ADD CONSTRAINT "lab_stations_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_stations" ADD CONSTRAINT "lab_stations_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_stations" ADD CONSTRAINT "lab_stations_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_template_stations" ADD CONSTRAINT "lab_template_stations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "lab_day_templates" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_template_versions" ADD CONSTRAINT "lab_template_versions_source_lab_day_id_fkey" FOREIGN KEY ("source_lab_day_id") REFERENCES "lab_days" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_template_versions" ADD CONSTRAINT "lab_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "lab_day_templates" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_timer_ready_status" ADD CONSTRAINT "lab_timer_ready_status_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_timer_ready_status" ADD CONSTRAINT "lab_timer_ready_status_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "lab_stations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_timer_state" ADD CONSTRAINT "lab_timer_state_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_users" ADD CONSTRAINT "lab_users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_week_templates" ADD CONSTRAINT "lab_week_templates_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "learning_plan_notes" ADD CONSTRAINT "learning_plan_notes_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "learning_plans" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "library_checkouts" ADD CONSTRAINT "library_checkouts_library_copy_id_fkey" FOREIGN KEY ("library_copy_id") REFERENCES "library_copies" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "library_checkouts" ADD CONSTRAINT "library_checkouts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_library_item_id_fkey" FOREIGN KEY ("library_item_id") REFERENCES "library_items" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "library_scanning_sessions" ADD CONSTRAINT "library_scanning_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "locations" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_chapters" ADD CONSTRAINT "lvfr_aemt_chapters_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "lvfr_aemt_modules" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_course_days" ADD CONSTRAINT "lvfr_aemt_course_days_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "lvfr_aemt_modules" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_files" ADD CONSTRAINT "lvfr_aemt_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_grades" ADD CONSTRAINT "lvfr_aemt_grades_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "lvfr_aemt_assessments" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_grades" ADD CONSTRAINT "lvfr_aemt_grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_instructor_assignments" ADD CONSTRAINT "lvfr_aemt_instructor_assignments_primary_instructor_id_fkey" FOREIGN KEY ("primary_instructor_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_instructor_assignments" ADD CONSTRAINT "lvfr_aemt_instructor_assignments_secondary_instructor_id_fkey" FOREIGN KEY ("secondary_instructor_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_instructor_availability" ADD CONSTRAINT "lvfr_aemt_instructor_availability_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_pharm_checkpoints" ADD CONSTRAINT "lvfr_aemt_pharm_checkpoints_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_plan_instances" ADD CONSTRAINT "lvfr_aemt_plan_instances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_plan_instances" ADD CONSTRAINT "lvfr_aemt_plan_instances_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_plan_instances" ADD CONSTRAINT "lvfr_aemt_plan_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "lvfr_aemt_plan_templates" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_plan_placements" ADD CONSTRAINT "lvfr_aemt_plan_placements_content_block_id_fkey" FOREIGN KEY ("content_block_id") REFERENCES "lvfr_aemt_content_blocks" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_plan_placements" ADD CONSTRAINT "lvfr_aemt_plan_placements_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "lvfr_aemt_plan_instances" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_plan_placements" ADD CONSTRAINT "lvfr_aemt_plan_placements_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_plan_templates" ADD CONSTRAINT "lvfr_aemt_plan_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_prerequisites" ADD CONSTRAINT "lvfr_aemt_prerequisites_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "lvfr_aemt_content_blocks" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_prerequisites" ADD CONSTRAINT "lvfr_aemt_prerequisites_requires_block_id_fkey" FOREIGN KEY ("requires_block_id") REFERENCES "lvfr_aemt_content_blocks" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_shift_patterns" ADD CONSTRAINT "lvfr_aemt_shift_patterns_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_skill_attempts" ADD CONSTRAINT "lvfr_aemt_skill_attempts_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_skill_attempts" ADD CONSTRAINT "lvfr_aemt_skill_attempts_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "lvfr_aemt_skills" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_skill_attempts" ADD CONSTRAINT "lvfr_aemt_skill_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_skill_status" ADD CONSTRAINT "lvfr_aemt_skill_status_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "lvfr_aemt_skills" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_skill_status" ADD CONSTRAINT "lvfr_aemt_skill_status_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_supplementary_days" ADD CONSTRAINT "lvfr_aemt_supplementary_days_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "mentorship_logs" ADD CONSTRAINT "mentorship_logs_pair_id_fkey" FOREIGN KEY ("pair_id") REFERENCES "mentorship_pairs" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "mentorship_pairs" ADD CONSTRAINT "mentorship_pairs_mentee_id_fkey" FOREIGN KEY ("mentee_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "mentorship_pairs" ADD CONSTRAINT "mentorship_pairs_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_assignments" ADD CONSTRAINT "onboarding_assignments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "onboarding_templates" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_events" ADD CONSTRAINT "onboarding_events_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "onboarding_assignments" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_events" ADD CONSTRAINT "onboarding_events_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "onboarding_phases" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_events" ADD CONSTRAINT "onboarding_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "onboarding_tasks" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_evidence" ADD CONSTRAINT "onboarding_evidence_task_progress_id_fkey" FOREIGN KEY ("task_progress_id") REFERENCES "onboarding_task_progress" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_phase_progress" ADD CONSTRAINT "onboarding_phase_progress_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "onboarding_assignments" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_phase_progress" ADD CONSTRAINT "onboarding_phase_progress_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "onboarding_phases" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_phases" ADD CONSTRAINT "onboarding_phases_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "onboarding_templates" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_task_dependencies" ADD CONSTRAINT "onboarding_task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "onboarding_tasks" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_task_dependencies" ADD CONSTRAINT "onboarding_task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "onboarding_tasks" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_task_progress" ADD CONSTRAINT "onboarding_task_progress_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "onboarding_assignments" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_task_progress" ADD CONSTRAINT "onboarding_task_progress_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "onboarding_tasks" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "onboarding_phases" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "open_shifts" ADD CONSTRAINT "open_shifts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "open_shifts" ADD CONSTRAINT "open_shifts_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "osce_observer_blocks" ADD CONSTRAINT "osce_observer_blocks_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "osce_time_blocks" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "osce_observer_blocks" ADD CONSTRAINT "osce_observer_blocks_observer_id_fkey" FOREIGN KEY ("observer_id") REFERENCES "osce_observers" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "osce_observers" ADD CONSTRAINT "osce_observers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "osce_events" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "osce_student_agencies" ADD CONSTRAINT "osce_student_agencies_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "osce_events" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "osce_student_schedule" ADD CONSTRAINT "osce_student_schedule_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "osce_events" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "osce_student_schedule" ADD CONSTRAINT "osce_student_schedule_time_block_id_fkey" FOREIGN KEY ("time_block_id") REFERENCES "osce_time_blocks" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "osce_time_blocks" ADD CONSTRAINT "osce_time_blocks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "osce_events" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "peer_evaluations" ADD CONSTRAINT "peer_evaluations_evaluated_id_fkey" FOREIGN KEY ("evaluated_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "peer_evaluations" ADD CONSTRAINT "peer_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "peer_evaluations" ADD CONSTRAINT "peer_evaluations_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_block_instructors" ADD CONSTRAINT "pmi_block_instructors_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_block_instructors" ADD CONSTRAINT "pmi_block_instructors_schedule_block_id_fkey" FOREIGN KEY ("schedule_block_id") REFERENCES "pmi_schedule_blocks" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_course_templates" ADD CONSTRAINT "pmi_course_templates_default_instructor_id_fkey" FOREIGN KEY ("default_instructor_id") REFERENCES "lab_users" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_course_templates" ADD CONSTRAINT "pmi_course_templates_replaces_course_id_fkey" FOREIGN KEY ("replaces_course_id") REFERENCES "pmi_course_templates" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_instructor_workload" ADD CONSTRAINT "pmi_instructor_workload_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_instructor_workload" ADD CONSTRAINT "pmi_instructor_workload_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "pmi_semesters" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_program_schedules" ADD CONSTRAINT "pmi_program_schedules_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_program_schedules" ADD CONSTRAINT "pmi_program_schedules_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "pmi_semesters" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_room_availability" ADD CONSTRAINT "pmi_room_availability_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "pmi_rooms" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_room_availability" ADD CONSTRAINT "pmi_room_availability_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "pmi_semesters" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_schedule_blocks" ADD CONSTRAINT "pmi_schedule_blocks_linked_lab_day_id_fkey" FOREIGN KEY ("linked_lab_day_id") REFERENCES "lab_days" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_schedule_blocks" ADD CONSTRAINT "pmi_schedule_blocks_program_schedule_id_fkey" FOREIGN KEY ("program_schedule_id") REFERENCES "pmi_program_schedules" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_schedule_blocks" ADD CONSTRAINT "pmi_schedule_blocks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "pmi_rooms" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_schedule_blocks" ADD CONSTRAINT "pmi_schedule_blocks_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "pmi_semesters" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "preceptor_eval_tokens" ADD CONSTRAINT "preceptor_eval_tokens_internship_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "student_internships" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "preceptor_eval_tokens" ADD CONSTRAINT "preceptor_eval_tokens_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "preceptor_feedback" ADD CONSTRAINT "preceptor_feedback_internship_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "student_internships" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "preceptor_feedback" ADD CONSTRAINT "preceptor_feedback_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "print_failures" ADD CONSTRAINT "print_failures_filament_type_id_fkey" FOREIGN KEY ("filament_type_id") REFERENCES "filament_types" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "print_failures" ADD CONSTRAINT "print_failures_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "print_failures" ADD CONSTRAINT "print_failures_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "print_requests" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "print_notifications" ADD CONSTRAINT "print_notifications_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "print_requests" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "print_request_history" ADD CONSTRAINT "print_request_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "print_requests" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "print_request_materials" ADD CONSTRAINT "print_request_materials_filament_type_id_fkey" FOREIGN KEY ("filament_type_id") REFERENCES "filament_types" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "print_request_materials" ADD CONSTRAINT "print_request_materials_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "print_requests" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "print_requests" ADD CONSTRAINT "print_requests_filament_type_id_fkey" FOREIGN KEY ("filament_type_id") REFERENCES "filament_types" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "print_requests" ADD CONSTRAINT "print_requests_material_preference_id_fkey" FOREIGN KEY ("material_preference_id") REFERENCES "filament_types" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "print_requests" ADD CONSTRAINT "print_requests_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "print_requests" ADD CONSTRAINT "print_requests_reorder_of_fkey" FOREIGN KEY ("reorder_of") REFERENCES "print_requests" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "printer_hour_adjustments" ADD CONSTRAINT "printer_hour_adjustments_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "printer_maintenance" ADD CONSTRAINT "printer_maintenance_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "program_outcomes" ADD CONSTRAINT "program_outcomes_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "programs" ADD CONSTRAINT "programs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "protocol_completions" ADD CONSTRAINT "protocol_completions_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "protocol_completions" ADD CONSTRAINT "protocol_completions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "resource_bookings" ADD CONSTRAINT "resource_bookings_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "bookable_resources" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "resource_versions" ADD CONSTRAINT "resource_versions_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "assessment_rubrics" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "rubric_scenario_assignments" ADD CONSTRAINT "rubric_scenario_assignments_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "assessment_rubrics" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "rubric_scenario_assignments" ADD CONSTRAINT "rubric_scenario_assignments_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_assessments" ADD CONSTRAINT "scenario_assessments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_assessments" ADD CONSTRAINT "scenario_assessments_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_assessments" ADD CONSTRAINT "scenario_assessments_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_assessments" ADD CONSTRAINT "scenario_assessments_lab_group_id_fkey" FOREIGN KEY ("lab_group_id") REFERENCES "lab_groups" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_assessments" ADD CONSTRAINT "scenario_assessments_lab_station_id_fkey" FOREIGN KEY ("lab_station_id") REFERENCES "lab_stations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_assessments" ADD CONSTRAINT "scenario_assessments_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "lab_stations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_assessments" ADD CONSTRAINT "scenario_assessments_team_lead_id_fkey" FOREIGN KEY ("team_lead_id") REFERENCES "students" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_favorites" ADD CONSTRAINT "scenario_favorites_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_participation" ADD CONSTRAINT "scenario_participation_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "lab_users" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_participation" ADD CONSTRAINT "scenario_participation_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "lab_users" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_participation" ADD CONSTRAINT "scenario_participation_instructor_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_participation" ADD CONSTRAINT "scenario_participation_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_participation" ADD CONSTRAINT "scenario_participation_lab_day_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_participation" ADD CONSTRAINT "scenario_participation_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_participation" ADD CONSTRAINT "scenario_participation_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_ratings" ADD CONSTRAINT "scenario_ratings_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_tags" ADD CONSTRAINT "scenario_tags_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_versions" ADD CONSTRAINT "scenario_versions_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_seating_chart_id_fkey" FOREIGN KEY ("seating_chart_id") REFERENCES "seating_charts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "seating_charts" ADD CONSTRAINT "seating_charts_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "seating_charts" ADD CONSTRAINT "seating_charts_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "seating_preferences" ADD CONSTRAINT "seating_preferences_other_student_id_fkey" FOREIGN KEY ("other_student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "seating_preferences" ADD CONSTRAINT "seating_preferences_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shift_signups" ADD CONSTRAINT "shift_signups_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shift_signups" ADD CONSTRAINT "shift_signups_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shift_signups" ADD CONSTRAINT "shift_signups_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "open_shifts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shift_swap_interest" ADD CONSTRAINT "shift_swap_interest_swap_request_id_fkey" FOREIGN KEY ("swap_request_id") REFERENCES "shift_trade_requests" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shift_trade_requests" ADD CONSTRAINT "shift_trade_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shift_trade_requests" ADD CONSTRAINT "shift_trade_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shift_trade_requests" ADD CONSTRAINT "shift_trade_requests_requester_shift_id_fkey" FOREIGN KEY ("requester_shift_id") REFERENCES "open_shifts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shift_trade_requests" ADD CONSTRAINT "shift_trade_requests_target_shift_id_fkey" FOREIGN KEY ("target_shift_id") REFERENCES "open_shifts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shift_trade_requests" ADD CONSTRAINT "shift_trade_requests_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shift_trades" ADD CONSTRAINT "shift_trades_original_shift_id_fkey" FOREIGN KEY ("original_shift_id") REFERENCES "open_shifts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_lab_station_id_fkey" FOREIGN KEY ("lab_station_id") REFERENCES "lab_stations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_competencies" ADD CONSTRAINT "skill_competencies_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_competencies" ADD CONSTRAINT "skill_competencies_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_documents" ADD CONSTRAINT "skill_documents_drill_id_fkey" FOREIGN KEY ("drill_id") REFERENCES "skill_drills" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_documents" ADD CONSTRAINT "skill_documents_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_drill_cases" ADD CONSTRAINT "skill_drill_cases_skill_drill_id_fkey" FOREIGN KEY ("skill_drill_id") REFERENCES "skill_drills" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_sheet_assignments" ADD CONSTRAINT "skill_sheet_assignments_skill_sheet_id_fkey" FOREIGN KEY ("skill_sheet_id") REFERENCES "skill_sheets" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_sheet_steps" ADD CONSTRAINT "skill_sheet_steps_skill_sheet_id_fkey" FOREIGN KEY ("skill_sheet_id") REFERENCES "skill_sheets" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_sheets" ADD CONSTRAINT "skill_sheets_canonical_skill_id_fkey" FOREIGN KEY ("canonical_skill_id") REFERENCES "canonical_skills" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_signoffs" ADD CONSTRAINT "skill_signoffs_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_signoffs" ADD CONSTRAINT "skill_signoffs_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_signoffs" ADD CONSTRAINT "skill_signoffs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_completions" ADD CONSTRAINT "station_completions_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_completions" ADD CONSTRAINT "station_completions_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_completions" ADD CONSTRAINT "station_completions_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "lab_stations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_completions" ADD CONSTRAINT "station_completions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_instructors" ADD CONSTRAINT "station_instructors_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "lab_stations" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_instructors" ADD CONSTRAINT "station_instructors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab_users" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_pool" ADD CONSTRAINT "station_pool_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_pool" ADD CONSTRAINT "station_pool_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_skills" ADD CONSTRAINT "station_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_skills" ADD CONSTRAINT "station_skills_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "lab_stations" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_achievements" ADD CONSTRAINT "student_achievements_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_case_stats" ADD CONSTRAINT "student_case_stats_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_case_stats" ADD CONSTRAINT "student_case_stats_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_clinical_hours" ADD CONSTRAINT "student_clinical_hours_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_clinical_hours" ADD CONSTRAINT "student_clinical_hours_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_communications" ADD CONSTRAINT "student_communications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_compliance_docs" ADD CONSTRAINT "student_compliance_docs_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_compliance_docs" ADD CONSTRAINT "student_compliance_docs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_compliance_records" ADD CONSTRAINT "student_compliance_records_doc_type_id_fkey" FOREIGN KEY ("doc_type_id") REFERENCES "compliance_document_types" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_compliance_records" ADD CONSTRAINT "student_compliance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_field_rides" ADD CONSTRAINT "student_field_rides_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_field_rides" ADD CONSTRAINT "student_field_rides_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_group_assignments" ADD CONSTRAINT "student_group_assignments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "student_groups" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_group_assignments" ADD CONSTRAINT "student_group_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_groups" ADD CONSTRAINT "student_groups_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_import_history" ADD CONSTRAINT "student_import_history_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_individual_tasks" ADD CONSTRAINT "student_individual_tasks_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_individual_tasks" ADD CONSTRAINT "student_individual_tasks_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_individual_tasks" ADD CONSTRAINT "student_individual_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_individual_tasks" ADD CONSTRAINT "student_individual_tasks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_internships" ADD CONSTRAINT "student_internships_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_internships" ADD CONSTRAINT "student_internships_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_internships" ADD CONSTRAINT "student_internships_preceptor_id_fkey" FOREIGN KEY ("preceptor_id") REFERENCES "field_preceptors" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_internships" ADD CONSTRAINT "student_internships_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_lab_ratings" ADD CONSTRAINT "student_lab_ratings_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_lab_ratings" ADD CONSTRAINT "student_lab_ratings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_lab_signups" ADD CONSTRAINT "student_lab_signups_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_lab_signups" ADD CONSTRAINT "student_lab_signups_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_learning_styles" ADD CONSTRAINT "student_learning_styles_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_mce_clearance" ADD CONSTRAINT "student_mce_clearance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_mce_modules" ADD CONSTRAINT "student_mce_modules_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_mce_modules" ADD CONSTRAINT "student_mce_modules_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_milestones" ADD CONSTRAINT "student_milestones_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_preceptor_assignments" ADD CONSTRAINT "student_preceptor_assignments_internship_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "student_internships" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_preceptor_assignments" ADD CONSTRAINT "student_preceptor_assignments_preceptor_id_fkey" FOREIGN KEY ("preceptor_id") REFERENCES "field_preceptors" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_skill_evaluations" ADD CONSTRAINT "student_skill_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_skill_evaluations" ADD CONSTRAINT "student_skill_evaluations_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_skill_evaluations" ADD CONSTRAINT "student_skill_evaluations_skill_sheet_id_fkey" FOREIGN KEY ("skill_sheet_id") REFERENCES "skill_sheets" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_skill_evaluations" ADD CONSTRAINT "student_skill_evaluations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_task_status" ADD CONSTRAINT "student_task_status_cohort_task_id_fkey" FOREIGN KEY ("cohort_task_id") REFERENCES "cohort_tasks" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_task_status" ADD CONSTRAINT "student_task_status_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_task_status" ADD CONSTRAINT "student_task_status_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "students" ADD CONSTRAINT "students_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "submissions" ADD CONSTRAINT "submissions_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "substitute_requests" ADD CONSTRAINT "substitute_requests_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "summative_evaluation_scores" ADD CONSTRAINT "summative_evaluation_scores_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "summative_evaluations" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "summative_evaluation_scores" ADD CONSTRAINT "summative_evaluation_scores_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "summative_evaluation_scores" ADD CONSTRAINT "summative_evaluation_scores_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "summative_evaluations" ADD CONSTRAINT "summative_evaluations_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "summative_evaluations" ADD CONSTRAINT "summative_evaluations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "summative_evaluations" ADD CONSTRAINT "summative_evaluations_internship_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "student_internships" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "summative_evaluations" ADD CONSTRAINT "summative_evaluations_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "summative_scenarios" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "summative_scenarios" ADD CONSTRAINT "summative_scenarios_linked_scenario_id_fkey" FOREIGN KEY ("linked_scenario_id") REFERENCES "scenarios" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "supply_barcodes" ADD CONSTRAINT "supply_barcodes_supply_item_id_fkey" FOREIGN KEY ("supply_item_id") REFERENCES "supply_items" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "supply_categories" ADD CONSTRAINT "supply_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "supply_categories" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "supply_items" ADD CONSTRAINT "supply_items_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory_bins" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "supply_items" ADD CONSTRAINT "supply_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "supply_categories" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "supply_items" ADD CONSTRAINT "supply_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "supply_notifications" ADD CONSTRAINT "supply_notifications_supply_item_id_fkey" FOREIGN KEY ("supply_item_id") REFERENCES "supply_items" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "supply_transactions" ADD CONSTRAINT "supply_transactions_supply_item_id_fkey" FOREIGN KEY ("supply_item_id") REFERENCES "supply_items" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "lab_users" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "instructor_tasks" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "instructor_tasks" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "teaching_log" ADD CONSTRAINT "teaching_log_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "instructor_certifications" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "teaching_log" ADD CONSTRAINT "teaching_log_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "teaching_log" ADD CONSTRAINT "teaching_log_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "lab_users" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "teaching_log" ADD CONSTRAINT "teaching_log_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "team_lead_log" ADD CONSTRAINT "team_lead_log_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "team_lead_log" ADD CONSTRAINT "team_lead_log_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "team_lead_log" ADD CONSTRAINT "team_lead_log_lab_station_id_fkey" FOREIGN KEY ("lab_station_id") REFERENCES "lab_stations" ("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "team_lead_log" ADD CONSTRAINT "team_lead_log_scenario_assessment_id_fkey" FOREIGN KEY ("scenario_assessment_id") REFERENCES "scenario_assessments" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "team_lead_log" ADD CONSTRAINT "team_lead_log_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "team_lead_log" ADD CONSTRAINT "team_lead_log_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "template_review_comments" ADD CONSTRAINT "template_review_comments_review_item_id_fkey" FOREIGN KEY ("review_item_id") REFERENCES "template_review_items" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "template_review_items" ADD CONSTRAINT "template_review_items_lab_day_id_fkey" FOREIGN KEY ("lab_day_id") REFERENCES "lab_days" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "template_review_items" ADD CONSTRAINT "template_review_items_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "template_reviews" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "template_reviews" ADD CONSTRAINT "template_reviews_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "timer_display_tokens" ADD CONSTRAINT "timer_display_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab_users" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab_users" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_endorsements" ADD CONSTRAINT "user_endorsements_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments" ("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_endorsements" ADD CONSTRAINT "user_endorsements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab_users" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab_users" ("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks" ("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===================
-- Unique Constraints
-- ===================
DO $$ BEGIN ALTER TABLE "access_cards" ADD CONSTRAINT "access_cards_card_uid_key" UNIQUE ("card_uid"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_devices" ADD CONSTRAINT "access_devices_hardware_id_key" UNIQUE ("hardware_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_pi_event_id_key" UNIQUE ("pi_event_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "access_rules" ADD CONSTRAINT "access_rules_access_card_id_access_door_id_key" UNIQUE ("access_card_id", "access_door_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_user_email_key" UNIQUE ("announcement_id", "user_email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "approved_external_emails" ADD CONSTRAINT "approved_external_emails_email_key" UNIQUE ("email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "bin_contents" ADD CONSTRAINT "bin_contents_bin_id_inventory_item_id_key" UNIQUE ("bin_id", "inventory_item_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "canonical_skills" ADD CONSTRAINT "canonical_skills_canonical_name_key" UNIQUE ("canonical_name"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_analytics" ADD CONSTRAINT "case_analytics_case_id_question_id_key" UNIQUE ("case_id", "question_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "case_sessions" ADD CONSTRAINT "case_sessions_session_code_key" UNIQUE ("session_code"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cert_notifications" ADD CONSTRAINT "cert_notifications_certification_id_notification_type_key" UNIQUE ("certification_id", "notification_type"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_rotations" ADD CONSTRAINT "clinical_rotations_student_id_rotation_date_key" UNIQUE ("student_id", "rotation_date"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_site_departments" ADD CONSTRAINT "clinical_site_departments_site_id_department_key" UNIQUE ("site_id", "department"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clinical_visit_students" ADD CONSTRAINT "clinical_visit_students_visit_id_student_id_key" UNIQUE ("visit_id", "student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohort_key_dates" ADD CONSTRAINT "cohort_key_dates_cohort_id_key" UNIQUE ("cohort_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_program_id_cohort_number_key" UNIQUE ("program_id", "cohort_number"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "compliance_audits" ADD CONSTRAINT "compliance_audits_audit_type_key" UNIQUE ("audit_type"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dashboard_layout_defaults" ADD CONSTRAINT "dashboard_layout_defaults_role_key" UNIQUE ("role"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_user_email_key" UNIQUE ("user_email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "data_consent_agreements" ADD CONSTRAINT "data_consent_agreements_user_email_agreement_type_agreement_key" UNIQUE ("user_email", "agreement_type", "agreement_version"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "departments" ADD CONSTRAINT "departments_abbreviation_key" UNIQUE ("abbreviation"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "departments" ADD CONSTRAINT "departments_name_key" UNIQUE ("name"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_template_customizations" ADD CONSTRAINT "email_template_customizations_template_key_key" UNIQUE ("template_key"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "equipment_categories" ADD CONSTRAINT "equipment_categories_name_key" UNIQUE ("name"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_asset_tag_key" UNIQUE ("asset_tag"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "field_trip_attendance" ADD CONSTRAINT "field_trip_attendance_field_trip_id_student_id_key" UNIQUE ("field_trip_id", "student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "google_calendar_events" ADD CONSTRAINT "google_calendar_events_user_email_source_type_source_id_key" UNIQUE ("user_email", "source_type", "source_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "guest_access" ADD CONSTRAINT "guest_access_access_code_key" UNIQUE ("access_code"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "instructor_availability" ADD CONSTRAINT "instructor_availability_instructor_id_date_start_time_key" UNIQUE ("instructor_id", "date", "start_time"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "instructor_daily_notes" ADD CONSTRAINT "instructor_daily_notes_instructor_id_note_date_key" UNIQUE ("instructor_id", "note_date"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "inventory_bin_contents" ADD CONSTRAINT "inventory_bin_contents_bin_id_item_id_expiration_date_key" UNIQUE ("bin_id", "item_id", "expiration_date"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "inventory_bins" ADD CONSTRAINT "inventory_bins_bin_code_key" UNIQUE ("bin_code"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_name_key" UNIQUE ("name"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_attendance" ADD CONSTRAINT "lab_day_attendance_lab_day_id_student_id_key" UNIQUE ("lab_day_id", "student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_roles" ADD CONSTRAINT "lab_day_roles_lab_day_id_instructor_id_role_key" UNIQUE ("lab_day_id", "instructor_id", "role"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_day_signups" ADD CONSTRAINT "lab_day_signups_lab_day_id_student_id_key" UNIQUE ("lab_day_id", "student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_days" ADD CONSTRAINT "lab_days_checkin_token_key" UNIQUE ("checkin_token"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_days" ADD CONSTRAINT "lab_days_date_cohort_id_key" UNIQUE ("date", "cohort_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_group_members" ADD CONSTRAINT "lab_group_members_student_id_key" UNIQUE ("student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_template_versions" ADD CONSTRAINT "lab_template_versions_template_id_version_number_key" UNIQUE ("template_id", "version_number"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_timer_ready_status" ADD CONSTRAINT "lab_timer_ready_status_lab_day_id_station_id_key" UNIQUE ("lab_day_id", "station_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_timer_state" ADD CONSTRAINT "lab_timer_state_lab_day_id_key" UNIQUE ("lab_day_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab_users" ADD CONSTRAINT "lab_users_email_key" UNIQUE ("email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_barcode_key" UNIQUE ("barcode"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_library_item_id_copy_number_key" UNIQUE ("library_item_id", "copy_number"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "library_items" ADD CONSTRAINT "library_items_isbn_key" UNIQUE ("isbn"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "locations" ADD CONSTRAINT "locations_qr_code_key" UNIQUE ("qr_code"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_course_days" ADD CONSTRAINT "lvfr_aemt_course_days_day_number_key" UNIQUE ("day_number"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_grades" ADD CONSTRAINT "lvfr_aemt_grades_student_id_assessment_id_key" UNIQUE ("student_id", "assessment_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_instructor_assignments" ADD CONSTRAINT "lvfr_aemt_instructor_assignments_day_number_key" UNIQUE ("day_number"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_instructor_availability" ADD CONSTRAINT "lvfr_aemt_instructor_availability_instructor_id_date_key" UNIQUE ("instructor_id", "date"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_plan_placements" ADD CONSTRAINT "lvfr_aemt_plan_placements_instance_id_content_block_id_day__key" UNIQUE ("instance_id", "content_block_id", "day_number", "start_time"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_plan_templates" ADD CONSTRAINT "lvfr_plan_templates_name_unique" UNIQUE ("name"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_prerequisites" ADD CONSTRAINT "lvfr_aemt_prerequisites_block_id_requires_block_id_rule_typ_key" UNIQUE ("block_id", "requires_block_id", "rule_type"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_skill_status" ADD CONSTRAINT "lvfr_aemt_skill_status_student_id_skill_id_key" UNIQUE ("student_id", "skill_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lvfr_aemt_supplementary_days" ADD CONSTRAINT "lvfr_aemt_supplementary_days_day_number_key" UNIQUE ("day_number"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_assignments" ADD CONSTRAINT "onboarding_assignments_template_id_instructor_email_key" UNIQUE ("template_id", "instructor_email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_phase_progress" ADD CONSTRAINT "onboarding_phase_progress_assignment_id_phase_id_key" UNIQUE ("assignment_id", "phase_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_task_dependencies" ADD CONSTRAINT "onboarding_task_dependencies_task_id_depends_on_task_id_key" UNIQUE ("task_id", "depends_on_task_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "onboarding_task_progress" ADD CONSTRAINT "onboarding_task_progress_assignment_id_task_id_key" UNIQUE ("assignment_id", "task_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "osce_events" ADD CONSTRAINT "osce_events_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "osce_observer_blocks" ADD CONSTRAINT "unique_observer_block" UNIQUE ("observer_id", "block_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "osce_observers" ADD CONSTRAINT "osce_observers_event_email_unique" UNIQUE ("event_id", "email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "osce_student_schedule" ADD CONSTRAINT "osce_student_schedule_time_block_id_slot_number_key" UNIQUE ("time_block_id", "slot_number"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "peer_evaluations" ADD CONSTRAINT "peer_evaluations_lab_day_id_evaluator_id_evaluated_id_key" UNIQUE ("lab_day_id", "evaluator_id", "evaluated_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_block_instructors" ADD CONSTRAINT "pmi_block_instructors_schedule_block_id_instructor_id_key" UNIQUE ("schedule_block_id", "instructor_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_instructor_workload" ADD CONSTRAINT "pmi_instructor_workload_semester_id_instructor_id_week_numb_key" UNIQUE ("semester_id", "instructor_id", "week_number"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_program_schedules" ADD CONSTRAINT "pmi_program_schedules_semester_id_cohort_id_key" UNIQUE ("semester_id", "cohort_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_rooms" ADD CONSTRAINT "pmi_rooms_name_key" UNIQUE ("name"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pmi_semesters" ADD CONSTRAINT "pmi_semesters_name_key" UNIQUE ("name"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "polls" ADD CONSTRAINT "polls_admin_link_key" UNIQUE ("admin_link"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "polls" ADD CONSTRAINT "polls_participant_link_key" UNIQUE ("participant_link"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "preceptor_eval_tokens" ADD CONSTRAINT "preceptor_eval_tokens_token_key" UNIQUE ("token"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "programs" ADD CONSTRAINT "programs_name_key" UNIQUE ("name"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "rubric_scenario_assignments" ADD CONSTRAINT "rubric_scenario_assignments_rubric_id_scenario_id_key" UNIQUE ("rubric_id", "scenario_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_favorites" ADD CONSTRAINT "scenario_favorites_user_email_scenario_id_key" UNIQUE ("user_email", "scenario_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scenario_ratings" ADD CONSTRAINT "scenario_ratings_scenario_id_user_email_key" UNIQUE ("scenario_id", "user_email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_seating_chart_id_student_id_key" UNIQUE ("seating_chart_id", "student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_seating_chart_id_table_number_seat_positio_key" UNIQUE ("seating_chart_id", "table_number", "seat_position"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "seating_preferences" ADD CONSTRAINT "seating_preferences_student_id_other_student_id_key" UNIQUE ("student_id", "other_student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shift_signups" ADD CONSTRAINT "shift_signups_shift_id_instructor_id_key" UNIQUE ("shift_id", "instructor_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_competencies" ADD CONSTRAINT "skill_competencies_student_id_skill_id_key" UNIQUE ("student_id", "skill_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_sheet_assignments" ADD CONSTRAINT "skill_sheet_assignments_skill_sheet_id_skill_name_program_key" UNIQUE ("skill_sheet_id", "skill_name", "program"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "skill_signoffs" ADD CONSTRAINT "skill_signoffs_student_id_skill_id_key" UNIQUE ("student_id", "skill_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_instructors" ADD CONSTRAINT "station_instructors_station_id_user_id_key" UNIQUE ("station_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_pool" ADD CONSTRAINT "station_pool_station_code_key" UNIQUE ("station_code"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "station_skills" ADD CONSTRAINT "station_skills_station_id_skill_id_key" UNIQUE ("station_id", "skill_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_compliance_docs" ADD CONSTRAINT "student_compliance_docs_student_id_key" UNIQUE ("student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_compliance_records" ADD CONSTRAINT "student_compliance_records_student_id_doc_type_id_key" UNIQUE ("student_id", "doc_type_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_group_assignments" ADD CONSTRAINT "student_group_assignments_group_id_student_id_key" UNIQUE ("group_id", "student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_lab_ratings" ADD CONSTRAINT "student_lab_ratings_student_id_lab_day_id_instructor_email_key" UNIQUE ("student_id", "lab_day_id", "instructor_email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_lab_signups" ADD CONSTRAINT "student_lab_signups_lab_day_id_student_id_key" UNIQUE ("lab_day_id", "student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_learning_styles" ADD CONSTRAINT "student_learning_styles_student_id_key" UNIQUE ("student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_mce_clearance" ADD CONSTRAINT "student_mce_clearance_student_id_key" UNIQUE ("student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_preceptor_assignments" ADD CONSTRAINT "student_preceptor_assignments_internship_id_preceptor_id_ro_key" UNIQUE ("internship_id", "preceptor_id", "role"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "student_task_status" ADD CONSTRAINT "student_task_status_student_id_cohort_task_id_key" UNIQUE ("student_id", "cohort_task_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "students" ADD CONSTRAINT "students_student_id_key" UNIQUE ("student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "submissions" ADD CONSTRAINT "submissions_poll_id_email_key" UNIQUE ("poll_id", "email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "summative_evaluation_scores" ADD CONSTRAINT "summative_evaluation_scores_evaluation_id_student_id_key" UNIQUE ("evaluation_id", "student_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "supply_barcodes" ADD CONSTRAINT "supply_barcodes_barcode_value_key" UNIQUE ("barcode_value"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "supply_categories" ADD CONSTRAINT "supply_categories_name_key" UNIQUE ("name"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "supply_items" ADD CONSTRAINT "supply_items_sku_key" UNIQUE ("sku"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "system_config" ADD CONSTRAINT "system_config_key_key" UNIQUE ("key"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_assignee_id_key" UNIQUE ("task_id", "assignee_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "timer_display_tokens" ADD CONSTRAINT "timer_display_tokens_token_key" UNIQUE ("token"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_user_id_department_id_key" UNIQUE ("user_id", "department_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_endorsements" ADD CONSTRAINT "user_endorsements_user_id_endorsement_type_department_id_key" UNIQUE ("user_id", "endorsement_type", "department_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_email_key" UNIQUE ("user_email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_session_token_key" UNIQUE ("session_token"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===================
-- Indexes
-- ===================
CREATE UNIQUE INDEX IF NOT EXISTS access_cards_card_uid_key ON public.access_cards USING btree (card_uid);
CREATE INDEX IF NOT EXISTS idx_access_cards_active ON public.access_cards USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_access_cards_lab_user ON public.access_cards USING btree (lab_user_id) WHERE (lab_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_access_cards_status ON public.access_cards USING btree (status);
CREATE INDEX IF NOT EXISTS idx_access_cards_student ON public.access_cards USING btree (student_id) WHERE (student_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_access_cards_uid ON public.access_cards USING btree (card_uid);
CREATE INDEX IF NOT EXISTS idx_heartbeats_device ON public.access_device_heartbeats USING btree (access_device_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_time ON public.access_device_heartbeats USING btree (reported_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS access_devices_hardware_id_key ON public.access_devices USING btree (hardware_id);
CREATE INDEX IF NOT EXISTS idx_access_devices_active ON public.access_devices USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_access_devices_door ON public.access_devices USING btree (door_id);
CREATE INDEX IF NOT EXISTS idx_access_devices_heartbeat ON public.access_devices USING btree (last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_access_devices_online ON public.access_devices USING btree (is_online);
CREATE INDEX IF NOT EXISTS idx_access_doors_active ON public.access_doors USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_access_doors_location ON public.access_doors USING btree (location_id) WHERE (location_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_access_doors_status ON public.access_doors USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS access_logs_pi_event_id_key ON public.access_logs USING btree (pi_event_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_card ON public.access_logs USING btree (access_card_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_card_uid ON public.access_logs USING btree (card_uid);
CREATE INDEX IF NOT EXISTS idx_access_logs_door ON public.access_logs USING btree (access_door_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_event_at ON public.access_logs USING btree (event_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_pi_event ON public.access_logs USING btree (pi_event_id) WHERE (pi_event_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_access_logs_result ON public.access_logs USING btree (result);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON public.access_requests USING btree (email);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.access_requests USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS access_rules_access_card_id_access_door_id_key ON public.access_rules USING btree (access_card_id, access_door_id);
CREATE INDEX IF NOT EXISTS idx_access_rules_active ON public.access_rules USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_access_rules_card ON public.access_rules USING btree (access_card_id);
CREATE INDEX IF NOT EXISTS idx_access_rules_door ON public.access_rules USING btree (access_door_id);
CREATE INDEX IF NOT EXISTS idx_aemt_tracking_cohort ON public.aemt_student_tracking USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_aemt_tracking_student ON public.aemt_student_tracking USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliation_notif_dedup ON public.affiliation_notifications_log USING btree (affiliation_id, notification_type, sent_date);
CREATE INDEX IF NOT EXISTS idx_agencies_capacity ON public.agencies USING btree (max_students_per_day) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_active ON public.ai_prompt_templates USING btree (is_active) WHERE (is_active = true);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_prompt_templates_name_version ON public.ai_prompt_templates USING btree (name, version);
CREATE INDEX IF NOT EXISTS idx_alumni_cohort ON public.alumni USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_alumni_program ON public.alumni USING btree (program);
CREATE INDEX IF NOT EXISTS idx_alumni_status ON public.alumni USING btree (employment_status);
CREATE INDEX IF NOT EXISTS idx_alumni_student ON public.alumni USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS announcement_reads_announcement_id_user_email_key ON public.announcement_reads USING btree (announcement_id, user_email);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON public.announcement_reads USING btree (announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON public.announcement_reads USING btree (user_email);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements USING btree (is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements USING btree (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS approved_external_emails_email_key ON public.approved_external_emails USING btree (email);
CREATE INDEX IF NOT EXISTS idx_approved_external_domain ON public.approved_external_emails USING btree (domain);
CREATE INDEX IF NOT EXISTS idx_approved_external_email ON public.approved_external_emails USING btree (email) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_assigned_tasks_by ON public.assigned_tasks USING btree (assigned_by_email);
CREATE INDEX IF NOT EXISTS idx_assigned_tasks_status ON public.assigned_tasks USING btree (status) WHERE (status <> 'completed'::text);
CREATE INDEX IF NOT EXISTS idx_assigned_tasks_to ON public.assigned_tasks USING btree (assigned_to_email);
CREATE INDEX IF NOT EXISTS idx_attendance_appeals_status ON public.attendance_appeals USING btree (status);
CREATE INDEX IF NOT EXISTS idx_attendance_appeals_student ON public.attendance_appeals USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log USING btree (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_user ON public.audit_log USING btree (created_at DESC, user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON public.audit_log USING btree (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log USING btree (user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_email ON public.audit_log USING btree (user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS bin_contents_bin_id_inventory_item_id_key ON public.bin_contents USING btree (bin_id, inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_history_sent ON public.broadcast_history USING btree (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_date ON public.bulk_operations_history USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_run_at ON public.calendar_sync_log USING btree (run_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS canonical_skills_canonical_name_key ON public.canonical_skills USING btree (canonical_name);
CREATE UNIQUE INDEX IF NOT EXISTS case_analytics_case_id_question_id_key ON public.case_analytics USING btree (case_id, question_id);
CREATE INDEX IF NOT EXISTS idx_case_analytics_case ON public.case_analytics USING btree (case_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_case ON public.case_assignments USING btree (case_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_cohort ON public.case_assignments USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_case_briefs_batch ON public.case_briefs USING btree (batch_name);
CREATE INDEX IF NOT EXISTS idx_case_briefs_category ON public.case_briefs USING btree (category);
CREATE INDEX IF NOT EXISTS idx_case_briefs_status ON public.case_briefs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_case_practice_case ON public.case_practice_progress USING btree (case_id);
CREATE INDEX IF NOT EXISTS idx_case_practice_email ON public.case_practice_progress USING btree (practitioner_email) WHERE (practitioner_email IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_case_practice_status ON public.case_practice_progress USING btree (status);
CREATE INDEX IF NOT EXISTS idx_case_practice_student ON public.case_practice_progress USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_practice_unique_practitioner ON public.case_practice_progress USING btree (practitioner_email, case_id, attempt_number) WHERE ((student_id IS NULL) AND (practitioner_email IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_practice_unique_student ON public.case_practice_progress USING btree (student_id, case_id, attempt_number) WHERE (student_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_case_responses_case_id ON public.case_responses USING btree (case_id);
CREATE INDEX IF NOT EXISTS idx_case_responses_case_student ON public.case_responses USING btree (case_id, student_id);
CREATE INDEX IF NOT EXISTS idx_case_responses_practitioner_email ON public.case_responses USING btree (practitioner_email) WHERE (practitioner_email IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_case_responses_session_id ON public.case_responses USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_case_responses_student_id ON public.case_responses USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS case_sessions_session_code_key ON public.case_sessions USING btree (session_code);
CREATE INDEX IF NOT EXISTS idx_case_sessions_case_id ON public.case_sessions USING btree (case_id);
CREATE INDEX IF NOT EXISTS idx_case_sessions_status ON public.case_sessions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_case_studies_category ON public.case_studies USING btree (category);
CREATE INDEX IF NOT EXISTS idx_case_studies_created_by ON public.case_studies USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_case_studies_difficulty ON public.case_studies USING btree (difficulty);
CREATE INDEX IF NOT EXISTS idx_case_studies_generated ON public.case_studies USING btree (generated_by_ai) WHERE (generated_by_ai = true);
CREATE INDEX IF NOT EXISTS idx_case_studies_is_active ON public.case_studies USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_case_studies_published ON public.case_studies USING btree (is_published, is_active);
CREATE INDEX IF NOT EXISTS idx_case_studies_review_status ON public.case_studies USING btree (content_review_status) WHERE (content_review_status <> 'not_applicable'::text);
CREATE INDEX IF NOT EXISTS idx_case_studies_visibility ON public.case_studies USING btree (visibility);
CREATE INDEX IF NOT EXISTS idx_ce_records_certification ON public.ce_records USING btree (certification_id);
CREATE INDEX IF NOT EXISTS idx_ce_records_instructor ON public.ce_records USING btree (instructor_id);
CREATE UNIQUE INDEX IF NOT EXISTS cert_notifications_certification_id_notification_type_key ON public.cert_notifications USING btree (certification_id, notification_type);
CREATE INDEX IF NOT EXISTS idx_cert_notifications_cert ON public.cert_notifications USING btree (certification_id);
CREATE INDEX IF NOT EXISTS idx_clinical_affiliations_expiration ON public.clinical_affiliations USING btree (expiration_date);
CREATE INDEX IF NOT EXISTS idx_clinical_affiliations_status ON public.clinical_affiliations USING btree (agreement_status);
CREATE UNIQUE INDEX IF NOT EXISTS clinical_rotations_student_id_rotation_date_key ON public.clinical_rotations USING btree (student_id, rotation_date);
CREATE INDEX IF NOT EXISTS idx_clinical_rotations_date ON public.clinical_rotations USING btree (rotation_date);
CREATE INDEX IF NOT EXISTS idx_clinical_rotations_site ON public.clinical_rotations USING btree (site_id);
CREATE INDEX IF NOT EXISTS idx_clinical_rotations_site_date ON public.clinical_rotations USING btree (site_id, rotation_date);
CREATE INDEX IF NOT EXISTS idx_clinical_rotations_student ON public.clinical_rotations USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS clinical_site_departments_site_id_department_key ON public.clinical_site_departments USING btree (site_id, department);
CREATE INDEX IF NOT EXISTS idx_clinical_site_departments_site ON public.clinical_site_departments USING btree (site_id);
CREATE INDEX IF NOT EXISTS idx_clinical_site_schedules_dates ON public.clinical_site_schedules USING btree (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_clinical_site_schedules_institution ON public.clinical_site_schedules USING btree (institution);
CREATE INDEX IF NOT EXISTS idx_clinical_site_schedules_site ON public.clinical_site_schedules USING btree (clinical_site_id);
CREATE INDEX IF NOT EXISTS idx_clinical_site_visits_agency ON public.clinical_site_visits USING btree (agency_id);
CREATE INDEX IF NOT EXISTS idx_clinical_site_visits_cohort ON public.clinical_site_visits USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_clinical_site_visits_date ON public.clinical_site_visits USING btree (visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_site_visits_site ON public.clinical_site_visits USING btree (site_id);
CREATE INDEX IF NOT EXISTS idx_clinical_site_visits_visitor ON public.clinical_site_visits USING btree (visitor_id);
CREATE INDEX IF NOT EXISTS idx_clinical_sites_active ON public.clinical_sites USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_clinical_sites_capacity ON public.clinical_sites USING btree (max_students_per_day) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_clinical_sites_monitoring ON public.clinical_sites USING btree (visit_monitoring_enabled) WHERE (visit_monitoring_enabled = true);
CREATE INDEX IF NOT EXISTS idx_clinical_sites_system ON public.clinical_sites USING btree (system);
CREATE INDEX IF NOT EXISTS idx_task_definitions_phase ON public.clinical_task_definitions USING btree (phase);
CREATE INDEX IF NOT EXISTS idx_task_definitions_template ON public.clinical_task_definitions USING btree (template_id);
CREATE UNIQUE INDEX IF NOT EXISTS clinical_visit_students_visit_id_student_id_key ON public.clinical_visit_students USING btree (visit_id, student_id);
CREATE INDEX IF NOT EXISTS idx_clinical_visit_students_student ON public.clinical_visit_students USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_clinical_visit_students_visit ON public.clinical_visit_students USING btree (visit_id);
CREATE INDEX IF NOT EXISTS idx_closeout_documents_internship ON public.closeout_documents USING btree (internship_id);
CREATE INDEX IF NOT EXISTS idx_closeout_surveys_internship ON public.closeout_surveys USING btree (internship_id);
CREATE INDEX IF NOT EXISTS idx_closeout_surveys_submitted_at ON public.closeout_surveys USING btree (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_closeout_surveys_type ON public.closeout_surveys USING btree (survey_type);
CREATE UNIQUE INDEX IF NOT EXISTS cohort_key_dates_cohort_id_key ON public.cohort_key_dates USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_milestones_cohort ON public.cohort_milestones USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_milestones_due_date ON public.cohort_milestones USING btree (due_date);
CREATE INDEX IF NOT EXISTS idx_cohort_scenario_completions_cohort ON public.cohort_scenario_completions USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_scenario_completions_scenario ON public.cohort_scenario_completions USING btree (scenario_id);
CREATE INDEX IF NOT EXISTS idx_cohort_skill_completions_cohort ON public.cohort_skill_completions USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_skill_completions_skill ON public.cohort_skill_completions USING btree (skill_id);
CREATE INDEX IF NOT EXISTS idx_cohort_tasks_cohort ON public.cohort_tasks USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_tasks_phase ON public.cohort_tasks USING btree (phase);
CREATE UNIQUE INDEX IF NOT EXISTS cohorts_program_id_cohort_number_key ON public.cohorts USING btree (program_id, cohort_number);
CREATE INDEX IF NOT EXISTS idx_cohorts_archived ON public.cohorts USING btree (is_archived);
CREATE INDEX IF NOT EXISTS idx_cohorts_semester ON public.cohorts USING btree (semester);
CREATE INDEX IF NOT EXISTS idx_cohorts_track_clinical_hours ON public.cohorts USING btree (track_clinical_hours) WHERE (track_clinical_hours = true);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_audit ON public.compliance_audit_log USING btree (audit_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_date ON public.compliance_audit_log USING btree (completed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS compliance_audits_audit_type_key ON public.compliance_audits USING btree (audit_type);
CREATE INDEX IF NOT EXISTS idx_custody_checkouts_status ON public.custody_checkouts USING btree (status);
CREATE INDEX IF NOT EXISTS idx_custody_checkouts_student_id ON public.custody_checkouts USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_custom_skills_station ON public.custom_skills USING btree (station_id);
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_layout_defaults_role_key ON public.dashboard_layout_defaults USING btree (role);
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_layouts_user_email_key ON public.dashboard_layouts USING btree (user_email);
CREATE UNIQUE INDEX IF NOT EXISTS data_consent_agreements_user_email_agreement_type_agreement_key ON public.data_consent_agreements USING btree (user_email, agreement_type, agreement_version);
CREATE INDEX IF NOT EXISTS idx_consent_type ON public.data_consent_agreements USING btree (agreement_type);
CREATE INDEX IF NOT EXISTS idx_consent_user_email ON public.data_consent_agreements USING btree (user_email);
CREATE INDEX IF NOT EXISTS idx_data_export_archives_created ON public.data_export_archives USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_export_archives_expires ON public.data_export_archives USING btree (expires_at) WHERE (expires_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_data_export_archives_type ON public.data_export_archives USING btree (export_type);
CREATE INDEX IF NOT EXISTS idx_export_history_date ON public.data_export_history USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_history_user ON public.data_export_history USING btree (exported_by);
CREATE UNIQUE INDEX IF NOT EXISTS departments_abbreviation_key ON public.departments USING btree (abbreviation);
CREATE UNIQUE INDEX IF NOT EXISTS departments_name_key ON public.departments USING btree (name);
CREATE INDEX IF NOT EXISTS idx_document_requests_student ON public.document_requests USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_ekg_scores_baseline ON public.ekg_warmup_scores USING btree (is_baseline) WHERE (is_baseline = true);
CREATE INDEX IF NOT EXISTS idx_ekg_scores_student ON public.ekg_warmup_scores USING btree (student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON public.email_log USING btree (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_user ON public.email_log USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_user_id ON public.email_log USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON public.email_queue USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue USING btree (status);
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON public.email_queue USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS email_template_customizations_template_key_key ON public.email_template_customizations USING btree (template_key);
CREATE INDEX IF NOT EXISTS idx_email_template_key ON public.email_template_customizations USING btree (template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON public.email_templates USING btree (category);
CREATE INDEX IF NOT EXISTS idx_employment_verifications_internship ON public.employment_verifications USING btree (internship_id);
CREATE INDEX IF NOT EXISTS idx_emt_tracking_cohort ON public.emt_student_tracking USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_emt_tracking_student ON public.emt_student_tracking USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assignments_item ON public.equipment_assignments USING btree (equipment_item_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assignments_status ON public.equipment_assignments USING btree (status) WHERE (status = 'active'::text);
CREATE UNIQUE INDEX IF NOT EXISTS equipment_categories_name_key ON public.equipment_categories USING btree (name);
CREATE INDEX IF NOT EXISTS idx_equipment_checkouts_equipment ON public.equipment_checkouts USING btree (equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_checkouts_lab_day ON public.equipment_checkouts USING btree (lab_day_id);
CREATE UNIQUE INDEX IF NOT EXISTS equipment_items_asset_tag_key ON public.equipment_items USING btree (asset_tag);
CREATE INDEX IF NOT EXISTS idx_equipment_items_asset_tag ON public.equipment_items USING btree (asset_tag);
CREATE INDEX IF NOT EXISTS idx_equipment_items_assigned ON public.equipment_items USING btree (assigned_to) WHERE (assigned_to IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_equipment_items_category ON public.equipment_items USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_equipment_items_location ON public.equipment_items USING btree (location_id);
CREATE INDEX IF NOT EXISTS idx_equipment_items_status ON public.equipment_items USING btree (status);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_due ON public.equipment_maintenance USING btree (next_due_date) WHERE (next_due_date IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment ON public.equipment_maintenance USING btree (equipment_item_id);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_item ON public.equipment_maintenance USING btree (equipment_item_id);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_next_due ON public.equipment_maintenance USING btree (next_due_date);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_scheduled ON public.equipment_maintenance USING btree (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_status ON public.equipment_maintenance USING btree (status);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.error_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON public.error_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_created ON public.feedback_reports USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_status ON public.feedback_reports USING btree (status);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_type ON public.feedback_reports USING btree (report_type);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_updated_at ON public.feedback_reports USING btree (updated_at);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_user ON public.feedback_reports USING btree (user_email);
CREATE INDEX IF NOT EXISTS idx_preceptors_active ON public.field_preceptors USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_preceptors_agency ON public.field_preceptors USING btree (agency_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_date ON public.field_ride_requests USING btree (date_requested);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON public.field_ride_requests USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS field_trip_attendance_field_trip_id_student_id_key ON public.field_trip_attendance USING btree (field_trip_id, student_id);
CREATE INDEX IF NOT EXISTS idx_field_trip_attendance_student ON public.field_trip_attendance USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_field_trip_attendance_trip ON public.field_trip_attendance USING btree (field_trip_id);
CREATE INDEX IF NOT EXISTS idx_field_trips_active ON public.field_trips USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_field_trips_cohort ON public.field_trips USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_field_trips_date ON public.field_trips USING btree (trip_date DESC);
CREATE INDEX IF NOT EXISTS idx_filament_adjustments_created_at ON public.filament_adjustments USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_filament_adjustments_filament ON public.filament_adjustments USING btree (filament_type_id);
CREATE INDEX IF NOT EXISTS idx_filament_purchases_filament ON public.filament_purchases USING btree (filament_type_id);
CREATE INDEX IF NOT EXISTS idx_filament_types_active ON public.filament_types USING btree (is_active) WHERE (is_active = true);
CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_events_user_email_source_type_source_id_key ON public.google_calendar_events USING btree (user_email, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_gcal_events_lab_day_id ON public.google_calendar_events USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_gcal_events_shift_id ON public.google_calendar_events USING btree (shift_id);
CREATE INDEX IF NOT EXISTS idx_gcal_events_source ON public.google_calendar_events USING btree (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_gcal_events_user_email ON public.google_calendar_events USING btree (user_email);
CREATE UNIQUE INDEX IF NOT EXISTS guest_access_access_code_key ON public.guest_access USING btree (access_code);
CREATE INDEX IF NOT EXISTS idx_guest_access_code ON public.guest_access USING btree (access_code);
CREATE INDEX IF NOT EXISTS idx_guest_access_lab_day ON public.guest_access USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_guest_access_name ON public.guest_access USING btree (name);
CREATE INDEX IF NOT EXISTS idx_import_history_created ON public.import_history USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_history_type ON public.import_history USING btree (import_type);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON public.incidents USING btree (incident_date DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON public.incidents USING btree (severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents USING btree (status);
CREATE INDEX IF NOT EXISTS idx_availability_date ON public.instructor_availability USING btree (date);
CREATE INDEX IF NOT EXISTS idx_availability_instructor ON public.instructor_availability USING btree (instructor_id);
CREATE UNIQUE INDEX IF NOT EXISTS instructor_availability_instructor_id_date_start_time_key ON public.instructor_availability USING btree (instructor_id, date, start_time);
CREATE INDEX IF NOT EXISTS idx_instructor_certs_expiration ON public.instructor_certifications USING btree (expiration_date);
CREATE INDEX IF NOT EXISTS idx_instructor_certs_instructor ON public.instructor_certifications USING btree (instructor_id);
CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON public.instructor_daily_notes USING btree (note_date);
CREATE INDEX IF NOT EXISTS idx_daily_notes_instructor ON public.instructor_daily_notes USING btree (instructor_email);
CREATE INDEX IF NOT EXISTS idx_daily_notes_instructor_date ON public.instructor_daily_notes USING btree (instructor_id, note_date);
CREATE INDEX IF NOT EXISTS idx_daily_notes_instructor_email ON public.instructor_daily_notes USING btree (instructor_email);
CREATE UNIQUE INDEX IF NOT EXISTS instructor_daily_notes_instructor_id_note_date_key ON public.instructor_daily_notes USING btree (instructor_id, note_date);
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_assigned ON public.instructor_tasks USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_assigned_by ON public.instructor_tasks USING btree (assigned_by);
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_assigned_status_due ON public.instructor_tasks USING btree (assigned_to, status, due_date);
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_assigned_to ON public.instructor_tasks USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_assignee_status_due ON public.instructor_tasks USING btree (assigned_to, status, due_date);
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_due ON public.instructor_tasks USING btree (due_date);
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_due_date ON public.instructor_tasks USING btree (due_date);
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_status ON public.instructor_tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.instructor_tasks USING btree (assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.instructor_tasks USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.instructor_tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.instructor_time_entries USING btree (clock_in);
CREATE INDEX IF NOT EXISTS idx_time_entries_instructor ON public.instructor_time_entries USING btree (instructor_email);
CREATE INDEX IF NOT EXISTS idx_time_entries_lab_day ON public.instructor_time_entries USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON public.instructor_time_entries USING btree (status);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON public.internship_meetings USING btree (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_meetings_student ON public.internship_meetings USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_bin_contents_bin_id ON public.inventory_bin_contents USING btree (bin_id);
CREATE INDEX IF NOT EXISTS idx_bin_contents_item_id ON public.inventory_bin_contents USING btree (item_id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_bin_contents_bin_id_item_id_expiration_date_key ON public.inventory_bin_contents USING btree (bin_id, item_id, expiration_date);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_bins_bin_code_key ON public.inventory_bins USING btree (bin_code);
CREATE INDEX IF NOT EXISTS idx_inventory_containers_room ON public.inventory_containers USING btree (room_id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_name_key ON public.inventory_locations USING btree (name);
CREATE INDEX IF NOT EXISTS idx_inventory_positions_container ON public.inventory_positions USING btree (container_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_default ON public.lab_checklist_templates USING btree (station_type, is_default) WHERE (is_default = true);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_station_type ON public.lab_checklist_templates USING btree (station_type);
CREATE INDEX IF NOT EXISTS idx_attendance_lab_day ON public.lab_day_attendance USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.lab_day_attendance USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_attendance_lab_day ON public.lab_day_attendance USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_attendance_status ON public.lab_day_attendance USING btree (status);
CREATE INDEX IF NOT EXISTS idx_lab_day_attendance_student ON public.lab_day_attendance USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS lab_day_attendance_lab_day_id_student_id_key ON public.lab_day_attendance USING btree (lab_day_id, student_id);
CREATE INDEX IF NOT EXISTS idx_checklist_lab_day ON public.lab_day_checklist_items USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_checklists_lab_day ON public.lab_day_checklists USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_costs_lab_day ON public.lab_day_costs USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_debrief_notes_lab_day ON public.lab_day_debrief_notes USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_debriefs_lab_day ON public.lab_day_debriefs USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_equipment_lab_day ON public.lab_day_equipment USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_equipment_status ON public.lab_day_equipment USING btree (status);
CREATE INDEX IF NOT EXISTS idx_lab_day_roles_instructor ON public.lab_day_roles USING btree (instructor_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_roles_lab ON public.lab_day_roles USING btree (lab_day_id);
CREATE UNIQUE INDEX IF NOT EXISTS lab_day_roles_lab_day_id_instructor_id_role_key ON public.lab_day_roles USING btree (lab_day_id, instructor_id, role);
CREATE INDEX IF NOT EXISTS idx_lab_day_signups_lab ON public.lab_day_signups USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_signups_student ON public.lab_day_signups USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS lab_day_signups_lab_day_id_student_id_key ON public.lab_day_signups USING btree (lab_day_id, student_id);
CREATE INDEX IF NOT EXISTS idx_student_queue_lab_day ON public.lab_day_student_queue USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_student_queue_station ON public.lab_day_student_queue USING btree (station_id);
CREATE INDEX IF NOT EXISTS idx_student_queue_student ON public.lab_day_student_queue USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_templates_anchor ON public.lab_day_templates USING btree (is_anchor) WHERE (is_anchor = true);
CREATE INDEX IF NOT EXISTS idx_lab_day_templates_category ON public.lab_day_templates USING btree (category);
CREATE INDEX IF NOT EXISTS idx_lab_day_templates_created_by ON public.lab_day_templates USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_lab_day_templates_day ON public.lab_day_templates USING btree (day_number);
CREATE INDEX IF NOT EXISTS idx_lab_day_templates_review ON public.lab_day_templates USING btree (requires_review) WHERE (requires_review = true);
CREATE INDEX IF NOT EXISTS idx_lab_day_templates_shared ON public.lab_day_templates USING btree (is_shared) WHERE (is_shared = true);
CREATE INDEX IF NOT EXISTS idx_lab_day_templates_updated_at ON public.lab_day_templates USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_days_assigned_timer ON public.lab_days USING btree (assigned_timer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_days_checkin_token ON public.lab_days USING btree (checkin_token) WHERE (checkin_token IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_lab_days_cohort ON public.lab_days USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_lab_days_cohort_date ON public.lab_days USING btree (cohort_id, date);
CREATE INDEX IF NOT EXISTS idx_lab_days_cohort_id ON public.lab_days USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_lab_days_date ON public.lab_days USING btree (date);
CREATE INDEX IF NOT EXISTS idx_lab_days_date_cohort ON public.lab_days USING btree (date, cohort_id);
CREATE INDEX IF NOT EXISTS idx_lab_days_needs_coverage ON public.lab_days USING btree (needs_coverage) WHERE (needs_coverage = true);
CREATE INDEX IF NOT EXISTS idx_lab_days_semester ON public.lab_days USING btree (semester);
CREATE INDEX IF NOT EXISTS idx_lab_days_source_template ON public.lab_days USING btree (source_template_id) WHERE (source_template_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS lab_days_checkin_token_key ON public.lab_days USING btree (checkin_token);
CREATE UNIQUE INDEX IF NOT EXISTS lab_days_date_cohort_id_key ON public.lab_days USING btree (date, cohort_id);
CREATE INDEX IF NOT EXISTS idx_equipment_lab_day ON public.lab_equipment_items USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON public.lab_equipment_items USING btree (status);
CREATE INDEX IF NOT EXISTS idx_lab_equipment_tracking_lab_day ON public.lab_equipment_tracking USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_group_history_group ON public.lab_group_assignment_history USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_group_history_student ON public.lab_group_assignment_history USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_lab_group_history_date ON public.lab_group_history USING btree (changed_at);
CREATE INDEX IF NOT EXISTS idx_lab_group_history_student ON public.lab_group_history USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_lab_group_members_group ON public.lab_group_members USING btree (lab_group_id);
CREATE INDEX IF NOT EXISTS idx_lab_group_members_student ON public.lab_group_members USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS lab_group_members_student_id_key ON public.lab_group_members USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_lab_groups_cohort ON public.lab_groups USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_lab_stations_instructor ON public.lab_stations USING btree (instructor_email);
CREATE INDEX IF NOT EXISTS idx_lab_stations_lab_day ON public.lab_stations USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_stations_lab_day_id ON public.lab_stations USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_stations_metadata ON public.lab_stations USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_lab_template_stations_template ON public.lab_template_stations USING btree (template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_template ON public.lab_template_versions USING btree (template_id);
CREATE UNIQUE INDEX IF NOT EXISTS lab_template_versions_template_id_version_number_key ON public.lab_template_versions USING btree (template_id, version_number);
CREATE INDEX IF NOT EXISTS idx_lab_timer_ready_status_lab_day_id ON public.lab_timer_ready_status USING btree (lab_day_id);
CREATE UNIQUE INDEX IF NOT EXISTS lab_timer_ready_status_lab_day_id_station_id_key ON public.lab_timer_ready_status USING btree (lab_day_id, station_id);
CREATE INDEX IF NOT EXISTS idx_lab_timer_state_lab_day_id ON public.lab_timer_state USING btree (lab_day_id);
CREATE UNIQUE INDEX IF NOT EXISTS lab_timer_state_lab_day_id_key ON public.lab_timer_state USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_users_agency ON public.lab_users USING btree (agency_affiliation) WHERE (agency_affiliation IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_lab_users_email ON public.lab_users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_lab_users_email_lower ON public.lab_users USING btree (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS lab_users_email_key ON public.lab_users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_lab_week_templates_program ON public.lab_week_templates USING btree (program_id);
CREATE INDEX IF NOT EXISTS idx_lab_week_templates_week ON public.lab_week_templates USING btree (semester, week_number);
CREATE INDEX IF NOT EXISTS idx_learning_plan_notes_plan ON public.learning_plan_notes USING btree (plan_id);
CREATE INDEX IF NOT EXISTS idx_learning_plans_student ON public.learning_plans USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_library_checkouts_copy ON public.library_checkouts USING btree (library_copy_id);
CREATE INDEX IF NOT EXISTS idx_library_checkouts_due ON public.library_checkouts USING btree (due_date) WHERE (status = 'active'::text);
CREATE INDEX IF NOT EXISTS idx_library_checkouts_status ON public.library_checkouts USING btree (status);
CREATE INDEX IF NOT EXISTS idx_library_checkouts_student ON public.library_checkouts USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_library_copies_barcode ON public.library_copies USING btree (barcode);
CREATE INDEX IF NOT EXISTS idx_library_copies_item ON public.library_copies USING btree (library_item_id);
CREATE INDEX IF NOT EXISTS idx_library_copies_status ON public.library_copies USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS library_copies_barcode_key ON public.library_copies USING btree (barcode);
CREATE UNIQUE INDEX IF NOT EXISTS library_copies_library_item_id_copy_number_key ON public.library_copies USING btree (library_item_id, copy_number);
CREATE INDEX IF NOT EXISTS idx_library_items_isbn ON public.library_items USING btree (isbn);
CREATE INDEX IF NOT EXISTS idx_library_items_title ON public.library_items USING btree (title);
CREATE UNIQUE INDEX IF NOT EXISTS library_items_isbn_key ON public.library_items USING btree (isbn);
CREATE UNIQUE INDEX IF NOT EXISTS locations_qr_code_key ON public.locations USING btree (qr_code);
CREATE INDEX IF NOT EXISTS idx_lvfr_chapters_module ON public.lvfr_aemt_chapters USING btree (module_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_course_days_date ON public.lvfr_aemt_course_days USING btree (date);
CREATE INDEX IF NOT EXISTS idx_lvfr_course_days_module ON public.lvfr_aemt_course_days USING btree (module_id);
CREATE UNIQUE INDEX IF NOT EXISTS lvfr_aemt_course_days_day_number_key ON public.lvfr_aemt_course_days USING btree (day_number);
CREATE INDEX IF NOT EXISTS idx_lvfr_files_module ON public.lvfr_aemt_files USING btree (module_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_grades_assessment ON public.lvfr_aemt_grades USING btree (assessment_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_grades_student ON public.lvfr_aemt_grades USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS lvfr_aemt_grades_student_id_assessment_id_key ON public.lvfr_aemt_grades USING btree (student_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_assignments_date ON public.lvfr_aemt_instructor_assignments USING btree (date);
CREATE UNIQUE INDEX IF NOT EXISTS lvfr_aemt_instructor_assignments_day_number_key ON public.lvfr_aemt_instructor_assignments USING btree (day_number);
CREATE INDEX IF NOT EXISTS idx_lvfr_avail_date ON public.lvfr_aemt_instructor_availability USING btree (date);
CREATE INDEX IF NOT EXISTS idx_lvfr_avail_instructor ON public.lvfr_aemt_instructor_availability USING btree (instructor_id);
CREATE UNIQUE INDEX IF NOT EXISTS lvfr_aemt_instructor_availability_instructor_id_date_key ON public.lvfr_aemt_instructor_availability USING btree (instructor_id, date);
CREATE INDEX IF NOT EXISTS idx_lvfr_pharm_ck_student ON public.lvfr_aemt_pharm_checkpoints USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_plan_instances_created ON public.lvfr_aemt_plan_instances USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_instances_template ON public.lvfr_aemt_plan_instances USING btree (template_id);
CREATE INDEX IF NOT EXISTS idx_placements_day ON public.lvfr_aemt_plan_placements USING btree (instance_id, day_number);
CREATE INDEX IF NOT EXISTS idx_placements_instance ON public.lvfr_aemt_plan_placements USING btree (instance_id);
CREATE UNIQUE INDEX IF NOT EXISTS lvfr_aemt_plan_placements_instance_id_content_block_id_day__key ON public.lvfr_aemt_plan_placements USING btree (instance_id, content_block_id, day_number, start_time);
CREATE UNIQUE INDEX IF NOT EXISTS lvfr_plan_templates_name_unique ON public.lvfr_aemt_plan_templates USING btree (name);
CREATE INDEX IF NOT EXISTS idx_prerequisites_block ON public.lvfr_aemt_prerequisites USING btree (block_id);
CREATE INDEX IF NOT EXISTS idx_prerequisites_requires ON public.lvfr_aemt_prerequisites USING btree (requires_block_id);
CREATE UNIQUE INDEX IF NOT EXISTS lvfr_aemt_prerequisites_block_id_requires_block_id_rule_typ_key ON public.lvfr_aemt_prerequisites USING btree (block_id, requires_block_id, rule_type);
CREATE INDEX IF NOT EXISTS idx_lvfr_skill_att_skill ON public.lvfr_aemt_skill_attempts USING btree (skill_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_skill_att_student ON public.lvfr_aemt_skill_attempts USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_skill_status_skill ON public.lvfr_aemt_skill_status USING btree (skill_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_skill_status_student ON public.lvfr_aemt_skill_status USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS lvfr_aemt_skill_status_student_id_skill_id_key ON public.lvfr_aemt_skill_status USING btree (student_id, skill_id);
CREATE UNIQUE INDEX IF NOT EXISTS lvfr_aemt_supplementary_days_day_number_key ON public.lvfr_aemt_supplementary_days USING btree (day_number);
CREATE INDEX IF NOT EXISTS idx_medications_class ON public.medications USING btree (drug_class);
CREATE INDEX IF NOT EXISTS idx_medications_name ON public.medications USING btree (name);
CREATE INDEX IF NOT EXISTS idx_mentorship_logs_pair ON public.mentorship_logs USING btree (pair_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_pairs_mentee ON public.mentorship_pairs USING btree (mentee_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_pairs_mentor ON public.mentorship_pairs USING btree (mentor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_created ON public.notifications_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_log_poll ON public.notifications_log USING btree (poll_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_recipient ON public.notifications_log USING btree (recipient_email);
CREATE INDEX IF NOT EXISTS idx_notifications_log_sent_by ON public.notifications_log USING btree (sent_by_email);
CREATE INDEX IF NOT EXISTS idx_notifications_log_type ON public.notifications_log USING btree (type);
CREATE INDEX IF NOT EXISTS idx_onboarding_assignments_instructor ON public.onboarding_assignments USING btree (instructor_email);
CREATE INDEX IF NOT EXISTS idx_onboarding_assignments_status ON public.onboarding_assignments USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_assignments_template_id_instructor_email_key ON public.onboarding_assignments USING btree (template_id, instructor_email);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_actor ON public.onboarding_events USING btree (actor_email);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_assignment ON public.onboarding_events USING btree (assignment_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_created ON public.onboarding_events USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_metadata ON public.onboarding_events USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_type ON public.onboarding_events USING btree (event_type);
CREATE INDEX IF NOT EXISTS idx_evidence_progress ON public.onboarding_evidence USING btree (task_progress_id);
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_phase_progress_assignment_id_phase_id_key ON public.onboarding_phase_progress USING btree (assignment_id, phase_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_phases_template ON public.onboarding_phases USING btree (template_id);
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_task_dependencies_task_id_depends_on_task_id_key ON public.onboarding_task_dependencies USING btree (task_id, depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_task_progress_assignment ON public.onboarding_task_progress USING btree (assignment_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_task_progress_status ON public.onboarding_task_progress USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_task_progress_assignment_id_task_id_key ON public.onboarding_task_progress USING btree (assignment_id, task_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_phase ON public.onboarding_tasks USING btree (phase_id);
CREATE INDEX IF NOT EXISTS idx_open_shifts_lab_day ON public.open_shifts USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_shifts_created_by ON public.open_shifts USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON public.open_shifts USING btree (date);
CREATE INDEX IF NOT EXISTS idx_osce_events_slug ON public.osce_events USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_osce_events_status ON public.osce_events USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS osce_events_slug_key ON public.osce_events USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_osce_observer_blocks_block ON public.osce_observer_blocks USING btree (block_id);
CREATE INDEX IF NOT EXISTS idx_osce_observer_blocks_observer ON public.osce_observer_blocks USING btree (observer_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_observer_block ON public.osce_observer_blocks USING btree (observer_id, block_id);
CREATE INDEX IF NOT EXISTS idx_osce_observers_email ON public.osce_observers USING btree (email);
CREATE INDEX IF NOT EXISTS idx_osce_observers_event ON public.osce_observers USING btree (event_id);
CREATE UNIQUE INDEX IF NOT EXISTS osce_observers_event_email_unique ON public.osce_observers USING btree (event_id, email);
CREATE INDEX IF NOT EXISTS idx_osce_student_agencies_event ON public.osce_student_agencies USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_osce_student_schedule_block ON public.osce_student_schedule USING btree (time_block_id);
CREATE INDEX IF NOT EXISTS idx_osce_student_schedule_event ON public.osce_student_schedule USING btree (event_id);
CREATE UNIQUE INDEX IF NOT EXISTS osce_student_schedule_time_block_id_slot_number_key ON public.osce_student_schedule USING btree (time_block_id, slot_number);
CREATE INDEX IF NOT EXISTS idx_osce_time_blocks_event ON public.osce_time_blocks USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_peer_evaluations_evaluated ON public.peer_evaluations USING btree (evaluated_id);
CREATE INDEX IF NOT EXISTS idx_peer_evaluations_lab_day ON public.peer_evaluations USING btree (lab_day_id);
CREATE UNIQUE INDEX IF NOT EXISTS peer_evaluations_lab_day_id_evaluator_id_evaluated_id_key ON public.peer_evaluations USING btree (lab_day_id, evaluator_id, evaluated_id);
CREATE INDEX IF NOT EXISTS idx_block_instructors_block ON public.pmi_block_instructors USING btree (schedule_block_id);
CREATE INDEX IF NOT EXISTS idx_block_instructors_instr ON public.pmi_block_instructors USING btree (instructor_id);
CREATE UNIQUE INDEX IF NOT EXISTS pmi_block_instructors_schedule_block_id_instructor_id_key ON public.pmi_block_instructors USING btree (schedule_block_id, instructor_id);
CREATE INDEX IF NOT EXISTS idx_course_templates_default_instructor ON public.pmi_course_templates USING btree (default_instructor_id) WHERE (default_instructor_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_course_templates_program ON public.pmi_course_templates USING btree (program_type, semester_number);
CREATE INDEX IF NOT EXISTS idx_course_templates_replaces ON public.pmi_course_templates USING btree (replaces_course_id) WHERE (replaces_course_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_instructor_workload_sem ON public.pmi_instructor_workload USING btree (semester_id, instructor_id);
CREATE UNIQUE INDEX IF NOT EXISTS pmi_instructor_workload_semester_id_instructor_id_week_numb_key ON public.pmi_instructor_workload USING btree (semester_id, instructor_id, week_number);
CREATE INDEX IF NOT EXISTS idx_program_schedules_sem ON public.pmi_program_schedules USING btree (semester_id);
CREATE UNIQUE INDEX IF NOT EXISTS pmi_program_schedules_semester_id_cohort_id_key ON public.pmi_program_schedules USING btree (semester_id, cohort_id);
CREATE INDEX IF NOT EXISTS idx_room_availability_room ON public.pmi_room_availability USING btree (room_id);
CREATE UNIQUE INDEX IF NOT EXISTS pmi_rooms_name_key ON public.pmi_rooms USING btree (name);
CREATE INDEX IF NOT EXISTS idx_pmi_schedule_blocks_course_name ON public.pmi_schedule_blocks USING btree (course_name) WHERE (course_name IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pmi_schedule_blocks_semester ON public.pmi_schedule_blocks USING btree (semester_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON public.pmi_schedule_blocks USING btree (date);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_linked_lab_day ON public.pmi_schedule_blocks USING btree (linked_lab_day_id) WHERE (linked_lab_day_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_program ON public.pmi_schedule_blocks USING btree (program_schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_recurring_group ON public.pmi_schedule_blocks USING btree (recurring_group_id) WHERE (recurring_group_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_room ON public.pmi_schedule_blocks USING btree (room_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_semester_date ON public.pmi_schedule_blocks USING btree (semester_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS pmi_semesters_name_key ON public.pmi_semesters USING btree (name);
CREATE INDEX IF NOT EXISTS idx_polls_admin_link ON public.polls USING btree (admin_link);
CREATE INDEX IF NOT EXISTS idx_polls_available_slots ON public.polls USING gin (available_slots);
CREATE INDEX IF NOT EXISTS idx_polls_participant_link ON public.polls USING btree (participant_link);
CREATE UNIQUE INDEX IF NOT EXISTS polls_admin_link_key ON public.polls USING btree (admin_link);
CREATE UNIQUE INDEX IF NOT EXISTS polls_participant_link_key ON public.polls USING btree (participant_link);
CREATE INDEX IF NOT EXISTS idx_preceptor_tokens_internship ON public.preceptor_eval_tokens USING btree (internship_id);
CREATE INDEX IF NOT EXISTS idx_preceptor_tokens_token ON public.preceptor_eval_tokens USING btree (token);
CREATE UNIQUE INDEX IF NOT EXISTS preceptor_eval_tokens_token_key ON public.preceptor_eval_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS idx_preceptor_feedback_date ON public.preceptor_feedback USING btree (shift_date);
CREATE INDEX IF NOT EXISTS idx_preceptor_feedback_flagged ON public.preceptor_feedback USING btree (flagged) WHERE (flagged = true);
CREATE INDEX IF NOT EXISTS idx_preceptor_feedback_internship ON public.preceptor_feedback USING btree (internship_id);
CREATE INDEX IF NOT EXISTS idx_preceptor_feedback_student ON public.preceptor_feedback USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_print_notifications_read_at ON public.print_notifications USING btree (read_at) WHERE (read_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_print_notifications_user_id ON public.print_notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_print_request_history_request_id ON public.print_request_history USING btree (request_id);
CREATE INDEX IF NOT EXISTS idx_print_request_materials_request_id ON public.print_request_materials USING btree (request_id);
CREATE INDEX IF NOT EXISTS idx_print_requests_cost_type ON public.print_requests USING btree (cost_type);
CREATE INDEX IF NOT EXISTS idx_print_requests_created_at ON public.print_requests USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_requests_operator_id ON public.print_requests USING btree (operator_id);
CREATE INDEX IF NOT EXISTS idx_print_requests_status ON public.print_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_print_requests_user_id ON public.print_requests USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_printer_hour_adj_created ON public.printer_hour_adjustments USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_printer_hour_adj_printer ON public.printer_hour_adjustments USING btree (printer_id);
CREATE INDEX IF NOT EXISTS idx_program_outcomes_cohort ON public.program_outcomes USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_program_outcomes_year ON public.program_outcomes USING btree (year);
CREATE INDEX IF NOT EXISTS idx_program_requirements_program ON public.program_requirements USING btree (program);
CREATE INDEX IF NOT EXISTS idx_program_requirements_type ON public.program_requirements USING btree (requirement_type);
CREATE UNIQUE INDEX IF NOT EXISTS programs_name_key ON public.programs USING btree (name);
CREATE INDEX IF NOT EXISTS idx_protocol_completions_category ON public.protocol_completions USING btree (protocol_category);
CREATE INDEX IF NOT EXISTS idx_protocol_completions_student ON public.protocol_completions USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_record_access_log_date ON public.record_access_log USING btree (accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_access_log_student ON public.record_access_log USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_record_access_log_user ON public.record_access_log USING btree (user_email);
CREATE INDEX IF NOT EXISTS idx_report_templates_creator ON public.report_templates USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_report_templates_shared ON public.report_templates USING btree (is_shared);
CREATE INDEX IF NOT EXISTS idx_report_templates_user ON public.report_templates USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_date ON public.resource_bookings USING btree (booking_date);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_resource ON public.resource_bookings USING btree (resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_status ON public.resource_bookings USING btree (status);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_time ON public.resource_bookings USING btree (start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_resource_versions_resource ON public.resource_versions USING btree (resource_id);
CREATE INDEX IF NOT EXISTS idx_resources_active ON public.resources USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources USING btree (category);
CREATE INDEX IF NOT EXISTS idx_resources_uploaded_by ON public.resources USING btree (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric ON public.rubric_criteria USING btree (rubric_id);
CREATE UNIQUE INDEX IF NOT EXISTS rubric_scenario_assignments_rubric_id_scenario_id_key ON public.rubric_scenario_assignments USING btree (rubric_id, scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_cohort ON public.scenario_assessments USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_date ON public.scenario_assessments USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_email ON public.scenario_assessments USING btree (email_status) WHERE (email_status = 'queued'::text);
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_flagged ON public.scenario_assessments USING btree (flagged_for_review) WHERE (flagged_for_review = true);
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_group ON public.scenario_assessments USING btree (lab_group_id);
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_issue_level ON public.scenario_assessments USING btree (issue_level) WHERE (issue_level <> 'none'::text);
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_lab_day ON public.scenario_assessments USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_station ON public.scenario_assessments USING btree (lab_station_id);
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_team_lead ON public.scenario_assessments USING btree (team_lead_id);
CREATE INDEX IF NOT EXISTS idx_scenario_favorites_scenario ON public.scenario_favorites USING btree (scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_favorites_user ON public.scenario_favorites USING btree (user_email);
CREATE UNIQUE INDEX IF NOT EXISTS scenario_favorites_user_email_scenario_id_key ON public.scenario_favorites USING btree (user_email, scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_participation_date ON public.scenario_participation USING btree (date DESC);
CREATE INDEX IF NOT EXISTS idx_scenario_participation_lab_day ON public.scenario_participation USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_scenario_participation_role ON public.scenario_participation USING btree (role);
CREATE INDEX IF NOT EXISTS idx_scenario_participation_scenario ON public.scenario_participation USING btree (scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_participation_student ON public.scenario_participation USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_scenario_ratings_scenario ON public.scenario_ratings USING btree (scenario_id);
CREATE UNIQUE INDEX IF NOT EXISTS scenario_ratings_scenario_id_user_email_key ON public.scenario_ratings USING btree (scenario_id, user_email);
CREATE INDEX IF NOT EXISTS idx_scenario_tags_scenario ON public.scenario_tags USING btree (scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_versions_scenario ON public.scenario_versions USING btree (scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_active ON public.scenarios USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_scenarios_active_category ON public.scenarios USING btree (category, difficulty) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_scenarios_category ON public.scenarios USING btree (category);
CREATE INDEX IF NOT EXISTS idx_scenarios_difficulty ON public.scenarios USING btree (difficulty);
CREATE INDEX IF NOT EXISTS idx_scenarios_ekg ON public.scenarios USING gin (ekg_findings) WHERE ((ekg_findings IS NOT NULL) AND (ekg_findings <> '{}'::jsonb));
CREATE INDEX IF NOT EXISTS idx_scenarios_equipment_needed ON public.scenarios USING gin (equipment_needed) WHERE ((equipment_needed IS NOT NULL) AND (array_length(equipment_needed, 1) > 0));
CREATE INDEX IF NOT EXISTS idx_scenarios_programs ON public.scenarios USING gin (applicable_programs);
CREATE INDEX IF NOT EXISTS idx_scenarios_review_status ON public.scenarios USING btree (content_review_status);
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_active ON public.scheduled_exports USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_created_by ON public.scheduled_exports USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_next_run ON public.scheduled_exports USING btree (next_run_at);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_chart ON public.seat_assignments USING btree (seating_chart_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_student ON public.seat_assignments USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS seat_assignments_seating_chart_id_student_id_key ON public.seat_assignments USING btree (seating_chart_id, student_id);
CREATE UNIQUE INDEX IF NOT EXISTS seat_assignments_seating_chart_id_table_number_seat_positio_key ON public.seat_assignments USING btree (seating_chart_id, table_number, seat_position);
CREATE INDEX IF NOT EXISTS idx_seating_charts_cohort ON public.seating_charts USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_seating_preferences_student ON public.seating_preferences USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS seating_preferences_student_id_other_student_id_key ON public.seating_preferences USING btree (student_id, other_student_id);
CREATE INDEX IF NOT EXISTS idx_signups_instructor ON public.shift_signups USING btree (instructor_id);
CREATE INDEX IF NOT EXISTS idx_signups_shift ON public.shift_signups USING btree (shift_id);
CREATE INDEX IF NOT EXISTS idx_signups_status ON public.shift_signups USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS shift_signups_shift_id_instructor_id_key ON public.shift_signups USING btree (shift_id, instructor_id);
CREATE INDEX IF NOT EXISTS idx_swap_interest_request ON public.shift_swap_interest USING btree (swap_request_id);
CREATE INDEX IF NOT EXISTS idx_swap_interest_user ON public.shift_swap_interest USING btree (interested_by);
CREATE INDEX IF NOT EXISTS idx_trade_requester ON public.shift_trade_requests USING btree (requester_id);
CREATE INDEX IF NOT EXISTS idx_trade_requester_shift ON public.shift_trade_requests USING btree (requester_shift_id);
CREATE INDEX IF NOT EXISTS idx_trade_status ON public.shift_trade_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_trade_target_user ON public.shift_trade_requests USING btree (target_user_id);
CREATE INDEX IF NOT EXISTS idx_shift_trades_original_instructor ON public.shift_trades USING btree (original_instructor_email);
CREATE INDEX IF NOT EXISTS idx_shift_trades_shift ON public.shift_trades USING btree (original_shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_trades_status ON public.shift_trades USING btree (status);
CREATE INDEX IF NOT EXISTS idx_skill_assessments_station ON public.skill_assessments USING btree (lab_station_id);
CREATE INDEX IF NOT EXISTS idx_skill_assessments_student ON public.skill_assessments USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_skill_competencies_skill ON public.skill_competencies USING btree (skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_competencies_student ON public.skill_competencies USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS skill_competencies_student_id_skill_id_key ON public.skill_competencies USING btree (student_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_documents_drill ON public.skill_documents USING btree (drill_id);
CREATE INDEX IF NOT EXISTS idx_skill_documents_skill ON public.skill_documents USING btree (skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_documents_type ON public.skill_documents USING btree (document_type);
CREATE INDEX IF NOT EXISTS idx_skill_drill_cases_drill_id ON public.skill_drill_cases USING btree (skill_drill_id);
CREATE INDEX IF NOT EXISTS idx_skill_drills_active ON public.skill_drills USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_skill_drills_category ON public.skill_drills USING btree (category);
CREATE INDEX IF NOT EXISTS idx_skill_drills_created_by ON public.skill_drills USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_skill_drills_program_semester ON public.skill_drills USING btree (program, semester);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_drills_station_id ON public.skill_drills USING btree (station_id) WHERE (station_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_assignments_skill_name ON public.skill_sheet_assignments USING btree (skill_name);
CREATE UNIQUE INDEX IF NOT EXISTS skill_sheet_assignments_skill_sheet_id_skill_name_program_key ON public.skill_sheet_assignments USING btree (skill_sheet_id, skill_name, program);
CREATE INDEX IF NOT EXISTS idx_steps_sheet_order ON public.skill_sheet_steps USING btree (skill_sheet_id, step_number);
CREATE INDEX IF NOT EXISTS idx_skill_sheets_canonical ON public.skill_sheets USING btree (canonical_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_sheets_platinum_type ON public.skill_sheets USING btree (platinum_skill_type) WHERE (platinum_skill_type IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_skill_sheets_program_source ON public.skill_sheets USING btree (program, source_priority);
CREATE INDEX IF NOT EXISTS idx_skill_signoffs_skill ON public.skill_signoffs USING btree (skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_signoffs_student ON public.skill_signoffs USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_skill_signoffs_student_active ON public.skill_signoffs USING btree (student_id) WHERE (revoked_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS skill_signoffs_student_id_skill_id_key ON public.skill_signoffs USING btree (student_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_skills_category ON public.skills USING btree (category);
CREATE INDEX IF NOT EXISTS idx_skills_levels ON public.skills USING gin (certification_levels);
CREATE INDEX IF NOT EXISTS idx_station_completions_date ON public.station_completions USING btree (completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_station_completions_result ON public.station_completions USING btree (result);
CREATE INDEX IF NOT EXISTS idx_station_completions_station ON public.station_completions USING btree (station_id);
CREATE INDEX IF NOT EXISTS idx_station_completions_student ON public.station_completions USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_station_instructors_station ON public.station_instructors USING btree (station_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_station_instructors_unique ON public.station_instructors USING btree (station_id, user_email);
CREATE INDEX IF NOT EXISTS idx_station_instructors_user ON public.station_instructors USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS station_instructors_station_id_user_id_key ON public.station_instructors USING btree (station_id, user_id);
CREATE INDEX IF NOT EXISTS idx_station_pool_active ON public.station_pool USING btree (is_active, semester);
CREATE INDEX IF NOT EXISTS idx_station_pool_category ON public.station_pool USING btree (category);
CREATE INDEX IF NOT EXISTS idx_station_pool_cohort ON public.station_pool USING btree (cohort_id);
CREATE UNIQUE INDEX IF NOT EXISTS station_pool_station_code_key ON public.station_pool USING btree (station_code);
CREATE INDEX IF NOT EXISTS idx_station_skills_skill_id ON public.station_skills USING btree (skill_id);
CREATE INDEX IF NOT EXISTS idx_station_skills_station ON public.station_skills USING btree (station_id);
CREATE INDEX IF NOT EXISTS idx_station_skills_station_id ON public.station_skills USING btree (station_id);
CREATE UNIQUE INDEX IF NOT EXISTS station_skills_station_id_skill_id_key ON public.station_skills USING btree (station_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON public.student_achievements USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_clinical_hours_cohort ON public.student_clinical_hours USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_clinical_hours_student ON public.student_clinical_hours USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_student_clinical_hours_cohort ON public.student_clinical_hours USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_student_clinical_hours_student ON public.student_clinical_hours USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_student_communications_flagged ON public.student_communications USING btree (flagged) WHERE (flagged = true);
CREATE INDEX IF NOT EXISTS idx_student_communications_follow_up ON public.student_communications USING btree (follow_up_needed, follow_up_completed) WHERE ((follow_up_needed = true) AND (follow_up_completed = false));
CREATE INDEX IF NOT EXISTS idx_student_communications_student ON public.student_communications USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_cohort ON public.student_compliance_docs USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_student ON public.student_compliance_docs USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_type ON public.student_compliance_docs USING btree (doc_type);
CREATE UNIQUE INDEX IF NOT EXISTS student_compliance_docs_student_id_key ON public.student_compliance_docs USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_expiration ON public.student_compliance_records USING btree (expiration_date);
CREATE INDEX IF NOT EXISTS idx_compliance_records_status ON public.student_compliance_records USING btree (status);
CREATE INDEX IF NOT EXISTS idx_compliance_records_student ON public.student_compliance_records USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS student_compliance_records_student_id_doc_type_id_key ON public.student_compliance_records USING btree (student_id, doc_type_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_student ON public.student_documents USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_type ON public.student_documents USING btree (document_type);
CREATE INDEX IF NOT EXISTS idx_field_rides_cohort ON public.student_field_rides USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_field_rides_student ON public.student_field_rides USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_group_assignments_group ON public.student_group_assignments USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_group_assignments_student ON public.student_group_assignments USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS student_group_assignments_group_id_student_id_key ON public.student_group_assignments USING btree (group_id, student_id);
CREATE INDEX IF NOT EXISTS idx_student_groups_cohort ON public.student_groups USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_import_history_cohort ON public.student_import_history USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_individual_tasks_due ON public.student_individual_tasks USING btree (due_date);
CREATE INDEX IF NOT EXISTS idx_individual_tasks_status ON public.student_individual_tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_individual_tasks_student ON public.student_individual_tasks USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_individual_tasks_type ON public.student_individual_tasks USING btree (task_type);
CREATE INDEX IF NOT EXISTS idx_internships_agency_date ON public.student_internships USING btree (agency_id, placement_date);
CREATE INDEX IF NOT EXISTS idx_internships_cohort ON public.student_internships USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_internships_placement_date ON public.student_internships USING btree (placement_date);
CREATE INDEX IF NOT EXISTS idx_internships_status ON public.student_internships USING btree (status);
CREATE INDEX IF NOT EXISTS idx_internships_student ON public.student_internships USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_student_internships_closeout_status ON public.student_internships USING btree (closeout_completed, snhd_submitted, cleared_for_nremt);
CREATE INDEX IF NOT EXISTS idx_student_internships_snhd_course_completion ON public.student_internships USING btree (snhd_course_completion_submitted_at);
CREATE INDEX IF NOT EXISTS idx_student_internships_snhd_field_doc ON public.student_internships USING btree (snhd_field_docs_submitted_at);
CREATE INDEX IF NOT EXISTS idx_student_internships_snhd_submitted ON public.student_internships USING btree (snhd_submitted) WHERE (snhd_submitted = true);
CREATE INDEX IF NOT EXISTS idx_student_lab_ratings_instructor ON public.student_lab_ratings USING btree (instructor_email);
CREATE INDEX IF NOT EXISTS idx_student_lab_ratings_lab_day ON public.student_lab_ratings USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_student_lab_ratings_student ON public.student_lab_ratings USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS student_lab_ratings_student_id_lab_day_id_instructor_email_key ON public.student_lab_ratings USING btree (student_id, lab_day_id, instructor_email);
CREATE INDEX IF NOT EXISTS idx_student_lab_signups_lab ON public.student_lab_signups USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_student_lab_signups_status ON public.student_lab_signups USING btree (status);
CREATE INDEX IF NOT EXISTS idx_student_lab_signups_student ON public.student_lab_signups USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS student_lab_signups_lab_day_id_student_id_key ON public.student_lab_signups USING btree (lab_day_id, student_id);
CREATE INDEX IF NOT EXISTS idx_learning_styles_student ON public.student_learning_styles USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS student_learning_styles_student_id_key ON public.student_learning_styles USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_mce_clearance_status ON public.student_mce_clearance USING btree (clearance_status);
CREATE INDEX IF NOT EXISTS idx_mce_clearance_student ON public.student_mce_clearance USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS student_mce_clearance_student_id_key ON public.student_mce_clearance USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_mce_modules_cohort ON public.student_mce_modules USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_mce_modules_student ON public.student_mce_modules USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_milestones_completed ON public.student_milestones USING btree (completed_date);
CREATE INDEX IF NOT EXISTS idx_milestones_semester ON public.student_milestones USING btree (semester);
CREATE INDEX IF NOT EXISTS idx_milestones_student ON public.student_milestones USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_milestones_type ON public.student_milestones USING btree (milestone_type);
CREATE INDEX IF NOT EXISTS idx_student_notes_author ON public.student_notes USING btree (author_id);
CREATE INDEX IF NOT EXISTS idx_student_notes_flag ON public.student_notes USING btree (flag_level) WHERE (flag_level = ANY (ARRAY['yellow'::text, 'red'::text]));
CREATE INDEX IF NOT EXISTS idx_student_notes_flagged ON public.student_notes USING btree (student_id) WHERE (is_flagged = true);
CREATE INDEX IF NOT EXISTS idx_student_notes_student ON public.student_notes USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_preceptor_assignments_active ON public.student_preceptor_assignments USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_preceptor_assignments_internship ON public.student_preceptor_assignments USING btree (internship_id);
CREATE INDEX IF NOT EXISTS idx_preceptor_assignments_preceptor ON public.student_preceptor_assignments USING btree (preceptor_id);
CREATE INDEX IF NOT EXISTS idx_preceptor_assignments_role ON public.student_preceptor_assignments USING btree (role);
CREATE UNIQUE INDEX IF NOT EXISTS student_preceptor_assignments_internship_id_preceptor_id_ro_key ON public.student_preceptor_assignments USING btree (internship_id, preceptor_id, role);
CREATE INDEX IF NOT EXISTS idx_eval_sheet ON public.student_skill_evaluations USING btree (skill_sheet_id);
CREATE INDEX IF NOT EXISTS idx_eval_student ON public.student_skill_evaluations USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_skill_evals_email_status ON public.student_skill_evaluations USING btree (email_status) WHERE (email_status = 'queued'::text);
CREATE INDEX IF NOT EXISTS idx_skill_evals_lab_day ON public.student_skill_evaluations USING btree (lab_day_id) WHERE (lab_day_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_skill_evals_status ON public.student_skill_evaluations USING btree (student_id, status) WHERE (status = 'in_progress'::text);
CREATE INDEX IF NOT EXISTS idx_skill_evals_student_sheet_attempt ON public.student_skill_evaluations USING btree (student_id, skill_sheet_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_student_task_status_status ON public.student_task_status USING btree (status);
CREATE INDEX IF NOT EXISTS idx_student_task_status_student ON public.student_task_status USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_student_task_status_task ON public.student_task_status USING btree (cohort_task_id);
CREATE UNIQUE INDEX IF NOT EXISTS student_task_status_student_id_cohort_task_id_key ON public.student_task_status USING btree (student_id, cohort_task_id);
CREATE INDEX IF NOT EXISTS idx_students_cohort ON public.students USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_students_cohort_id ON public.students USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_students_cohort_status ON public.students USING btree (cohort_id, status);
CREATE INDEX IF NOT EXISTS idx_students_emstesting_id ON public.students USING btree (emstesting_id) WHERE (emstesting_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_students_learning_style ON public.students USING btree (learning_style);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS students_student_id_key ON public.students USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_email ON public.submissions USING btree (email);
CREATE INDEX IF NOT EXISTS idx_submissions_poll ON public.submissions USING btree (poll_id);
CREATE INDEX IF NOT EXISTS idx_submissions_poll_id ON public.submissions USING btree (poll_id);
CREATE INDEX IF NOT EXISTS idx_submissions_respondent_role ON public.submissions USING btree (respondent_role);
CREATE UNIQUE INDEX IF NOT EXISTS submissions_poll_id_email_key ON public.submissions USING btree (poll_id, email);
CREATE INDEX IF NOT EXISTS idx_substitute_requests_lab_day ON public.substitute_requests USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_substitute_requests_status ON public.substitute_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_summative_scores_evaluation ON public.summative_evaluation_scores USING btree (evaluation_id);
CREATE INDEX IF NOT EXISTS idx_summative_scores_student ON public.summative_evaluation_scores USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS summative_evaluation_scores_evaluation_id_student_id_key ON public.summative_evaluation_scores USING btree (evaluation_id, student_id);
CREATE INDEX IF NOT EXISTS idx_summative_evaluations_cohort ON public.summative_evaluations USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_summative_evaluations_date ON public.summative_evaluations USING btree (evaluation_date);
CREATE INDEX IF NOT EXISTS idx_summative_evaluations_internship ON public.summative_evaluations USING btree (internship_id);
CREATE INDEX IF NOT EXISTS idx_summative_scenarios_linked ON public.summative_scenarios USING btree (linked_scenario_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_summative_scenarios_number ON public.summative_scenarios USING btree (scenario_number) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_supply_barcodes_item ON public.supply_barcodes USING btree (supply_item_id);
CREATE INDEX IF NOT EXISTS idx_supply_barcodes_value ON public.supply_barcodes USING btree (barcode_value);
CREATE UNIQUE INDEX IF NOT EXISTS supply_barcodes_barcode_value_key ON public.supply_barcodes USING btree (barcode_value);
CREATE UNIQUE INDEX IF NOT EXISTS supply_categories_name_key ON public.supply_categories USING btree (name);
CREATE INDEX IF NOT EXISTS idx_supply_items_category ON public.supply_items USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_supply_items_expiration ON public.supply_items USING btree (expiration_date) WHERE (expiration_date IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_supply_items_low_stock ON public.supply_items USING btree (quantity, reorder_level) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_supply_items_sku ON public.supply_items USING btree (sku);
CREATE INDEX IF NOT EXISTS idx_supply_items_type ON public.supply_items USING btree (item_type);
CREATE UNIQUE INDEX IF NOT EXISTS supply_items_sku_key ON public.supply_items USING btree (sku);
CREATE INDEX IF NOT EXISTS idx_supply_transactions_date ON public.supply_transactions USING btree (performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_supply_transactions_item ON public.supply_transactions USING btree (supply_item_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_date ON public.system_alerts USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_unresolved ON public.system_alerts USING btree (is_resolved, severity) WHERE (is_resolved = false);
CREATE INDEX IF NOT EXISTS idx_system_config_category ON public.system_config USING btree (category);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON public.system_config USING btree (key);
CREATE UNIQUE INDEX IF NOT EXISTS system_config_key_key ON public.system_config USING btree (key);
CREATE INDEX IF NOT EXISTS idx_task_assignees_assignee ON public.task_assignees USING btree (assignee_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_assignee_id ON public.task_assignees USING btree (assignee_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_status ON public.task_assignees USING btree (status);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON public.task_assignees USING btree (task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON public.task_assignees USING btree (task_id);
CREATE UNIQUE INDEX IF NOT EXISTS task_assignees_task_id_assignee_id_key ON public.task_assignees USING btree (task_id, assignee_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments USING btree (task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments USING btree (task_id);
CREATE INDEX IF NOT EXISTS idx_teaching_log_cohort ON public.teaching_log USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_teaching_log_date ON public.teaching_log USING btree (date_taught);
CREATE INDEX IF NOT EXISTS idx_teaching_log_instructor ON public.teaching_log USING btree (instructor_id);
CREATE INDEX IF NOT EXISTS idx_team_availability_creator ON public.team_availability_views USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_team_lead_log_cohort ON public.team_lead_log USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_team_lead_log_student ON public.team_lead_log USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_template_review_comments_review_item_id ON public.template_review_comments USING btree (review_item_id);
CREATE INDEX IF NOT EXISTS idx_template_review_items_disposition ON public.template_review_items USING btree (disposition);
CREATE INDEX IF NOT EXISTS idx_template_review_items_lab_day_id ON public.template_review_items USING btree (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_template_review_items_review_id ON public.template_review_items USING btree (review_id);
CREATE INDEX IF NOT EXISTS idx_template_reviews_cohort_id ON public.template_reviews USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_template_reviews_created_by ON public.template_reviews USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_template_reviews_status ON public.template_reviews USING btree (status);
CREATE INDEX IF NOT EXISTS idx_timer_display_tokens_active ON public.timer_display_tokens USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_timer_display_tokens_lab_room ON public.timer_display_tokens USING btree (lab_room_id);
CREATE INDEX IF NOT EXISTS idx_timer_display_tokens_token ON public.timer_display_tokens USING btree (token);
CREATE UNIQUE INDEX IF NOT EXISTS timer_display_tokens_token_key ON public.timer_display_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS idx_user_activity_date ON public.user_activity USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_page ON public.user_activity USING btree (page_path);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON public.user_activity USING btree (user_email);
CREATE UNIQUE INDEX IF NOT EXISTS user_departments_user_id_department_id_key ON public.user_departments USING btree (user_id, department_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_type ON public.user_endorsements USING btree (endorsement_type);
CREATE INDEX IF NOT EXISTS idx_endorsements_user ON public.user_endorsements USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_endorsements_user_id_endorsement_type_department_id_key ON public.user_endorsements USING btree (user_id, endorsement_type, department_id);
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON public.user_notifications USING btree (user_email, archived_at) WHERE (archived_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_notifications_digest ON public.user_notifications USING btree (user_email, digest_sent_at) WHERE (digest_sent_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_notifications_digest_pending ON public.user_notifications USING btree (user_email, created_at) WHERE ((digest_sent_at IS NULL) AND (is_read = false));
CREATE INDEX IF NOT EXISTS idx_user_notifications_category ON public.user_notifications USING btree (category);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created ON public.user_notifications USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_email ON public.user_notifications USING btree (user_email);
CREATE INDEX IF NOT EXISTS idx_user_notifications_email_created ON public.user_notifications USING btree (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_email_read_created ON public.user_notifications USING btree (user_email, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_ref_type_created ON public.user_notifications USING btree (reference_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON public.user_notifications USING btree (type);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications USING btree (user_email, is_read) WHERE (is_read = false);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read_date ON public.user_notifications USING btree (user_email, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_preferences_email ON public.user_preferences USING btree (user_email);
CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_user_email_key ON public.user_preferences USING btree (user_email);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role);
CREATE INDEX IF NOT EXISTS idx_user_sessions_email ON public.user_sessions USING btree (user_email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions USING btree (session_token);
CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_session_token_key ON public.user_sessions USING btree (session_token);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_date ON public.webhook_deliveries USING btree (delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON public.webhook_deliveries USING btree (webhook_id);

-- ===================
-- Row Level Security
-- ===================
ALTER TABLE "access_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_device_heartbeats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_doors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aemt_student_tracking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "affiliation_notifications_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agency_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_prompt_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alumni" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcement_reads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approved_external_emails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assigned_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bin_contents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendar_sync_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "canonical_skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_analytics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_briefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_practice_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_studies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ce_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ce_requirements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cert_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classrooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_affiliations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_rotations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_site_departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_site_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_site_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_sites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_task_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_task_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_visit_students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "closeout_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "closeout_surveys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cohort_key_dates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cohort_milestones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cohort_scenario_completions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cohort_skill_completions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cohort_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cohorts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compliance_audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compliance_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compliance_document_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custody_checkout_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custody_checkouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_consent_agreements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_export_archives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_export_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deletion_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ekg_warmup_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_template_customizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employment_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emt_student_tracking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipment_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipment_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipment_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipment_maintenance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "field_preceptors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "field_ride_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "field_trip_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "field_trips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "filament_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "filament_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "filament_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "google_calendar_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guest_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "instructor_availability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "instructor_certifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "instructor_daily_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "instructor_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "instructor_time_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "internship_meetings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_bin_contents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_bin_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_bins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_containers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_checklist_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_day_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_day_checklist_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_day_checklists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_day_debrief_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_day_debriefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_day_equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_day_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_day_student_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_day_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_days" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_equipment_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_group_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_stations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_template_stations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_template_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_timer_ready_status" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_timer_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_week_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "library_checkouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "library_copies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "library_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "library_scanning_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_chapters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_content_blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_course_days" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_grades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_instructor_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_instructor_availability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_medications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_pharm_checkpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_plan_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_plan_placements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_plan_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_prerequisites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_shift_patterns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_skill_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_skill_status" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lvfr_aemt_supplementary_days" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_phase_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_phases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_task_dependencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_task_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "open_shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "osce_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pmi_block_instructors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pmi_course_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pmi_instructor_workload" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pmi_program_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pmi_room_availability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pmi_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pmi_schedule_blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pmi_semesters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "polls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "preceptor_eval_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "preceptor_feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_failures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_request_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_request_materials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "printer_hour_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "printer_maintenance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "printers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "protocol_completions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "record_access_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resource_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scenario_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scenario_favorites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scenario_participation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scenarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_exports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seat_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seating_charts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seating_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shift_signups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shift_swap_interest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shift_trade_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_competencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_drill_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_drills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_sheet_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_sheet_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_sheets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "station_completions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "station_instructors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "station_pool" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "station_skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_achievements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_case_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_clinical_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_compliance_docs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_compliance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_field_rides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_group_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_import_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_individual_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_internships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_lab_ratings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_lab_signups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_learning_styles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_mce_clearance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_mce_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_milestones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_preceptor_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_skill_evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_task_status" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "summative_evaluation_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "summative_evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "summative_scenarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supply_barcodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supply_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supply_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supply_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supply_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_assignees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teaching_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_availability_views" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_lead_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "template_review_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "template_review_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "template_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "timer_display_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_endorsements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "Access admins can manage cards" ON "access_cards" FOR ALL TO {public} USING (is_access_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "access_cards" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Access admins can view heartbeats" ON "access_device_heartbeats" FOR SELECT TO {public} USING (is_access_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "access_device_heartbeats" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Access admins can manage devices" ON "access_devices" FOR ALL TO {public} USING (is_access_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "OPS users can view devices" ON "access_devices" FOR SELECT TO {public} USING (has_ops_access()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "access_devices" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Access admins can manage doors" ON "access_doors" FOR ALL TO {public} USING (is_access_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "OPS users can view doors" ON "access_doors" FOR SELECT TO {public} USING (has_ops_access()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "access_doors" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Access admins can insert logs" ON "access_logs" FOR INSERT TO {public} WITH CHECK (is_access_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "OPS users can view access logs" ON "access_logs" FOR SELECT TO {public} USING (has_ops_access()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "access_logs" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access" ON "access_requests" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Access admins can manage rules" ON "access_rules" FOR ALL TO {public} USING (is_access_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "access_rules" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Access admins can manage schedules" ON "access_schedules" FOR ALL TO {public} USING (is_access_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "OPS users can view schedules" ON "access_schedules" FOR SELECT TO {public} USING (has_ops_access()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "access_schedules" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to aemt_tracking" ON "aemt_student_tracking" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated users to insert AEMT tracking" ON "aemt_student_tracking" FOR INSERT TO {authenticated} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated users to update AEMT tracking" ON "aemt_student_tracking" FOR UPDATE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated users to view AEMT tracking" ON "aemt_student_tracking" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users view notification logs" ON "affiliation_notifications_log" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to agencies" ON "agencies" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow read access to agencies" ON "agencies" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can view contacts" ON "agency_contacts" FOR SELECT TO {public} USING ((auth.role() = 'authenticated'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role manages contacts" ON "agency_contacts" FOR ALL TO {public} USING ((auth.role() = 'service_role'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ai_prompt_templates_service_role" ON "ai_prompt_templates" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_all_alumni" ON "alumni" FOR ALL TO {authenticated} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "announcement_reads_insert" ON "announcement_reads" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "announcement_reads_select" ON "announcement_reads" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "announcement_reads_upsert" ON "announcement_reads" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "announcements_delete" ON "announcements" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "announcements_insert" ON "announcements" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "announcements_read" ON "announcements" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "announcements_select" ON "announcements" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "announcements_update" ON "announcements" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_approved_external" ON "approved_external_emails" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users see own tasks" ON "assigned_tasks" FOR ALL TO {public} USING (((assigned_to_email = (auth.jwt() ->> 'email'::text)) OR (assigned_by_email = (auth.jwt() ->> 'email'::text)))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow insert audit logs" ON "audit_log" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins can view audit logs" ON "audit_log" FOR SELECT TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.id = auth.uid()) AND (lab_users.role = 'superadmin'::text))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read bin contents" ON "bin_contents" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage bin contents" ON "bin_contents" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "bin_contents" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow service role full access to calendar_sync_log" ON "calendar_sync_log" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view canonical_skills" ON "canonical_skills" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role can do anything on canonical_skills" ON "canonical_skills" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access to case_analytics" ON "case_analytics" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access to case_assignments" ON "case_assignments" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "case_briefs_service_role" ON "case_briefs" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access to case_flags" ON "case_flags" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access to case_practice_progress" ON "case_practice_progress" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access to case_responses" ON "case_responses" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access to case_reviews" ON "case_reviews" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access to case_sessions" ON "case_sessions" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can read published cases" ON "case_studies" FOR SELECT TO {public} USING (((is_active = true) AND ((is_published = true) OR (visibility = ANY (ARRAY['official'::text, 'community'::text]))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access to case_studies" ON "case_studies" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for ce_records" ON "ce_records" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for ce_requirements" ON "ce_requirements" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for cert_notifications" ON "cert_notifications" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view classrooms" ON "classrooms" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users manage affiliations" ON "clinical_affiliations" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for service role" ON "clinical_rotations" FOR ALL TO {public} USING ((auth.role() = 'service_role'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow read for authenticated users" ON "clinical_rotations" FOR SELECT TO {public} USING ((auth.role() = 'authenticated'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to clinical_site_departments" ON "clinical_site_departments" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "clinical_site_schedules_delete" ON "clinical_site_schedules" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "clinical_site_schedules_insert" ON "clinical_site_schedules" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "clinical_site_schedules_read" ON "clinical_site_schedules" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "clinical_site_schedules_update" ON "clinical_site_schedules" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to clinical_site_visits" ON "clinical_site_visits" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to clinical_sites" ON "clinical_sites" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to task_definitions" ON "clinical_task_definitions" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to task_templates" ON "clinical_task_templates" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to clinical_visit_students" ON "clinical_visit_students" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "closeout_docs_delete" ON "closeout_documents" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "closeout_docs_insert" ON "closeout_documents" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "closeout_docs_select" ON "closeout_documents" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "surveys_delete" ON "closeout_surveys" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "surveys_insert" ON "closeout_surveys" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "surveys_select" ON "closeout_surveys" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "surveys_update" ON "closeout_surveys" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to cohort_key_dates" ON "cohort_key_dates" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to milestones" ON "cohort_milestones" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for cohort_scenario_completions" ON "cohort_scenario_completions" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for cohort_skill_completions" ON "cohort_skill_completions" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to cohort_tasks" ON "cohort_tasks" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for cohorts" ON "cohorts" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "compliance_audit_log_service" ON "compliance_audit_log" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "compliance_audits_service" ON "compliance_audits" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated read of doc types" ON "compliance_document_types" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read custody checkout items" ON "custody_checkout_items" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage custody checkout items" ON "custody_checkout_items" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "custody_checkout_items" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read custody checkouts" ON "custody_checkouts" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage custody checkouts" ON "custody_checkouts" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "custody_checkouts" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to custom_skills" ON "custom_skills" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for custom_skills" ON "custom_skills" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_consent" ON "data_consent_agreements" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for authenticated" ON "data_export_archives" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "export_history_insert" ON "data_export_history" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "export_history_select" ON "data_export_history" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for deletion_requests" ON "deletion_requests" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "document_requests_service_role" ON "document_requests" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ekg_scores_delete_policy" ON "ekg_warmup_scores" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ekg_scores_insert_policy" ON "ekg_warmup_scores" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ekg_scores_select_policy" ON "ekg_warmup_scores" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ekg_scores_update_policy" ON "ekg_warmup_scores" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role can access email_log" ON "email_log" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role can access email_queue" ON "email_queue" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage email templates" ON "email_template_customizations" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ev_delete" ON "employment_verifications" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ev_insert" ON "employment_verifications" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ev_select" ON "employment_verifications" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ev_update" ON "employment_verifications" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to emt_tracking" ON "emt_student_tracking" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated users to insert EMT tracking" ON "emt_student_tracking" FOR INSERT TO {authenticated} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated users to update EMT tracking" ON "emt_student_tracking" FOR UPDATE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated users to view EMT tracking" ON "emt_student_tracking" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "equipment_read" ON "equipment" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read equipment assignments" ON "equipment_assignments" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage equipment assignments" ON "equipment_assignments" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "equipment_assignments" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can read equipment categories" ON "equipment_categories" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage equipment categories" ON "equipment_categories" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "equipment_categories" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read equipment" ON "equipment_items" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage equipment" ON "equipment_items" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "equipment_items" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read equipment maintenance" ON "equipment_maintenance" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage equipment maintenance" ON "equipment_maintenance" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "equipment_maintenance" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can create feedback" ON "feedback_reports" FOR INSERT TO {anon,authenticated} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update feedback" ON "feedback_reports" FOR UPDATE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view feedback" ON "feedback_reports" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to preceptors" ON "field_preceptors" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow read access to preceptors" ON "field_preceptors" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can submit ride requests" ON "field_ride_requests" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can view ride requests" ON "field_ride_requests" FOR SELECT TO {public} USING ((auth.role() = 'authenticated'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role manages ride requests" ON "field_ride_requests" FOR ALL TO {public} USING ((auth.role() = 'service_role'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to field_trip_attendance" ON "field_trip_attendance" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to field_trips" ON "field_trips" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Operators can manage adjustments" ON "filament_adjustments" FOR ALL TO {public} USING (is_print_operator()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "filament_adjustments" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Operators can manage purchases" ON "filament_purchases" FOR ALL TO {public} USING (is_print_operator()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "filament_purchases" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view active filament types" ON "filament_types" FOR SELECT TO {public} USING ((is_active = true)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Operators can manage filaments" ON "filament_types" FOR ALL TO {public} USING (is_print_operator()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "filament_types" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow service role full access to google_calendar_events" ON "google_calendar_events" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for guest_access" ON "guest_access" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage import_history" ON "import_history" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access to incidents" ON "incidents" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can view all availability" ON "instructor_availability" FOR SELECT TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.id = auth.uid()) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete own availability" ON "instructor_availability" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can insert own availability" ON "instructor_availability" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can manage own availability" ON "instructor_availability" FOR ALL TO {public} USING ((instructor_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update own availability" ON "instructor_availability" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view availability" ON "instructor_availability" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for instructor_certifications" ON "instructor_certifications" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can manage own notes" ON "instructor_daily_notes" FOR ALL TO {public} USING ((((auth.uid())::text = (instructor_id)::text) OR (auth.role() = 'authenticated'::text))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "daily_notes_delete_policy" ON "instructor_daily_notes" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "daily_notes_insert_policy" ON "instructor_daily_notes" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "daily_notes_select_policy" ON "instructor_daily_notes" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "daily_notes_update_policy" ON "instructor_daily_notes" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Assigner can delete tasks" ON "instructor_tasks" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Assigners can delete their tasks" ON "instructor_tasks" FOR DELETE TO {public} USING ((assigned_by = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Task participants can update" ON "instructor_tasks" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create tasks" ON "instructor_tasks" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update tasks they're involved in" ON "instructor_tasks" FOR UPDATE TO {public} USING (((assigned_by = auth.uid()) OR (assigned_to = auth.uid()))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view all tasks" ON "instructor_tasks" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view tasks assigned to or by them" ON "instructor_tasks" FOR SELECT TO {public} USING (((assigned_to = auth.uid()) OR (assigned_by = auth.uid()))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "instructors_delete_time_entries" ON "instructor_time_entries" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "instructors_insert_own_time_entries" ON "instructor_time_entries" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "instructors_read_own_time_entries" ON "instructor_time_entries" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "instructors_update_own_time_entries" ON "instructor_time_entries" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can view meetings" ON "internship_meetings" FOR SELECT TO {public} USING ((auth.role() = 'authenticated'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role manages meetings" ON "internship_meetings" FOR ALL TO {public} USING ((auth.role() = 'service_role'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read bins" ON "inventory_bins" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage bins" ON "inventory_bins" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "inventory_bins" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can read checklist templates" ON "lab_checklist_templates" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Instructors can manage checklist templates" ON "lab_checklist_templates" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Instructors can manage attendance" ON "lab_day_attendance" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can manage checklists" ON "lab_day_checklist_items" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for authenticated" ON "lab_day_checklists" FOR ALL TO {public} USING ((auth.role() = 'authenticated'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "debrief_notes_all_authenticated" ON "lab_day_debrief_notes" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for authenticated" ON "lab_day_debriefs" FOR ALL TO {public} USING ((auth.role() = 'authenticated'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for authenticated" ON "lab_day_equipment" FOR ALL TO {public} USING ((auth.role() = 'authenticated'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role has full access to lab_day_equipment" ON "lab_day_equipment" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can manage lab day roles" ON "lab_day_roles" FOR ALL TO {public} USING ((auth.role() = 'authenticated'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lab_day_roles_delete_policy" ON "lab_day_roles" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lab_day_roles_insert_policy" ON "lab_day_roles" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lab_day_roles_select_policy" ON "lab_day_roles" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lab_day_roles_update_policy" ON "lab_day_roles" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view lab_day_student_queue" ON "lab_day_student_queue" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role can do anything on lab_day_student_queue" ON "lab_day_student_queue" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "templates_delete" ON "lab_day_templates" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "templates_insert" ON "lab_day_templates" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "templates_select" ON "lab_day_templates" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "templates_update" ON "lab_day_templates" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for lab_days" ON "lab_days" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users manage equipment" ON "lab_equipment_items" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for lab_group_history" ON "lab_group_history" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for lab_group_members" ON "lab_group_members" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for lab_groups" ON "lab_groups" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for lab_stations" ON "lab_stations" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "stations_delete" ON "lab_template_stations" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "stations_insert" ON "lab_template_stations" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "stations_select" ON "lab_template_stations" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "stations_update" ON "lab_template_stations" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for authenticated" ON "lab_template_versions" FOR ALL TO {public} USING ((auth.role() = 'authenticated'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service can manage ready status" ON "lab_timer_ready_status" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create ready status" ON "lab_timer_ready_status" FOR INSERT TO {authenticated} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete ready status" ON "lab_timer_ready_status" FOR DELETE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update ready status" ON "lab_timer_ready_status" FOR UPDATE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view ready status" ON "lab_timer_ready_status" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service can manage timer state" ON "lab_timer_state" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create timer state" ON "lab_timer_state" FOR INSERT TO {authenticated} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete timer state" ON "lab_timer_state" FOR DELETE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update timer state" ON "lab_timer_state" FOR UPDATE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view timer state" ON "lab_timer_state" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for lab_users" ON "lab_users" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lab_week_templates_delete" ON "lab_week_templates" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lab_week_templates_insert" ON "lab_week_templates" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lab_week_templates_read" ON "lab_week_templates" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lab_week_templates_update" ON "lab_week_templates" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read library checkouts" ON "library_checkouts" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage library checkouts" ON "library_checkouts" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "library_checkouts" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read library copies" ON "library_copies" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage library copies" ON "library_copies" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "library_copies" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read library items" ON "library_items" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage library items" ON "library_items" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "library_items" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage scanning sessions" ON "library_scanning_sessions" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "library_scanning_sessions" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read locations" ON "locations" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage locations" ON "locations" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "locations" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_assessments" ON "lvfr_aemt_assessments" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_chapters" ON "lvfr_aemt_chapters" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "content_blocks_service" ON "lvfr_aemt_content_blocks" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_course_days" ON "lvfr_aemt_course_days" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_files" ON "lvfr_aemt_files" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_grades" ON "lvfr_aemt_grades" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_assign" ON "lvfr_aemt_instructor_assignments" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_avail" ON "lvfr_aemt_instructor_availability" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_medications" ON "lvfr_aemt_medications" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_modules" ON "lvfr_aemt_modules" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_pharm_ck" ON "lvfr_aemt_pharm_checkpoints" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "plan_instances_service" ON "lvfr_aemt_plan_instances" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "plan_placements_service" ON "lvfr_aemt_plan_placements" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "plan_templates_service" ON "lvfr_aemt_plan_templates" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "prerequisites_service" ON "lvfr_aemt_prerequisites" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_shift" ON "lvfr_aemt_shift_patterns" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_skill_att" ON "lvfr_aemt_skill_attempts" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_skill_status" ON "lvfr_aemt_skill_status" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_skills" ON "lvfr_aemt_skills" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_lvfr_supplementary" ON "lvfr_aemt_supplementary_days" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can insert notifications" ON "notifications_log" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can read their own notifications" ON "notifications_log" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow insert onboarding assignments" ON "onboarding_assignments" FOR INSERT TO {authenticated} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow read onboarding assignments" ON "onboarding_assignments" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow update onboarding assignments" ON "onboarding_assignments" FOR UPDATE TO {authenticated} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins_manage_assignments" ON "onboarding_assignments" FOR ALL TO {authenticated} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.email = auth.email()) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.email = auth.email()) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "instructors_see_own_assignments" ON "onboarding_assignments" FOR SELECT TO {public} USING ((instructor_email = (auth.jwt() ->> 'email'::text))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "mentors_see_mentee_assignments" ON "onboarding_assignments" FOR SELECT TO {public} USING ((mentor_email = (auth.jwt() ->> 'email'::text))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "temp_allow_insert" ON "onboarding_assignments" FOR INSERT TO {authenticated} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins_see_all_events" ON "onboarding_events" FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.email = (auth.jwt() ->> 'email'::text)) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_see_own_events" ON "onboarding_events" FOR SELECT TO {public} USING (((actor_email = (auth.jwt() ->> 'email'::text)) OR (target_email = (auth.jwt() ->> 'email'::text)))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins_manage_evidence" ON "onboarding_evidence" FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.email = (auth.jwt() ->> 'email'::text)) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "mentors_view_mentee_evidence" ON "onboarding_evidence" FOR SELECT TO {public} USING ((EXISTS ( SELECT 1
   FROM (onboarding_task_progress tp
     JOIN onboarding_assignments a ON ((tp.assignment_id = a.id)))
  WHERE ((tp.id = onboarding_evidence.task_progress_id) AND (a.mentor_email = (auth.jwt() ->> 'email'::text)))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_manage_own_evidence" ON "onboarding_evidence" FOR ALL TO {public} USING ((uploaded_by = (auth.jwt() ->> 'email'::text))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins_manage_phase_progress" ON "onboarding_phase_progress" FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.email = (auth.jwt() ->> 'email'::text)) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_see_own_phase_progress" ON "onboarding_phase_progress" FOR SELECT TO {public} USING ((EXISTS ( SELECT 1
   FROM onboarding_assignments
  WHERE ((onboarding_assignments.id = onboarding_phase_progress.assignment_id) AND ((onboarding_assignments.instructor_email = (auth.jwt() ->> 'email'::text)) OR (onboarding_assignments.mentor_email = (auth.jwt() ->> 'email'::text))))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins_manage_phases" ON "onboarding_phases" FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.email = (auth.jwt() ->> 'email'::text)) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anyone_reads_phases" ON "onboarding_phases" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins_manage_dependencies" ON "onboarding_task_dependencies" FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.email = (auth.jwt() ->> 'email'::text)) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anyone_reads_dependencies" ON "onboarding_task_dependencies" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins_manage_all_progress" ON "onboarding_task_progress" FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.email = (auth.jwt() ->> 'email'::text)) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "instructors_manage_own_progress" ON "onboarding_task_progress" FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM onboarding_assignments
  WHERE ((onboarding_assignments.id = onboarding_task_progress.assignment_id) AND (onboarding_assignments.instructor_email = (auth.jwt() ->> 'email'::text)))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "mentors_view_mentee_progress" ON "onboarding_task_progress" FOR SELECT TO {public} USING ((EXISTS ( SELECT 1
   FROM onboarding_assignments
  WHERE ((onboarding_assignments.id = onboarding_task_progress.assignment_id) AND (onboarding_assignments.mentor_email = (auth.jwt() ->> 'email'::text)))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins_manage_tasks" ON "onboarding_tasks" FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.email = (auth.jwt() ->> 'email'::text)) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anyone_reads_tasks" ON "onboarding_tasks" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins_manage_templates" ON "onboarding_templates" FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.email = (auth.jwt() ->> 'email'::text)) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anyone_reads_active_templates" ON "onboarding_templates" FOR SELECT TO {public} USING ((is_active = true)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage shifts" ON "open_shifts" FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.id = auth.uid()) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Directors can manage shifts" ON "open_shifts" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Everyone can view open shifts" ON "open_shifts" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "osce_events_service_role" ON "osce_events" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can read pmi_block_instructors" ON "pmi_block_instructors" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role bypass for pmi_block_instructors" ON "pmi_block_instructors" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can read course templates" ON "pmi_course_templates" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Lead instructors can manage course templates" ON "pmi_course_templates" FOR ALL TO {authenticated} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can read pmi_instructor_workload" ON "pmi_instructor_workload" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role bypass for pmi_instructor_workload" ON "pmi_instructor_workload" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can read pmi_program_schedules" ON "pmi_program_schedules" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role bypass for pmi_program_schedules" ON "pmi_program_schedules" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can read pmi_room_availability" ON "pmi_room_availability" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role bypass for pmi_room_availability" ON "pmi_room_availability" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can read pmi_rooms" ON "pmi_rooms" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role bypass for pmi_rooms" ON "pmi_rooms" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can read pmi_schedule_blocks" ON "pmi_schedule_blocks" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role bypass for pmi_schedule_blocks" ON "pmi_schedule_blocks" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can read pmi_semesters" ON "pmi_semesters" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role bypass for pmi_semesters" ON "pmi_semesters" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow delete for creators" ON "polls" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view polls" ON "polls" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can create polls" ON "polls" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "tokens_insert" ON "preceptor_eval_tokens" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "tokens_select" ON "preceptor_eval_tokens" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "tokens_update" ON "preceptor_eval_tokens" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access on preceptor_feedback" ON "preceptor_feedback" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Operators can manage failures" ON "print_failures" FOR ALL TO {public} USING (is_print_operator()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "print_failures" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view own request failures" ON "print_failures" FOR SELECT TO {public} USING ((EXISTS ( SELECT 1
   FROM print_requests
  WHERE ((print_requests.id = print_failures.request_id) AND (print_requests.user_id = auth.uid()))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "print_notifications" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "System can insert notifications" ON "print_notifications" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update own notifications" ON "print_notifications" FOR UPDATE TO {public} USING ((user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view own notifications" ON "print_notifications" FOR SELECT TO {public} USING ((user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Operators can view all history" ON "print_request_history" FOR SELECT TO {public} USING (is_print_operator()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "print_request_history" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "System can insert history" ON "print_request_history" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view own request history" ON "print_request_history" FOR SELECT TO {public} USING ((EXISTS ( SELECT 1
   FROM print_requests
  WHERE ((print_requests.id = print_request_history.request_id) AND (print_requests.user_id = auth.uid()))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Operators can manage materials" ON "print_request_materials" FOR ALL TO {public} USING (is_print_operator()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "print_request_materials" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view own request materials" ON "print_request_materials" FOR SELECT TO {public} USING ((EXISTS ( SELECT 1
   FROM print_requests
  WHERE ((print_requests.id = print_request_materials.request_id) AND (print_requests.user_id = auth.uid()))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Operators can update requests" ON "print_requests" FOR UPDATE TO {public} USING (is_print_operator()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Operators can view all requests" ON "print_requests" FOR SELECT TO {public} USING (is_print_operator()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "print_requests" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create requests" ON "print_requests" FOR INSERT TO {public} WITH CHECK ((auth.uid() = user_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update own pending requests" ON "print_requests" FOR UPDATE TO {public} USING (((auth.uid() = user_id) AND (status = ANY (ARRAY['submitted'::text, 'needs_info'::text])))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view own requests" ON "print_requests" FOR SELECT TO {public} USING ((auth.uid() = user_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Operators can manage hour adjustments" ON "printer_hour_adjustments" FOR ALL TO {public} USING (is_print_operator()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "printer_hour_adjustments" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view maintenance" ON "printer_maintenance" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Operators can manage maintenance" ON "printer_maintenance" FOR ALL TO {public} USING (is_print_operator()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "printer_maintenance" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view printers" ON "printers" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Operators can manage printers" ON "printers" FOR ALL TO {public} USING (is_print_operator()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "printers" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for programs" ON "programs" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "protocol_completions_delete_policy" ON "protocol_completions" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "protocol_completions_insert_policy" ON "protocol_completions" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "protocol_completions_select_policy" ON "protocol_completions" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "protocol_completions_update_policy" ON "protocol_completions" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_role_access_log" ON "record_access_log" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role can do everything on resource_versions" ON "resource_versions" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role can do everything on resources" ON "resources" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for scenario_assessments" ON "scenario_assessments" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow insert for authenticated" ON "scenario_assessments" FOR INSERT TO {authenticated} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can manage their own favorites" ON "scenario_favorites" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for authenticated" ON "scenario_participation" FOR ALL TO {public} USING ((auth.role() = 'authenticated'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "scenario_participation_delete_policy" ON "scenario_participation" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "scenario_participation_insert_policy" ON "scenario_participation" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "scenario_participation_select_policy" ON "scenario_participation" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "scenario_participation_update_policy" ON "scenario_participation" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for scenarios" ON "scenarios" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage scheduled exports" ON "scheduled_exports" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all deletes on seat assignments" ON "seat_assignments" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all inserts on seat assignments" ON "seat_assignments" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all updates on seat assignments" ON "seat_assignments" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view seat assignments" ON "seat_assignments" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all deletes on seating charts" ON "seating_charts" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all inserts on seating charts" ON "seating_charts" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all updates on seating charts" ON "seating_charts" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view seating charts" ON "seating_charts" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all deletes on seating_preferences" ON "seating_preferences" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all inserts on preferences" ON "seating_preferences" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all updates on seating_preferences" ON "seating_preferences" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view preferences" ON "seating_preferences" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all signups" ON "shift_signups" FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.id = auth.uid()) AND (lab_users.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can manage own signups" ON "shift_signups" FOR ALL TO {public} USING ((instructor_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can manage signups" ON "shift_signups" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view signups" ON "shift_signups" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users manage swap interest" ON "shift_swap_interest" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users manage trades" ON "shift_trade_requests" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for skill_assessments" ON "skill_assessments" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access on skill_competencies" ON "skill_competencies" FOR ALL TO {service_role} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage skill_documents" ON "skill_documents" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can read skill_documents" ON "skill_documents" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "skill_drill_cases_read" ON "skill_drill_cases" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view skill drills" ON "skill_drills" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Instructors can manage skill drills" ON "skill_drills" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "skill_drills_read" ON "skill_drills" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view skill_sheet_assignments" ON "skill_sheet_assignments" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role can do anything on skill_sheet_assignments" ON "skill_sheet_assignments" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view skill_sheet_steps" ON "skill_sheet_steps" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role can do anything on skill_sheet_steps" ON "skill_sheet_steps" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view skill_sheets" ON "skill_sheets" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role can do anything on skill_sheets" ON "skill_sheets" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for skills" ON "skills" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "station_completions_all" ON "station_completions" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for authenticated" ON "station_instructors" FOR ALL TO {authenticated} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create station instructors" ON "station_instructors" FOR INSERT TO {authenticated} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete station instructors" ON "station_instructors" FOR DELETE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update station instructors" ON "station_instructors" FOR UPDATE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view station instructors" ON "station_instructors" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "station_pool_all" ON "station_pool" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for station_skills" ON "station_skills" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access to student_achievements" ON "student_achievements" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access to student_case_stats" ON "student_case_stats" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to clinical_hours" ON "student_clinical_hours" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to compliance_docs" ON "student_compliance_docs" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated users to insert compliance docs" ON "student_compliance_docs" FOR INSERT TO {authenticated} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated users to update compliance docs" ON "student_compliance_docs" FOR UPDATE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated users to view compliance docs" ON "student_compliance_docs" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated insert of compliance records" ON "student_compliance_records" FOR INSERT TO {authenticated} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated read of compliance records" ON "student_compliance_records" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow authenticated update of compliance records" ON "student_compliance_records" FOR UPDATE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "student_documents_service_role" ON "student_documents" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to field_rides" ON "student_field_rides" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all deletes on student_group_assignments" ON "student_group_assignments" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all inserts on group assignments" ON "student_group_assignments" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all updates on student_group_assignments" ON "student_group_assignments" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view group assignments" ON "student_group_assignments" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all deletes on student_groups" ON "student_groups" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all inserts on groups" ON "student_groups" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all updates on student_groups" ON "student_groups" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view groups" ON "student_groups" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "import_history_insert" ON "student_import_history" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "import_history_select" ON "student_import_history" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to individual_tasks" ON "student_individual_tasks" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to internships" ON "student_internships" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow read access to internships" ON "student_internships" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access" ON "student_lab_ratings" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "student_lab_signups_delete_policy" ON "student_lab_signups" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "student_lab_signups_insert_policy" ON "student_lab_signups" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "student_lab_signups_select_policy" ON "student_lab_signups" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "student_lab_signups_update_policy" ON "student_lab_signups" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all deletes on learning styles" ON "student_learning_styles" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all inserts on learning styles" ON "student_learning_styles" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all updates on learning styles" ON "student_learning_styles" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view learning styles" ON "student_learning_styles" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view mce clearance" ON "student_mce_clearance" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role can manage mce clearance" ON "student_mce_clearance" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to mce_modules" ON "student_mce_modules" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to milestones" ON "student_milestones" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Instructors can manage student notes" ON "student_notes" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users delete preceptor assignments" ON "student_preceptor_assignments" FOR DELETE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users insert preceptor assignments" ON "student_preceptor_assignments" FOR INSERT TO {authenticated} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users see preceptor assignments" ON "student_preceptor_assignments" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users update preceptor assignments" ON "student_preceptor_assignments" FOR UPDATE TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can view student_skill_evaluations" ON "student_skill_evaluations" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role can do anything on student_skill_evaluations" ON "student_skill_evaluations" FOR ALL TO {public} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all access to student_task_status" ON "student_task_status" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for students" ON "students" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role can manage students" ON "students" FOR ALL TO {public} USING ((auth.role() = 'service_role'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow delete submissions" ON "submissions" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can insert submissions" ON "submissions" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view submissions" ON "submissions" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own submissions" ON "submissions" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can manage summative scores" ON "summative_evaluation_scores" FOR ALL TO {authenticated} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can manage summative evaluations" ON "summative_evaluations" FOR ALL TO {authenticated} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can read summative scenarios" ON "summative_scenarios" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage supply barcodes" ON "supply_barcodes" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "supply_barcodes" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can read supply categories" ON "supply_categories" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage supply categories" ON "supply_categories" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "supply_categories" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read supply items" ON "supply_items" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage supply items" ON "supply_items" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "supply_items" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage supply notifications" ON "supply_notifications" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "supply_notifications" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated can read supply transactions" ON "supply_transactions" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Inventory admins can manage supply transactions" ON "supply_transactions" FOR ALL TO {public} USING (is_inventory_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins have full access" ON "supply_transactions" FOR ALL TO {public} USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "alerts_insert" ON "system_alerts" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "alerts_select" ON "system_alerts" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "alerts_update" ON "system_alerts" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service role full access" ON "system_config" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for system_settings" ON "system_settings" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create task assignees" ON "task_assignees" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete task assignees" ON "task_assignees" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update task assignees" ON "task_assignees" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view task assignees" ON "task_assignees" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can add comments to their tasks" ON "task_comments" FOR INSERT TO {public} WITH CHECK ((EXISTS ( SELECT 1
   FROM instructor_tasks
  WHERE ((instructor_tasks.id = task_comments.task_id) AND ((instructor_tasks.assigned_to = auth.uid()) OR (instructor_tasks.assigned_by = auth.uid())))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create comments" ON "task_comments" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view comments on their tasks" ON "task_comments" FOR SELECT TO {public} USING ((EXISTS ( SELECT 1
   FROM instructor_tasks
  WHERE ((instructor_tasks.id = task_comments.task_id) AND ((instructor_tasks.assigned_to = auth.uid()) OR (instructor_tasks.assigned_by = auth.uid())))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view task comments" ON "task_comments" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for teaching_log" ON "teaching_log" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete own team views" ON "team_availability_views" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can insert team views" ON "team_availability_views" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view own team views" ON "team_availability_views" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Allow all for team_lead_log" ON "team_lead_log" FOR ALL TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "template_review_comments_delete" ON "template_review_comments" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "template_review_comments_insert" ON "template_review_comments" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "template_review_comments_select" ON "template_review_comments" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "template_review_comments_update" ON "template_review_comments" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "template_review_items_delete" ON "template_review_items" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "template_review_items_insert" ON "template_review_items" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "template_review_items_select" ON "template_review_items" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "template_review_items_update" ON "template_review_items" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "template_reviews_delete" ON "template_reviews" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "template_reviews_insert" ON "template_reviews" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "template_reviews_select" ON "template_reviews" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "template_reviews_update" ON "template_reviews" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can manage timer tokens" ON "timer_display_tokens" FOR ALL TO {authenticated} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can manage tokens" ON "timer_display_tokens" FOR ALL TO {authenticated} USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public read active tokens" ON "timer_display_tokens" FOR SELECT TO {public} USING ((is_active = true)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "activity_insert" ON "user_activity" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "activity_select" ON "user_activity" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins manage endorsements" ON "user_endorsements" FOR INSERT TO {authenticated} WITH CHECK ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.email = (auth.jwt() ->> 'email'::text)) AND (lab_users.role = 'superadmin'::text))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins update endorsements" ON "user_endorsements" FOR UPDATE TO {authenticated} USING ((EXISTS ( SELECT 1
   FROM lab_users
  WHERE ((lab_users.email = (auth.jwt() ->> 'email'::text)) AND (lab_users.role = 'superadmin'::text))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users see endorsements" ON "user_endorsements" FOR SELECT TO {authenticated} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service can delete notifications" ON "user_notifications" FOR DELETE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Service can insert notifications" ON "user_notifications" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can read own notifications" ON "user_notifications" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update own notifications" ON "user_notifications" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can insert own preferences" ON "user_preferences" FOR INSERT TO {public} WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can read own preferences" ON "user_preferences" FOR SELECT TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update own preferences" ON "user_preferences" FOR UPDATE TO {public} USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Superadmins can manage all roles" ON "user_roles" FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM lab_users lu
  WHERE ((lu.email = (auth.jwt() ->> 'email'::text)) AND (lu.role = 'superadmin'::text))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view their own roles" ON "user_roles" FOR SELECT TO {public} USING ((user_id IN ( SELECT lu.id
   FROM lab_users lu
  WHERE (lu.email = (auth.jwt() ->> 'email'::text))))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===================
-- Functions
-- ===================
-- Function: admin_delete
CREATE OR REPLACE FUNCTION public.admin_delete(target_table text, target_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Set the override flag for this transaction only
  SET LOCAL app.allow_critical_delete = 'true';

  -- Execute the delete
  EXECUTE format('DELETE FROM %I WHERE id = $1', target_table) USING target_id;

  RETURN FOUND;
END;
$function$
;

-- Function: bin_before_change
CREATE OR REPLACE FUNCTION public.bin_before_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
    IF TG_OP = 'INSERT' AND (NEW.barcode IS NULL OR NEW.barcode = '') THEN
      NEW.barcode := generate_bin_barcode();
    END IF;

    IF NEW.bin_type = 'multi_item' AND NEW.inventory_item_id IS NOT NULL THEN
      RAISE EXCEPTION 'Multi-item bins cannot have inventory_item_id set. Use bin_contents table instead.';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
  END;
  $function$
;

-- Function: check_assignment_completion
CREATE OR REPLACE FUNCTION public.check_assignment_completion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_total_required INTEGER;
  v_completed_count INTEGER;
  v_template_id UUID;
  v_assigned_by TEXT;
  v_instructor_email TEXT;
BEGIN
  SELECT a.template_id, a.assigned_by, a.instructor_email
  INTO v_template_id, v_assigned_by, v_instructor_email
  FROM onboarding_assignments a
  WHERE a.id = NEW.assignment_id;

  SELECT COUNT(*) INTO v_total_required
  FROM onboarding_tasks t
  JOIN onboarding_phases p ON t.phase_id = p.id
  WHERE p.template_id = v_template_id AND t.is_required = true;

  SELECT COUNT(*) INTO v_completed_count
  FROM onboarding_task_progress tp
  JOIN onboarding_tasks t ON tp.task_id = t.id
  WHERE tp.assignment_id = NEW.assignment_id
    AND tp.status IN ('completed', 'waived')
    AND t.is_required = true;

  IF v_completed_count >= v_total_required AND v_total_required > 0 THEN
    UPDATE onboarding_assignments
    SET status = 'completed', updated_at = NOW()
    WHERE id = NEW.assignment_id;

    -- Notify admin
    INSERT INTO user_notifications (user_email, title, message, type, link_url)
    VALUES (
      v_assigned_by,
      'Onboarding Complete',
      format('%s has completed all onboarding tasks!', v_instructor_email),
      'success',
      '/admin/onboarding'
    );

    -- Notify instructor
    INSERT INTO user_notifications (user_email, title, message, type, link_url)
    VALUES (
      v_instructor_email,
      'Onboarding Complete!',
      'Congratulations! You have completed all onboarding requirements.',
      'success',
      '/onboarding'
    );
  END IF;

  RETURN NEW;
END;
$function$
;

-- Function: check_phase_completion
CREATE OR REPLACE FUNCTION public.check_phase_completion(p_assignment_id uuid, p_phase_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_total INTEGER;
  v_completed INTEGER;
  v_assignment RECORD;
  v_phase RECORD;
BEGIN
  SELECT * INTO v_assignment FROM onboarding_assignments WHERE id = p_assignment_id;
  SELECT * INTO v_phase FROM onboarding_phases WHERE id = p_phase_id;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE tp.status IN ('completed', 'waived'))
  INTO v_total, v_completed
  FROM onboarding_task_progress tp
  JOIN onboarding_tasks t ON tp.task_id = t.id
  WHERE tp.assignment_id = p_assignment_id
    AND t.phase_id = p_phase_id
    AND t.is_required = true;

  -- Update or create phase progress
  INSERT INTO onboarding_phase_progress (assignment_id, phase_id, status, started_at, completed_at, elapsed_days)
  VALUES (
    p_assignment_id, p_phase_id,
    CASE WHEN v_completed >= v_total THEN 'completed' ELSE 'in_progress' END,
    COALESCE(
      (SELECT MIN(started_at) FROM onboarding_task_progress tp
       JOIN onboarding_tasks t ON tp.task_id = t.id
       WHERE tp.assignment_id = p_assignment_id AND t.phase_id = p_phase_id AND tp.started_at IS NOT NULL),
      NOW()
    ),
    CASE WHEN v_completed >= v_total THEN NOW() ELSE NULL END,
    CASE WHEN v_completed >= v_total THEN
      EXTRACT(DAY FROM NOW() - v_assignment.start_date)::INTEGER
    ELSE NULL END
  )
  ON CONFLICT (assignment_id, phase_id) DO UPDATE SET
    status = EXCLUDED.status,
    completed_at = EXCLUDED.completed_at,
    elapsed_days = EXCLUDED.elapsed_days,
    total_task_minutes = (
      SELECT COALESCE(SUM(time_spent_minutes), 0)
      FROM onboarding_task_progress tp
      JOIN onboarding_tasks t ON tp.task_id = t.id
      WHERE tp.assignment_id = p_assignment_id AND t.phase_id = p_phase_id
    );

  -- Log phase completion event
  IF v_completed >= v_total AND v_total > 0 THEN
    INSERT INTO onboarding_events (event_type, assignment_id, phase_id, actor_email, actor_role, metadata)
    VALUES (
      'phase_completed', p_assignment_id, p_phase_id,
      v_assignment.instructor_email, 'system',
      jsonb_build_object(
        'phase_name', v_phase.name,
        'phase_number', v_phase.sort_order,
        'tasks_completed', v_completed,
        'elapsed_days', EXTRACT(DAY FROM NOW() - v_assignment.start_date)::INTEGER,
        'total_task_minutes', (
          SELECT COALESCE(SUM(time_spent_minutes), 0)
          FROM onboarding_task_progress tp
          JOIN onboarding_tasks t ON tp.task_id = t.id
          WHERE tp.assignment_id = p_assignment_id AND t.phase_id = p_phase_id
        )
      )
    );
  END IF;
END;
$function$
;

-- Function: compute_location_full_path
CREATE OR REPLACE FUNCTION public.compute_location_full_path(loc_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  path_parts TEXT[] := '{}';
  current_id UUID := loc_id;
  current_name TEXT;
  parent UUID;
BEGIN
  WHILE current_id IS NOT NULL LOOP
    SELECT name, parent_id INTO current_name, parent
    FROM public.locations WHERE id = current_id;
    IF current_name IS NOT NULL THEN
      path_parts := array_prepend(current_name, path_parts);
    END IF;
    current_id := parent;
  END LOOP;
  RETURN array_to_string(path_parts, ' > ');
END;
$function$
;

-- Function: create_notification
CREATE OR REPLACE FUNCTION public.create_notification(p_user_email text, p_title text, p_message text, p_type text DEFAULT 'general'::text, p_link_url text DEFAULT NULL::text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO user_notifications (
    user_email, title, message, type, link_url, reference_type, reference_id
  ) VALUES (
    p_user_email, p_title, p_message, p_type, p_link_url, p_reference_type, p_reference_id
  ) RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$function$
;

-- Function: create_notification
CREATE OR REPLACE FUNCTION public.create_notification(p_user_email text, p_title text, p_message text, p_type text DEFAULT 'general'::text, p_link_url text DEFAULT NULL::text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_category text DEFAULT 'system'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO user_notifications (
    user_email, title, message, type, link_url, reference_type, reference_id, category
  ) VALUES (
    p_user_email, p_title, p_message, p_type, p_link_url, p_reference_type, p_reference_id, p_category
  ) RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$function$
;

-- Function: create_task_progress_for_assignment
CREATE OR REPLACE FUNCTION public.create_task_progress_for_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO onboarding_task_progress (assignment_id, task_id, status)
  SELECT NEW.id, t.id, 'pending'
  FROM onboarding_tasks t
  JOIN onboarding_phases p ON t.phase_id = p.id
  WHERE p.template_id = NEW.template_id;

  -- Notify the instructor
  INSERT INTO user_notifications (user_email, title, message, type, link_url)
  VALUES (
    NEW.instructor_email,
    'Onboarding Assigned',
    'Your onboarding checklist is ready. Tap to view your tasks!',
    'info',
    '/onboarding'
  );

  -- Notify the mentor if assigned
  IF NEW.mentor_email IS NOT NULL THEN
    INSERT INTO user_notifications (user_email, title, message, type, link_url)
    VALUES (
      NEW.mentor_email,
      'New Mentee Assigned',
      format('You have been assigned as a mentor for %s onboarding.', NEW.instructor_email),
      'info',
      '/onboarding'
    );
  END IF;

  RETURN NEW;
END;
$function$
;

-- Function: generate_bin_barcode
CREATE OR REPLACE FUNCTION public.generate_bin_barcode()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  new_code TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    new_code := 'BIN-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));
    SELECT COUNT(*) INTO exists_count FROM public.inventory_bins WHERE barcode = new_code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN new_code;
END;
$function$
;

-- Function: generate_location_qr_code
CREATE OR REPLACE FUNCTION public.generate_location_qr_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  new_code TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    new_code := 'LOC-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));
    SELECT COUNT(*) INTO exists_count FROM public.locations WHERE qr_code = new_code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN new_code;
END;
$function$
;

-- Function: get_all_users
CREATE OR REPLACE FUNCTION public.get_all_users()
 RETURNS TABLE(id uuid, email text, display_name text, role text, status text, last_sign_in_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Only superadmins can call this
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: superadmin required';
  END IF;
  
  RETURN QUERY
  SELECT DISTINCT
    lu.id,
    lu.email,
    lu.display_name,
    lu.role,
    lu.status,
    au.last_sign_in_at
  FROM lab_users lu
  JOIN user_departments ud ON ud.user_id = lu.id
  JOIN departments d ON d.id = ud.department_id
  LEFT JOIN auth.users au ON au.email = lu.email
  WHERE d.abbreviation = 'OPS'
  ORDER BY lu.email;
END;
$function$
;

-- Function: get_user_email_prefs
CREATE OR REPLACE FUNCTION public.get_user_email_prefs(user_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  prefs JSONB;
BEGIN
  SELECT up.email_preferences INTO prefs
  FROM user_preferences up
  JOIN lab_users lu ON lu.id = up.user_id
  WHERE lu.email ILIKE user_email;

  IF prefs IS NULL THEN
    -- Return default preferences
    RETURN '{
      "enabled": false,
      "mode": "immediate",
      "digest_time": "08:00",
      "categories": {
        "tasks": true,
        "labs": true,
        "scheduling": true,
        "feedback": false,
        "clinical": false,
        "system": false
      }
    }'::jsonb;
  END IF;

  RETURN prefs;
END;
$function$
;

-- Function: has_ops_access
CREATE OR REPLACE FUNCTION public.has_ops_access()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN
  RETURN EXISTS (
    SELECT 1 FROM lab_users lu
    JOIN user_departments ud ON ud.user_id = lu.id
    JOIN departments d ON d.id = ud.department_id
    WHERE lu.email = auth.jwt() ->> 'email'
    AND lu.status = 'active' AND d.abbreviation = 'OPS'
  );
END; $function$
;

-- Function: has_pmi_ops_role
CREATE OR REPLACE FUNCTION public.has_pmi_ops_role(role_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN
  IF is_superadmin() THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN lab_users lu ON lu.id = ur.user_id
    WHERE lu.email = auth.jwt() ->> 'email'
    AND lu.status = 'active' AND ur.role = role_name
  );
END; $function$
;

-- Function: is_access_admin
CREATE OR REPLACE FUNCTION public.is_access_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN has_pmi_ops_role('access_admin');
END;
$function$
;

-- Function: is_inventory_admin
CREATE OR REPLACE FUNCTION public.is_inventory_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN RETURN has_pmi_ops_role('inventory_admin'); END; $function$
;

-- Function: is_print_operator
CREATE OR REPLACE FUNCTION public.is_print_operator()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN RETURN has_pmi_ops_role('operator'); END; $function$
;

-- Function: is_superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN
  RETURN EXISTS (
    SELECT 1 FROM lab_users
    WHERE email = auth.jwt() ->> 'email'
    AND role = 'superadmin' AND status = 'active'
  );
END; $function$
;

-- Function: location_after_insert
CREATE OR REPLACE FUNCTION public.location_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
    UPDATE locations SET full_path = compute_location_full_path(NEW.id) WHERE id = NEW.id;
    RETURN NEW;
  END;
  $function$
;

-- Function: location_before_change
CREATE OR REPLACE FUNCTION public.location_before_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.qr_code IS NULL OR NEW.qr_code = '') THEN
    NEW.qr_code := public.generate_location_qr_code();
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.updated_at := NOW();
  ELSE
    NEW.full_path := public.compute_location_full_path(NEW.id);
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$function$
;

-- Function: log_assignment_completion
CREATE OR REPLACE FUNCTION public.log_assignment_completion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_elapsed INTEGER;
  v_total_minutes INTEGER;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    v_elapsed := EXTRACT(DAY FROM NOW() - NEW.start_date)::INTEGER;
    NEW.completed_at := NOW();
    NEW.total_elapsed_days := v_elapsed;

    SELECT COALESCE(SUM(time_spent_minutes), 0) INTO v_total_minutes
    FROM onboarding_task_progress
    WHERE assignment_id = NEW.id;

    INSERT INTO onboarding_events (event_type, assignment_id, actor_email, actor_role, metadata)
    VALUES (
      'assignment_completed', NEW.id,
      NEW.instructor_email, 'system',
      jsonb_build_object(
        'total_elapsed_days', v_elapsed,
        'total_task_minutes', v_total_minutes,
        'instructor_type', NEW.instructor_type,
        'start_date', NEW.start_date,
        'target_date', NEW.target_completion_date,
        'days_ahead_or_behind', (NEW.target_completion_date - CURRENT_DATE)
      )
    );
  END IF;

  RETURN NEW;
END;
$function$
;

-- Function: log_inventory_adjustment
CREATE OR REPLACE FUNCTION public.log_inventory_adjustment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
    INSERT INTO public.inventory_adjustments (item_id, adjustment, quantity_before, quantity_after, adjusted_by)
    VALUES (NEW.id, NEW.quantity - OLD.quantity, OLD.quantity, NEW.quantity, auth.uid());
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$
;

-- Function: log_onboarding_event
CREATE OR REPLACE FUNCTION public.log_onboarding_event(p_event_type text, p_actor_email text, p_assignment_id uuid DEFAULT NULL::uuid, p_task_id uuid DEFAULT NULL::uuid, p_phase_id uuid DEFAULT NULL::uuid, p_actor_role text DEFAULT NULL::text, p_target_email text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO onboarding_events (
    event_type, assignment_id, task_id, phase_id,
    actor_email, actor_role, target_email, metadata
  ) VALUES (
    p_event_type, p_assignment_id, p_task_id, p_phase_id,
    p_actor_email, p_actor_role, p_target_email, p_metadata
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$function$
;

-- Function: log_task_progress_event
CREATE OR REPLACE FUNCTION public.log_task_progress_event()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_assignment RECORD;
  v_task RECORD;
  v_phase RECORD;
  v_time_spent INTEGER;
  v_turnaround INTEGER;
BEGIN
  SELECT * INTO v_assignment FROM onboarding_assignments WHERE id = NEW.assignment_id;
  SELECT * INTO v_task FROM onboarding_tasks WHERE id = NEW.task_id;
  SELECT * INTO v_phase FROM onboarding_phases WHERE id = v_task.phase_id;

  -- Task started
  IF NEW.status = 'in_progress' AND (OLD.status = 'pending' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO onboarding_events (event_type, assignment_id, task_id, phase_id, actor_email, actor_role, metadata)
    VALUES (
      'task_started', NEW.assignment_id, NEW.task_id, v_task.phase_id,
      v_assignment.instructor_email, 'instructor',
      jsonb_build_object(
        'task_title', v_task.title,
        'task_type', v_task.task_type,
        'phase_name', v_phase.name,
        'estimated_minutes', v_task.estimated_minutes
      )
    );

    -- Track sign-off request timing
    IF v_task.requires_sign_off THEN
      NEW.sign_off_requested_at := NOW();

      INSERT INTO onboarding_events (event_type, assignment_id, task_id, phase_id, actor_email, actor_role, target_email, metadata)
      VALUES (
        'sign_off_requested', NEW.assignment_id, NEW.task_id, v_task.phase_id,
        v_assignment.instructor_email, 'instructor',
        CASE WHEN v_task.sign_off_role = 'mentor' THEN v_assignment.mentor_email ELSE v_assignment.assigned_by END,
        jsonb_build_object('task_title', v_task.title, 'sign_off_role', v_task.sign_off_role)
      );
    END IF;
  END IF;

  -- Task completed
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    -- Calculate time spent
    IF NEW.started_at IS NOT NULL THEN
      v_time_spent := EXTRACT(EPOCH FROM (NOW() - NEW.started_at)) / 60;
      NEW.time_spent_minutes := v_time_spent;
    END IF;

    -- Calculate sign-off turnaround
    IF NEW.sign_off_requested_at IS NOT NULL AND NEW.signed_off_at IS NOT NULL THEN
      v_turnaround := EXTRACT(EPOCH FROM (NEW.signed_off_at - NEW.sign_off_requested_at)) / 60;
      NEW.sign_off_turnaround_minutes := v_turnaround;
    END IF;

    INSERT INTO onboarding_events (event_type, assignment_id, task_id, phase_id, actor_email, actor_role, metadata)
    VALUES (
      'task_completed', NEW.assignment_id, NEW.task_id, v_task.phase_id,
      COALESCE(NEW.signed_off_by, v_assignment.instructor_email),
      CASE WHEN NEW.signed_off_by IS NOT NULL THEN 'approver' ELSE 'instructor' END,
      jsonb_build_object(
        'task_title', v_task.title,
        'task_type', v_task.task_type,
        'phase_name', v_phase.name,
        'time_spent_minutes', v_time_spent,
        'sign_off_turnaround_minutes', v_turnaround,
        'estimated_minutes', v_task.estimated_minutes
      )
    );

    -- Check if this completes a phase
    PERFORM check_phase_completion(NEW.assignment_id, v_task.phase_id);
  END IF;

  -- Task reopened
  IF NEW.status IN ('pending', 'in_progress') AND OLD.status = 'completed' THEN
    NEW.reopened_count := COALESCE(OLD.reopened_count, 0) + 1;

    INSERT INTO onboarding_events (event_type, assignment_id, task_id, phase_id, actor_email, actor_role, metadata)
    VALUES (
      'task_reopened', NEW.assignment_id, NEW.task_id, v_task.phase_id,
      v_assignment.instructor_email, 'instructor',
      jsonb_build_object('task_title', v_task.title, 'reopen_count', NEW.reopened_count)
    );
  END IF;

  -- Task blocked
  IF NEW.status = 'blocked' AND OLD.status IS DISTINCT FROM 'blocked' THEN
    NEW.blocked_at := NOW();

    INSERT INTO onboarding_events (event_type, assignment_id, task_id, phase_id, actor_email, actor_role, metadata)
    VALUES (
      'task_blocked', NEW.assignment_id, NEW.task_id, v_task.phase_id,
      v_assignment.instructor_email, 'instructor',
      jsonb_build_object('task_title', v_task.title, 'reason', NEW.blocked_reason)
    );
  END IF;

  RETURN NEW;
END;
$function$
;

-- Function: move_student_to_group
CREATE OR REPLACE FUNCTION public.move_student_to_group(p_student_id uuid, p_new_group_id uuid, p_changed_by text, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_old_group_id UUID;
BEGIN
  SELECT lab_group_id INTO v_old_group_id
  FROM public.lab_group_members
  WHERE student_id = p_student_id;
  
  INSERT INTO public.lab_group_history (student_id, from_group_id, to_group_id, changed_by, reason)
  VALUES (p_student_id, v_old_group_id, p_new_group_id, p_changed_by, p_reason);
  
  DELETE FROM public.lab_group_members WHERE student_id = p_student_id;
  
  IF p_new_group_id IS NOT NULL THEN
    INSERT INTO public.lab_group_members (lab_group_id, student_id, assigned_by)
    VALUES (p_new_group_id, p_student_id, p_changed_by);
  END IF;
END;
$function$
;

-- Function: notify_sign_off_needed
CREATE OR REPLACE FUNCTION public.notify_sign_off_needed()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_task RECORD;
  v_assignment RECORD;
  v_notify_email TEXT;
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status = 'pending' THEN
    SELECT * INTO v_task FROM onboarding_tasks WHERE id = NEW.task_id;
    
    IF v_task.requires_sign_off THEN
      SELECT * INTO v_assignment 
      FROM onboarding_assignments WHERE id = NEW.assignment_id;

      -- Determine who to notify
      IF v_task.sign_off_role = 'mentor' THEN
        v_notify_email := v_assignment.mentor_email;
      ELSE
        v_notify_email := v_assignment.assigned_by;
      END IF;

      IF v_notify_email IS NOT NULL THEN
        INSERT INTO user_notifications (user_email, title, message, type, link_url)
        VALUES (
          v_notify_email,
          'Sign-Off Requested',
          format('%s needs sign-off on: %s', v_assignment.instructor_email, v_task.title),
          'warning',
          '/onboarding'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

-- Function: notify_task_assignment
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  RETURN NEW;
END;
$function$
;

-- Function: prevent_critical_delete
CREATE OR REPLACE FUNCTION public.prevent_critical_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Allow if admin override is set via: SET LOCAL app.allow_critical_delete = 'true';
  IF current_setting('app.allow_critical_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'DELETE on % is blocked. Use the admin deletion API with proper authorization. Table: %, Row ID: %',
    TG_TABLE_NAME, TG_TABLE_NAME, OLD.id;
END;
$function$
;

-- Function: prevent_mass_delete
CREATE OR REPLACE FUNCTION public.prevent_mass_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT count(*) INTO row_count FROM old_table;
  IF current_setting('app.allow_mass_delete', true) = 'true' THEN
    RETURN NULL;
  END IF;
  IF row_count > 5 THEN
    RAISE EXCEPTION 'Mass delete blocked: % rows would be deleted from %. Use admin override if intentional.', row_count, TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END;
$function$
;

-- Function: set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- Function: update_children_full_path
CREATE OR REPLACE FUNCTION public.update_children_full_path()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
    IF OLD.name IS DISTINCT FROM NEW.name OR OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
      WITH RECURSIVE descendants AS (
        SELECT id FROM locations WHERE parent_id = NEW.id
        UNION ALL
        SELECT l.id FROM locations l
        INNER JOIN descendants d ON l.parent_id = d.id
      )
      UPDATE locations SET full_path = compute_location_full_path(id)
      WHERE id IN (SELECT id FROM descendants);
    END IF;
    RETURN NEW;
  END;
  $function$
;

-- Function: update_clinical_hours_totals
CREATE OR REPLACE FUNCTION public.update_clinical_hours_totals()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.total_hours := COALESCE(NEW.psych_hours, 0) +
                     COALESCE(NEW.ed_hours, 0) +
                     COALESCE(NEW.icu_hours, 0) +
                     COALESCE(NEW.ob_hours, 0) +
                     COALESCE(NEW.or_hours, 0) +
                     COALESCE(NEW.peds_ed_hours, 0) +
                     COALESCE(NEW.peds_icu_hours, 0) +
                     COALESCE(NEW.ems_field_hours, 0) +
                     COALESCE(NEW.cardiology_hours, 0) +
                     COALESCE(NEW.ems_ridealong_hours, 0);
  NEW.total_shifts := COALESCE(NEW.psych_shifts, 0) +
                      COALESCE(NEW.ed_shifts, 0) +
                      COALESCE(NEW.icu_shifts, 0) +
                      COALESCE(NEW.ob_shifts, 0) +
                      COALESCE(NEW.or_shifts, 0) +
                      COALESCE(NEW.peds_ed_shifts, 0) +
                      COALESCE(NEW.peds_icu_shifts, 0) +
                      COALESCE(NEW.ems_field_shifts, 0) +
                      COALESCE(NEW.cardiology_shifts, 0) +
                      COALESCE(NEW.ems_ridealong_shifts, 0);
  RETURN NEW;
END;
$function$
;

-- Function: update_clinical_rotations_updated_at
CREATE OR REPLACE FUNCTION public.update_clinical_rotations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

-- Function: update_instructor_tasks_updated_at
CREATE OR REPLACE FUNCTION public.update_instructor_tasks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- Function: update_library_item_status
CREATE OR REPLACE FUNCTION public.update_library_item_status(p_item_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
  BEGIN
    UPDATE library_items
    SET status = p_status
    WHERE id = p_item_id;
  END;
  $function$
;

-- Function: update_scheduled_exports_updated_at
CREATE OR REPLACE FUNCTION public.update_scheduled_exports_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- Function: update_scheduling_updated_at
CREATE OR REPLACE FUNCTION public.update_scheduling_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- Function: update_skill_documents_updated_at
CREATE OR REPLACE FUNCTION public.update_skill_documents_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- Function: update_station_pool_timestamp
CREATE OR REPLACE FUNCTION public.update_station_pool_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- Function: update_student_preceptor_assignments_updated_at
CREATE OR REPLACE FUNCTION public.update_student_preceptor_assignments_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- Function: update_task_status_from_assignees
CREATE OR REPLACE FUNCTION public.update_task_status_from_assignees()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  task_mode TEXT;
  all_completed BOOLEAN;
  any_completed BOOLEAN;
BEGIN
  -- Get the completion mode
  SELECT completion_mode INTO task_mode
  FROM instructor_tasks
  WHERE id = NEW.task_id;

  -- For 'any' mode: task is completed when anyone completes
  IF task_mode = 'any' THEN
    SELECT EXISTS (
      SELECT 1 FROM task_assignees
      WHERE task_id = NEW.task_id AND status = 'completed'
    ) INTO any_completed;

    IF any_completed THEN
      UPDATE instructor_tasks
      SET status = 'completed', completed_at = NOW()
      WHERE id = NEW.task_id AND status != 'completed';
    END IF;

  -- For 'all' mode: task is completed when all assignees complete
  ELSIF task_mode = 'all' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM task_assignees
      WHERE task_id = NEW.task_id AND status NOT IN ('completed', 'cancelled')
    ) INTO all_completed;

    IF all_completed THEN
      UPDATE instructor_tasks
      SET status = 'completed', completed_at = NOW()
      WHERE id = NEW.task_id AND status != 'completed';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

-- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- ===================
-- Triggers
-- ===================
DO $$ BEGIN
  CREATE TRIGGER "access_cards_updated_at" BEFORE UPDATE ON "access_cards" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "access_devices_updated_at" BEFORE UPDATE ON "access_devices" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "access_doors_updated_at" BEFORE UPDATE ON "access_doors" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "access_rules_updated_at" BEFORE UPDATE ON "access_rules" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "access_schedules_updated_at" BEFORE UPDATE ON "access_schedules" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "task_assignment_notification" AFTER INSERT ON "assigned_tasks" FOR EACH ROW EXECUTE FUNCTION notify_task_assignment();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "trg_clinical_rotations_updated_at" BEFORE UPDATE ON "clinical_rotations" FOR EACH ROW EXECUTE FUNCTION update_clinical_rotations_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_closeout_documents" BEFORE DELETE ON "closeout_documents" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_closeout_surveys" BEFORE DELETE ON "closeout_surveys" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_cohorts" BEFORE DELETE ON "cohorts" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_cohorts" AFTER DELETE ON "cohorts" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "update_custody_checkouts_updated_at" BEFORE UPDATE ON "custody_checkouts" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "update_filament_types_updated_at" BEFORE UPDATE ON "filament_types" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "instructor_availability_updated_at" BEFORE UPDATE ON "instructor_availability" FOR EACH ROW EXECUTE FUNCTION update_scheduling_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "instructor_tasks_updated_at" BEFORE UPDATE ON "instructor_tasks" FOR EACH ROW EXECUTE FUNCTION update_instructor_tasks_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "update_inventory_bin_contents_updated_at" BEFORE UPDATE ON "inventory_bin_contents" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "bin_before_change_trigger" BEFORE UPDATE OR INSERT ON "inventory_bins" FOR EACH ROW EXECUTE FUNCTION bin_before_change();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "update_inventory_bins_updated_at" BEFORE UPDATE ON "inventory_bins" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "update_inventory_locations_updated_at" BEFORE UPDATE ON "inventory_locations" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_lab_group_members" BEFORE DELETE ON "lab_group_members" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_lab_group_members" AFTER DELETE ON "lab_group_members" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_lab_groups" BEFORE DELETE ON "lab_groups" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_lab_groups" AFTER DELETE ON "lab_groups" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "location_after_insert_trigger" AFTER INSERT ON "locations" FOR EACH ROW EXECUTE FUNCTION location_after_insert();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "location_before_change_trigger" BEFORE UPDATE OR INSERT ON "locations" FOR EACH ROW EXECUTE FUNCTION location_before_change();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "update_children_full_path_trigger" AFTER UPDATE ON "locations" FOR EACH ROW EXECUTE FUNCTION update_children_full_path();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "set_updated_at_assignments" BEFORE UPDATE ON "onboarding_assignments" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "trigger_create_task_progress" AFTER INSERT ON "onboarding_assignments" FOR EACH ROW EXECUTE FUNCTION create_task_progress_for_assignment();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "trigger_log_assignment_completion" BEFORE UPDATE ON "onboarding_assignments" FOR EACH ROW EXECUTE FUNCTION log_assignment_completion();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "set_updated_at_progress" BEFORE UPDATE ON "onboarding_task_progress" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "trigger_check_completion" AFTER UPDATE ON "onboarding_task_progress" FOR EACH ROW EXECUTE FUNCTION check_assignment_completion();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "trigger_log_task_events" BEFORE UPDATE ON "onboarding_task_progress" FOR EACH ROW EXECUTE FUNCTION log_task_progress_event();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "trigger_notify_sign_off" AFTER UPDATE ON "onboarding_task_progress" FOR EACH ROW EXECUTE FUNCTION notify_sign_off_needed();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "set_updated_at_templates" BEFORE UPDATE ON "onboarding_templates" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "open_shifts_updated_at" BEFORE UPDATE ON "open_shifts" FOR EACH ROW EXECUTE FUNCTION update_scheduling_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "update_print_request_materials_updated_at" BEFORE UPDATE ON "print_request_materials" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "update_print_requests_updated_at" BEFORE UPDATE ON "print_requests" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "update_printers_updated_at" BEFORE UPDATE ON "printers" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_programs" AFTER DELETE ON "programs" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_scenario_assessments" BEFORE DELETE ON "scenario_assessments" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_scenario_assessments" AFTER DELETE ON "scenario_assessments" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "trg_scheduled_exports_updated_at" BEFORE UPDATE ON "scheduled_exports" FOR EACH ROW EXECUTE FUNCTION update_scheduled_exports_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "shift_signups_updated_at" BEFORE UPDATE ON "shift_signups" FOR EACH ROW EXECUTE FUNCTION update_scheduling_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_skill_assessments" BEFORE DELETE ON "skill_assessments" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_skill_assessments" AFTER DELETE ON "skill_assessments" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "trigger_skill_documents_updated_at" BEFORE UPDATE ON "skill_documents" FOR EACH ROW EXECUTE FUNCTION update_skill_documents_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_station_completions" BEFORE DELETE ON "station_completions" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_station_completions" AFTER DELETE ON "station_completions" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "station_pool_updated_at" BEFORE UPDATE ON "station_pool" FOR EACH ROW EXECUTE FUNCTION update_station_pool_timestamp();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_student_clinical_hours" BEFORE DELETE ON "student_clinical_hours" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_student_clinical_hours" AFTER DELETE ON "student_clinical_hours" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_student_group_assignments" BEFORE DELETE ON "student_group_assignments" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_student_group_assignments" AFTER DELETE ON "student_group_assignments" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_student_groups" BEFORE DELETE ON "student_groups" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_student_groups" AFTER DELETE ON "student_groups" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_student_internships" BEFORE DELETE ON "student_internships" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_student_internships" AFTER DELETE ON "student_internships" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "student_preceptor_assignments_updated_at" BEFORE UPDATE ON "student_preceptor_assignments" FOR EACH ROW EXECUTE FUNCTION update_student_preceptor_assignments_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_student_skill_evaluations" BEFORE DELETE ON "student_skill_evaluations" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_student_skill_evaluations" AFTER DELETE ON "student_skill_evaluations" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_students" BEFORE DELETE ON "students" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_mass_delete_students" AFTER DELETE ON "students" FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_summative_evaluation_scores" BEFORE DELETE ON "summative_evaluation_scores" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "prevent_delete_summative_evaluations" BEFORE DELETE ON "summative_evaluations" FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "task_assignees_status_update" AFTER UPDATE ON "task_assignees" FOR EACH ROW EXECUTE FUNCTION update_task_status_from_assignees();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

