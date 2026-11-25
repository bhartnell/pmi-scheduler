// Pure helpers for the "Submitted" confirmation card on the station grading
// page (skill sheets). Screen-only: nothing here touches the save path.

export interface SubmittedCardInput {
  studentName?: string | null;
  skillName?: string | null;
  result: 'pass' | 'fail' | string;
  belowMinReason?: string | null;
  pointsEarned?: number | null;
  pointsPossible?: number | null;
  savedAt: Date;
}

export interface SubmittedCardText {
  title: string;
  detail: string;
  resultLabel: string;
  pointsLine: string | null;
  timeLine: string;
}

export function buildSubmittedCard(i: SubmittedCardInput): SubmittedCardText {
  const isPass = i.result === 'pass';
  let resultLabel = isPass ? 'PASS' : 'FAIL';
  if (isPass && i.belowMinReason && i.belowMinReason.trim()) {
    resultLabel = 'PASS - Pass below minimum - sent for review';
  }
  const hasPoints =
    typeof i.pointsEarned === 'number' && typeof i.pointsPossible === 'number' && i.pointsPossible > 0;
  const time = i.savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return {
    title: 'Submitted',
    detail: [i.studentName || 'Student', i.skillName || 'Skill', resultLabel].join(' - '),
    resultLabel,
    pointsLine: hasPoints ? `${i.pointsEarned} / ${i.pointsPossible} points` : null,
    timeLine: `Saved ${time}`,
  };
}

/** Show only after a server-confirmed COMPLETE save (not in-progress, not while a handoff prompt defers the reset). */
export function shouldShowSubmittedCard(args: {
  saveStatus: 'complete' | 'in_progress';
  success: boolean;
  evaluationId?: string | null;
}): boolean {
  return args.saveStatus === 'complete' && args.success === true && !!args.evaluationId;
}

/** The card is visible only while no student is selected (start view); picking a student clears it. */
export function submittedCardVisible(hasCard: boolean, selectedStudentId?: string | null): boolean {
  return hasCard && !selectedStudentId;
}
