-- Add NREMT testing day flag to lab_days
ALTER TABLE lab_days ADD COLUMN IF NOT EXISTS is_nremt_testing BOOLEAN DEFAULT false;

-- Mark the specific lab day as NREMT testing
UPDATE lab_days SET is_nremt_testing = true WHERE id = 'a74f07a9-653e-4da9-b185-040cd7b12a3d';
