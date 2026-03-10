// Pharmacology Checkpoint Scoring Logic
// Fuzzy matching for student answers against medication data.

/**
 * Score a student's answer against the correct answer.
 * Uses keyword matching, not exact string comparison.
 *
 * @returns Score between 0 and 1
 */
export function scoreField(
  studentAnswer: string,
  correctAnswer: string,
  fieldName?: string
): { score: number; matched: boolean } {
  if (!studentAnswer || !correctAnswer) {
    return { score: 0, matched: false };
  }

  const student = normalizeText(studentAnswer);
  const correct = normalizeText(correctAnswer);

  // Exact match
  if (student === correct) {
    return { score: 1, matched: true };
  }

  // Special handling for dose fields — extract numbers and units
  if (fieldName?.includes('dose') || fieldName?.includes('Dose')) {
    return scoreDoseField(student, correct);
  }

  // General word overlap scoring
  return scoreWordOverlap(student, correct);
}

/**
 * Score an array field (e.g., indications, contraindications).
 * Each item in the correct answer is scored individually.
 */
export function scoreArrayField(
  studentAnswers: string[],
  correctAnswers: string[]
): { score: number; matched: boolean; perItem: { correct: string; matched: boolean }[] } {
  if (!correctAnswers || correctAnswers.length === 0) {
    return { score: 1, matched: true, perItem: [] };
  }

  const perItem = correctAnswers.map(correct => {
    const bestMatch = studentAnswers.some(student => {
      const result = scoreWordOverlap(normalizeText(student), normalizeText(correct));
      return result.score >= 0.7;
    });
    return { correct, matched: bestMatch };
  });

  const matchedCount = perItem.filter(i => i.matched).length;
  const score = matchedCount / correctAnswers.length;

  return { score, matched: score >= 0.7, perItem };
}

/**
 * Score a complete checkpoint — all blanked fields across all medications.
 */
export function scoreCheckpoint(
  responses: Array<{
    medication_id: string;
    answers: Record<string, string | string[]>;
  }>,
  medications: Array<{
    id: string;
    [key: string]: unknown;
  }>,
  blankedFields: string[]
): {
  totalScore: number;
  passed: boolean;
  perMedication: Array<{
    medication_id: string;
    fields: Array<{
      field: string;
      studentAnswer: string | string[];
      correctAnswer: string | string[] | undefined;
      matched: boolean;
    }>;
    score: number;
  }>;
} {
  let totalCorrect = 0;
  let totalFields = 0;

  const perMedication = responses.map(response => {
    const med = medications.find(m => m.id === response.medication_id);
    if (!med) {
      return { medication_id: response.medication_id, fields: [], score: 0 };
    }

    const fields = blankedFields.map(field => {
      const studentAnswer = response.answers[field];
      const correctAnswer = med[field];

      if (correctAnswer === undefined || correctAnswer === null) {
        return { field, studentAnswer: studentAnswer || '', correctAnswer: undefined, matched: true };
      }

      let matched = false;

      if (Array.isArray(correctAnswer)) {
        const studentArr = Array.isArray(studentAnswer) ? studentAnswer : [String(studentAnswer || '')];
        const result = scoreArrayField(studentArr, correctAnswer as string[]);
        matched = result.matched;
      } else {
        const result = scoreField(
          String(studentAnswer || ''),
          String(correctAnswer),
          field
        );
        matched = result.matched;
      }

      totalFields++;
      if (matched) totalCorrect++;

      return {
        field,
        studentAnswer: studentAnswer || '',
        correctAnswer: (Array.isArray(correctAnswer) ? correctAnswer : String(correctAnswer)) as string | string[],
        matched,
      };
    });

    const fieldScores = fields.filter(f => f.correctAnswer !== undefined);
    const medScore = fieldScores.length > 0
      ? fieldScores.filter(f => f.matched).length / fieldScores.length
      : 1;

    return { medication_id: response.medication_id, fields, score: medScore };
  });

  const totalScore = totalFields > 0 ? Math.round((totalCorrect / totalFields) * 100) : 0;

  return {
    totalScore,
    passed: totalScore >= 80,
    perMedication,
  };
}

/**
 * Get blanked fields based on difficulty level and checkpoint_blanks config.
 * Level 1: first 3 fields
 * Level 2: first 5 fields
 * Level 3: first 7 fields (or all)
 */
export function getBlankedFields(checkpointBlanks: string[], level: number): string[] {
  const counts: Record<number, number> = { 1: 3, 2: 5, 3: 7 };
  const count = counts[level] || 3;
  return checkpointBlanks.slice(0, count);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreWordOverlap(student: string, correct: string): { score: number; matched: boolean } {
  const studentWords = new Set(student.split(' ').filter(w => w.length > 1));
  const correctWords = correct.split(' ').filter(w => w.length > 1);

  if (correctWords.length === 0) return { score: 1, matched: true };

  let matchCount = 0;
  for (const word of correctWords) {
    if (studentWords.has(word)) {
      matchCount++;
    }
  }

  const score = matchCount / correctWords.length;
  return { score, matched: score >= 0.7 };
}

function scoreDoseField(student: string, correct: string): { score: number; matched: boolean } {
  // Extract numbers from both
  const studentNums = student.match(/[\d.]+/g)?.map(Number) || [];
  const correctNums = correct.match(/[\d.]+/g)?.map(Number) || [];

  if (correctNums.length === 0) {
    return scoreWordOverlap(student, correct);
  }

  // Check if key numbers match
  let numMatch = 0;
  for (const cn of correctNums) {
    if (studentNums.some(sn => Math.abs(sn - cn) < 0.01)) {
      numMatch++;
    }
  }

  const numScore = numMatch / correctNums.length;

  // Also check unit keywords
  const unitOverlap = scoreWordOverlap(student, correct);

  // Combined: numbers matter more
  const score = numScore * 0.6 + unitOverlap.score * 0.4;
  return { score, matched: score >= 0.7 };
}
