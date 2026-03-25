'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Heart,
  Activity,
  Thermometer,
  Droplets,
  ClipboardList,
  Stethoscope,
  FileText,
  ChevronDown,
  ChevronUp,
  Lock,
  Printer,
  ArrowLeft,
} from 'lucide-react';

interface VitalSet {
  BP: string;
  HR: string;
  RR: string;
  SpO2: string;
  Temp: string;
  BGL: string;
  ETCO2?: string;
}

interface PhaseVitals {
  phase: number;
  title: string;
  vitals: VitalSet[];
}

interface OsceScenario {
  id: string;
  scenario_letter: string;
  title: string;
  patient_name: string;
  patient_age: string;
  patient_gender: string;
  chief_complaint: string;
  dispatch_text: string;
  instructor_notes: string | null;
  critical_actions: string[];
  expected_interventions: Record<string, string[] | string>;
  oral_board_domains: Record<string, string[]>;
  vital_sign_progressions: PhaseVitals[];
  full_content: string;
  is_active: boolean;
}

export default function OsceScenarioViewer() {
  const params = useParams();
  const letter = (params.letter as string)?.toUpperCase();

  const [scenario, setScenario] = useState<OsceScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([1]));
  const [showFullContent, setShowFullContent] = useState(false);

  useEffect(() => {
    if (!letter) return;
    fetch(`/api/osce-scenarios/${letter}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            setError('You must be signed in to view scenarios.');
          } else if (res.status === 404) {
            setError('Scenario not found.');
          } else {
            setError('Failed to load scenario.');
          }
          return;
        }
        const data = await res.json();
        setScenario(data);
      })
      .catch(() => setError('Failed to load scenario.'))
      .finally(() => setLoading(false));
  }, [letter]);

  const togglePhase = (phase: number) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading scenario...</p>
        </div>
      </div>
    );
  }

  if (error || !scenario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {error || 'Scenario not found'}
          </h1>
          <a
            href="/osce-scenario"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 inline-flex items-center gap-1 mt-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to scenarios
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 print:bg-white">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 print:border-b-2 print:border-black">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-2">
            <a
              href="/osce-scenario"
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 inline-flex items-center gap-1 print:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
              All Scenarios
            </a>
            <button
              onClick={() => window.print()}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 inline-flex items-center gap-1 print:hidden"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600 text-white text-xl font-bold">
              {scenario.scenario_letter}
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Scenario {scenario.scenario_letter}: {scenario.title}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                PMI Paramedic Program OSCE
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Instructor Notes (lead_instructor+ only) */}
        {scenario.instructor_notes && (
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-6 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="h-5 w-5 text-red-600 dark:text-red-400" />
              <h2 className="text-lg font-bold text-red-800 dark:text-red-300">
                INSTRUCTOR NOTES (READ FIRST)
              </h2>
            </div>
            <div className="text-red-900 dark:text-red-200 whitespace-pre-wrap text-sm leading-relaxed">
              {scenario.instructor_notes}
            </div>
          </div>
        )}

        {/* Patient & Dispatch Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Patient Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Patient Information</h2>
            </div>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Name</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white">{scenario.patient_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Age</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white">{scenario.patient_age}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Gender</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white">
                  {scenario.patient_gender === 'M' ? 'Male' : scenario.patient_gender === 'F' ? 'Female' : scenario.patient_gender}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Chief Complaint</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white">{scenario.chief_complaint}</dd>
              </div>
            </dl>
          </div>

          {/* Dispatch Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dispatch</h2>
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {scenario.dispatch_text}
            </div>
          </div>
        </div>

        {/* Critical Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-yellow-300 dark:border-yellow-600 p-6 print:break-inside-avoid">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Critical Actions (Must Perform)</h2>
          </div>
          <ol className="space-y-2">
            {scenario.critical_actions.map((action, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{action}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Vital Sign Progressions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Vital Sign Progressions</h2>
          </div>
          <div className="space-y-4">
            {scenario.vital_sign_progressions.map((phase) => (
              <div key={phase.phase} className="border border-gray-100 dark:border-gray-700 rounded-lg print:break-inside-avoid">
                <button
                  onClick={() => togglePhase(phase.phase)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg print:hover:bg-transparent"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm font-bold">
                      {phase.phase}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {phase.title}
                    </span>
                  </div>
                  <span className="print:hidden">
                    {expandedPhases.has(phase.phase) ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </span>
                </button>
                {(expandedPhases.has(phase.phase) || typeof window === 'undefined') && (
                  <div className="px-4 pb-4">
                    {phase.vitals.map((v, idx) => (
                      <div key={idx} className="mb-3">
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                          <VitalCard label="BP" value={v.BP} icon={<Heart className="h-4 w-4" />} />
                          <VitalCard label="HR" value={v.HR} icon={<Activity className="h-4 w-4" />} />
                          <VitalCard label="RR" value={v.RR} icon={<Droplets className="h-4 w-4" />} />
                          <VitalCard label="SpO2" value={v.SpO2} icon={<Droplets className="h-4 w-4" />} />
                          <VitalCard label="Temp" value={v.Temp} icon={<Thermometer className="h-4 w-4" />} />
                          <VitalCard label="BGL" value={v.BGL} icon={<Droplets className="h-4 w-4" />} />
                        </div>
                        {v.ETCO2 && (
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-1.5">
                            ETCO2: {v.ETCO2}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Expected Interventions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <ClipboardList className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Expected Interventions by Phase</h2>
          </div>
          <div className="space-y-6">
            {Object.entries(scenario.expected_interventions).map(([phase, actions]) => (
              <div key={phase} className="print:break-inside-avoid">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{phase}</h3>
                {Array.isArray(actions) ? (
                  <ul className="space-y-1 ml-4">
                    {actions.map((action, i) => (
                      <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                        <span className="text-gray-400 mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-gray-400" />
                        {action}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400 ml-4 whitespace-pre-wrap">{actions}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Oral Board / Debrief Discussion Points */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 print:break-inside-avoid">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Debrief Discussion Points</h2>
          </div>
          {Object.entries(scenario.oral_board_domains).map(([domain, questions]) => (
            <div key={domain} className="mb-4">
              <ul className="space-y-2">
                {questions.map((q, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                    <span className="text-indigo-400 mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Full Content (collapsible) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 print:hidden">
          <button
            onClick={() => setShowFullContent(!showFullContent)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <FileText className="h-5 w-5" />
            <span className="text-sm font-medium">
              {showFullContent ? 'Hide' : 'Show'} Full Document Text
            </span>
            {showFullContent ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showFullContent && (
            <pre className="mt-4 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-[600px] overflow-auto">
              {scenario.full_content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function VitalCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 mb-1 text-gray-400 dark:text-gray-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}
