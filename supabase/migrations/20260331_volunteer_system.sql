-- Volunteer events (NREMT day, specific lab days, etc.)
CREATE TABLE IF NOT EXISTS volunteer_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('nremt_testing', 'lab_day', 'other')),
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  description TEXT,
  max_volunteers INTEGER,
  linked_lab_day_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invite campaigns
CREATE TABLE IF NOT EXISTS volunteer_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_type TEXT CHECK (invite_type IN ('instructor1', 'general')),
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  event_ids UUID[],
  message TEXT,
  deadline TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Volunteer registrations
CREATE TABLE IF NOT EXISTS volunteer_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES volunteer_events(id) ON DELETE CASCADE,
  invite_id UUID REFERENCES volunteer_invites(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  volunteer_type TEXT CHECK (volunteer_type IN ('instructor1', 'general', 'former_student', 'community')),
  agency_affiliation TEXT,
  needs_evaluation BOOLEAN DEFAULT false,
  evaluation_skill TEXT,
  evaluation_status TEXT DEFAULT 'not_applicable' CHECK (evaluation_status IN ('pending', 'scheduled', 'completed', 'not_applicable')),
  evaluation_id UUID,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'attended', 'no_show', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_volunteer_events_date ON volunteer_events(date);
CREATE INDEX IF NOT EXISTS idx_volunteer_registrations_event ON volunteer_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_registrations_email ON volunteer_registrations(email);
CREATE INDEX IF NOT EXISTS idx_volunteer_invites_token ON volunteer_invites(token);

-- RLS
ALTER TABLE volunteer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON volunteer_events FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON volunteer_invites FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON volunteer_registrations FOR ALL USING (true);
