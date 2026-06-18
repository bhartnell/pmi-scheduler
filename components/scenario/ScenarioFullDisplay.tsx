'use client';

/**
 * ScenarioFullDisplay — the rich scenario reference panel originally
 * inlined in /app/clinical/summative-evaluations/[id]/grade/page.tsx.
 * Extracted into a shared component so the same instructor-facing
 * scenario view renders everywhere — currently:
 *
 *   - the summative-evaluation grading page (read-only reference
 *     while scoring a student)
 *   - the lab-management scenario detail page (preview pane next
 *     to the edit form)
 *
 * Sections rendered, in instructor-workflow order:
 *   1. INSTRUCTOR NOTES (READ FIRST) — yellow banner
 *   2. Dispatch Information
 *   3. Patient Information & Scene
 *   4. Primary Assessment (XABCDE)
 *   5. Secondary Assessment — vitals, history, SAMPLE, OPQRST,
 *      secondary survey
 *   6. Critical Actions
 *   7. Scenario Phases (collapsible per phase)
 *   8. Debrief Discussion Points
 *
 * Accepts a permissive scenario shape so both consumer types
 * (lab-management's Scenario interface + grading's
 * linked_scenario) work without coercion.
 */

import { useState } from 'react';
import {
  Info,
  Radio,
  User,
  Heart,
  Stethoscope,
  Thermometer,
  ClipboardList,
  Zap,
  Activity,
  AlertTriangle,
  FileText,
  ChevronUp,
  ChevronDown,
  Pill,
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any;

export interface ScenarioFullDisplayProps {
  scenario: AnyObj;
  /** When true, all phases start expanded. Default: only first. */
  expandAllPhases?: boolean;
  /** When true, hide the few always-rendering sections (Patient Info, Secondary
   *  Assessment, SAMPLE) if they have no data — for sparse cases (e.g. OCR'd
   *  ACLS cards). Default false → unchanged for existing consumers. */
  hideEmpty?: boolean;
}

export default function ScenarioFullDisplay({
  scenario,
  expandAllPhases = false,
  hideEmpty = false,
}: ScenarioFullDisplayProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(() => {
    const phases = Array.isArray(scenario?.phases) ? scenario.phases : [];
    if (expandAllPhases) {
      return new Set(phases.map((_: AnyObj, i: number) => i));
    }
    return phases.length > 0 ? new Set([0]) : new Set();
  });

  const togglePhase = (idx: number) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const initialVitals = scenario?.initial_vitals as AnyObj | null;
  const ekg = scenario?.ekg_findings as AnyObj | null;
  const opqrst = scenario?.opqrst as AnyObj | null;
  const sample = scenario?.sample_history as AnyObj | null;
  const secondary = scenario?.secondary_survey as AnyObj | null;
  const phases = Array.isArray(scenario?.phases) ? scenario.phases : [];

  const hasPrimaryAssessment =
    scenario?.assessment_x ||
    scenario?.assessment_a ||
    scenario?.assessment_b ||
    scenario?.assessment_c ||
    scenario?.assessment_d ||
    scenario?.assessment_e ||
    scenario?.general_impression ||
    scenario?.avpu ||
    scenario?.gcs ||
    scenario?.pupils;

  // Data-presence checks for the always-rendering sections (used by hideEmpty).
  const patientInfoHasData = !!(scenario?.patient_name || scenario?.patient_age != null || scenario?.patient_sex || scenario?.patient_weight || scenario?.chief_complaint);
  const vitalsHasData = !!(initialVitals && Object.values(initialVitals).some(v => v));
  const medHistHasData = !!(scenario?.medical_history?.length || scenario?.medications?.length || scenario?.allergies);
  const sampleHasData = !!(sample?.signs_symptoms || sample?.last_oral_intake || sample?.events_leading || scenario?.medications?.length || scenario?.medical_history?.length || scenario?.allergies || scenario?.chief_complaint);
  const opqrstHasData = !!(opqrst && Object.values(opqrst).some(v => v));
  const secondaryHasData = !!(secondary && Object.values(secondary).some(v => v));
  const secondaryWrapperHasData = vitalsHasData || medHistHasData || sampleHasData || opqrstHasData || secondaryHasData;
  const showPatientInfo = !hideEmpty || patientInfoHasData;
  const showSecondary = !hideEmpty || secondaryWrapperHasData;
  const showSample = !hideEmpty || sampleHasData;

  return (
    <div className="space-y-6">
      {/* 0. SCENARIO PRESENTATION (lead-in) + CASE NARRATIVE — free-text fields
          (e.g. OCR'd ACLS cards). Guarded on presence → auto-collapse when empty. */}
      {scenario?.patient_presentation && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Scenario
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{scenario.patient_presentation}</p>
        </div>
      )}
      {scenario?.history && (
        <details className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700" open>
          <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer flex items-center gap-2">
            <FileText className="w-4 h-4" /> Case Narrative / Progression
          </summary>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{scenario.history}</p>
        </details>
      )}

      {/* 1. INSTRUCTOR NOTES (TOP — READ FIRST!) */}
      {scenario?.instructor_notes && (
        <div className="bg-yellow-100 dark:bg-yellow-900/40 p-4 rounded-lg border-2 border-yellow-400 dark:border-yellow-600">
          <h4 className="font-bold text-yellow-900 dark:text-yellow-200 mb-2 flex items-center gap-2 text-lg">
            <Info className="w-5 h-5" />
            INSTRUCTOR NOTES (READ FIRST)
          </h4>
          <p className="text-sm text-yellow-800 dark:text-yellow-300 whitespace-pre-wrap">
            {scenario.instructor_notes}
          </p>
        </div>
      )}

      {/* 2. DISPATCH INFORMATION */}
      {(scenario?.dispatch_time || scenario?.dispatch_location || scenario?.dispatch_notes) && (
        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Radio className="w-4 h-4" />
            Dispatch Information
          </h4>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            {scenario.dispatch_time && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Time:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-white">
                  {scenario.dispatch_time}
                </span>
              </div>
            )}
            {scenario.dispatch_location && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Location:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-white">
                  {scenario.dispatch_location}
                </span>
              </div>
            )}
            {scenario.dispatch_notes && (
              <div className="md:col-span-3">
                <span className="text-gray-500 dark:text-gray-400">Notes:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-white">
                  {scenario.dispatch_notes}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. PATIENT INFORMATION & SCENE */}
      {showPatientInfo && (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <User className="w-4 h-4" />
          Patient Information & Scene
        </h4>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {scenario?.patient_name && <p><strong>Name:</strong> {scenario.patient_name}</p>}
              {scenario?.patient_age != null && <p><strong>Age:</strong> {scenario.patient_age} years</p>}
              {scenario?.patient_sex && <p><strong>Sex:</strong> {scenario.patient_sex}</p>}
              {scenario?.patient_weight && <p><strong>Weight:</strong> {scenario.patient_weight}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <h5 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Chief Complaint
            </h5>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {scenario?.chief_complaint || 'Not specified'}
            </p>
          </div>
        </div>
      </div>
      )}

      {/* 4. PRIMARY ASSESSMENT (XABCDE) */}
      {hasPrimaryAssessment && (
        <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-lg border border-cyan-200 dark:border-cyan-800">
          <h4 className="font-semibold text-cyan-800 dark:text-cyan-300 mb-3 flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            Primary Assessment (XABCDE)
          </h4>
          <div className="space-y-2 text-sm">
            {scenario.general_impression && (
              <div>
                <span className="font-medium text-cyan-700 dark:text-cyan-400">General Impression:</span>{' '}
                <span className="text-gray-700 dark:text-gray-300">{scenario.general_impression}</span>
              </div>
            )}
            {scenario.avpu && (
              <div>
                <span className="font-medium text-cyan-700 dark:text-cyan-400">AVPU:</span>{' '}
                <span className="text-gray-700 dark:text-gray-300">{scenario.avpu}</span>
              </div>
            )}
            <div className="grid gap-2 mt-2">
              {scenario.assessment_x && (
                <AssessmentRow letter="X" text={scenario.assessment_x} />
              )}
              {scenario.assessment_a && (
                <AssessmentRow letter="A" text={scenario.assessment_a} />
              )}
              {scenario.assessment_b && (
                <AssessmentRow letter="B" text={scenario.assessment_b} />
              )}
              {scenario.assessment_c && (
                <AssessmentRow letter="C" text={scenario.assessment_c} />
              )}
              {(scenario.assessment_d || scenario.gcs || scenario.pupils) && (
                <AssessmentRow
                  letter="D"
                  text={[
                    scenario.assessment_d,
                    scenario.gcs && `GCS: ${scenario.gcs}`,
                    scenario.pupils && `Pupils: ${scenario.pupils}`,
                  ].filter(Boolean).join(' | ')}
                />
              )}
              {scenario.assessment_e && (
                <AssessmentRow letter="E" text={scenario.assessment_e} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. SECONDARY ASSESSMENT */}
      {showSecondary && (
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 space-y-4">
        <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
          <Thermometer className="w-4 h-4" />
          Secondary Assessment
        </h4>

        {/* Vitals + EKG inline */}
        {initialVitals && Object.values(initialVitals).some(v => v) && (
          <div>
            <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">Vital Signs</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {initialVitals.bp && <VitalCell label="BP" value={initialVitals.bp} />}
              {initialVitals.hr && <VitalCell label="HR" value={initialVitals.hr} />}
              {initialVitals.rr && <VitalCell label="RR" value={initialVitals.rr} />}
              {initialVitals.spo2 && <VitalCell label="SpO2" value={`${initialVitals.spo2}%`} />}
              {initialVitals.temp && <VitalCell label="Temp" value={`${initialVitals.temp}°F`} />}
              {initialVitals.bgl && <VitalCell label="BGL" value={initialVitals.bgl} />}
              {initialVitals.gcs && <VitalCell label="GCS" value={initialVitals.gcs} />}
              {initialVitals.etco2 && <VitalCell label="ETCO2" value={initialVitals.etco2} />}
              {ekg?.rhythm && (
                <div className="bg-white dark:bg-gray-800 p-2 rounded col-span-2">
                  <span className="text-gray-500 dark:text-gray-400">EKG:</span>{' '}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {ekg.rhythm}
                    {ekg.rate ? ` @ ${ekg.rate}` : ''}
                  </span>
                </div>
              )}
            </div>
            {ekg && (ekg.interpretation || ekg.twelve_lead) && (
              <div className="mt-2 text-sm space-y-1">
                {ekg.interpretation && (
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">EKG Interpretation:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{ekg.interpretation}</span>
                  </p>
                )}
                {ekg.twelve_lead && (
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">12-Lead:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{ekg.twelve_lead}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Medical History */}
        {(scenario?.medical_history?.length || scenario?.medications?.length || scenario?.allergies) && (
          <div>
            <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">Medical History</h5>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              {scenario.medical_history?.length ? (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">PMHx:</span>
                  <ul className="text-gray-600 dark:text-gray-400 list-disc list-inside">
                    {scenario.medical_history.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {scenario.medications?.length ? (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <Pill className="w-3 h-3" /> Medications:
                  </span>
                  <ul className="text-gray-600 dark:text-gray-400 list-disc list-inside">
                    {scenario.medications.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {scenario.allergies && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Allergies:</span>
                  <p className="text-red-600 dark:text-red-400">{scenario.allergies}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SAMPLE History */}
        {showSample && (
        <div>
          <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
            <ClipboardList className="w-3 h-3" /> SAMPLE History
          </h5>
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">S - Signs/Symptoms:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">
                {sample?.signs_symptoms || scenario?.chief_complaint || '—'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">A - Allergies:</span>{' '}
              <span className={scenario?.allergies ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}>
                {scenario?.allergies || 'NKDA'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">M - Medications:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">
                {scenario?.medications?.length ? scenario.medications.join(', ') : 'None'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">P - Past Medical Hx:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">
                {scenario?.medical_history?.length ? scenario.medical_history.join(', ') : 'None'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">L - Last Oral Intake:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{sample?.last_oral_intake || '—'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">E - Events Leading:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{sample?.events_leading || '—'}</span>
            </div>
          </div>
        </div>
        )}

        {/* OPQRST */}
        {opqrst && Object.values(opqrst).some(v => v) && (
          <div>
            <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
              <Zap className="w-3 h-3" /> OPQRST (Pain Assessment)
            </h5>
            <div className="grid md:grid-cols-2 gap-1 text-sm">
              {opqrst.onset && <OpqrstRow letter="O" label="Onset" value={opqrst.onset} />}
              {opqrst.provocation && <OpqrstRow letter="P" label="Provocation" value={opqrst.provocation} />}
              {opqrst.quality && <OpqrstRow letter="Q" label="Quality" value={opqrst.quality} />}
              {opqrst.radiation && <OpqrstRow letter="R" label="Radiation" value={opqrst.radiation} />}
              {opqrst.severity && <OpqrstRow letter="S" label="Severity" value={opqrst.severity} />}
              {opqrst.time_onset && <OpqrstRow letter="T" label="Time" value={opqrst.time_onset} />}
            </div>
          </div>
        )}

        {/* Secondary Survey */}
        {secondary && Object.values(secondary).some(v => v) && (
          <div>
            <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Secondary Survey (Physical Exam)
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {secondary.head && <SurveyCell label="Head" value={secondary.head} />}
              {secondary.neck && <SurveyCell label="Neck" value={secondary.neck} />}
              {secondary.chest && <SurveyCell label="Chest" value={secondary.chest} />}
              {secondary.abdomen && <SurveyCell label="Abdomen" value={secondary.abdomen} />}
              {secondary.back && <SurveyCell label="Back" value={secondary.back} />}
              {secondary.pelvis && <SurveyCell label="Pelvis" value={secondary.pelvis} />}
              {secondary.extremities && (
                <div className="bg-white dark:bg-gray-800 p-2 rounded col-span-2 md:col-span-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Extremities:</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">{secondary.extremities}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* 6. CRITICAL ACTIONS */}
      {scenario?.critical_actions?.length ? (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Critical Actions (Must Perform)
          </h4>
          <ul className="text-sm text-red-700 dark:text-red-400 list-disc list-inside">
            {scenario.critical_actions.map((action: string, idx: number) => (
              <li key={idx}>{action}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 7. SCENARIO PHASES */}
      {phases.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Scenario Phases
          </h4>
          <div className="space-y-2">
            {phases.map((phase: AnyObj, idx: number) => (
              <div
                key={idx}
                className="border dark:border-gray-700 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => togglePhase(idx)}
                  className="w-full px-4 py-2 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span className="font-medium text-gray-900 dark:text-white">
                    {phase.name && !/^Phase \d+$/i.test(phase.name)
                      ? `Phase ${idx + 1}: ${phase.name}`
                      : `Phase ${idx + 1}`}
                  </span>
                  {expandedPhases.has(idx) ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {expandedPhases.has(idx) && (
                  <div className="p-4 space-y-3">
                    {phase.vitals && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Vitals
                        </h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          {phase.vitals.bp && <PhaseVitalCell tone="blue" label="BP" value={phase.vitals.bp} />}
                          {phase.vitals.hr && <PhaseVitalCell tone="red" label="HR" value={phase.vitals.hr} />}
                          {phase.vitals.rr && <PhaseVitalCell tone="green" label="RR" value={phase.vitals.rr} />}
                          {phase.vitals.spo2 && <PhaseVitalCell tone="purple" label="SpO2" value={`${phase.vitals.spo2}%`} />}
                          {phase.vitals.temp && <PhaseVitalCell tone="orange" label="Temp" value={`${phase.vitals.temp}°F`} />}
                          {phase.vitals.bgl && <PhaseVitalCell tone="yellow" label="BGL" value={phase.vitals.bgl} />}
                          {phase.vitals.gcs && <PhaseVitalCell tone="gray" label="GCS" value={phase.vitals.gcs} />}
                          {phase.vitals.etco2 && <PhaseVitalCell tone="cyan" label="ETCO2" value={phase.vitals.etco2} />}
                          {(phase.vitals.rhythm || phase.vitals.ekg || phase.vitals.ekg_rhythm) && (
                            <PhaseVitalCell
                              tone="pink"
                              label="EKG Rhythm"
                              value={phase.vitals.ekg_rhythm || phase.vitals.rhythm || phase.vitals.ekg}
                              wide
                            />
                          )}
                        </div>
                      </div>
                    )}
                    {phase.presentation_notes && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Presentation
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {phase.presentation_notes}
                        </p>
                      </div>
                    )}
                    {Array.isArray(phase.expected_actions) && phase.expected_actions.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Expected Actions
                        </h5>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                          {phase.expected_actions.map((action: string, aIdx: number) => (
                            <li key={aIdx}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {phase.instructor_cues && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                        <h5 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                          Instructor Cues
                        </h5>
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">
                          {phase.instructor_cues}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. DEBRIEF DISCUSSION POINTS */}
      {scenario?.debrief_points?.length ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
          <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Debrief Discussion Points
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {scenario.debrief_points.map((point: string, idx: number) => (
              <li key={idx}>{point}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ─── Internal subcomponents ──────────────────────────────────────

function AssessmentRow({ letter, text }: { letter: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="inline-block w-6 h-6 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 rounded text-center font-bold text-sm leading-6">
        {letter}
      </span>
      <span className="text-gray-700 dark:text-gray-300 flex-1">{text}</span>
    </div>
  );
}

function VitalCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-2 rounded">
      <span className="text-gray-500 dark:text-gray-400">{label}:</span>{' '}
      <span className="font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

function OpqrstRow({ letter, label, value }: { letter: string; label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-gray-700 dark:text-gray-300">{letter} - {label}:</span>{' '}
      <span className="text-gray-600 dark:text-gray-400">{value}</span>
    </div>
  );
}

function SurveyCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-2 rounded">
      <span className="font-medium text-gray-700 dark:text-gray-300">{label}:</span>{' '}
      <span className="text-gray-600 dark:text-gray-400">{value}</span>
    </div>
  );
}

const TONE_BG: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-900/20',
  red: 'bg-red-50 dark:bg-red-900/20',
  green: 'bg-green-50 dark:bg-green-900/20',
  purple: 'bg-purple-50 dark:bg-purple-900/20',
  orange: 'bg-orange-50 dark:bg-orange-900/20',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/20',
  gray: 'bg-gray-50 dark:bg-gray-700',
  cyan: 'bg-cyan-50 dark:bg-cyan-900/20',
  pink: 'bg-pink-50 dark:bg-pink-900/20',
};

function PhaseVitalCell({
  tone,
  label,
  value,
  wide = false,
}: {
  tone: keyof typeof TONE_BG;
  label: string;
  value: string | number;
  wide?: boolean;
}) {
  return (
    <div className={`${TONE_BG[tone]} p-2 rounded${wide ? ' col-span-2' : ''}`}>
      <span className="text-gray-500 dark:text-gray-400">{label}:</span>{' '}
      <span className="font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}
