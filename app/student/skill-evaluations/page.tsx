'use client';

/**
 * Student Skill Evaluations Page
 *
 * List of the student's own visible skill-evaluation results for standard
 * labs (team-lead counts, pass/fail, instructor notes). Links to the
 * per-evaluation detail page. NREMT/certification-exam results never appear
 * here — those are delivered via the Pima Portal/SNHD, not in-app.
 */

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, CheckCircle, XCircle, ChevronRight } from 'lucide-react';

interface EvaluationListItem {
  id: string;
  evaluation_type: string;
  result: string;
  created_at: string;
  skill_sheet: { id: string; skill_name: string } | null;
  lab_day: { id: string; date: string; title: string } | null;
}

export default function StudentSkillEvaluationsPage() {
  const { data: session } = useSession();
  const [evaluations, setEvaluations] = useState<EvaluationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/student/skill-evaluations')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setEvaluations(data.evaluations || []);
        })
        .catch((error) => console.error('Error fetching skill evaluations:', error))
        .finally(() => setLoading(false));
    }
  }, [session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Skill Evaluation Results
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Your graded skill results from standard labs
        </p>
      </div>

      {evaluations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <ClipboardCheck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No results yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Graded skill evaluations from your labs will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map((evaluation) => {
            const passed = evaluation.result === 'pass';
            return (
              <Link
                key={evaluation.id}
                href={`/student/skill-evaluations/${evaluation.id}`}
                className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      passed
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-red-100 dark:bg-red-900/30'
                    }`}
                  >
                    {passed ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {evaluation.skill_sheet?.skill_name || 'Skill Evaluation'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm mt-1">
                      <span
                        className={`font-medium ${
                          passed
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {passed ? 'Passed' : 'Fail'}
                      </span>
                      {evaluation.lab_day?.date && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {new Date(evaluation.lab_day.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                      {evaluation.lab_day?.title && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {evaluation.lab_day.title}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
