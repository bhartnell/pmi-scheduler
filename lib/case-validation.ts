// ---------------------------------------------------------------------------
// Case JSON Validation Utility
// ---------------------------------------------------------------------------
// Validates AI-generated case study JSON against the required schema,
// checking structural completeness, physiological plausibility, and
// question design rules.
// ---------------------------------------------------------------------------

import { normalizeQuestionType, CANONICAL_QUESTION_TYPES } from '@/lib/question-types';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

// ---------------------------------------------------------------------------
// Valid enums
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = [
  'cardiac', 'respiratory', 'trauma', 'medical',
  'ob', 'peds', 'behavioral', 'environmental',
] as const;

const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

// Accept both canonical types and known AI-format aliases
const VALID_QUESTION_TYPES = [
  ...CANONICAL_QUESTION_TYPES,
  'select_all', // AI-generated alias for multi_select
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isNonEmptyArray(v: unknown): v is unknown[] {
  return Array.isArray(v) && v.length > 0;
}

/**
 * Parse a BP string like "120/80" and return [systolic, diastolic] or null.
 */
function parseBP(bp: unknown): [number, number] | null {
  if (typeof bp !== 'string') return null;
  const match = bp.match(/^(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

/**
 * Parse a numeric value from a string that may contain units (e.g. "98%" or "120 bpm").
 */
function parseNumeric(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const match = v.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1]);
}

// ---------------------------------------------------------------------------
// Main validation function
// ---------------------------------------------------------------------------

export function validateCaseJson(caseData: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  // ---- Required top-level fields ----

  const requiredFields = [
    'title', 'description', 'chief_complaint', 'category',
    'subcategory', 'difficulty', 'applicable_programs', 'phases',
  ];

  for (const field of requiredFields) {
    if (caseData[field] === undefined || caseData[field] === null) {
      errors.push({ field, message: `Missing required field: ${field}`, severity: 'error' });
    } else if (typeof caseData[field] === 'string' && (caseData[field] as string).trim() === '') {
      errors.push({ field, message: `Field "${field}" must not be empty`, severity: 'error' });
    }
  }

  // ---- Category validation ----
  if (isNonEmptyString(caseData.category)) {
    const cat = (caseData.category as string).toLowerCase();
    if (!(VALID_CATEGORIES as readonly string[]).includes(cat)) {
      errors.push({
        field: 'category',
        message: `Invalid category "${caseData.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // ---- Difficulty validation ----
  if (isNonEmptyString(caseData.difficulty)) {
    const diff = (caseData.difficulty as string).toLowerCase();
    if (!(VALID_DIFFICULTIES as readonly string[]).includes(diff)) {
      errors.push({
        field: 'difficulty',
        message: `Invalid difficulty "${caseData.difficulty}". Must be one of: ${VALID_DIFFICULTIES.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // ---- applicable_programs validation ----
  if (caseData.applicable_programs !== undefined && !isNonEmptyArray(caseData.applicable_programs)) {
    errors.push({
      field: 'applicable_programs',
      message: 'applicable_programs must be a non-empty array',
      severity: 'error',
    });
  }

  // ---- Phases validation ----
  const phases = caseData.phases;
  if (!Array.isArray(phases)) {
    errors.push({ field: 'phases', message: 'phases must be an array', severity: 'error' });
    return errors; // Can't validate further without phases
  }

  if (phases.length < 3) {
    errors.push({
      field: 'phases',
      message: `At least 3 phases required, found ${phases.length}`,
      severity: 'error',
    });
  }

  // Track question types across all phases
  const allQuestionTypes = new Set<string>();

  for (let pi = 0; pi < phases.length; pi++) {
    const phase = phases[pi] as Record<string, unknown> | null;
    const prefix = `phases[${pi}]`;

    if (!phase || typeof phase !== 'object') {
      errors.push({ field: prefix, message: `Phase ${pi} is not a valid object`, severity: 'error' });
      continue;
    }

    // ---- Phase questions ----
    const questions = phase.questions;
    if (!Array.isArray(questions) || questions.length < 2) {
      errors.push({
        field: `${prefix}.questions`,
        message: `Phase ${pi} must have at least 2 questions, found ${Array.isArray(questions) ? questions.length : 0}`,
        severity: 'error',
      });
    }

    if (Array.isArray(questions)) {
      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi] as Record<string, unknown> | null;
        const qPrefix = `${prefix}.questions[${qi}]`;

        if (!q || typeof q !== 'object') {
          errors.push({ field: qPrefix, message: 'Question is not a valid object', severity: 'error' });
          continue;
        }

        const rawQType = (q.question_type || q.type) as string | undefined;
        const qType = isNonEmptyString(rawQType) ? (normalizeQuestionType(rawQType) ?? rawQType) : undefined;
        if (isNonEmptyString(rawQType)) {
          allQuestionTypes.add(qType || rawQType);
          // Warn on unknown type
          if (!normalizeQuestionType(rawQType)) {
            errors.push({
              field: `${qPrefix}.question_type`,
              message: `Unknown question type "${rawQType}". Supported: ${CANONICAL_QUESTION_TYPES.join(', ')}`,
              severity: 'warning',
            });
          }
        }

        // Points > 0
        const points = q.points;
        if (points === undefined || points === null || (typeof points === 'number' && points <= 0)) {
          errors.push({
            field: `${qPrefix}.points`,
            message: `Question must have points > 0`,
            severity: 'error',
          });
        }

        // Explanation
        if (!isNonEmptyString(q.explanation)) {
          errors.push({
            field: `${qPrefix}.explanation`,
            message: 'Question must have a non-empty explanation',
            severity: 'error',
          });
        }

        // Type-specific validation (use normalised type for matching)
        if (qType === 'multiple_choice') {
          const options = q.options;
          if (!isNonEmptyArray(options)) {
            errors.push({
              field: `${qPrefix}.options`,
              message: 'Multiple choice question must have options array',
              severity: 'error',
            });
          }
          const correctAnswer = q.correct_answer;
          if (!isNonEmptyString(correctAnswer)) {
            errors.push({
              field: `${qPrefix}.correct_answer`,
              message: 'Multiple choice question must have a correct_answer',
              severity: 'error',
            });
          } else if (isNonEmptyArray(options)) {
            // Check that correct_answer is in options
            const optionStrings = (options as unknown[]).map((o) => {
              if (typeof o === 'string') return o;
              if (typeof o === 'object' && o !== null && 'text' in (o as Record<string, unknown>)) {
                return (o as Record<string, unknown>).text;
              }
              return String(o);
            });
            if (!optionStrings.includes(correctAnswer)) {
              errors.push({
                field: `${qPrefix}.correct_answer`,
                message: `correct_answer "${correctAnswer}" not found in options`,
                severity: 'warning',
              });
            }
          }
        }

        if (qType === 'multi_select' || rawQType === 'select_all') {
          const correctAnswers = q.correct_answers;
          if (!isNonEmptyArray(correctAnswers)) {
            errors.push({
              field: `${qPrefix}.correct_answers`,
              message: 'select_all question must have a correct_answers array',
              severity: 'error',
            });
          }
        }

        if (qType === 'free_text') {
          if (!isNonEmptyString(q.sample_answer)) {
            errors.push({
              field: `${qPrefix}.sample_answer`,
              message: 'free_text question must have a sample_answer',
              severity: 'error',
            });
          }
        }

        if (qType === 'numeric') {
          const range = q.acceptable_range;
          if (!Array.isArray(range) || range.length !== 2) {
            errors.push({
              field: `${qPrefix}.acceptable_range`,
              message: 'numeric question must have an acceptable_range [min, max]',
              severity: 'warning',
            });
          }
        }

        if (qType === 'ordered_list') {
          const correctOrder = q.correct_order;
          if (!isNonEmptyArray(correctOrder)) {
            errors.push({
              field: `${qPrefix}.correct_order`,
              message: 'ordered_list question must have a correct_order array',
              severity: 'error',
            });
          }
        }
      }
    }

    // ---- Vitals validation ----
    const vitals = phase.vitals as Record<string, unknown> | null | undefined;
    if (vitals && typeof vitals === 'object') {
      // BP
      if (vitals.bp !== undefined) {
        const bp = parseBP(vitals.bp);
        if (bp) {
          const [sys, dia] = bp;
          if (sys < 60 || sys > 240) {
            errors.push({
              field: `${prefix}.vitals.bp`,
              message: `Systolic BP ${sys} out of range (60-240)`,
              severity: 'warning',
            });
          }
          if (dia < 30 || dia > 140) {
            errors.push({
              field: `${prefix}.vitals.bp`,
              message: `Diastolic BP ${dia} out of range (30-140)`,
              severity: 'warning',
            });
          }
          if (sys <= dia) {
            errors.push({
              field: `${prefix}.vitals.bp`,
              message: `Systolic (${sys}) must be greater than diastolic (${dia})`,
              severity: 'error',
            });
          }
        }
      }

      // HR
      if (vitals.hr !== undefined) {
        const hr = parseNumeric(vitals.hr);
        if (hr !== null && (hr < 0 || hr > 220)) {
          errors.push({
            field: `${prefix}.vitals.hr`,
            message: `HR ${hr} out of range (0-220)`,
            severity: 'warning',
          });
        }
      }

      // RR
      if (vitals.rr !== undefined) {
        const rr = parseNumeric(vitals.rr);
        if (rr !== null && (rr < 0 || rr > 60)) {
          errors.push({
            field: `${prefix}.vitals.rr`,
            message: `RR ${rr} out of range (0-60)`,
            severity: 'warning',
          });
        }
      }

      // SpO2
      if (vitals.spo2 !== undefined) {
        const spo2 = parseNumeric(vitals.spo2);
        if (spo2 !== null && (spo2 < 0 || spo2 > 100)) {
          errors.push({
            field: `${prefix}.vitals.spo2`,
            message: `SpO2 ${spo2} out of range (0-100)`,
            severity: 'warning',
          });
        }
      }

      // GCS
      if (vitals.gcs !== undefined) {
        const gcs = parseNumeric(vitals.gcs);
        if (gcs !== null && (gcs < 3 || gcs > 15)) {
          errors.push({
            field: `${prefix}.vitals.gcs`,
            message: `GCS ${gcs} out of range (3-15)`,
            severity: 'warning',
          });
        }
      }
    }
  }

  // ---- At least 2 different question types across all phases ----
  if (allQuestionTypes.size < 2) {
    errors.push({
      field: 'questions',
      message: `At least 2 different question types required across all phases, found ${allQuestionTypes.size}: ${[...allQuestionTypes].join(', ') || 'none'}`,
      severity: 'error',
    });
  }

  // ---- Optional but recommended fields (warnings) ----
  if (!isNonEmptyArray(caseData.learning_objectives)) {
    errors.push({
      field: 'learning_objectives',
      message: 'learning_objectives is recommended (3-5 items)',
      severity: 'warning',
    });
  }

  if (!isNonEmptyArray(caseData.critical_actions)) {
    errors.push({
      field: 'critical_actions',
      message: 'critical_actions is recommended (3-6 items)',
      severity: 'warning',
    });
  }

  if (!isNonEmptyArray(caseData.common_errors)) {
    errors.push({
      field: 'common_errors',
      message: 'common_errors is recommended (3-6 items)',
      severity: 'warning',
    });
  }

  if (!isNonEmptyArray(caseData.debrief_points)) {
    errors.push({
      field: 'debrief_points',
      message: 'debrief_points is recommended (3-5 items)',
      severity: 'warning',
    });
  }

  return errors;
}
