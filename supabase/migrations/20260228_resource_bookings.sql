CREATE TABLE IF NOT EXISTS bookable_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('room', 'equipment', 'sim_lab', 'other')),
  description TEXT,
  location TEXT,
  capacity INTEGER,
  is_active BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES bookable_resources(id) ON DELETE CASCADE,
  booked_by TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  notes TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_bookings_resource ON resource_bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_time ON resource_bookings(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_status ON resource_bookings(status);

NOTIFY pgrst, 'reload schema';
