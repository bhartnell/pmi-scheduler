-- Add is_pmi_contract and notification_dismissed columns to clinical_affiliations
ALTER TABLE clinical_affiliations
  ADD COLUMN IF NOT EXISTS is_pmi_contract BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_dismissed BOOLEAN DEFAULT false;
