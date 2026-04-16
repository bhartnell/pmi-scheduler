-- Manual correction: tag Tran and Ocampo-Yim's passing E201 retakes
-- with is_retake=true and link to their same-day fail record.
-- Lab day: a74f07a9-653e-4da9-b185-040cd7b12a3d (2026-04-15 NREMT)

-- Ocampo-Yim pass → links to his fail
UPDATE student_skill_evaluations
SET is_retake = true,
    original_evaluation_id = '87154d62-5b15-4b18-8709-e8a24c101992'
WHERE id = '22bf0de0-f6f1-4b40-9976-a07e5d4634f8';

-- Tran pass → links to her fail
UPDATE student_skill_evaluations
SET is_retake = true,
    original_evaluation_id = '6c3ded40-d487-4fad-b84c-ad557b62aade'
WHERE id = '5fcbfc7a-da54-4229-9808-027cf59705fa';
