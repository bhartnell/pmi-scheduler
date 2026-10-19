-- module_flags: lets a whole module (route prefix) be "parked" without deleting anything.
-- key = route prefix, e.g. '/attendance'. Parked routes render a plain parked page; data untouched.
CREATE TABLE IF NOT EXISTS module_flags (
  key        text PRIMARY KEY,
  enabled    boolean NOT NULL DEFAULT true,
  parked_at  timestamptz,
  note       text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE module_flags ENABLE ROW LEVEL SECURITY;

-- Service role (API routes) bypasses RLS; no anon/authenticated policies on purpose.
CREATE INDEX IF NOT EXISTS idx_module_flags_enabled ON module_flags (enabled) WHERE enabled = false;

-- ROLLBACK:
-- DROP TABLE IF EXISTS module_flags;  -- only holds park toggles; no business data
