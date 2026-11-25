// Pure helper for the NREMT "Unmarked items" confirmation at submit.
// Unmarked = a simple step with no mark at all (neither check nor X), or a
// step with sub-items where NO box is ticked. A sub-item step with some boxes
// ticked is marked: its unticked boxes are the proctor's answer.

export interface UnmarkedStepLike {
  step_number: number;
  instruction: string;
  sub_items?: unknown[] | null;
}

export function unmarkedSteps<S extends UnmarkedStepLike>(
  steps: S[],
  stepMarks: Record<number, string | null | undefined>,
  subItemMarks: Record<number, boolean[] | undefined>,
): S[] {
  return steps.filter((s) => {
    if (s.sub_items && s.sub_items.length > 0) {
      const checks = subItemMarks[s.step_number];
      return !checks || !checks.some(Boolean);
    }
    return !stepMarks[s.step_number];
  });
}
