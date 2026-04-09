-- Fix self-referencing FK on student_skill_evaluations.team_evaluation_id
-- The existing FK blocks deletion of the leader evaluation when team members reference it.
-- Change to ON DELETE SET NULL so deleting a leader evaluation clears the reference on team members.

ALTER TABLE student_skill_evaluations
  DROP CONSTRAINT IF EXISTS student_skill_evaluations_team_evaluation_id_fkey;

ALTER TABLE student_skill_evaluations
  ADD CONSTRAINT student_skill_evaluations_team_evaluation_id_fkey
  FOREIGN KEY (team_evaluation_id) REFERENCES student_skill_evaluations(id)
  ON DELETE SET NULL;
