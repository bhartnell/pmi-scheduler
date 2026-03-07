'use client';

import {
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileText,
  ExternalLink
} from 'lucide-react';
import type { Station } from './types';
import { toArray } from './types';

interface ScenarioGradingProps {
  station: Station;
  showScenarioDetails: boolean;
  onToggleScenarioDetails: () => void;
  skillSheetIds: Record<string, string>;
  onOpenSkillSheet: (sheetId: string) => void;
}

export default function ScenarioGrading({
  station,
  showScenarioDetails,
  onToggleScenarioDetails,
  skillSheetIds,
  onOpenSkillSheet,
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

      {/* Scenario Info */}
      {scenario ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <button
            onClick={onToggleScenarioDetails}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">{scenario.title}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {scenario.category}{scenario.subcategory ? ` / ${scenario.subcategory}` : ''} • {scenario.difficulty}
                {scenario.estimated_duration ? ` • ${scenario.estimated_duration} min` : ''}
              </p>
            </div>
            {showScenarioDetails ? <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
          </button>
          {showScenarioDetails && (
            <div className="px-4 pb-4 border-t dark:border-gray-700 space-y-4 mt-3">
              {/* 1. INSTRUCTOR NOTES (TOP - READ FIRST!) */}
              {scenario.instructor_notes && (
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg border-2 border-yellow-400 dark:border-yellow-600">
                  <h3 className="text-sm font-bold text-yellow-900 dark:text-yellow-200 mb-1">INSTRUCTOR NOTES (READ FIRST)</h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 whitespace-pre-wrap">{scenario.instructor_notes}</p>
                </div>
              )}

              {/* 2. Dispatch Info */}
              {(scenario.chief_complaint || scenario.dispatch_location) && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">Dispatch</h3>
                  {scenario.chief_complaint && (
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                      Chief Complaint: {scenario.chief_complaint}
                    </p>
                  )}
                  {scenario.dispatch_location && (
                    <p className="text-sm text-red-700 dark:text-red-400">Location: {scenario.dispatch_location}</p>
                  )}
                  {scenario.dispatch_notes && (
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">{scenario.dispatch_notes}</p>
                  )}
                </div>
              )}

              {/* Patient Info */}
              {(scenario.patient_name || scenario.patient_age || scenario.general_impression) && (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-2">Patient</h3>
                  <div className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
                    {scenario.patient_name && (
                      <p><span className="font-medium">Name:</span> {scenario.patient_name}</p>
                    )}
                    {(scenario.patient_age || scenario.patient_sex) && (
                      <p>
                        {scenario.patient_age && <span>{scenario.patient_age} y/o </span>}
                        {scenario.patient_sex && <span>{scenario.patient_sex}</span>}
                        {scenario.patient_weight && <span>, {scenario.patient_weight} kg</span>}
                      </p>
                    )}
                    {scenario.general_impression && (
                      <p className="mt-2"><span className="font-medium">Presentation:</span> {scenario.general_impression}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Medical History */}
              {(scenario.medical_history || scenario.medications || scenario.allergies) && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">History</h3>
                  <div className="text-sm text-orange-700 dark:text-orange-400 space-y-1">
                    {scenario.medical_history && toArray(scenario.medical_history).length > 0 && (
                      <p><span className="font-medium">PMHx:</span> {toArray(scenario.medical_history).join(', ')}</p>
                    )}
                    {scenario.medications && toArray(scenario.medications).length > 0 && (
                      <p><span className="font-medium">Meds:</span> {toArray(scenario.medications).join(', ')}</p>
                    )}
                    {scenario.allergies && toArray(scenario.allergies).length > 0 && (
                      <p><span className="font-medium">Allergies:</span> {toArray(scenario.allergies).join(', ')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Vitals */}
              {scenario.initial_vitals && Object.keys(scenario.initial_vitals).length > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Initial Vitals</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                    {scenario.initial_vitals.bp && (
                      <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                        <div className="font-medium text-green-700 dark:text-green-400">BP</div>
                        <div className="text-green-900 dark:text-green-300">{scenario.initial_vitals.bp}</div>
                      </div>
                    )}
                    {scenario.initial_vitals.hr && (
                      <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                        <div className="font-medium text-green-700 dark:text-green-400">HR</div>
                        <div className="text-green-900 dark:text-green-300">{scenario.initial_vitals.hr}</div>
                      </div>
                    )}
                    {scenario.initial_vitals.rr && (
                      <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                        <div className="font-medium text-green-700 dark:text-green-400">RR</div>
                        <div className="text-green-900 dark:text-green-300">{scenario.initial_vitals.rr}</div>
                      </div>
                    )}
                    {scenario.initial_vitals.spo2 && (
                      <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                        <div className="font-medium text-green-700 dark:text-green-400">SpO2</div>
                        <div className="text-green-900 dark:text-green-300">{scenario.initial_vitals.spo2}</div>
                      </div>
                    )}
                    {scenario.initial_vitals.etco2 && (
                      <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                        <div className="font-medium text-green-700 dark:text-green-400">EtCO2</div>
                        <div className="text-green-900 dark:text-green-300">{scenario.initial_vitals.etco2}</div>
                      </div>
                    )}
                    {scenario.initial_vitals.temp && (
                      <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                        <div className="font-medium text-green-700 dark:text-green-400">Temp</div>
                        <div className="text-green-900 dark:text-green-300">{scenario.initial_vitals.temp}</div>
                      </div>
                    )}
                    {scenario.initial_vitals.glucose && (
                      <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                        <div className="font-medium text-green-700 dark:text-green-400">BGL</div>
                        <div className="text-green-900 dark:text-green-300">{scenario.initial_vitals.glucose}</div>
                      </div>
                    )}
                    {scenario.initial_vitals.gcs && (
                      <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                        <div className="font-medium text-green-700 dark:text-green-400">GCS</div>
                        <div className="text-green-900 dark:text-green-300">{scenario.initial_vitals.gcs}</div>
                      </div>
                    )}
                    {scenario.initial_vitals.pain && (
                      <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                        <div className="font-medium text-green-700 dark:text-green-400">Pain</div>
                        <div className="text-green-900 dark:text-green-300">{scenario.initial_vitals.pain}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Phases - Assessment Flow Structure */}
              {scenario.phases && scenario.phases.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Scenario Phases</h3>
                  {scenario.phases.map((phase, index) => {
                    const v = phase.vitals || {};
                    const expectedActions = phase.expected_actions || (phase.expected_interventions ? toArray(phase.expected_interventions).join(', ') : '');

                    // Check what data exists for each section
                    const hasSceneInfo = phase.scene_safety || phase.mechanism_injury || phase.nature_illness || phase.resources_needed || phase.environmental_concerns;

                    // Build XABCDE from phase data, falling back to scenario-level defaults
                    const xabcde = {
                      x: phase.hemorrhage_control || scenario.assessment_x || null,
                      a: phase.airway || scenario.assessment_a || null,
                      b: phase.breathing || scenario.assessment_b || (v.rr || v.lung_sounds ? `RR ${v.rr || '—'}${v.lung_sounds ? `, ${v.lung_sounds}` : ''}` : null),
                      c: phase.circulation || scenario.assessment_c || (v.hr || v.skin ? `HR ${v.hr || '—'}${v.skin ? `, skin ${v.skin}` : ''}${v.pulse_quality ? `, pulse ${v.pulse_quality}` : ''}` : null),
                      d: phase.disability || scenario.assessment_d || (v.loc || v.gcs || v.gcs_total || scenario.gcs || scenario.pupils ? `${v.loc || ''}${v.gcs || v.gcs_total || scenario.gcs ? ` GCS ${v.gcs || v.gcs_total || scenario.gcs}` : ''}${v.pupils || scenario.pupils ? `, pupils ${v.pupils || scenario.pupils}` : ''}`.trim() : null),
                      e: phase.expose || scenario.assessment_e || null
                    };

                    // Get AVPU from LOC or scenario-level
                    const avpu = phase.avpu || scenario.avpu || (v.loc ? (
                      v.loc.toLowerCase().includes('alert') ? 'Alert' :
                      v.loc.toLowerCase().includes('verbal') ? 'Verbal' :
                      v.loc.toLowerCase().includes('pain') ? 'Pain' :
                      v.loc.toLowerCase().includes('unresponsive') ? 'Unresponsive' : null
                    ) : null);

                    // Get general impression from phase or scenario
                    const generalImpression = phase.general_impression || scenario.general_impression;

                    // SAMPLE - use phase values or fall back to scenario-level
                    const sampleData = {
                      signs_symptoms: phase.signs_symptoms || scenario.sample_history?.signs_symptoms || scenario.chief_complaint,
                      allergies: scenario.allergies,
                      medications: scenario.medications,
                      medical_history: scenario.medical_history,
                      last_oral_intake: phase.last_oral_intake || scenario.sample_history?.last_oral_intake,
                      events_leading: phase.events_leading || scenario.sample_history?.events_leading
                    };
                    const showSAMPLE = index === 0 && (sampleData.signs_symptoms || sampleData.allergies || sampleData.medications || sampleData.medical_history || sampleData.last_oral_intake || sampleData.events_leading);

                    // OPQRST - use phase values or fall back to scenario-level
                    const opqrstData = {
                      onset: phase.onset || scenario.opqrst?.onset,
                      provocation: phase.provocation || scenario.opqrst?.provocation,
                      quality: phase.quality || scenario.opqrst?.quality,
                      radiation: phase.radiation || scenario.opqrst?.radiation,
                      severity: phase.severity || scenario.opqrst?.severity,
                      time_onset: phase.time_onset || scenario.opqrst?.time_onset
                    };

                    return (
                      <div
                        key={index}
                        className={`rounded-lg border overflow-hidden ${
                          index === 0
                            ? 'border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800'
                            : 'border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800'
                        }`}
                      >
                        {/* Phase Header */}
                        <div className={`px-4 py-2 border-b ${
                          index === 0
                            ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
                            : 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`font-semibold text-sm ${
                              index === 0
                                ? 'text-blue-800 dark:text-blue-300'
                                : 'text-amber-800 dark:text-amber-300'
                            }`}>
                              {phase.phase_name || `Phase ${index + 1}`}
                            </span>
                            {phase.trigger && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                                {phase.trigger}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-4 space-y-4">
                          {/* Presentation Notes */}
                          {phase.presentation_notes && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 italic border-l-2 border-gray-300 dark:border-gray-600 pl-3 bg-gray-50 dark:bg-gray-700/50 py-2 rounded-r">
                              {phase.presentation_notes}
                            </p>
                          )}

                          {/* 1. SCENE SIZE-UP */}
                          {hasSceneInfo && (
                            <div className="space-y-2">
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

                          {/* 2. PRIMARY ASSESSMENT - XABCDE (Always show structure) */}
                          <div className="space-y-2">
                            <div className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider border-b border-orange-200 dark:border-orange-800 pb-1">
                              Primary Assessment
                            </div>
                            <div className="text-xs space-y-1.5 pl-2">
                              <div className="flex">
                                <span className="w-5 font-bold text-orange-600 dark:text-orange-400">X</span>
                                <span className="text-gray-500 dark:text-gray-400 w-24">Hemorrhage:</span>
                                <span className={`flex-1 ${xabcde.x ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{xabcde.x || '—'}</span>
                              </div>
                              <div className="flex">
                                <span className="w-5 font-bold text-orange-600 dark:text-orange-400">A</span>
                                <span className="text-gray-500 dark:text-gray-400 w-24">Airway:</span>
                                <span className={`flex-1 ${xabcde.a ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{xabcde.a || '—'}</span>
                              </div>
                              <div className="flex">
                                <span className="w-5 font-bold text-orange-600 dark:text-orange-400">B</span>
                                <span className="text-gray-500 dark:text-gray-400 w-24">Breathing:</span>
                                <span className={`flex-1 ${xabcde.b ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{xabcde.b || '—'}</span>
                              </div>
                              <div className="flex">
                                <span className="w-5 font-bold text-orange-600 dark:text-orange-400">C</span>
                                <span className="text-gray-500 dark:text-gray-400 w-24">Circulation:</span>
                                <span className={`flex-1 ${xabcde.c ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{xabcde.c || '—'}</span>
                              </div>
                              <div className="flex">
                                <span className="w-5 font-bold text-orange-600 dark:text-orange-400">D</span>
                                <span className="text-gray-500 dark:text-gray-400 w-24">Disability:</span>
                                <span className={`flex-1 ${xabcde.d ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{xabcde.d || '—'}</span>
                              </div>
                              <div className="flex">
                                <span className="w-5 font-bold text-orange-600 dark:text-orange-400">E</span>
                                <span className="text-gray-500 dark:text-gray-400 w-24">Expose:</span>
                                <span className={`flex-1 ${xabcde.e ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{xabcde.e || '—'}</span>
                              </div>
                            </div>
                            {/* AVPU & General Impression */}
                            <div className="flex gap-6 text-xs mt-2 pl-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                              <div><span className="font-medium text-gray-500 dark:text-gray-400">AVPU:</span> <span className={`font-medium ${avpu ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{avpu || '—'}</span></div>
                              <div><span className="font-medium text-gray-500 dark:text-gray-400">Impression:</span> <span className={`font-medium ${generalImpression ? (generalImpression.toLowerCase().includes('sick') || generalImpression.toLowerCase().includes('critical') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400') : 'text-gray-400 dark:text-gray-500 italic'}`}>{generalImpression || '—'}</span></div>
                            </div>
                          </div>

                          {/* 3. SECONDARY ASSESSMENT (Always show structure) */}
                          <div className="space-y-3">
                            <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider border-b border-green-200 dark:border-green-800 pb-1">
                              Secondary Assessment
                            </div>

                            {/* Vitals Grid */}
                            <div className="pl-2">
                              <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Vitals</div>
                              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-xs">
                                <div className="text-center p-1.5 bg-gray-50 dark:bg-gray-700 rounded"><div className="text-gray-400 dark:text-gray-500 text-[10px]">BP</div><div className={`font-medium ${v.bp ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{v.bp || '—'}</div></div>
                                <div className="text-center p-1.5 bg-gray-50 dark:bg-gray-700 rounded"><div className="text-gray-400 dark:text-gray-500 text-[10px]">HR</div><div className={`font-medium ${v.hr ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{v.hr || '—'}</div></div>
                                <div className="text-center p-1.5 bg-gray-50 dark:bg-gray-700 rounded"><div className="text-gray-400 dark:text-gray-500 text-[10px]">RR</div><div className={`font-medium ${v.rr ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{v.rr || '—'}</div></div>
                                <div className="text-center p-1.5 bg-gray-50 dark:bg-gray-700 rounded"><div className="text-gray-400 dark:text-gray-500 text-[10px]">SpO2</div><div className={`font-medium ${v.spo2 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{v.spo2 || '—'}</div></div>
                                <div className="text-center p-1.5 bg-gray-50 dark:bg-gray-700 rounded"><div className="text-gray-400 dark:text-gray-500 text-[10px]">EtCO2</div><div className={`font-medium ${v.etco2 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{v.etco2 || '—'}</div></div>
                                <div className="text-center p-1.5 bg-gray-50 dark:bg-gray-700 rounded"><div className="text-gray-400 dark:text-gray-500 text-[10px]">Temp</div><div className={`font-medium ${v.temp ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{v.temp || '—'}</div></div>
                                <div className="text-center p-1.5 bg-gray-50 dark:bg-gray-700 rounded"><div className="text-gray-400 dark:text-gray-500 text-[10px]">BGL</div><div className={`font-medium ${(v.glucose || v.blood_glucose) ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{v.glucose || v.blood_glucose || '—'}</div></div>
                              </div>
                              {/* Additional vitals on second row */}
                              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded"><span className="text-gray-400 dark:text-gray-500 text-[10px]">EKG:</span> <span className={`font-medium ${v.ekg_rhythm ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{v.ekg_rhythm || '—'}</span></div>
                                <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded"><span className="text-gray-400 dark:text-gray-500 text-[10px]">Pain:</span> <span className={`font-medium ${v.pain ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{v.pain ? `${v.pain}/10` : '—'}</span></div>
                              </div>
                            </div>

                            {/* SAMPLE History (Always show on first phase) */}
                            {index === 0 && (
                              <div className="pl-2">
                                <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">SAMPLE History</div>
                                <div className="text-xs space-y-1 bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                                  <div className="flex">
                                    <span className="w-4 font-bold text-green-600 dark:text-green-400">S</span>
                                    <span className="text-gray-500 dark:text-gray-400 w-32">Signs/Symptoms:</span>
                                    <span className={`flex-1 ${sampleData.signs_symptoms ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{sampleData.signs_symptoms || '—'}</span>
                                  </div>
                                  <div className="flex">
                                    <span className="w-4 font-bold text-green-600 dark:text-green-400">A</span>
                                    <span className="text-gray-500 dark:text-gray-400 w-32">Allergies:</span>
                                    <span className={`flex-1 ${sampleData.allergies ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{sampleData.allergies ? (toArray(sampleData.allergies).join(', ') || 'NKDA') : '—'}</span>
                                  </div>
                                  <div className="flex">
                                    <span className="w-4 font-bold text-green-600 dark:text-green-400">M</span>
                                    <span className="text-gray-500 dark:text-gray-400 w-32">Medications:</span>
                                    <span className={`flex-1 ${sampleData.medications && toArray(sampleData.medications).length > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{sampleData.medications && toArray(sampleData.medications).length > 0 ? toArray(sampleData.medications).join(', ') : '—'}</span>
                                  </div>
                                  <div className="flex">
                                    <span className="w-4 font-bold text-green-600 dark:text-green-400">P</span>
                                    <span className="text-gray-500 dark:text-gray-400 w-32">Past Medical Hx:</span>
                                    <span className={`flex-1 ${sampleData.medical_history && toArray(sampleData.medical_history).length > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{sampleData.medical_history && toArray(sampleData.medical_history).length > 0 ? toArray(sampleData.medical_history).join(', ') : '—'}</span>
                                  </div>
                                  <div className="flex">
                                    <span className="w-4 font-bold text-green-600 dark:text-green-400">L</span>
                                    <span className="text-gray-500 dark:text-gray-400 w-32">Last Oral Intake:</span>
                                    <span className={`flex-1 ${sampleData.last_oral_intake ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{sampleData.last_oral_intake || '—'}</span>
                                  </div>
                                  <div className="flex">
                                    <span className="w-4 font-bold text-green-600 dark:text-green-400">E</span>
                                    <span className="text-gray-500 dark:text-gray-400 w-32">Events Leading:</span>
                                    <span className={`flex-1 ${sampleData.events_leading ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{sampleData.events_leading || '—'}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* OPQRST (Always show) */}
                            <div className="pl-2">
                              <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">OPQRST</div>
                              <div className="text-xs space-y-1 bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                                <div className="flex">
                                  <span className="w-4 font-bold text-purple-600 dark:text-purple-400">O</span>
                                  <span className="text-gray-500 dark:text-gray-400 w-32">Onset:</span>
                                  <span className={`flex-1 ${opqrstData.onset ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{opqrstData.onset || '—'}</span>
                                </div>
                                <div className="flex">
                                  <span className="w-4 font-bold text-purple-600 dark:text-purple-400">P</span>
                                  <span className="text-gray-500 dark:text-gray-400 w-32">Provocation:</span>
                                  <span className={`flex-1 ${opqrstData.provocation ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{opqrstData.provocation || '—'}</span>
                                </div>
                                <div className="flex">
                                  <span className="w-4 font-bold text-purple-600 dark:text-purple-400">Q</span>
                                  <span className="text-gray-500 dark:text-gray-400 w-32">Quality:</span>
                                  <span className={`flex-1 ${opqrstData.quality ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{opqrstData.quality || '—'}</span>
                                </div>
                                <div className="flex">
                                  <span className="w-4 font-bold text-purple-600 dark:text-purple-400">R</span>
                                  <span className="text-gray-500 dark:text-gray-400 w-32">Radiation:</span>
                                  <span className={`flex-1 ${opqrstData.radiation ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{opqrstData.radiation || '—'}</span>
                                </div>
                                <div className="flex">
                                  <span className="w-4 font-bold text-purple-600 dark:text-purple-400">S</span>
                                  <span className="text-gray-500 dark:text-gray-400 w-32">Severity:</span>
                                  <span className={`flex-1 ${opqrstData.severity ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{opqrstData.severity || '—'}</span>
                                </div>
                                <div className="flex">
                                  <span className="w-4 font-bold text-purple-600 dark:text-purple-400">T</span>
                                  <span className="text-gray-500 dark:text-gray-400 w-32">Time:</span>
                                  <span className={`flex-1 ${opqrstData.time_onset ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{opqrstData.time_onset || '—'}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 4. EXPECTED INTERVENTIONS */}
                          {expectedActions && (
                            <div className="space-y-2">
                              <div className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider border-b border-purple-200 dark:border-purple-800 pb-1">
                                Expected Interventions
                              </div>
                              <p className="text-xs text-gray-700 dark:text-gray-300 pl-2">{expectedActions}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fallback: Show assessment structure when no phases exist */}
              {(!scenario.phases || scenario.phases.length === 0) && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Assessment Structure</h3>
                  <div className="rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 overflow-hidden">
                    <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
                      <span className="font-semibold text-sm text-blue-800 dark:text-blue-300">Initial Presentation</span>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Primary Assessment - XABCDE */}
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider border-b border-orange-200 dark:border-orange-800 pb-1">
                          Primary Assessment
                        </div>
                        <div className="text-xs space-y-1.5 pl-2">
                          <div className="flex">
                            <span className="w-5 font-bold text-orange-600 dark:text-orange-400">X</span>
                            <span className="text-gray-500 dark:text-gray-400 w-24">Hemorrhage:</span>
                            <span className={`flex-1 ${scenario.assessment_x ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.assessment_x || '—'}</span>
                          </div>
                          <div className="flex">
                            <span className="w-5 font-bold text-orange-600 dark:text-orange-400">A</span>
                            <span className="text-gray-500 dark:text-gray-400 w-24">Airway:</span>
                            <span className={`flex-1 ${scenario.assessment_a ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.assessment_a || '—'}</span>
                          </div>
                          <div className="flex">
                            <span className="w-5 font-bold text-orange-600 dark:text-orange-400">B</span>
                            <span className="text-gray-500 dark:text-gray-400 w-24">Breathing:</span>
                            <span className={`flex-1 ${scenario.assessment_b ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.assessment_b || '—'}</span>
                          </div>
                          <div className="flex">
                            <span className="w-5 font-bold text-orange-600 dark:text-orange-400">C</span>
                            <span className="text-gray-500 dark:text-gray-400 w-24">Circulation:</span>
                            <span className={`flex-1 ${scenario.assessment_c ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.assessment_c || '—'}</span>
                          </div>
                          <div className="flex">
                            <span className="w-5 font-bold text-orange-600 dark:text-orange-400">D</span>
                            <span className="text-gray-500 dark:text-gray-400 w-24">Disability:</span>
                            <span className={`flex-1 ${scenario.assessment_d || scenario.gcs || scenario.pupils ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                              {scenario.assessment_d || (scenario.gcs || scenario.pupils ? [scenario.gcs && `GCS: ${scenario.gcs}`, scenario.pupils && `Pupils: ${scenario.pupils}`].filter(Boolean).join(' | ') : '—')}
                            </span>
                          </div>
                          <div className="flex">
                            <span className="w-5 font-bold text-orange-600 dark:text-orange-400">E</span>
                            <span className="text-gray-500 dark:text-gray-400 w-24">Expose:</span>
                            <span className={`flex-1 ${scenario.assessment_e ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.assessment_e || '—'}</span>
                          </div>
                        </div>
                        <div className="flex gap-6 text-xs mt-2 pl-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                          <div><span className="font-medium text-gray-500 dark:text-gray-400">AVPU:</span> <span className={`font-medium ${scenario.avpu ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.avpu || '—'}</span></div>
                          <div><span className="font-medium text-gray-500 dark:text-gray-400">Impression:</span> <span className={`font-medium ${scenario.general_impression ? (scenario.general_impression.toLowerCase().includes('sick') || scenario.general_impression.toLowerCase().includes('critical') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400') : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.general_impression || '—'}</span></div>
                        </div>
                      </div>

                      {/* Secondary Assessment */}
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider border-b border-green-200 dark:border-green-800 pb-1">
                          Secondary Assessment
                        </div>

                        {/* SAMPLE History */}
                        <div className="pl-2">
                          <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">SAMPLE History</div>
                          <div className="text-xs space-y-1 bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                            <div className="flex">
                              <span className="w-4 font-bold text-green-600 dark:text-green-400">S</span>
                              <span className="text-gray-500 dark:text-gray-400 w-32">Signs/Symptoms:</span>
                              <span className={`flex-1 ${scenario.chief_complaint ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.chief_complaint || '—'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-4 font-bold text-green-600 dark:text-green-400">A</span>
                              <span className="text-gray-500 dark:text-gray-400 w-32">Allergies:</span>
                              <span className={`flex-1 ${scenario.allergies ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.allergies ? (toArray(scenario.allergies).join(', ') || 'NKDA') : '—'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-4 font-bold text-green-600 dark:text-green-400">M</span>
                              <span className="text-gray-500 dark:text-gray-400 w-32">Medications:</span>
                              <span className={`flex-1 ${scenario.medications && toArray(scenario.medications).length > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.medications && toArray(scenario.medications).length > 0 ? toArray(scenario.medications).join(', ') : '—'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-4 font-bold text-green-600 dark:text-green-400">P</span>
                              <span className="text-gray-500 dark:text-gray-400 w-32">Past Medical Hx:</span>
                              <span className={`flex-1 ${scenario.medical_history && toArray(scenario.medical_history).length > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.medical_history && toArray(scenario.medical_history).length > 0 ? toArray(scenario.medical_history).join(', ') : '—'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-4 font-bold text-green-600 dark:text-green-400">L</span>
                              <span className="text-gray-500 dark:text-gray-400 w-32">Last Oral Intake:</span>
                              <span className={`flex-1 ${scenario.sample_history?.last_oral_intake ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.sample_history?.last_oral_intake || '—'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-4 font-bold text-green-600 dark:text-green-400">E</span>
                              <span className="text-gray-500 dark:text-gray-400 w-32">Events Leading:</span>
                              <span className={`flex-1 ${scenario.sample_history?.events_leading ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.sample_history?.events_leading || '—'}</span>
                            </div>
                          </div>
                        </div>

                        {/* OPQRST */}
                        <div className="pl-2">
                          <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">OPQRST</div>
                          <div className="text-xs space-y-1 bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                            <div className="flex">
                              <span className="w-4 font-bold text-purple-600 dark:text-purple-400">O</span>
                              <span className="text-gray-500 dark:text-gray-400 w-32">Onset:</span>
                              <span className={`flex-1 ${scenario.opqrst?.onset ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.opqrst?.onset || '—'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-4 font-bold text-purple-600 dark:text-purple-400">P</span>
                              <span className="text-gray-500 dark:text-gray-400 w-32">Provocation:</span>
                              <span className={`flex-1 ${scenario.opqrst?.provocation ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.opqrst?.provocation || '—'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-4 font-bold text-purple-600 dark:text-purple-400">Q</span>
                              <span className="text-gray-500 dark:text-gray-400 w-32">Quality:</span>
                              <span className={`flex-1 ${scenario.opqrst?.quality ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.opqrst?.quality || '—'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-4 font-bold text-purple-600 dark:text-purple-400">R</span>
                              <span className="text-gray-500 dark:text-gray-400 w-32">Radiation:</span>
                              <span className={`flex-1 ${scenario.opqrst?.radiation ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.opqrst?.radiation || '—'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-4 font-bold text-purple-600 dark:text-purple-400">S</span>
                              <span className="text-gray-500 dark:text-gray-400 w-32">Severity:</span>
                              <span className={`flex-1 ${scenario.opqrst?.severity ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.opqrst?.severity || '—'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-4 font-bold text-purple-600 dark:text-purple-400">T</span>
                              <span className="text-gray-500 dark:text-gray-400 w-32">Time:</span>
                              <span className={`flex-1 ${scenario.opqrst?.time_onset ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>{scenario.opqrst?.time_onset || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
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
