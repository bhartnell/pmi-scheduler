'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Wrench,
  Users,
  AlertTriangle,
  Clock,
  Layers,
  BookOpen,
  Target,
  GraduationCap,
  CheckCircle2,
  ListChecks,
} from 'lucide-react';

export interface StationMetadata {
  station_id?: string;
  duration_minutes?: number;
  time_block?: string;
  equipment?: string[];
  tracking?: { type: string; log_fields?: string[]; [key: string]: unknown };
  instructor_required?: boolean;
  roles?: string[];
  instructor_tiering?: {
    one_instructor?: string;
    two_instructors?: string;
    three_instructors?: string;
  };
  stress_layers?: string[];
  common_errors?: string[];
  scenario_cards?: Array<Record<string, string>>;
  available_stations?: Array<{
    station_id: string;
    station_name: string;
    category?: string;
    duration_per_student_minutes?: number;
    description?: string;
    equipment?: string[];
  }>;
  available_scenarios?: Array<Record<string, string>>;
  // S3 Drill Data fields
  objectives?: string[];
  student_instructions?: string[];
  instructor_guide?: {
    briefing?: { duration_minutes?: number; script?: string };
    during_scenario?: string[];
    during_case?: string[];
    during_station?: string[];
    rotation_instructions?: string[];
    pacing?: string;
    debrief_each_student?: string[];
    [key: string]: unknown;
  };
  case_bank?: Array<{
    case_id: string;
    case_name?: string;
    vignette?: string;
    vitals?: string;
    expected_response?: Record<string, unknown>;
    follow_up_questions?: string[];
    [key: string]: unknown;
  }>;
  rhythm_cases?: Array<{
    case_id: string;
    rhythm?: string;
    treatment_sequence?: string;
    stable_presentation?: string;
    unstable_presentation?: string;
    decision_point?: string;
    [key: string]: unknown;
  }>;
  minicode_phase_overlay?: {
    walk_through?: {
      weeks?: string;
      instructor_role?: string;
      student_expectation?: string;
      stress_layers_active?: boolean;
      rhythm_complexity?: string;
      pass_criteria?: string;
    };
    pressured?: {
      weeks?: string;
      instructor_role?: string;
      student_expectation?: string;
      stress_layers_active?: boolean;
      rhythm_complexity?: string;
      pass_criteria?: string;
    };
    full_lead?: {
      weeks?: string;
      instructor_role?: string;
      student_expectation?: string;
      stress_layers_active?: boolean;
      rhythm_complexity?: string;
      pass_criteria?: string;
    };
  };
  key_observations?: string[];
  stress_layers_detailed?: Array<{ layer: string; description: string }>;
}

interface TemplateGuideSectionProps {
  metadata: StationMetadata;
}

export default function TemplateGuideSection({ metadata }: TemplateGuideSectionProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [showAllCases, setShowAllCases] = useState(false);

  const m = metadata;

  const hasTimeBlock = m.time_block || m.duration_minutes;
  const hasEquipment = m.equipment && m.equipment.length > 0;
  const hasInstructorTiering =
    m.instructor_tiering &&
    (m.instructor_tiering.one_instructor ||
      m.instructor_tiering.two_instructors ||
      m.instructor_tiering.three_instructors);
  const hasRoles = m.roles && m.roles.length > 0;
  const hasCommonErrors = m.common_errors && m.common_errors.length > 0;
  const hasScenarioCards = m.scenario_cards && m.scenario_cards.length > 0;
  const hasAvailableStations =
    m.available_stations && m.available_stations.length > 0;
  const hasStressLayers = m.stress_layers && m.stress_layers.length > 0;

  // S3 Drill Data checks
  const hasObjectives = m.objectives && m.objectives.length > 0;
  const hasStudentInstructions = m.student_instructions && m.student_instructions.length > 0;
  const hasInstructorGuide = m.instructor_guide && (m.instructor_guide.briefing?.script || m.instructor_guide.during_scenario?.length || m.instructor_guide.during_case?.length);
  const hasCaseBank = m.case_bank && m.case_bank.length > 0;
  const hasRhythmCases = m.rhythm_cases && m.rhythm_cases.length > 0;
  const hasMinicode = m.minicode_phase_overlay && (m.minicode_phase_overlay.walk_through || m.minicode_phase_overlay.pressured || m.minicode_phase_overlay.full_lead);
  const hasKeyObservations = m.key_observations && m.key_observations.length > 0;
  const hasDetailedStressLayers = m.stress_layers_detailed && m.stress_layers_detailed.length > 0;

  const hasAnySection =
    hasTimeBlock ||
    hasEquipment ||
    hasInstructorTiering ||
    hasRoles ||
    hasCommonErrors ||
    hasScenarioCards ||
    hasAvailableStations ||
    hasStressLayers ||
    hasObjectives ||
    hasStudentInstructions ||
    hasInstructorGuide ||
    hasCaseBank ||
    hasRhythmCases ||
    hasMinicode ||
    hasKeyObservations ||
    hasDetailedStressLayers;

  if (!hasAnySection) return null;

  return (
    <div className="border border-orange-200 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/20 rounded-lg">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex items-center justify-between w-full p-3 text-left"
        aria-expanded={!collapsed}
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-800 dark:text-orange-300">
          <BookOpen className="w-4 h-4 shrink-0" />
          Template Guide
        </span>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
        ) : (
          <ChevronUp className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
        )}
      </button>

      {/* Collapsible content */}
      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          {/* Time Block */}
          {hasTimeBlock && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <Clock className="w-3 h-3" />
                Time Block
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {m.time_block
                  ? m.duration_minutes
                    ? `${m.time_block} (${m.duration_minutes} min)`
                    : m.time_block
                  : `${m.duration_minutes} min`}
              </p>
            </div>
          )}

          {/* Equipment Needed */}
          {hasEquipment && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <Wrench className="w-3 h-3" />
                Equipment Needed
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {m.equipment!.map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instructor Tiering */}
          {hasInstructorTiering && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <Users className="w-3 h-3" />
                Instructor Tiering
              </p>
              <div className="space-y-0.5">
                {m.instructor_tiering!.three_instructors && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">3 instructors:</span>{' '}
                    {m.instructor_tiering!.three_instructors}
                  </p>
                )}
                {m.instructor_tiering!.two_instructors && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">2 instructors:</span>{' '}
                    {m.instructor_tiering!.two_instructors}
                  </p>
                )}
                {m.instructor_tiering!.one_instructor && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">1 instructor:</span>{' '}
                    {m.instructor_tiering!.one_instructor}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Team Roles */}
          {hasRoles && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <Users className="w-3 h-3" />
                Team Roles
              </p>
              <div className="flex flex-wrap gap-1">
                {m.roles!.map((role, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-xs rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 capitalize"
                  >
                    {role.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Common Errors */}
          {hasCommonErrors && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <AlertTriangle className="w-3 h-3" />
                Common Errors (Watch For)
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-2">
                <ul className="list-disc list-inside space-y-0.5">
                  {m.common_errors!.map((err, idx) => (
                    <li key={idx} className="text-sm text-amber-900 dark:text-amber-200">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Scenario Cards */}
          {hasScenarioCards && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <BookOpen className="w-3 h-3" />
                Scenario Cards ({m.scenario_cards!.length})
              </p>
              <div className="space-y-1">
                {m.scenario_cards!.map((card, idx) => (
                  <div
                    key={idx}
                    className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 flex flex-wrap gap-x-3 gap-y-0.5"
                  >
                    {Object.entries(card).map(([key, value]) => (
                      <span key={key} className="text-gray-700 dark:text-gray-300">
                        <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                        {value}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Sub-Stations */}
          {hasAvailableStations && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <Layers className="w-3 h-3" />
                Available Sub-Stations
              </p>
              <div className="space-y-1.5">
                {m.available_stations!.map((sub, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {sub.station_name}
                      </span>
                      {sub.category && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          {sub.category}
                        </span>
                      )}
                      {sub.duration_per_student_minutes && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {sub.duration_per_student_minutes} min/student
                        </span>
                      )}
                    </div>
                    {sub.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {sub.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stress Layers (simple string array) */}
          {hasStressLayers && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <Layers className="w-3 h-3" />
                Stress Layers
              </p>
              <div className="flex flex-wrap gap-1">
                {m.stress_layers!.map((layer, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300"
                  >
                    {layer}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Learning Objectives */}
          {hasObjectives && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Target className="w-3 h-3" /> Learning Objectives
              </h4>
              <ol className="list-decimal list-inside space-y-0.5 text-sm text-gray-700 dark:text-gray-300">
                {m.objectives!.map((obj, i) => <li key={i}>{obj}</li>)}
              </ol>
            </div>
          )}

          {/* Student Instructions */}
          {hasStudentInstructions && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <GraduationCap className="w-3 h-3" /> Student Instructions
              </h4>
              <ol className="list-decimal list-inside space-y-0.5 text-sm text-gray-700 dark:text-gray-300">
                {m.student_instructions!.map((inst, i) => <li key={i}>{inst}</li>)}
              </ol>
            </div>
          )}

          {/* Instructor Guide */}
          {hasInstructorGuide && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <ListChecks className="w-3 h-3" /> Instructor Guide
              </h4>
              <div className="space-y-2">
                {m.instructor_guide!.briefing?.script && (
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-800 dark:text-blue-300">
                    <span className="font-medium">Briefing{m.instructor_guide!.briefing.duration_minutes ? ` (${m.instructor_guide!.briefing.duration_minutes} min)` : ''}:</span>{' '}
                    {m.instructor_guide!.briefing.script}
                  </div>
                )}
                {(m.instructor_guide!.during_scenario || m.instructor_guide!.during_case || m.instructor_guide!.during_station) && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">During Activity:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-sm text-gray-700 dark:text-gray-300">
                      {(m.instructor_guide!.during_scenario || m.instructor_guide!.during_case || m.instructor_guide!.during_station || []).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.instructor_guide!.rotation_instructions && m.instructor_guide!.rotation_instructions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rotation:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-sm text-gray-700 dark:text-gray-300">
                      {m.instructor_guide!.rotation_instructions.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.instructor_guide!.pacing && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">{m.instructor_guide!.pacing}</p>
                )}
              </div>
            </div>
          )}

          {/* Case Bank / Rhythm Cases */}
          {(hasCaseBank || hasRhythmCases) && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                {hasCaseBank ? `Case Bank (${m.case_bank!.length})` : `Rhythm Cases (${m.rhythm_cases!.length})`}
              </h4>
              <div className="space-y-2">
                {hasCaseBank && (showAllCases ? m.case_bank! : m.case_bank!.slice(0, 3)).map((c, i) => (
                  <div key={c.case_id || i} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{c.case_name || c.case_id}</p>
                    {c.vignette && <p className="text-gray-600 dark:text-gray-400 mt-0.5">{c.vignette}</p>}
                    {c.vitals && <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 font-mono">{c.vitals}</p>}
                    {c.follow_up_questions && c.follow_up_questions.length > 0 && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Follow-up: {c.follow_up_questions.join(' | ')}</p>
                    )}
                  </div>
                ))}
                {hasRhythmCases && (showAllCases ? m.rhythm_cases! : m.rhythm_cases!.slice(0, 3)).map((r, i) => (
                  <div key={r.case_id || i} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{r.rhythm || r.case_id}</p>
                    {r.treatment_sequence && <p className="text-gray-600 dark:text-gray-400 mt-0.5">{r.treatment_sequence}</p>}
                    {r.stable_presentation && <p className="text-xs text-green-600 dark:text-green-400 mt-0.5"><span className="font-medium">Stable:</span> {r.stable_presentation}</p>}
                    {r.unstable_presentation && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5"><span className="font-medium">Unstable:</span> {r.unstable_presentation}</p>}
                    {r.decision_point && <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 italic">{r.decision_point}</p>}
                  </div>
                ))}
                {((hasCaseBank && m.case_bank!.length > 3) || (hasRhythmCases && m.rhythm_cases!.length > 3)) && (
                  <button
                    onClick={() => setShowAllCases(!showAllCases)}
                    className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
                  >
                    {showAllCases ? 'Show fewer' : `Show all ${hasCaseBank ? m.case_bank!.length : m.rhythm_cases!.length} cases`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Minicode Phase Overlay */}
          {hasMinicode && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Minicode Phase Progression
              </h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['walk_through', 'pressured', 'full_lead'] as const).map(phase => {
                  const p = m.minicode_phase_overlay?.[phase];
                  if (!p) return null;
                  const labels: Record<string, string> = { walk_through: 'Walk-Through', pressured: 'Pressured', full_lead: 'Full Lead' };
                  const colors: Record<string, string> = {
                    walk_through: 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20',
                    pressured: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20',
                    full_lead: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20',
                  };
                  return (
                    <div key={phase} className={`p-2 rounded border ${colors[phase]}`}>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{labels[phase]}</p>
                      {p.weeks && <p className="text-gray-500 dark:text-gray-400">Weeks {p.weeks}</p>}
                      {p.instructor_role && <p className="mt-1"><span className="font-medium">Instructor:</span> {p.instructor_role}</p>}
                      {p.student_expectation && <p className="mt-1"><span className="font-medium">Student:</span> {p.student_expectation}</p>}
                      {p.pass_criteria && <p className="mt-1 text-gray-600 dark:text-gray-400 italic">{p.pass_criteria}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key Observations */}
          {hasKeyObservations && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Key Observations
              </h4>
              <ul className="space-y-0.5 text-sm text-gray-700 dark:text-gray-300">
                {m.key_observations!.map((obs, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    {obs}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Detailed Stress Layers (objects with {layer, description}) */}
          {hasDetailedStressLayers && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Stress Layers
              </h4>
              <div className="space-y-1.5">
                {m.stress_layers_detailed!.map((sl, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 whitespace-nowrap flex-shrink-0">
                      {sl.layer}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">{sl.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
