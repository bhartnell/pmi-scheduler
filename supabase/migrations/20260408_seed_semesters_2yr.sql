-- Pre-populate standard semesters through Fall 2027
-- Uses ON CONFLICT DO NOTHING since pmi_semesters has a unique constraint on name

INSERT INTO pmi_semesters (name, start_date, end_date, is_active) VALUES
  ('Spring 2026', '2026-01-01', '2026-04-30', true),
  ('Summer 2026', '2026-05-01', '2026-08-31', true),
  ('Fall 2026',   '2026-08-01', '2026-12-31', true),
  ('Spring 2027', '2027-01-01', '2027-04-30', true),
  ('Summer 2027', '2027-05-01', '2027-08-31', true),
  ('Fall 2027',   '2027-08-01', '2027-12-31', true)
ON CONFLICT (name) DO UPDATE SET
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  is_active = true;
