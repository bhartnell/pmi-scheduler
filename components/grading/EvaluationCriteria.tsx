'use client';

import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  ClipboardCheck
} from 'lucide-react';
import type { CriteriaRating } from './types';
import { RATING_COLORS } from './types';

interface EvaluationCriteriaProps {
  activeCriteria: { id: string; name: string; description: string }[];
  criteriaRatings: CriteriaRating[];
  isSkillsStation: boolean;
  satisfactoryCount: number;
  needsImprovementCount: number;
  unsatisfactoryCount: number;
  allRated: boolean;
  totalCriteria: number;
  skillsPass: boolean;
  skillsNeedsPractice: boolean;
  phase1Pass: boolean;
  phase2Pass: boolean;
  onUpdateRating: (criteriaId: string, rating: 'S' | 'NI' | 'U') => void;
  onUpdateNotes: (criteriaId: string, notes: string) => void;
}

export default function EvaluationCriteria({
  activeCriteria,
  criteriaRatings,
  isSkillsStation,
  satisfactoryCount,
  needsImprovementCount,
  unsatisfactoryCount,
  allRated,
  totalCriteria,
  skillsPass,
  skillsNeedsPractice,
  phase1Pass,
  phase2Pass,
  onUpdateRating,
  onUpdateNotes,
}: EvaluationCriteriaProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            {isSkillsStation ? (
              <>
                <ClipboardCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                Skill Evaluation
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Evaluation Criteria
              </>
            )}
          </h2>
          {isSkillsStation && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Grading is optional for skills stations - you can save without rating
            </p>
          )}
        </div>
        <div className="text-sm">
          <span className="text-green-600 dark:text-green-400 font-medium">{satisfactoryCount} S</span>
          {needsImprovementCount > 0 && (
            <span className="text-yellow-600 dark:text-yellow-400 font-medium ml-2">{needsImprovementCount} NI</span>
          )}
          {unsatisfactoryCount > 0 && (
            <span className="text-red-600 dark:text-red-400 font-medium ml-2">{unsatisfactoryCount} U</span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {activeCriteria.map((criteria, index) => {
          const rating = criteriaRatings.find(r => r.criteria_id === criteria.id);
          const needsNotes = rating?.rating === 'NI' || rating?.rating === 'U';

          return (
            <div key={criteria.id} className="border dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm font-medium shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white">{criteria.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{criteria.description}</div>

                  {/* Rating Buttons */}
                  <div className="flex gap-2 mb-2">
                    {(['S', 'NI', 'U'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => onUpdateRating(criteria.id, r)}
                        className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                          rating?.rating === r
                            ? RATING_COLORS[r]
                            : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        {r === 'S' ? 'Satisfactory' : r === 'NI' ? 'Needs Improvement' : 'Unsatisfactory'}
                      </button>
                    ))}
                  </div>

                  {/* Notes (optional for NI/U) */}
                  {needsNotes && (
                    <div>
                      <textarea
                        value={rating?.notes || ''}
                        onChange={(e) => onUpdateNotes(criteria.id, e.target.value)}
                        placeholder="Required: Explain the issue and improvement plan..."
                        rows={2}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pass/Fail Summary */}
      {allRated && (
        <div className={`mt-4 p-4 rounded-lg ${
          isSkillsStation ? (
            skillsPass ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700' :
            skillsNeedsPractice ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700' :
            'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
          ) : (
            phase2Pass ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700' :
            phase1Pass ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700' :
            'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
          )
        }`}>
          <div className="flex items-center gap-3">
            {isSkillsStation ? (
              skillsPass ? (
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : skillsNeedsPractice ? (
                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              )
            ) : (
              phase2Pass ? (
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : phase1Pass ? (
                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              )
            )}
            <div>
              <div className={`font-medium ${
                isSkillsStation ? (
                  skillsPass ? 'text-green-800 dark:text-green-300' :
                  skillsNeedsPractice ? 'text-yellow-800 dark:text-yellow-300' :
                  'text-red-800 dark:text-red-300'
                ) : (
                  phase2Pass ? 'text-green-800 dark:text-green-300' :
                  phase1Pass ? 'text-yellow-800 dark:text-yellow-300' :
                  'text-red-800 dark:text-red-300'
                )
              }`}>
                {satisfactoryCount}/{totalCriteria} Satisfactory
              </div>
              <div className={`text-sm ${
                isSkillsStation ? (
                  skillsPass ? 'text-green-700 dark:text-green-400' :
                  skillsNeedsPractice ? 'text-yellow-700 dark:text-yellow-400' :
                  'text-red-700 dark:text-red-400'
                ) : (
                  phase2Pass ? 'text-green-700 dark:text-green-400' :
                  phase1Pass ? 'text-yellow-700 dark:text-yellow-400' :
                  'text-red-700 dark:text-red-400'
                )
              }`}>
                {isSkillsStation ? (
                  skillsPass ? 'Pass - Skill demonstrated competently' :
                  skillsNeedsPractice ? 'Needs Practice - Additional training recommended' :
                  'Unsatisfactory - Remediation required'
                ) : (
                  phase2Pass ? 'Phase 2 Pass (7/8 required)' :
                  phase1Pass ? 'Phase 1 Pass (6/8 required) - Does not meet Phase 2' :
                  'Does not meet Phase 1 or Phase 2 requirements'
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
