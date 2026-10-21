-- OSCE over-subscription: soft cap with standby (card 3ea5cd1c).
-- Additive and idempotent. Existing signups all default to 'confirmed' (nothing changes for them).
ALTER TABLE public.osce_observer_blocks
  ADD COLUMN IF NOT EXISTS capacity_status text NOT NULL DEFAULT 'confirmed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'osce_observer_blocks_capacity_status_check'
  ) THEN
    ALTER TABLE public.osce_observer_blocks
      ADD CONSTRAINT osce_observer_blocks_capacity_status_check
      CHECK (capacity_status IN ('confirmed', 'standby'));
  END IF;
END $$;

-- ROLLBACK:
-- ALTER TABLE public.osce_observer_blocks DROP CONSTRAINT IF EXISTS osce_observer_blocks_capacity_status_check;
-- ALTER TABLE public.osce_observer_blocks DROP COLUMN IF EXISTS capacity_status;
-- (standby rows would lose their marker; they would all read as confirmed.)
