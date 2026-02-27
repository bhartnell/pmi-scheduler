'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';

interface SurveyQuestion {
  id: string;
  text: string;
  category: string;
}

interface SurveyCategory {
  name: string;
  questions: SurveyQuestion[];
}

// Hospital Preceptor Survey question definitions
const HOSPITAL_CATEGORIES: SurveyCategory[] = [
  {
    name: 'Preceptor Behavior',
    questions: [
      { id: 'q1', text: 'Preceptor demonstrated professionalism', category: 'Preceptor Behavior' },
      { id: 'q2', text: 'Preceptor was approachable and supportive', category: 'Preceptor Behavior' },
      { id: 'q3', text: 'Preceptor provided constructive feedback', category: 'Preceptor Behavior' },
      { id: 'q4', text: 'Preceptor allowed increasing independence', category: 'Preceptor Behavior' },
      { id: 'q5', text: 'Preceptor modeled good patient care', category: 'Preceptor Behavior' },
      { id: 'q6', text: 'Preceptor explained clinical decision-making', category: 'Preceptor Behavior' },
      { id: 'q7', text: 'Preceptor was available when needed', category: 'Preceptor Behavior' },
      { id: 'q8', text: 'Preceptor treated me with respect', category: 'Preceptor Behavior' },
      { id: 'q9', text: 'Preceptor communicated expectations clearly', category: 'Preceptor Behavior' },
    ],
  },
  {
    name: 'Skills / Knowledge',
    questions: [
      { id: 'q10', text: 'Preceptor helped develop assessment skills', category: 'Skills / Knowledge' },
      { id: 'q11', text: 'Preceptor encouraged critical thinking', category: 'Skills / Knowledge' },
      { id: 'q12', text: 'Preceptor guided medication administration', category: 'Skills / Knowledge' },
      { id: 'q13', text: 'Preceptor supported procedural skill practice', category: 'Skills / Knowledge' },
      { id: 'q14', text: 'Preceptor reviewed documentation / charting', category: 'Skills / Knowledge' },
      { id: 'q15', text: 'Preceptor discussed pathophysiology', category: 'Skills / Knowledge' },
      { id: 'q16', text: 'Preceptor promoted evidence-based practice', category: 'Skills / Knowledge' },
    ],
  },
  {
    name: 'General',
    questions: [
      { id: 'q17', text: 'Overall quality of clinical experience', category: 'General' },
      { id: 'q18', text: 'Would recommend this site to other students', category: 'General' },
      { id: 'q19', text: 'Overall preceptor rating', category: 'General' },
    ],
  },
];

// Field Preceptor Survey uses the same structure but in a field context
const FIELD_CATEGORIES: SurveyCategory[] = [
  {
    name: 'Preceptor Behavior',
    questions: [
      { id: 'q1', text: 'Field preceptor demonstrated professionalism', category: 'Preceptor Behavior' },
      { id: 'q2', text: 'Field preceptor was approachable and supportive', category: 'Preceptor Behavior' },
      { id: 'q3', text: 'Field preceptor provided constructive feedback', category: 'Preceptor Behavior' },
      { id: 'q4', text: 'Field preceptor allowed increasing independence', category: 'Preceptor Behavior' },
      { id: 'q5', text: 'Field preceptor modeled good patient care', category: 'Preceptor Behavior' },
      { id: 'q6', text: 'Field preceptor explained clinical decision-making', category: 'Preceptor Behavior' },
      { id: 'q7', text: 'Field preceptor was available when needed', category: 'Preceptor Behavior' },
      { id: 'q8', text: 'Field preceptor treated me with respect', category: 'Preceptor Behavior' },
      { id: 'q9', text: 'Field preceptor communicated expectations clearly', category: 'Preceptor Behavior' },
    ],
  },
  {
    name: 'Skills / Knowledge',
    questions: [
      { id: 'q10', text: 'Field preceptor helped develop assessment skills', category: 'Skills / Knowledge' },
      { id: 'q11', text: 'Field preceptor encouraged critical thinking', category: 'Skills / Knowledge' },
      { id: 'q12', text: 'Field preceptor guided medication administration', category: 'Skills / Knowledge' },
      { id: 'q13', text: 'Field preceptor supported procedural skill practice', category: 'Skills / Knowledge' },
      { id: 'q14', text: 'Field preceptor reviewed documentation / charting', category: 'Skills / Knowledge' },
      { id: 'q15', text: 'Field preceptor discussed pathophysiology', category: 'Skills / Knowledge' },
      { id: 'q16', text: 'Field preceptor promoted evidence-based practice', category: 'Skills / Knowledge' },
    ],
  },
  {
    name: 'General',
    questions: [
      { id: 'q17', text: 'Overall quality of field internship experience', category: 'General' },
      { id: 'q18', text: 'Would recommend this agency to other students', category: 'General' },
      { id: 'q19', text: 'Overall field preceptor rating', category: 'General' },
    ],
  },
];

type RatingValue = 1 | 2 | 3 | 4 | 5 | 'na' | null;

interface SurveyResponses {
  [questionId: string]: RatingValue;
}

interface ExistingSurvey {
  id: string;
  survey_type: string;
  preceptor_name: string | null;
  agency_name: string | null;
  responses: SurveyResponses;
  submitted_by: string | null;
  submitted_at: string | null;
}

interface CloseoutSurveyModalProps {
  internship_id: string;
  survey_type: 'hospital_preceptor' | 'field_preceptor';
  existing_survey?: ExistingSurvey | null;
  onComplete: (survey: ExistingSurvey) => void;
  onClose: () => void;
}

const RATING_LABELS: Record<number | string, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
  na: 'N/A',
};

const RATING_COLORS: Record<number | string, string> = {
  1: 'bg-red-500 text-white border-red-500',
  2: 'bg-orange-400 text-white border-orange-400',
  3: 'bg-yellow-400 text-white border-yellow-400',
  4: 'bg-blue-500 text-white border-blue-500',
  5: 'bg-green-500 text-white border-green-500',
  na: 'bg-gray-400 text-white border-gray-400',
};

const RATING_COLORS_UNSELECTED =
  'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500';

export default function CloseoutSurveyModal({
  internship_id,
  survey_type,
  existing_survey,
  onComplete,
  onClose,
}: CloseoutSurveyModalProps) {
  const categories = survey_type === 'field_preceptor' ? FIELD_CATEGORIES : HOSPITAL_CATEGORIES;
  const allQuestions = categories.flatMap(c => c.questions);

  const [preceptorName, setPreceptorName] = useState(existing_survey?.preceptor_name || '');
  const [agencyName, setAgencyName] = useState(existing_survey?.agency_name || '');
  const [responses, setResponses] = useState<SurveyResponses>(() => {
    if (existing_survey?.responses) {
      return existing_survey.responses;
    }
    const initial: SurveyResponses = {};
    allQuestions.forEach(q => { initial[q.id] = null; });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure all question keys are initialized when survey type changes
  useEffect(() => {
    setResponses(prev => {
      const updated = { ...prev };
      allQuestions.forEach(q => {
        if (!(q.id in updated)) {
          updated[q.id] = null;
        }
      });
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey_type]);

  const isFieldSurvey = survey_type === 'field_preceptor';
  const title = survey_type === 'hospital_preceptor' ? 'Hospital Preceptor Survey' : 'Field Preceptor Survey';

  const answeredCount = allQuestions.filter(q => responses[q.id] !== null).length;
  const totalCount = allQuestions.length;
  const allAnswered =
    answeredCount === totalCount &&
    (!isFieldSurvey || (preceptorName.trim().length > 0 && agencyName.trim().length > 0));

  const handleRating = (questionId: string, value: RatingValue) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setSubmitting(true);
    setError(null);

    try {
      const baseUrl = `/api/clinical/internships/${internship_id}/closeout/surveys`;
      const isEdit = !!existing_survey;
      const method = isEdit ? 'PUT' : 'POST';

      const body: Record<string, unknown> = {
        survey_type,
        responses,
        preceptor_name: preceptorName.trim() || null,
        agency_name: agencyName.trim() || null,
      };
      if (isEdit) {
        body.survey_id = existing_survey!.id;
      }

      const res = await fetch(baseUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        onComplete(data.survey);
      } else {
        setError(data.error || 'Failed to save survey');
      }
    } catch {
      setError('Failed to save survey');
    }

    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-screen flex items-start justify-center p-4 py-8">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20 rounded-t-xl">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {answeredCount} of {totalCount} questions answered
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Field survey: preceptor + agency inputs */}
            {isFieldSurvey && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Preceptor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={preceptorName}
                    onChange={e => setPreceptorName(e.target.value)}
                    placeholder="Enter preceptor name"
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Agency Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={e => setAgencyName(e.target.value)}
                    placeholder="Enter agency name"
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Rating scale legend */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-700 dark:text-gray-300">Scale:</span>
              {([1, 2, 3, 4, 5] as const).map(v => (
                <span key={v} className="flex items-center gap-1">
                  <span className={`w-5 h-5 rounded text-center text-xs leading-5 font-bold ${RATING_COLORS[v]}`}>
                    {v}
                  </span>
                  <span>{RATING_LABELS[v]}</span>
                </span>
              ))}
              <span className="flex items-center gap-1">
                <span className={`px-1.5 h-5 rounded text-center text-xs leading-5 font-bold ${RATING_COLORS['na']}`}>
                  N/A
                </span>
                <span>Not Applicable</span>
              </span>
            </div>

            {/* Questions by category */}
            {categories.map((category, catIdx) => (
              <div key={category.name}>
                <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-3 pb-1 border-b border-emerald-200 dark:border-emerald-800">
                  {category.name}
                </h4>
                <div className="space-y-1">
                  {category.questions.map((question, qIdx) => {
                    const isEven = qIdx % 2 === 0;
                    const currentValue = responses[question.id];
                    const isAnswered = currentValue !== null;

                    return (
                      <div
                        key={question.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                          isEven
                            ? 'bg-gray-50 dark:bg-gray-700/40'
                            : 'bg-white dark:bg-gray-800'
                        } ${!isAnswered ? 'border border-amber-200 dark:border-amber-800/40' : ''}`}
                      >
                        {/* Question number + text */}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 mr-1.5">
                            {catIdx === 0
                              ? qIdx + 1
                              : catIdx === 1
                              ? qIdx + 10
                              : qIdx + 17}
                            .
                          </span>
                          <span className="text-sm text-gray-800 dark:text-gray-200">
                            {question.text}
                          </span>
                        </div>

                        {/* Rating buttons */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {([1, 2, 3, 4, 5] as const).map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleRating(question.id, currentValue === val ? null : val)}
                              title={RATING_LABELS[val]}
                              className={`w-8 h-8 rounded border font-bold text-sm transition-all ${
                                currentValue === val
                                  ? RATING_COLORS[val]
                                  : RATING_COLORS_UNSELECTED
                              }`}
                            >
                              {val}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleRating(question.id, currentValue === 'na' ? null : 'na')}
                            title="Not Applicable"
                            className={`px-2 h-8 rounded border font-bold text-xs transition-all ${
                              currentValue === 'na'
                                ? RATING_COLORS['na']
                                : RATING_COLORS_UNSELECTED
                            }`}
                          >
                            N/A
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Progress + Submit */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {allAnswered ? (
                  <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    All questions answered - ready to submit
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    {totalCount - answeredCount} question{totalCount - answeredCount !== 1 ? 's' : ''} remaining
                    {isFieldSurvey && (!preceptorName.trim() || !agencyName.trim()) && (
                      <> (and preceptor / agency name required)</>
                    )}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!allAnswered || submitting}
                  className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                    allAnswered && !submitting
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {existing_survey ? 'Update Survey' : 'Submit Survey'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
