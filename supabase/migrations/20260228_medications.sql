-- 3. Medications
CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  generic_name TEXT,
  drug_class TEXT,
  indications TEXT,
  contraindications TEXT,
  side_effects TEXT,
  dosing JSONB DEFAULT '{}',
  routes TEXT[],
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_medications_name ON medications(name);
CREATE INDEX IF NOT EXISTS idx_medications_class ON medications(drug_class);
NOTIFY pgrst, 'reload schema';
