'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  ExternalLink,
  Activity,
  User,
  Radio,
  Stethoscope,
  StickyNote,
} from 'lucide-react';
import type { Station, ScenarioPhase } from './types';
import { toArray } from './types';

interface ScenarioGradingProps {
  station: Station;
  showScenarioDetails: boolean;
  onToggleScenarioDetails: () => void;
  skillSheetIds: Record<string, string>;
  onOpenSkillSheet: (sheetId: string) => void;
  scenarioNotes?: string;
  onScenarioNotesChange?: (notes: string) => void;
  isNremtTesting?: boolean;
}

function VitalsGrid({ vitals, compact }: { vitals: Record<string, string | undefined>; compact?: boolean }) {
  const vitalsList = [
    { key: 'bp', label: 'BP' },
    { key: 'hr', label: 'HR' },
    { key: 'rr', label: 'RR' },
    { key: 'spo2', label: 'SpO2' },
    { key: 'etco2', label: 'EtCO2' },
    { key: 'temp', label: 'Temp' },
    { key: 'glucose', label: 'BGL', alt: 'blood_glucose' },
    { key: 'gcs', label: 'GCS', alt: 'gcs_total' },
    { key: 'pain', label: 'Pain', format: (v: string) => `${v}/10` },
    { key: 'ekg_rhythm', label: 'EKG' },
  ];

  const hasAny = vitalsList.some(v => vitals[v.key] || (v.alt && vitals[v.alt]));
  if (!hasAny) return null;

  return (
    <div className={`grid ${compact ? 'grid-cols-5 gap-1' : 'grid-cols-5 sm:grid-cols-5 gap-1.5'}`}>
      {vitalsList.map(v => {
        const value = vitals[v.key] || (v.alt ? vitals[v.alt] : undefined);
        if (!value) return null;
        const display = v.format ? v.format(value) : value;
        return (
          <div key={v.key} className="text-center p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">{v.label}</div>
            <div className="font-bold text-emerald-900 dark:text-emerald-100 text-xs">{display}</div>
          </div>
        );
      })}
    </div>
  );
}

function CollapsiblePhase({
  phase,
  index,
  scenario,
  defaultExpanded,
}: {
  phase: ScenarioPhase;
  index: number;
  scenario: NonNullable<Station['scenario']>;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  if (!phase) return null;

  const v = phase.vitals || {};
  const expectedActions = phase.expected_actions || (phase.expected_interventions ? toArray(phase.expected_interventions).join(', ') : '');

  // Scene info
  const hasSceneInfo = phase.scene_safety || phase.mechanism_injury || phase.nature_illness || phase.resources_needed || phase.environmental_concerns;

  // XABCDE from phase data, falling back to scenario-level
  const xabcde = {
    x: phase.hemorrhage_control || scenario.assessment_x || null,
    a: phase.airway || scenario.assessment_a || null,
    b: phase.breathing || scenario.assessment_b || (v.rr || v.lung_sounds ? `RR ${v.rr || '—'}${v.lung_sounds ? `, ${v.lung_sounds}` : ''}` : null),
    c: phase.circulation || scenario.assessment_c || (v.hr || v.skin ? `HR ${v.hr || '—'}${v.skin ? `, skin ${v.skin}` : ''}${v.pulse_quality ? `, pulse ${v.pulse_quality}` : ''}` : null),
    d: phase.disability || scenario.assessment_d || (v.loc || v.gcs || v.gcs_total || scenario.gcs || scenario.pupils ? `${v.loc || ''}${v.gcs || v.gcs_total || scenario.gcs ? ` GCS ${v.gcs || v.gcs_total || scenario.gcs}` : ''}${v.pupils || scenario.pupils ? `, pupils ${v.pupils || scenario.pupils}` : ''}`.trim() : null),
    e: phase.expose || scenario.assessment_e || null,
  };
  const hasXABCDE = Object.values(xabcde).some(Boolean);

  // AVPU
  const avpu = phase.avpu || scenario.avpu || (v.loc ? (
    v.loc.toLowerCase().includes('alert') ? 'Alert' :
    v.loc.toLowerCase().includes('verbal') ? 'Verbal' :
    v.loc.toLowerCase().includes('pain') ? 'Pain' :
    v.loc.toLowerCase().includes('unresponsive') ? 'Unresponsive' : null
  ) : null);

  const generalImpression = phase.general_impression || scenario.general_impression;

  // SAMPLE - show only on first phase
  const sampleData = {
    signs_symptoms: phase.signs_symptoms || scenario.sample_history?.signs_symptoms || scenario.chief_complaint,
    allergies: scenario.allergies,
    medications: scenario.medications,
    medical_history: scenario.medical_history,
    last_oral_intake: phase.last_oral_intake || scenario.sample_history?.last_oral_intake,
    events_leading: phase.events_leading || scenario.sample_history?.events_leading,
  };
  const showSAMPLE = index === 0 && (sampleData.signs_symptoms || sampleData.allergies || sampleData.medications || sampleData.medical_history || sampleData.last_oral_intake || sampleData.events_leading);

  // OPQRST
  const opqrstData = {
    onset: phase.onset || scenario.opqrst?.onset,
    provocation: phase.provocation || scenario.opqrst?.provocation,
    quality: phase.quality || scenario.opqrst?.quality,
    radiation: phase.radiation || scenario.opqrst?.radiation,
    severity: phase.severity || scenario.opqrst?.severity,
    time_onset: phase.time_onset || scenario.opqrst?.time_onset,
  };
  const hasOPQRST = Object.values(opqrstData).some(Boolean);

  // Phase step colors
  const stepColors = [
    'border-blue-400 dark:border-blue-600',
    'border-amber-400 dark:border-amber-600',
    'border-purple-400 dark:border-purple-600',
    'border-green-400 dark:border-green-600',
    'border-rose-400 dark:border-rose-600',
  ];
  const headerBgs = [
    'bg-blue-50 dark:bg-blue-900/30',
    'bg-amber-50 dark:bg-amber-900/30',
    'bg-purple-50 dark:bg-purple-900/30',
    'bg-green-50 dark:bg-green-900/30',
    'bg-rose-50 dark:bg-rose-900/30',
  ];
  const headerTexts = [
    'text-blue-800 dark:text-blue-300',
    'text-amber-800 dark:text-amber-300',
    'text-purple-800 dark:text-purple-300',
    'text-green-800 dark:text-green-300',
    'text-rose-800 dark:text-rose-300',
  ];
  const colorIdx = index % stepColors.length;

  return (
    <div className="relative">
      {/* Vertical connector line */}
      {index > 0 && (
        <div className="absolute -top-4 left-5 w-0.5 h-4 bg-gray-300 dark:bg-gray-600" />
      )}

      <div className={`rounded-lg border-l-4 ${stepColors[colorIdx]} bg-white dark:bg-gray-800 shadow-sm overflow-hidden`}>
        {/* Phase Header - clickable to toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full px-4 py-3 flex items-center gap-3 text-left ${headerBgs[colorIdx]} hover:opacity-90 transition-opacity`}
        >
          {/* Step indicator */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${headerTexts[colorIdx]} bg-white dark:bg-gray-800 border-2 ${stepColors[colorIdx]}`}>
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <span className={`font-semibold text-sm ${headerTexts[colorIdx]}`}>
              {phase.phase_name || `Phase ${index + 1}`}
            </span>
            {phase.trigger && (
              <span className="text-xs text-gray-500 dark:text-gray-400 italic ml-2">
                {phase.trigger}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          )}
        </button>

        {/* Phase Content */}
        {expanded && (
          <div className="p-4 space-y-4 border-t border-gray-100 dark:border-gray-700">
            {/* Presentation Notes */}
            {phase.presentation_notes && (
              <p className="text-sm text-gray-700 dark:text-gray-300 italic border-l-2 border-gray-300 dark:border-gray-600 pl-3 bg-gray-50 dark:bg-gray-700/50 py-2 rounded-r">
                {phase.presentation_notes}
              </p>
            )}

            {/* Phase Vitals (always show if present) */}
            <VitalsGrid vitals={v as Record<string, string | undefined>} compact />

            {/* Additional vital details (lung sounds, skin, etc.) */}
            {(v.lung_sounds || v.skin || v.jvd || v.edema || v.capillary_refill || v.twelve_lead_notes) && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {v.lung_sounds && (
                  <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-gray-500 dark:text-gray-400">Lungs:</span> <span className="font-medium text-gray-900 dark:text-white">{v.lung_sounds}{v.lung_notes ? ` (${v.lung_notes})` : ''}</span>
                  </div>
                )}
                {v.skin && (
                  <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-gray-500 dark:text-gray-400">Skin:</span> <span className="font-medium text-gray-900 dark:text-white">{v.skin}</span>
                  </div>
                )}
                {v.jvd && (
                  <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-gray-500 dark:text-gray-400">JVD:</span> <span className="font-medium text-gray-900 dark:text-white">{v.jvd}</span>
                  </div>
                )}
                {v.edema && (
                  <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-gray-500 dark:text-gray-400">Edema:</span> <span className="font-medium text-gray-900 dark:text-white">{v.edema}</span>
                  </div>
                )}
                {v.capillary_refill && (
                  <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-gray-500 dark:text-gray-400">Cap Refill:</span> <span className="font-medium text-gray-900 dark:text-white">{v.capillary_refill}</span>
                  </div>
                )}
                {v.twelve_lead_notes && (
                  <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">12-Lead:</span> <span className="font-medium text-gray-900 dark:text-white">{v.twelve_lead_notes}</span>
                  </div>
                )}
              </div>
            )}

            {/* Scene Size-Up */}
            {hasSceneInfo && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider border-b border-red-200 dark:border-red-800 pb-1">
                  Scene Size-Up
                </div>
                <div className="text-xs space-y-1 pl-2">
                  {phase.scene_safety && <div><span className="text-gray-500 dark:text-gray-400">Safety:</span> <span className="text-gray-900 dark:text-white">{phase.scene_safety}</span></div>}
                  {phase.mechanism_injury && <div><span className="text-gray-500 dark:text-gray-400">MOI:</span> <span className="text-gray-900 dark:text-white">{phase.mechanism_injury}</span></div>}
                  {phase.nature_illness && <div><span className="text-gray-500 dark:text-gray-400">NOI:</span> <span className="text-gray-900 dark:text-white">{phase.nature_illness}</span></div>}
                  {phase.resources_needed && <div><span className="text-gray-500 dark:text-gray-400">Resources:</span> <span className="text-gray-900 dark:text-white">{phase.resources_needed}</span></div>}
                  {phase.environmental_concerns && <div><span className="text-gray-500 dark:text-gray-400">Environment:</span> <span className="text-gray-900 dark:text-white">{phase.environmental_concerns}</span></div>}
                </div>
              </div>
            )}

            {/* Primary Assessment - XABCDE */}
            {hasXABCDE && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider border-b border-orange-200 dark:border-orange-800 pb-1">
                  Primary Assessment (XABCDE)
                </div>
                <div className="text-xs space-y-1 pl-2">
                  {(['x', 'a', 'b', 'c', 'd', 'e'] as const).map(letter => {
                    const labels: Record<string, string> = { x: 'Hemorrhage', a: 'Airway', b: 'Breathing', c: 'Circulation', d: 'Disability', e: 'Expose' };
                    const val = xabcde[letter];
                    return (
                      <div key={letter} className="flex">
                        <span className="w-5 font-bold text-orange-600 dark:text-orange-400">{letter.toUpperCase()}</span>
                        <span className="text-gray-500 dark:text-gray-400 w-24">{labels[letter]}:</span>
                        <span className={`flex-1 ${val ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{val || '—'}</span>
                      </div>
                    );
                  })}
                </div>
                {/* AVPU & General Impression */}
                <div className="flex gap-6 text-xs mt-1 pl-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <div><span className="font-medium text-gray-500 dark:text-gray-400">AVPU:</span> <span className={`font-medium ${avpu ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{avpu || '—'}</span></div>
                  <div><span className="font-medium text-gray-500 dark:text-gray-400">Impression:</span> <span className={`font-medium ${generalImpression ? (generalImpression.toLowerCase().includes('sick') || generalImpression.toLowerCase().includes('critical') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400') : 'text-gray-400 dark:text-gray-500 italic'}`}>{generalImpression || '—'}</span></div>
                </div>
              </div>
            )}

            {/* SAMPLE History (first phase only) */}
            {showSAMPLE && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider border-b border-green-200 dark:border-green-800 pb-1">
                  SAMPLE History
                </div>
                <div className="text-xs space-y-1 bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                  {([
                    { letter: 'S', label: 'Signs/Symptoms', value: sampleData.signs_symptoms },
                    { letter: 'A', label: 'Allergies', value: sampleData.allergies ? (toArray(sampleData.allergies).join(', ') || 'NKDA') : null },
                    { letter: 'M', label: 'Medications', value: sampleData.medications && toArray(sampleData.medications).length > 0 ? toArray(sampleData.medications).join(', ') : null },
                    { letter: 'P', label: 'Past Medical Hx', value: sampleData.medical_history && toArray(sampleData.medical_history).length > 0 ? toArray(sampleData.medical_history).join(', ') : null },
                    { letter: 'L', label: 'Last Oral Intake', value: sampleData.last_oral_intake },
                    { letter: 'E', label: 'Events Leading', value: sampleData.events_leading },
                  ] as const).map(item => (
                    <div key={item.letter} className="flex">
                      <span className="w-4 font-bold text-green-600 dark:text-green-400">{item.letter}</span>
                      <span className="text-gray-500 dark:text-gray-400 w-32">{item.label}:</span>
                      <span className={`flex-1 ${item.value ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{item.value || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OPQRST */}
            {hasOPQRST && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider border-b border-purple-200 dark:border-purple-800 pb-1">
                  OPQRST
                </div>
                <div className="text-xs space-y-1 bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                  {([
                    { letter: 'O', label: 'Onset', value: opqrstData.onset },
                    { letter: 'P', label: 'Provocation', value: opqrstData.provocation },
                    { letter: 'Q', label: 'Quality', value: opqrstData.quality },
                    { letter: 'R', label: 'Radiation', value: opqrstData.radiation },
                    { letter: 'S', label: 'Severity', value: opqrstData.severity },
                    { letter: 'T', label: 'Time', value: opqrstData.time_onset },
                  ] as const).map(item => (
                    <div key={item.letter} className="flex">
                      <span className="w-4 font-bold text-purple-600 dark:text-purple-400">{item.letter}</span>
                      <span className="text-gray-500 dark:text-gray-400 w-32">{item.label}:</span>
                      <span className={`flex-1 ${item.value ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{item.value || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expected Interventions */}
            {expectedActions && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b border-indigo-200 dark:border-indigo-800 pb-1">
                  Expected Interventions
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 pl-2">{expectedActions}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScenarioGrading({
  station,
  showScenarioDetails,
  onToggleScenarioDetails,
  skillSheetIds,
  onOpenSkillSheet,
  scenarioNotes,
  onScenarioNotesChange,
  isNremtTesting,
}: ScenarioGradingProps) {
  const scenario = station.scenario;

  return (
    <>
      {/* Skills Station Header & Materials */}
      {station.station_type === 'skills' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-1">
                <ClipboardCheck className="w-4 h-4" />
                <span>Skills Station</span>
              </div>
              <h2 className="text-xl font-bold text-green-900 dark:text-green-100">
                {station.skill_name || station.custom_title || 'Skills Practice'}
              </h2>
            </div>
          </div>

          {/* View Skill Sheet for main station skill */}
          {(station.skill_name || station.custom_title) && (
            <div className="mb-3">
              {skillSheetIds[station.skill_name || station.custom_title || ''] ? (
                <button
                  onClick={() => onOpenSkillSheet(skillSheetIds[station.skill_name || station.custom_title || ''])}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                >
                  <ClipboardCheck className="w-3 h-3" />
                  View Skill Sheet
                </button>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">No skill sheet available</span>
              )}
            </div>
          )}

          {/* Station Details/Instructions */}
          {station.station_details && (
            <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700">
              <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Instructions:</div>
              <div className="text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap">{station.station_details}</div>
            </div>
          )}

          {/* Assigned Skills List */}
          {((station.station_skills && station.station_skills.length > 0) || (station.custom_skills && station.custom_skills.length > 0)) && (
            <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700">
              <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">Skills to Practice:</div>
              <div className="space-y-2">
                {station.station_skills?.map((ss) => (
                  <div key={ss.skill.id} className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 text-sm rounded-lg">
                      {ss.skill.name}
                    </span>
                    {skillSheetIds[ss.skill.name] ? (
                      <button
                        onClick={() => onOpenSkillSheet(skillSheetIds[ss.skill.name])}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                      >
                        <ClipboardCheck className="w-3 h-3" />
                        View Skill Sheet
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500 italic">No skill sheet</span>
                    )}
                  </div>
                ))}
                {station.custom_skills?.map((cs) => (
                  <div key={cs.id} className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-sm rounded-lg">
                      {cs.name} <span className="text-xs opacity-70">(custom)</span>
                    </span>
                    {skillSheetIds[cs.name] ? (
                      <button
                        onClick={() => onOpenSkillSheet(skillSheetIds[cs.name])}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                      >
                        <ClipboardCheck className="w-3 h-3" />
                        View Skill Sheet
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500 italic">No skill sheet</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resource Links */}
          {(station.skill_sheet_url || station.instructions_url) && (
            <div className="flex flex-wrap gap-3 mb-3">
              {station.skill_sheet_url && (
                <a
                  href={station.skill_sheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  <FileText className="w-4 h-4" />
                  View Skill Sheet
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {station.instructions_url && (
                <a
                  href={station.instructions_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded-lg hover:bg-green-200 dark:hover:bg-green-700 text-sm border border-green-300 dark:border-green-600"
                >
                  <FileText className="w-4 h-4" />
                  View Instructions
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Station Notes */}
          {station.station_notes && (
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700">
              <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Instructor Notes:</div>
              <div className="text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap">{station.station_notes}</div>
            </div>
          )}
        </div>
      )}

      {/* Scenario Info — Improved Layout */}
      {scenario ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* === ALWAYS VISIBLE: Scenario Header === */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">{scenario.title}</h2>
                <p className="text-blue-100 text-sm">
                  {scenario.category}{scenario.subcategory ? ` / ${scenario.subcategory}` : ''}
                  <span className="mx-1.5 opacity-50">|</span>
                  {scenario.difficulty}
                  {scenario.estimated_duration ? <><span className="mx-1.5 opacity-50">|</span>{scenario.estimated_duration} min</> : ''}
                </p>
              </div>
              <button
                onClick={onToggleScenarioDetails}
                className="text-white/80 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm flex items-center gap-1"
              >
                {showScenarioDetails ? (
                  <>Hide Details <ChevronDown className="w-4 h-4" /></>
                ) : (
                  <>Show Details <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>

          {/* === ALWAYS VISIBLE: Dispatch + Patient Quick Strip === */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            {/* Dispatch / Chief Complaint */}
            {(scenario.chief_complaint || scenario.dispatch_location || scenario.dispatch_notes) && (
              <div className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                <div className="flex items-start gap-2">
                  <Radio className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    {scenario.chief_complaint && (
                      <span className="font-semibold text-red-800 dark:text-red-300">CC: {scenario.chief_complaint}</span>
                    )}
                    {scenario.dispatch_location && (
                      <span className="text-red-700 dark:text-red-400 ml-2">@ {scenario.dispatch_location}</span>
                    )}
                    {scenario.dispatch_notes && (
                      <p className="text-red-700 dark:text-red-400 mt-0.5">{scenario.dispatch_notes}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Patient Info Strip */}
            <div className="px-4 py-2.5 flex flex-wrap gap-x-6 gap-y-1 text-sm bg-purple-50/50 dark:bg-purple-900/10">
              {scenario.patient_name && (
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-gray-500 dark:text-gray-400">Patient:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{scenario.patient_name}</span>
                </div>
              )}
              {(scenario.patient_age || scenario.patient_sex) && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Age/Sex:</span>{' '}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {scenario.patient_age ? `${scenario.patient_age} y/o` : ''}{scenario.patient_sex ? ` ${scenario.patient_sex}` : ''}
                    {scenario.patient_weight ? `, ${scenario.patient_weight} kg` : ''}
                  </span>
                </div>
              )}
              {scenario.general_impression && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Impression:</span>{' '}
                  <span className={`font-semibold ${
                    scenario.general_impression.toLowerCase().includes('sick') || scenario.general_impression.toLowerCase().includes('critical')
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>{scenario.general_impression}</span>
                </div>
              )}
            </div>

            {/* Initial Vitals Strip — Always visible */}
            {scenario.initial_vitals && Object.keys(scenario.initial_vitals).length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-emerald-50/50 dark:bg-emerald-900/10">
                <div className="flex items-center gap-2 mb-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Initial Vitals</span>
                </div>
                <VitalsGrid vitals={scenario.initial_vitals as Record<string, string | undefined>} />
              </div>
            )}

            {/* Medical History Strip — Always visible */}
            {(scenario.medical_history || scenario.medications || scenario.allergies) && (
              <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 text-xs flex flex-wrap gap-x-4 gap-y-1">
                {scenario.medical_history && toArray(scenario.medical_history).length > 0 && (
                  <div><span className="font-semibold text-gray-500 dark:text-gray-400">PMHx:</span> <span className="text-gray-900 dark:text-white">{toArray(scenario.medical_history).join(', ')}</span></div>
                )}
                {scenario.medications && toArray(scenario.medications).length > 0 && (
                  <div><span className="font-semibold text-gray-500 dark:text-gray-400">Meds:</span> <span className="text-gray-900 dark:text-white">{toArray(scenario.medications).join(', ')}</span></div>
                )}
                {scenario.allergies && toArray(scenario.allergies).length > 0 && (
                  <div><span className="font-semibold text-gray-500 dark:text-gray-400">Allergies:</span> <span className="text-gray-900 dark:text-white">{toArray(scenario.allergies).join(', ')}</span></div>
                )}
              </div>
            )}
          </div>

          {/* === EXPANDABLE: Detailed Scenario Info === */}
          {showScenarioDetails && (
            <div className="px-4 py-4 space-y-4">
              {/* Instructor Notes (READ FIRST!) */}
              {scenario.instructor_notes && (
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg border-2 border-yellow-400 dark:border-yellow-600">
                  <h3 className="text-sm font-bold text-yellow-900 dark:text-yellow-200 mb-1">INSTRUCTOR NOTES (READ FIRST)</h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 whitespace-pre-wrap">{scenario.instructor_notes}</p>
                </div>
              )}

              {/* === PHASES: Visual Progression === */}
              {scenario.phases && scenario.phases.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" />
                    Scenario Phases
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">({scenario.phases.length} phases)</span>
                  </h3>
                  <div className="space-y-3 pl-1">
                    {scenario.phases.map((phase, index) => (
                      <CollapsiblePhase
                        key={index}
                        phase={phase}
                        index={index}
                        scenario={scenario}
                        defaultExpanded={index === 0}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback: Assessment structure when no phases */}
              {(!scenario.phases || scenario.phases.length === 0) && (
                <FallbackAssessmentStructure scenario={scenario} />
              )}

              {/* Secondary Survey */}
              {scenario.secondary_survey && Object.values(scenario.secondary_survey).some(Boolean) && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h3 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Secondary Survey</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(scenario.secondary_survey).map(([region, finding]) => {
                      if (!finding) return null;
                      return (
                        <div key={region} className="flex gap-2">
                          <span className="font-medium text-gray-500 dark:text-gray-400 capitalize">{region}:</span>
                          <span className="text-gray-900 dark:text-white">{finding}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* EKG Findings */}
              {scenario.ekg_findings && Object.values(scenario.ekg_findings).some(Boolean) && (
                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800">
                  <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">EKG / Cardiac Findings</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {scenario.ekg_findings.rhythm && <div><span className="text-gray-500 dark:text-gray-400">Rhythm:</span> <span className="font-medium text-gray-900 dark:text-white">{scenario.ekg_findings.rhythm}</span></div>}
                    {scenario.ekg_findings.rate && <div><span className="text-gray-500 dark:text-gray-400">Rate:</span> <span className="font-medium text-gray-900 dark:text-white">{scenario.ekg_findings.rate}</span></div>}
                    {scenario.ekg_findings.interpretation && <div className="col-span-2"><span className="text-gray-500 dark:text-gray-400">Interpretation:</span> <span className="font-medium text-gray-900 dark:text-white">{scenario.ekg_findings.interpretation}</span></div>}
                    {scenario.ekg_findings.twelve_lead && <div className="col-span-2"><span className="text-gray-500 dark:text-gray-400">12-Lead:</span> <span className="font-medium text-gray-900 dark:text-white">{scenario.ekg_findings.twelve_lead}</span></div>}
                  </div>
                </div>
              )}

              {/* Learning Objectives */}
              {scenario.learning_objectives && toArray(scenario.learning_objectives).length > 0 && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-300 mb-2">Learning Objectives</h3>
                  <ul className="text-sm text-indigo-700 dark:text-indigo-400 space-y-1">
                    {toArray(scenario.learning_objectives).map((obj, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-indigo-400 dark:text-indigo-500">•</span>
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Debrief Points */}
              {scenario.debrief_points && toArray(scenario.debrief_points).length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">Debrief Discussion Points</h3>
                  <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                    {toArray(scenario.debrief_points).map((point, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-amber-400 dark:text-amber-500">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* === Scenario Notes (Proctor Notes) — Always visible at bottom === */}
          {onScenarioNotesChange && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2 mb-1.5">
                <StickyNote className="w-4 h-4 text-amber-500" />
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {isNremtTesting ? 'NREMT Scenario Notes' : 'Scenario Notes'}
                </label>
                <span className="text-xs text-gray-400 dark:text-gray-500">(saved with evaluation)</span>
              </div>
              <textarea
                value={scenarioNotes || ''}
                onChange={(e) => onScenarioNotesChange(e.target.value)}
                placeholder={isNremtTesting
                  ? 'Record specific scenario details, variations, or modifications used for this attempt...'
                  : 'Record notes about scenario specifics, patient actor details, or modifications...'}
                className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
          )}
        </div>
      ) : station.station_type === 'skills' && !station.skill_name && !station.custom_title && !station.station_details ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h2 className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Skills Station
          </h2>
          <p className="text-green-700 dark:text-green-400 text-sm mt-1">
            This is a skills practice station. Grade using the simplified skill criteria below.
          </p>
        </div>
      ) : station.station_type === 'skills' ? (
        null // Skills station with details is handled above
      ) : station.station_type === 'documentation' ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h2 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documentation Station
          </h2>
          <p className="text-blue-700 dark:text-blue-400 text-sm mt-1">
            This is a documentation/PCR practice station. Grade based on documentation quality.
          </p>
        </div>
      ) : (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-300">No scenario assigned to this station</p>
        </div>
      )}
    </>
  );
}

/* Fallback assessment structure when no phases are defined */
function FallbackAssessmentStructure({ scenario }: { scenario: NonNullable<Station['scenario']> }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="relative">
      <div className="rounded-lg border-l-4 border-blue-400 dark:border-blue-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center gap-3 text-left bg-blue-50 dark:bg-blue-900/30 hover:opacity-90 transition-opacity"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-blue-800 dark:text-blue-300 bg-white dark:bg-gray-800 border-2 border-blue-400 dark:border-blue-600">
            1
          </div>
          <span className="font-semibold text-sm text-blue-800 dark:text-blue-300">Initial Presentation</span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 ml-auto" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400 ml-auto" />
          )}
        </button>

        {expanded && (
          <div className="p-4 space-y-4 border-t border-gray-100 dark:border-gray-700">
            {/* Primary Assessment - XABCDE */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider border-b border-orange-200 dark:border-orange-800 pb-1">
                Primary Assessment (XABCDE)
              </div>
              <div className="text-xs space-y-1 pl-2">
                {([
                  { letter: 'X', field: 'assessment_x', label: 'Hemorrhage' },
                  { letter: 'A', field: 'assessment_a', label: 'Airway' },
                  { letter: 'B', field: 'assessment_b', label: 'Breathing' },
                  { letter: 'C', field: 'assessment_c', label: 'Circulation' },
                  { letter: 'D', field: 'assessment_d', label: 'Disability' },
                  { letter: 'E', field: 'assessment_e', label: 'Expose' },
                ] as const).map(item => {
                  const val = scenario[item.field as keyof typeof scenario] as string | null;
                  const dVal = item.field === 'assessment_d' && !val
                    ? [scenario.gcs && `GCS: ${scenario.gcs}`, scenario.pupils && `Pupils: ${scenario.pupils}`].filter(Boolean).join(' | ') || null
                    : val;
                  return (
                    <div key={item.letter} className="flex">
                      <span className="w-5 font-bold text-orange-600 dark:text-orange-400">{item.letter}</span>
                      <span className="text-gray-500 dark:text-gray-400 w-24">{item.label}:</span>
                      <span className={`flex-1 ${dVal ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{dVal || '—'}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-6 text-xs mt-1 pl-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                <div><span className="font-medium text-gray-500 dark:text-gray-400">AVPU:</span> <span className={`font-medium ${scenario.avpu ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.avpu || '—'}</span></div>
                <div><span className="font-medium text-gray-500 dark:text-gray-400">Impression:</span> <span className={`font-medium ${scenario.general_impression ? (scenario.general_impression.toLowerCase().includes('sick') || scenario.general_impression.toLowerCase().includes('critical') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400') : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.general_impression || '—'}</span></div>
              </div>
            </div>

            {/* SAMPLE History */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider border-b border-green-200 dark:border-green-800 pb-1">
                SAMPLE History
              </div>
              <div className="text-xs space-y-1 bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                {([
                  { letter: 'S', label: 'Signs/Symptoms', value: scenario.chief_complaint },
                  { letter: 'A', label: 'Allergies', value: scenario.allergies ? (toArray(scenario.allergies).join(', ') || 'NKDA') : null },
                  { letter: 'M', label: 'Medications', value: scenario.medications && toArray(scenario.medications).length > 0 ? toArray(scenario.medications).join(', ') : null },
                  { letter: 'P', label: 'Past Medical Hx', value: scenario.medical_history && toArray(scenario.medical_history).length > 0 ? toArray(scenario.medical_history).join(', ') : null },
                  { letter: 'L', label: 'Last Oral Intake', value: scenario.sample_history?.last_oral_intake },
                  { letter: 'E', label: 'Events Leading', value: scenario.sample_history?.events_leading },
                ] as const).map(item => (
                  <div key={item.letter} className="flex">
                    <span className="w-4 font-bold text-green-600 dark:text-green-400">{item.letter}</span>
                    <span className="text-gray-500 dark:text-gray-400 w-32">{item.label}:</span>
                    <span className={`flex-1 ${item.value ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{item.value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* OPQRST */}
            {scenario.opqrst && Object.values(scenario.opqrst).some(Boolean) && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider border-b border-purple-200 dark:border-purple-800 pb-1">
                  OPQRST
                </div>
                <div className="text-xs space-y-1 bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                  {([
                    { letter: 'O', label: 'Onset', value: scenario.opqrst?.onset },
                    { letter: 'P', label: 'Provocation', value: scenario.opqrst?.provocation },
                    { letter: 'Q', label: 'Quality', value: scenario.opqrst?.quality },
                    { letter: 'R', label: 'Radiation', value: scenario.opqrst?.radiation },
                    { letter: 'S', label: 'Severity', value: scenario.opqrst?.severity },
                    { letter: 'T', label: 'Time', value: scenario.opqrst?.time_onset },
                  ] as const).map(item => (
                    <div key={item.letter} className="flex">
                      <span className="w-4 font-bold text-purple-600 dark:text-purple-400">{item.letter}</span>
                      <span className="text-gray-500 dark:text-gray-400 w-32">{item.label}:</span>
                      <span className={`flex-1 ${item.value ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{item.value || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
