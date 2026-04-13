'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  ClipboardCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  Shield,
  ArrowLeft,
} from 'lucide-react';

interface EvalStep {
  step_number: number;
  phase: string;
  instruction: string;
  is_critical: boolean;
}

interface Evaluation {
  id: string;
  evaluation_type: string;
  result: string;
  notes: string | null;
  flagged_items: { step_number: number; status: string }[] | null;
  step_marks: Record<string, string> | null;
  email_status: string;
  created_at: string;
  skill_sheet: {
    id: string;
    skill_name: string;
    source: string;
    steps: EvalStep[];
  } | null;
  evaluator: { id: string; name: string } | null;
  lab_day: { id: string; date: string; title: string } | null;
}

const PHASE_ORDER = ['preparation', 'procedure', 'assessment', 'packaging'];
const PHASE_LABELS: Record<string, string> = {
  preparation: 'Preparation',
  procedure: 'Procedure',
  assessment: 'Assessment',
  packaging: 'Packaging',
};

function formatInstructorName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

export default function EvaluationDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const evaluationId = params?.id as string;
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && evaluationId) {
      fetchEvaluation();
    }
  }, [session, evaluationId]);

  const fetchEvaluation = async () => {
    try {
      const res = await fetch(`/api/student/skill-evaluations?evaluation_id=${evaluationId}`);
      const data = await res.json();
      if (data.success && data.evaluations?.length > 0) {
        const eval_ = data.evaluations.find((e: Evaluation) => e.id === evaluationId);
        if (eval_) {
          if (eval_.skill_sheet?.id) {
            const sheetRes = await fetch(`/api/skill-sheets/${eval_.skill_sheet.id}`);
            const sheetData = await sheetRes.json();
            if (sheetData.success && sheetData.sheet?.steps) {
              eval_.skill_sheet.steps = sheetData.sheet.steps;
            }
          }
          setEvaluation(eval_);
        } else {
          setError('Evaluation not found');
        }
      } else {
        setError(data.error || 'Evaluation not found');
      }
    } catch {
      setError('Failed to load evaluation');
    }
    setLoading(false);
  };

  const togglePhase = (phase: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      next.has(phase) ? next.delete(phase) : next.add(phase);
      return next;
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error || 'Evaluation not found'}</p>
          <button
            onClick={() => router.back()}
            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const sheet = evaluation.skill_sheet;
  const steps = (sheet?.steps || []).sort((a, b) => a.step_number - b.step_number);
  const stepMarks = evaluation.step_marks || {};
  const flaggedItems = evaluation.flagged_items || [];

  const totalSteps = steps.length;
  const passedSteps = Object.values(stepMarks).filter(m => m === 'pass').length;
  const criticalSteps = steps.filter(s => s.is_critical);
  const criticalPassed = criticalSteps.filter(s => stepMarks[String(s.step_number)] === 'pass').length;

  const stepsByPhase: Record<string, EvalStep[]> = {};
  for (const step of steps) {
    const phase = step.phase || 'procedure';
    if (!stepsByPhase[phase]) stepsByPhase[phase] = [];
    stepsByPhase[phase].push(step);
  }
  const orderedPhases = [
    ...PHASE_ORDER.filter(p => stepsByPhase[p]),
    ...Object.keys(stepsByPhase).filter(p => !PHASE_ORDER.includes(p)),
  ];

  const evalDate = evaluation.lab_day?.date
    ? new Date(evaluation.lab_day.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(evaluation.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const resultColor = evaluation.result === 'pass'
    ? 'text-green-600 dark:text-green-400'
    : evaluation.result === 'fail'
    ? 'text-red-600 dark:text-red-400'
    : 'text-amber-600 dark:text-amber-400';

  const resultBg = evaluation.result === 'pass'
    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    : evaluation.result === 'fail'
    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 py-3">
        <nav className="max-w-2xl mx-auto flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <button onClick={() => router.back()} className="hover:text-blue-600 inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-900 dark:text-white font-medium truncate">{sheet?.skill_name || 'Evaluation'}</span>
        </nav>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">{sheet?.skill_name || 'Skill Evaluation'}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{evalDate}</p>
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              evaluation.evaluation_type === 'formative'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
            }`}>
              {evaluation.evaluation_type === 'formative' ? <ClipboardCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
              {evaluation.evaluation_type === 'formative' ? 'Formative' : 'Final Competency'}
            </span>
          </div>

          {/* Result Banner */}
          <div className={`rounded-lg border p-3 ${resultBg}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Result</p>
                <p className={`text-xl font-bold ${resultColor}`}>{evaluation.result.toUpperCase()}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-gray-600 dark:text-gray-400">Steps: <strong>{passedSteps}/{totalSteps}</strong></p>
                {criticalSteps.length > 0 && (
                  <p className="text-gray-600 dark:text-gray-400">Critical: <strong>{criticalPassed}/{criticalSteps.length}</strong></p>
                )}
              </div>
            </div>
          </div>

          {evaluation.evaluator && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Evaluator: {formatInstructorName(evaluation.evaluator.name)}
            </p>
          )}
        </div>

        {/* Steps */}
        {steps.length > 0 && (
          <div className="space-y-3">
            {orderedPhases.map(phase => {
              const phaseSteps = stepsByPhase[phase];
              const isCollapsed = collapsedPhases.has(phase);
              const phaseLabel = PHASE_LABELS[phase] || phase.charAt(0).toUpperCase() + phase.slice(1);
              const phasePassed = phaseSteps.filter(s => stepMarks[String(s.step_number)] === 'pass').length;

              return (
                <div key={phase} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                  <button
                    onClick={() => togglePhase(phase)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                      {phaseLabel}
                      <span className="ml-2 text-gray-400 font-normal normal-case">
                        {phasePassed}/{phaseSteps.length}
                      </span>
                    </h3>
                    {isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {phaseSteps.map(step => {
                        const mark = stepMarks[String(step.step_number)];
                        const flagged = flaggedItems.find(f => f.step_number === step.step_number);
                        return (
                          <div key={step.step_number} className={`px-4 py-2.5 flex items-start gap-3 ${step.is_critical ? 'border-l-4 border-red-500' : ''}`}>
                            <span className="text-xs font-mono text-gray-400 mt-0.5 w-5 text-right shrink-0">
                              {step.step_number}.
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-1.5">
                                <p className="text-xs text-gray-900 dark:text-white">{step.instruction}</p>
                                {step.is_critical && (
                                  <span className="shrink-0 px-1 py-0.5 rounded text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30">
                                    CRIT
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {mark === 'pass' ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : mark === 'fail' || flagged?.status === 'fail' ? (
                                <XCircle className="w-5 h-5 text-red-500" />
                              ) : flagged?.status === 'caution' ? (
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Notes */}
        {evaluation.notes && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-2">
              <FileText className="w-4 h-4 text-gray-500" />
              Evaluator Comments
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">{evaluation.notes}</p>
          </div>
        )}
      </main>
    </div>
  );
}
