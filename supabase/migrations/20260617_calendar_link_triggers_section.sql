-- Section-aware rewrite of the calendar↔lab link triggers (Stage 1a spot #1).
--
-- The original functions (20260429_calendar_link_triggers.sql) matched a
-- schedule block to a lab_day on (cohort_id, date) ONLY. With multiple lab
-- sections per (cohort, date) that would link the FIRST/ambiguous row and copy
-- one block's times onto every section. These rewrites key the match on the
-- section as well:
--   * a lab_day matches a block when lab_days.section_number =
--     COALESCE(block.linked_section_number, 1)
--   * NULL linked_section_number behaves as section 1 — identical to the old
--     behavior for every existing (single-section) row, so nothing changes for
--     current data (incl. the live G14 ACLS day).
-- A deterministic ORDER BY + LIMIT 1 is added as a safety net so an unexpected
-- duplicate can never fan a time-copy across rows.
--
-- CREATE OR REPLACE keeps the existing triggers attached; no trigger re-create.

-- ── Function 1: link block to lab_day on lab_day INSERT ───────────
CREATE OR REPLACE FUNCTION pmi_link_block_on_lab_day_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_block_id uuid;
  v_start time;
  v_end   time;
BEGIN
  -- Find ONE published lab-type block for this (cohort, date) whose target
  -- section matches the new lab_day's section (block NULL = section 1).
  SELECT psb.id, psb.start_time, psb.end_time
    INTO v_block_id, v_start, v_end
  FROM pmi_schedule_blocks psb
  JOIN pmi_program_schedules pps ON psb.program_schedule_id = pps.id
  WHERE pps.cohort_id = NEW.cohort_id
    AND psb.date = NEW.date
    AND psb.block_type = 'lab'
    AND psb.status = 'published'
    AND COALESCE(psb.linked_section_number, 1) = NEW.section_number
  ORDER BY (psb.linked_lab_day_id IS NULL) DESC, psb.start_time NULLS LAST, psb.id
  LIMIT 1;

  IF v_block_id IS NOT NULL THEN
    -- Stamp the FK on the matched block if it isn't set yet.
    UPDATE pmi_schedule_blocks
    SET linked_lab_day_id = NEW.id, updated_at = now()
    WHERE id = v_block_id AND linked_lab_day_id IS NULL;

    -- Copy the block's times onto the new lab_day if it has none yet.
    IF NEW.start_time IS NULL AND v_start IS NOT NULL THEN
      UPDATE lab_days
      SET start_time = v_start, end_time = v_end
      WHERE id = NEW.id AND start_time IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Function 2: link + copy times on schedule-block publish ───────
CREATE OR REPLACE FUNCTION pmi_link_lab_day_on_block_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lab_day_id uuid;
  v_needs_time boolean;
BEGIN
  IF NEW.block_type <> 'lab' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'published' THEN
    RETURN NEW;
  END IF;

  -- Find the matching lab_day for (cohort, date, section). The block's target
  -- section is COALESCE(linked_section_number, 1).
  SELECT ld.id, (ld.start_time IS NULL)
    INTO v_lab_day_id, v_needs_time
  FROM lab_days ld
  JOIN pmi_program_schedules pps ON pps.id = NEW.program_schedule_id
  WHERE ld.cohort_id = pps.cohort_id
    AND ld.date = NEW.date
    AND ld.section_number = COALESCE(NEW.linked_section_number, 1)
  ORDER BY ld.section_number, ld.id
  LIMIT 1;

  IF v_lab_day_id IS NOT NULL THEN
    -- Stamp the FK on the just-published block (idempotent NULL-only).
    UPDATE pmi_schedule_blocks
    SET linked_lab_day_id = v_lab_day_id, updated_at = now()
    WHERE id = NEW.id AND linked_lab_day_id IS NULL;

    -- Copy this block's times onto the lab_day if it has none yet.
    IF v_needs_time AND NEW.start_time IS NOT NULL THEN
      UPDATE lab_days
      SET start_time = NEW.start_time, end_time = NEW.end_time
      WHERE id = v_lab_day_id AND start_time IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION pmi_link_block_on_lab_day_insert() IS
  'Section-aware (Stage 2): on lab_day INSERT, link a published lab block for the same (cohort, date) AND section (block linked_section_number NULL = section 1); copy times. Deterministic LIMIT 1. Manual links/times win via NULL guards.';
COMMENT ON FUNCTION pmi_link_lab_day_on_block_publish() IS
  'Section-aware (Stage 2): on block draft→published, link the lab_day for (cohort, date, section=COALESCE(linked_section_number,1)); copy times. Deterministic LIMIT 1. Drafts isolated until publish.';
