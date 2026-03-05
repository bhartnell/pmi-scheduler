-- Template Review System
-- Provides a structured workflow for reviewing and reconciling
-- actual lab day configurations against source templates at semester end.

-- ─── template_reviews ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS template_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  semester TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'completed', 'archived')),
  created_by TEXT NOT NULL,
  reviewers TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_template_reviews_cohort_id ON template_reviews(cohort_id);
CREATE INDEX IF NOT EXISTS idx_template_reviews_status ON template_reviews(status);
CREATE INDEX IF NOT EXISTS idx_template_reviews_created_by ON template_reviews(created_by);

-- ─── template_review_items ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS template_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES template_reviews(id) ON DELETE CASCADE,
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  template_id UUID,
  disposition TEXT NOT NULL DEFAULT 'pending' CHECK (disposition IN ('pending', 'accept_changes', 'keep_original', 'revised')),
  revised_data JSONB,
  reviewer_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_template_review_items_review_id ON template_review_items(review_id);
CREATE INDEX IF NOT EXISTS idx_template_review_items_lab_day_id ON template_review_items(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_template_review_items_disposition ON template_review_items(disposition);

-- ─── template_review_comments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS template_review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_item_id UUID NOT NULL REFERENCES template_review_items(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_review_comments_review_item_id ON template_review_comments(review_item_id);

-- ─── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE template_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_review_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_reviews' AND policyname = 'template_reviews_select') THEN
    CREATE POLICY template_reviews_select ON template_reviews FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_reviews' AND policyname = 'template_reviews_insert') THEN
    CREATE POLICY template_reviews_insert ON template_reviews FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_reviews' AND policyname = 'template_reviews_update') THEN
    CREATE POLICY template_reviews_update ON template_reviews FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_reviews' AND policyname = 'template_reviews_delete') THEN
    CREATE POLICY template_reviews_delete ON template_reviews FOR DELETE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_review_items' AND policyname = 'template_review_items_select') THEN
    CREATE POLICY template_review_items_select ON template_review_items FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_review_items' AND policyname = 'template_review_items_insert') THEN
    CREATE POLICY template_review_items_insert ON template_review_items FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_review_items' AND policyname = 'template_review_items_update') THEN
    CREATE POLICY template_review_items_update ON template_review_items FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_review_items' AND policyname = 'template_review_items_delete') THEN
    CREATE POLICY template_review_items_delete ON template_review_items FOR DELETE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_review_comments' AND policyname = 'template_review_comments_select') THEN
    CREATE POLICY template_review_comments_select ON template_review_comments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_review_comments' AND policyname = 'template_review_comments_insert') THEN
    CREATE POLICY template_review_comments_insert ON template_review_comments FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_review_comments' AND policyname = 'template_review_comments_update') THEN
    CREATE POLICY template_review_comments_update ON template_review_comments FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_review_comments' AND policyname = 'template_review_comments_delete') THEN
    CREATE POLICY template_review_comments_delete ON template_review_comments FOR DELETE USING (true);
  END IF;
END $$;
