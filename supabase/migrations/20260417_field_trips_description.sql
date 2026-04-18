-- Add dedicated description column to field_trips.
--
-- Backstory: the client form uses {name, location, description} but the
-- table was created with {title, destination, notes}. Commit d765915f
-- (2026-04-17) fixed the 500 by mapping description → notes in the API.
-- That worked but muddied the semantics — `notes` is now doing double
-- duty as both a trip description and ad-hoc internal notes.
--
-- This migration adds a proper description column so the two fields can
-- be separated cleanly. The API will start persisting description to
-- `description` while keeping `notes` available for free-form notes.

ALTER TABLE field_trips
  ADD COLUMN IF NOT EXISTS description text;

-- Backfill: copy existing notes into description so no data is lost.
-- Only backfill when description is NULL and notes is not — preserves
-- any newer description values that might already exist.
UPDATE field_trips
SET description = notes
WHERE description IS NULL AND notes IS NOT NULL;
