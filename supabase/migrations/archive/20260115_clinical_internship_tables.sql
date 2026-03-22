-- ============================================
-- CLINICAL & INTERNSHIP CORNER TABLES
-- Migration: 20260115_clinical_internship_tables.sql
-- ============================================

-- Agencies (EMS and Clinical Sites)
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abbreviation TEXT,
  type TEXT NOT NULL, -- 'ems', 'hospital'
  address TEXT,
  phone TEXT,
  website TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agency Contacts
CREATE TABLE agency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  department TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Field Preceptors (FTOs)
CREATE TABLE field_preceptors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  agency_id UUID REFERENCES agencies(id),
  agency_name TEXT, -- Denormalized for easy display
  station TEXT, -- "Station 4", "Primary", "367"
  normal_schedule TEXT, -- "Tues/Fri 0600-1800"
  snhd_trained_date DATE,
  snhd_cert_expires DATE,
  max_students INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student Internship Tracking
CREATE TABLE student_internships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES cohorts(id),

  -- Assignment
  preceptor_id UUID REFERENCES field_preceptors(id),
  agency_id UUID REFERENCES agencies(id),
  agency_name TEXT, -- Denormalized
  shift_type TEXT DEFAULT '12_hour', -- '12_hour', '24_hour', '48_hour'

  -- Key Dates
  placement_date DATE, -- When assigned to agency
  orientation_date DATE,
  internship_start_date DATE, -- First shift
  expected_end_date DATE,
  actual_end_date DATE,

  -- Phase Tracking
  current_phase TEXT DEFAULT 'pre_internship',
  -- 'pre_internship', 'phase_1_mentorship', 'phase_2_evaluation', 'completed', 'extended'

  -- Phase 1
  phase_1_start_date DATE,
  phase_1_end_date DATE,
  phase_1_eval_scheduled DATE,
  phase_1_eval_completed BOOLEAN DEFAULT false,
  phase_1_eval_notes TEXT,

  -- Phase 2
  phase_2_start_date DATE,
  phase_2_end_date DATE,
  phase_2_eval_scheduled DATE,
  phase_2_eval_completed BOOLEAN DEFAULT false,
  phase_2_eval_notes TEXT,

  -- Closeout
  closeout_meeting_date DATE,
  closeout_completed BOOLEAN DEFAULT false,

  -- Status
  status TEXT DEFAULT 'not_started',
  -- 'not_started', 'in_progress', 'on_track', 'at_risk', 'extended', 'completed', 'withdrawn'

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Internship Meetings
CREATE TABLE internship_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_internship_id UUID REFERENCES student_internships(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id),

  meeting_type TEXT NOT NULL,
  -- 'pre_internship', 'weekly_checkin', 'phase_1_eval', 'phase_2_eval', 'closeout', 'counseling', 'pip', 'other'

  scheduled_date DATE,
  scheduled_time TIME,
  location TEXT, -- 'Campus', 'Agency', 'Virtual'

  attendees TEXT[], -- ['Student', 'Preceptor', 'Agency Rep', 'Clinical Director']

  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'rescheduled'
  completed_at TIMESTAMPTZ,

  notes TEXT,
  action_items TEXT[],
  follow_up_needed BOOLEAN DEFAULT false,
  follow_up_date DATE,

  created_by UUID REFERENCES lab_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Field Ride Requests (Public submission like scheduler)
CREATE TABLE field_ride_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Student Info (not linked to students table - public form)
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  student_cohort TEXT, -- Free text from form

  -- Request Details
  agency TEXT NOT NULL,
  date_requested DATE NOT NULL,
  start_time TEXT, -- "0600", "1800"
  duration TEXT, -- "12 hours", "24 hours"
  unit_requested TEXT, -- "367", "Station 10"
  hours_category TEXT NOT NULL, -- 'emergency_room', 'electives'

  -- Processing
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'denied', 'completed'
  reviewed_by UUID REFERENCES lab_users(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,

  -- Tracking
  public_link_id TEXT, -- Which link they came from (for cohort-specific links)
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_preceptors_agency ON field_preceptors(agency_id);
CREATE INDEX idx_preceptors_active ON field_preceptors(is_active);
CREATE INDEX idx_internships_student ON student_internships(student_id);
CREATE INDEX idx_internships_cohort ON student_internships(cohort_id);
CREATE INDEX idx_internships_status ON student_internships(status);
CREATE INDEX idx_meetings_student ON internship_meetings(student_id);
CREATE INDEX idx_meetings_scheduled ON internship_meetings(scheduled_date);
CREATE INDEX idx_ride_requests_status ON field_ride_requests(status);
CREATE INDEX idx_ride_requests_date ON field_ride_requests(date_requested);

-- Enable RLS
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_preceptors ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE internship_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_ride_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies (authenticated users can view, service role can manage)
CREATE POLICY "Authenticated can view agencies" ON agencies FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role manages agencies" ON agencies FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated can view contacts" ON agency_contacts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role manages contacts" ON agency_contacts FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated can view preceptors" ON field_preceptors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role manages preceptors" ON field_preceptors FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated can view internships" ON student_internships FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role manages internships" ON student_internships FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated can view meetings" ON internship_meetings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role manages meetings" ON internship_meetings FOR ALL USING (auth.role() = 'service_role');

-- Ride requests: anyone can insert (public form), authenticated can view
CREATE POLICY "Anyone can submit ride requests" ON field_ride_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can view ride requests" ON field_ride_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role manages ride requests" ON field_ride_requests FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SEED DATA: Agencies
-- ============================================

INSERT INTO agencies (name, abbreviation, type, is_active) VALUES
  ('AMR Las Vegas', 'AMR', 'ems', true),
  ('Community Ambulance', 'CA', 'ems', true),
  ('MedicWest Ambulance', 'MedicWest', 'ems', true),
  ('Las Vegas Fire & Rescue', 'LVFR', 'ems', true),
  ('Henderson Fire Department', 'HFD', 'ems', true),
  ('North Las Vegas Fire', 'NLVF', 'ems', true),
  ('Spring Valley Hospital', 'SVH', 'hospital', true),
  ('Desert Hills Hospital', 'DHH', 'hospital', true),
  ('Centennial Hills Hospital', 'CHH', 'hospital', true),
  ('Valley Hospital', 'Valley', 'hospital', true),
  ('Summerlin Hospital', 'Summerlin', 'hospital', true),
  ('Southern Hills Hospital', 'SHH', 'hospital', true),
  ('Sunrise Hospital', 'Sunrise', 'hospital', true),
  ('UMC', 'UMC', 'hospital', true),
  ('St. Rose Dominican - Siena', 'St. Rose Siena', 'hospital', true),
  ('St. Rose Dominican - San Martin', 'St. Rose SM', 'hospital', true),
  ('St. Rose Dominican - Rose de Lima', 'St. Rose RDL', 'hospital', true),
  ('Mountain View Hospital', 'MVH', 'hospital', true),
  ('Boulder City Hospital', 'BCH', 'hospital', true);
