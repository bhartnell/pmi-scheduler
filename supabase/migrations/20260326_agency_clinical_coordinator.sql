-- Add clinical coordinator contact fields to agencies table
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS clinical_coordinator_name TEXT,
ADD COLUMN IF NOT EXISTS clinical_coordinator_email TEXT;
