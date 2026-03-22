-- Multi-preceptor assignment tracking
-- Supports primary, secondary, tertiary preceptors per student internship
-- Preserves assignment history (soft-delete with end_date)

CREATE TABLE IF NOT EXISTS student_preceptor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id UUID NOT NULL REFERENCES student_internships(id) ON DELETE CASCADE,
  preceptor_id UUID NOT NULL REFERENCES field_preceptors(id),
  role TEXT NOT NULL DEFAULT 'primary', -- 'primary', 'secondary', 'tertiary'
  assigned_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  assigned_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(internship_id, preceptor_id, role)
);

CREATE INDEX IF NOT EXISTS idx_preceptor_assignments_internship ON student_preceptor_assignments(internship_id);
CREATE INDEX IF NOT EXISTS idx_preceptor_assignments_preceptor ON student_preceptor_assignments(preceptor_id);

ALTER TABLE student_preceptor_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see preceptor assignments" ON student_preceptor_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert preceptor assignments" ON student_preceptor_assignments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users update preceptor assignments" ON student_preceptor_assignments
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users delete preceptor assignments" ON student_preceptor_assignments
  FOR DELETE TO authenticated USING (true);

-- Migrate existing preceptor_id data to the new table
INSERT INTO student_preceptor_assignments (internship_id, preceptor_id, role, assigned_date)
SELECT id, preceptor_id, 'primary', COALESCE(placement_date, created_at::date)
FROM student_internships
WHERE preceptor_id IS NOT NULL
ON CONFLICT DO NOTHING;
