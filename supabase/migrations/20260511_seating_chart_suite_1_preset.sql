-- Suite 1 seating chart preset.
--
-- Adds a "Suite 1" classroom record alongside the existing "Main
-- Classroom" so coordinators can pick which room a chart is for when
-- creating it. The layout_config carries a `preset` discriminator the
-- builder uses to choose its rendering branch — Main Classroom keeps
-- the 4×2 table layout, Suite 1 renders a left/right split with
-- variable seat counts per row per side.
--
-- Suite 1 layout (30 individual seats, two sections + aisle):
--   Row 5: [_][_]   |   (no right)
--   Row 4: [_][_]   |   [_][_][_][_]
--   Row 3: [_][_]   |   [_][_][_][_]
--   Row 2: [_][_][_][_] | [_][_][_][_]
--   Row 1: [_][_][_][_] | [_][_][_][_]
--           FRONT (instructor)
--
-- Idempotent — guards against re-inserting on re-run.

INSERT INTO classrooms (
  name,
  description,
  rows,
  tables_per_row,
  seats_per_table,
  layout_config,
  is_active
)
SELECT
  'Suite 1',
  'Suite 1 lecture room — 30 individual seats. Left section: front 2 rows of 4, back 3 rows of 2. Right section: 4 rows of 4. Aisle between sections.',
  5,
  2,
  4,
  jsonb_build_object(
    'preset', 'suite_1',
    'aisle_position', 'center',
    -- Per-row, per-side seat counts. Row 1 is the front (closest to
    -- the instructor). Right row 5 is 0 because the spec leaves it
    -- empty — the back-most row only has the left section.
    'rows', jsonb_build_array(
      jsonb_build_object('row', 1, 'zone', 'Front (Audio)',        'left', 4, 'right', 4),
      jsonb_build_object('row', 2, 'zone', 'Front (Audio)',        'left', 4, 'right', 4),
      jsonb_build_object('row', 3, 'zone', 'Middle (Visual)',      'left', 2, 'right', 4),
      jsonb_build_object('row', 4, 'zone', 'Middle (Visual)',      'left', 2, 'right', 4),
      jsonb_build_object('row', 5, 'zone', 'Back (Kinesthetic)',   'left', 2, 'right', 0)
    ),
    'overflow_seats', jsonb_build_object('enabled', false, 'count', 0),
    'seat_encoding', jsonb_build_object(
      'description', 'table_number = row*10 + side (1=left, 2=right). seat_position is 1..N within that section row.'
    )
  ),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM classrooms WHERE name = 'Suite 1'
);

-- Backfill: if Main Classroom layout_config lacks a `preset` key,
-- stamp it as 'default' so the builder can branch unambiguously.
UPDATE classrooms
   SET layout_config = jsonb_set(
         COALESCE(layout_config, '{}'::jsonb),
         '{preset}',
         '"default"'::jsonb
       )
 WHERE name = 'Main Classroom'
   AND (layout_config->>'preset') IS NULL;

COMMENT ON COLUMN classrooms.layout_config IS
  'Per-room layout spec. The "preset" key drives the builder''s rendering branch — "default" = legacy 4×2 tables, "suite_1" = variable-seats-per-row left/right split.';
