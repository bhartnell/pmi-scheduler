INSERT INTO pmi_semesters (name, start_date, end_date, is_active) VALUES
  ('Spring 2026', '2026-01-12', '2026-05-01', true),
  ('Summer 2026', '2026-05-11', '2026-08-14', false),
  ('Fall 2026', '2026-08-24', '2026-12-11', false)
ON CONFLICT DO NOTHING;
