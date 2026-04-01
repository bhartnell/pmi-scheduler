-- URGENT: Fix OSCE scenario assignments to match actual gradebook
-- Scenarios in use: A (Hypoglycemia), D (CHF), F (Status Epilepticus)
-- Do NOT touch any existing scores

-- Day 1 scenario assignments
UPDATE osce_assessments SET scenario = 'D' WHERE student_name = 'PORFIRIO';
UPDATE osce_assessments SET scenario = 'A' WHERE student_name = 'GIFFORD';
UPDATE osce_assessments SET scenario = 'D' WHERE student_name = 'JOHNSON';
UPDATE osce_assessments SET scenario = 'A' WHERE student_name = 'SOLARI';
UPDATE osce_assessments SET scenario = 'F' WHERE student_name = 'MIRANDA';
UPDATE osce_assessments SET scenario = 'A' WHERE student_name = 'BILHARZ';
UPDATE osce_assessments SET scenario = 'F' WHERE student_name = 'NIXON';
UPDATE osce_assessments SET scenario = 'F' WHERE student_name = 'GRAHOVAC';
UPDATE osce_assessments SET scenario = 'A' WHERE student_name = 'COTTRELL';
UPDATE osce_assessments SET scenario = 'A' WHERE student_name = 'RUIZ';
UPDATE osce_assessments SET scenario = 'D' WHERE student_name = 'SULLIVAN';
UPDATE osce_assessments SET scenario = 'D' WHERE student_name = 'ZENTEK';
UPDATE osce_assessments SET scenario = 'F' WHERE student_name = 'JAKICEVIC';

-- Day 2 scenario assignments
UPDATE osce_assessments SET scenario = 'D' WHERE student_name = 'SARELLANO LOPEZ';
UPDATE osce_assessments SET scenario = 'A' WHERE student_name = 'ACOSTA';
UPDATE osce_assessments SET scenario = 'A' WHERE student_name = 'CAHA';
UPDATE osce_assessments SET scenario = 'D' WHERE student_name = 'SMITH';
UPDATE osce_assessments SET scenario = 'D' WHERE student_name = 'KENNEDY';
UPDATE osce_assessments SET scenario = 'F' WHERE student_name = 'WILLIAMS';

-- Fix slot numbers
UPDATE osce_assessments SET slot_number = 1 WHERE student_name = 'PORFIRIO';
UPDATE osce_assessments SET slot_number = 2 WHERE student_name = 'GIFFORD';
UPDATE osce_assessments SET slot_number = 3 WHERE student_name = 'JOHNSON';
UPDATE osce_assessments SET slot_number = 4 WHERE student_name = 'SOLARI';
UPDATE osce_assessments SET slot_number = 5 WHERE student_name = 'MIRANDA';
UPDATE osce_assessments SET slot_number = 6 WHERE student_name = 'BILHARZ';
UPDATE osce_assessments SET slot_number = 7 WHERE student_name = 'NIXON';
UPDATE osce_assessments SET slot_number = 8 WHERE student_name = 'GRAHOVAC';
UPDATE osce_assessments SET slot_number = 9 WHERE student_name = 'COTTRELL';
UPDATE osce_assessments SET slot_number = 10 WHERE student_name = 'RUIZ';
UPDATE osce_assessments SET slot_number = 11 WHERE student_name = 'SULLIVAN';
UPDATE osce_assessments SET slot_number = 12 WHERE student_name = 'ZENTEK';
UPDATE osce_assessments SET slot_number = 13 WHERE student_name = 'JAKICEVIC';
UPDATE osce_assessments SET slot_number = 14 WHERE student_name = 'SARELLANO LOPEZ';
UPDATE osce_assessments SET slot_number = 15 WHERE student_name = 'ACOSTA';
UPDATE osce_assessments SET slot_number = 16 WHERE student_name = 'CAHA';
UPDATE osce_assessments SET slot_number = 17 WHERE student_name = 'SMITH';
UPDATE osce_assessments SET slot_number = 18 WHERE student_name = 'KENNEDY';
UPDATE osce_assessments SET slot_number = 19 WHERE student_name = 'WILLIAMS';

-- Fix day swaps: SULLIVAN to Day 1, ACOSTA to Day 2
UPDATE osce_assessments SET day_number = 1, assessment_date = '2026-03-30' WHERE student_name = 'SULLIVAN';
UPDATE osce_assessments SET day_number = 2, assessment_date = '2026-03-31' WHERE student_name = 'ACOSTA';
