-- Task 90: Case Study Bulk Generation Pipeline
-- Tables for case briefs catalog and AI prompt template management

-- ============================================================================
-- Case Briefs Catalog
-- ============================================================================
CREATE TABLE IF NOT EXISTS case_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  programs TEXT[] NOT NULL,
  scenario TEXT NOT NULL,
  special_instructions TEXT,
  batch_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'generated', 'failed', 'skipped')),
  generated_case_id UUID REFERENCES case_studies(id),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_briefs_status ON case_briefs(status);
CREATE INDEX IF NOT EXISTS idx_case_briefs_category ON case_briefs(category);
CREATE INDEX IF NOT EXISTS idx_case_briefs_batch ON case_briefs(batch_name);

ALTER TABLE case_briefs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'case_briefs' AND policyname = 'case_briefs_service_role'
  ) THEN
    CREATE POLICY case_briefs_service_role ON case_briefs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- AI Prompt Templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on name+version to allow version history
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_prompt_templates_name_version ON ai_prompt_templates(name, version);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_active ON ai_prompt_templates(is_active) WHERE is_active = true;

ALTER TABLE ai_prompt_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_prompt_templates' AND policyname = 'ai_prompt_templates_service_role'
  ) THEN
    CREATE POLICY ai_prompt_templates_service_role ON ai_prompt_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- Add AI generation tracking columns to case_studies if missing
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'case_studies' AND column_name = 'generated_by_ai') THEN
    ALTER TABLE case_studies ADD COLUMN generated_by_ai BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'case_studies' AND column_name = 'content_review_status') THEN
    ALTER TABLE case_studies ADD COLUMN content_review_status TEXT DEFAULT 'not_applicable' CHECK (content_review_status IN ('not_applicable', 'pending_review', 'approved', 'changes_requested', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'case_studies' AND column_name = 'generation_prompt') THEN
    ALTER TABLE case_studies ADD COLUMN generation_prompt JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'case_studies' AND column_name = 'generation_brief_id') THEN
    ALTER TABLE case_studies ADD COLUMN generation_brief_id UUID REFERENCES case_briefs(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_case_studies_review_status ON case_studies(content_review_status) WHERE content_review_status != 'not_applicable';
CREATE INDEX IF NOT EXISTS idx_case_studies_generated ON case_studies(generated_by_ai) WHERE generated_by_ai = true;
