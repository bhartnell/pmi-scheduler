-- Fix possible_points to match sub_items array length
-- Some steps have possible_points=1 but multiple sub_items, causing "3/1 pts" display

UPDATE skill_sheet_steps
SET possible_points = jsonb_array_length(sub_items)
WHERE sub_items IS NOT NULL
  AND jsonb_array_length(sub_items) > 0
  AND possible_points != jsonb_array_length(sub_items);
