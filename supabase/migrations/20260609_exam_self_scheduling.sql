-- Exam Self-Scheduling (final summative WRITTEN exam) — Phase A schema.
--
-- Net-new, additive pair of tables per SPEC_exam_self_scheduling_BUILD.md.
-- Nothing existing is modified: the written exam's completion flags stay on
-- student_internships (written_exam_passed / written_exam_date) and are only
-- written back by the narrow result endpoint. OSCE / summative (psychomotor)
-- structures are untouched.
--
-- Seat model (derived, never stored):
--   total_used = count(confirmed signups)
--   pima_used  = count(confirmed signups where uses_own_computer = false)
-- A trigger enforces capacity at the moment a signup becomes 'confirmed'
-- (insert or approval), using an advisory lock per session so two
-- simultaneous signups can't oversell the last seat. Pending signups do NOT
-- consume seats; approval re-checks capacity (trigger fires on the
-- pending→confirmed transition too).

-- ── exam_sessions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                  date NOT NULL,
  start_time            time NOT NULL,
  end_time              time NOT NULL,
  total_spots           integer NOT NULL,
  pima_computers        integer NOT NULL DEFAULT 4,
  primary_instructor_id uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  created_by            uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  status                text NOT NULL DEFAULT 'open',
  notes                 text,
  -- shared-calendar mapping (main calendar event; proctor is the attendee)
  google_event_id       text,
  google_event_link     text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_sessions_status_check') THEN
    ALTER TABLE exam_sessions
      ADD CONSTRAINT exam_sessions_status_check CHECK (status IN ('open', 'closed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_sessions_spots_check') THEN
    ALTER TABLE exam_sessions
      ADD CONSTRAINT exam_sessions_spots_check
      CHECK (total_spots > 0 AND pima_computers >= 0 AND pima_computers <= total_spots);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_sessions_date ON exam_sessions (date);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions (status);

-- ── exam_signups ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_signups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id        uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_email     text NOT NULL,
  uses_own_computer boolean NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  decided_by        uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  decided_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_signups_status_check') THEN
    ALTER TABLE exam_signups
      ADD CONSTRAINT exam_signups_status_check CHECK (status IN ('pending', 'confirmed', 'denied'));
  END IF;
END $$;

-- "One slot per student": at most one ACTIVE (pending or confirmed) signup
-- at a time. Denied rows are kept for audit and do not block a re-signup.
CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_signups_one_active_per_student
  ON exam_signups (student_id)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_exam_signups_session ON exam_signups (session_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_signups_student ON exam_signups (student_id);

-- ── capacity guard ─────────────────────────────────────────────────
-- Fires whenever a row IS or BECOMES 'confirmed' (insert confirmed,
-- pending→confirmed approval, or a confirmed row moving to a new session,
-- i.e. a reschedule). Advisory xact lock serializes per-session so the
-- count-then-commit window can't oversell the final seat.
CREATE OR REPLACE FUNCTION exam_signups_enforce_capacity()
RETURNS trigger AS $$
DECLARE
  v_total_spots integer;
  v_pima        integer;
  v_status      text;
  v_total_used  integer;
  v_pima_used   integer;
BEGIN
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' AND OLD.session_id = NEW.session_id
     AND OLD.uses_own_computer = NEW.uses_own_computer THEN
    RETURN NEW; -- no seat-relevant change
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.session_id::text));

  SELECT total_spots, pima_computers, status
    INTO v_total_spots, v_pima, v_status
    FROM exam_sessions WHERE id = NEW.session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'exam session not found';
  END IF;

  SELECT count(*) FILTER (WHERE true),
         count(*) FILTER (WHERE uses_own_computer = false)
    INTO v_total_used, v_pima_used
    FROM exam_signups
   WHERE session_id = NEW.session_id
     AND status = 'confirmed'
     AND id <> NEW.id;

  IF v_total_used >= v_total_spots THEN
    RAISE EXCEPTION 'exam session is full (% of % seats taken)', v_total_used, v_total_spots
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.uses_own_computer = false AND v_pima_used >= v_pima THEN
    RAISE EXCEPTION 'no Pima computers left for this session (% of % in use)', v_pima_used, v_pima
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exam_signups_capacity ON exam_signups;
CREATE TRIGGER trg_exam_signups_capacity
  BEFORE INSERT OR UPDATE ON exam_signups
  FOR EACH ROW EXECUTE FUNCTION exam_signups_enforce_capacity();

-- ── RLS (per project convention; API routes use the admin client) ──
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_signups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exam_sessions' AND policyname = 'Authenticated can read exam sessions') THEN
    CREATE POLICY "Authenticated can read exam sessions"
      ON exam_sessions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exam_signups' AND policyname = 'Authenticated can read exam signups') THEN
    CREATE POLICY "Authenticated can read exam signups"
      ON exam_signups FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

COMMENT ON TABLE exam_sessions IS
  'Final summative WRITTEN exam sessions, admin-built. Seats derived from confirmed exam_signups; pima_computers = Lockdown-capable Pima machines. Proctor = primary_instructor_id.';
COMMENT ON TABLE exam_signups IS
  'Student self-scheduled signups for exam_sessions. uses_own_computer=false consumes a Pima-computer seat AND a total seat. Partial unique index = one active slot per student. Capacity enforced by trg_exam_signups_capacity.';
