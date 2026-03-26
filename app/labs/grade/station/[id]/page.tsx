'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Save
} from 'lucide-react';
import TimerBanner from '@/components/TimerBanner';
import SkillSheetPanel from '@/components/SkillSheetPanel';

// Sub-components
import GradingHeader from '@/components/grading/GradingHeader';
import ScenarioGrading from '@/components/grading/ScenarioGrading';
import EvaluationCriteria from '@/components/grading/EvaluationCriteria';
import StudentSelection from '@/components/grading/StudentSelection';
import FlaggingPanel from '@/components/grading/FlaggingPanel';

// Types and constants from shared module
import {
  toArray,
  EVALUATION_CRITERIA,
  SKILLS_EVALUATION_CRITERIA,
  getMatchingMnemonic,
  buildDefaultSubItems,
  autoRatingFromSubItems,
} from '@/components/grading/types';
import type {
  Student,
  LabGroup,
  Station,
  CriteriaRating,
  SubItem,
} from '@/components/grading/types';

export default function GradeStationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const stationId = params?.id as string;

  const [station, setStation] = useState<Station | null>(null);
  const [labGroups, setLabGroups] = useState<LabGroup[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Grading state
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [teamLeaderId, setTeamLeaderId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(''); // For skills stations
  const [rotationNumber, setRotationNumber] = useState<number>(1);
  const [criticalActions, setCriticalActions] = useState<Record<string, boolean>>({});
  const [criteriaRatings, setCriteriaRatings] = useState<CriteriaRating[]>([]);
  const [overallComments, setOverallComments] = useState('');
  const [showScenarioDetails, setShowScenarioDetails] = useState(false);

  // Determine which criteria to use based on station type
  const isSkillsStation = station?.station_type === 'skills';
  const activeCriteria = isSkillsStation ? SKILLS_EVALUATION_CRITERIA : EVALUATION_CRITERIA;

  // Flagging state
  const [issueLevel, setIssueLevel] = useState<'none' | 'minor' | 'needs_followup'>('none');
  const [flagCategories, setFlagCategories] = useState<string[]>([]);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savedIndicatorTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Skill sheet lookup state (maps skill name -> skill_sheet id)
  const [skillSheetIds, setSkillSheetIds] = useState<Record<string, string>>({});

  // Skill sheet panel state
  const [panelSheetId, setPanelSheetId] = useState<string | null>(null);
  const [useEmbeddedSkillSheet, setUseEmbeddedSkillSheet] = useState(false);

  // Evaluation tracking for auto-advance
  const [evaluatedStudents, setEvaluatedStudents] = useState<Record<string, string>>({});
  const [inProgressStudents, setInProgressStudents] = useState<Record<string, string>>({});

  // Computed values
  const selectedGroup = labGroups.find(g => g.id === selectedGroupId);
  const satisfactoryCount = criteriaRatings.filter(r => r.rating === 'S').length;
  const needsImprovementCount = criteriaRatings.filter(r => r.rating === 'NI').length;
  const unsatisfactoryCount = criteriaRatings.filter(r => r.rating === 'U').length;
  const allRated = criteriaRatings.length > 0 && criteriaRatings.every(r => r.rating !== null);
  const totalCriteria = criteriaRatings.length;

  // Pass calculation - different for skills vs scenario
  const skillsPass = satisfactoryCount === 4;
  const skillsNeedsPractice = satisfactoryCount >= 3 && satisfactoryCount < 4;
  const phase1Pass = isSkillsStation ? skillsPass : satisfactoryCount >= 6;
  const phase2Pass = isSkillsStation ? skillsPass : satisfactoryCount >= 7;

  // Build student queue for the skill sheet panel
  const studentQueue = allStudents.map(s => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
    evaluated: !!evaluatedStudents[s.id],
    evaluationId: evaluatedStudents[s.id] || inProgressStudents[s.id] || undefined,
    inProgress: !!inProgressStudents[s.id] && !evaluatedStudents[s.id],
  }));

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && stationId) {
      fetchStation();
    }
  }, [session, stationId]);

  useEffect(() => {
    if (station?.lab_day?.cohort?.id) {
      fetchLabGroups(station.lab_day.cohort.id);
      // Also fetch all students for skills station dropdown
      if (station.station_type === 'skills') {
        fetchAllStudents(station.lab_day.cohort.id);
      }
    }
  }, [station]);

  useEffect(() => {
    // Initialize critical actions checkboxes when scenario loads
    if (station?.scenario?.critical_actions) {
      const actions = toArray(station.scenario.critical_actions);
      const initial: Record<string, boolean> = {};
      actions.forEach((action, index) => {
        initial[`action-${index}`] = false;
      });
      setCriticalActions(initial);
    }
  }, [station?.scenario?.critical_actions]);

  useEffect(() => {
    // Initialize criteria ratings based on station type
    if (station) {
      const criteria = station.station_type === 'skills' ? SKILLS_EVALUATION_CRITERIA : EVALUATION_CRITERIA;
      setCriteriaRatings(criteria.map(c => {
        const mnemonic = getMatchingMnemonic(c.name);
        return {
          criteria_id: c.id,
          criteria_name: c.name,
          rating: null,
          notes: '',
          ...(mnemonic ? { sub_items: buildDefaultSubItems(mnemonic) } : {}),
        };
      }));
    }
  }, [station?.station_type]);

  // Look up skill sheets for each assigned skill by name + program
  useEffect(() => {
    if (station?.lab_day?.cohort?.program?.abbreviation) {
      const allSkillNames: string[] = [];
      if (station.station_skills) {
        for (const ss of station.station_skills) {
          allSkillNames.push(ss.skill.name);
        }
      }
      if (station.custom_skills) {
        for (const cs of station.custom_skills) {
          allSkillNames.push(cs.name);
        }
      }
      let mainSkillName = station.skill_name || station.custom_title;
      if (mainSkillName) {
        const prefixMatch = mainSkillName.match(/^[A-Za-z0-9]+\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–]\s*(.+)$/);
        if (prefixMatch) {
          mainSkillName = prefixMatch[1].trim();
        }
        allSkillNames.push(mainSkillName);
      }
      if (allSkillNames.length > 0) {
        lookupSkillSheets(allSkillNames, station.lab_day.cohort.program.abbreviation);
      }
    }
  }, [station]);

  // Auto-open embedded skill sheet when available for skills stations
  useEffect(() => {
    if (isSkillsStation && station && Object.keys(skillSheetIds).length > 0) {
      // Find the main skill's sheet ID
      let mainSkillName = station.skill_name || station.custom_title;
      if (mainSkillName) {
        const prefixMatch = mainSkillName.match(/^[A-Za-z0-9]+\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–]\s*(.+)$/);
        if (prefixMatch) mainSkillName = prefixMatch[1].trim();
      }
      const sheetId = skillSheetIds[mainSkillName || '']
        || Object.values(skillSheetIds)[0];
      if (sheetId) {
        setPanelSheetId(sheetId);
        setUseEmbeddedSkillSheet(true);
      }
    }
  }, [isSkillsStation, station, skillSheetIds]);

  const fetchStation = async () => {
    try {
      const res = await fetch(`/api/lab-management/stations/${stationId}`);
      const data = await res.json();
      if (data.success) {
        setStation(data.station);
      }
    } catch (error) {
      console.error('Error fetching station:', error);
    }
    setLoading(false);
  };

  // Look up skill sheets for all skill names in a single bulk request
  const lookupSkillSheets = async (skillNames: string[], program: string) => {
    try {
      const res = await fetch(`/api/skill-sheets/by-skill-name/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: skillNames, program: program.toLowerCase() }),
      });
      const data = await res.json();
      if (data.success && data.results) {
        setSkillSheetIds(data.results);
      }
    } catch {
      const results: Record<string, string> = {};
      await Promise.all(
        skillNames.map(async (skillName) => {
          try {
            const res = await fetch(`/api/skill-sheets/by-skill-name?name=${encodeURIComponent(skillName)}&program=${encodeURIComponent(program.toLowerCase())}`);
            const data = await res.json();
            if (data.success && data.sheets && data.sheets.length > 0) {
              results[skillName] = data.sheets[0].id;
            }
          } catch { /* ignore */ }
        })
      );
      setSkillSheetIds(results);
    }
  };

  const fetchLabGroups = async (cohortId: string) => {
    try {
      const res = await fetch(`/api/lab-management/groups?cohortId=${cohortId}&include=members`);
      const data = await res.json();
      if (data.success && data.groups) {
        const groupsWithMembers = data.groups.map((group: any) => ({
          id: group.id,
          name: group.name,
          members: (group.members || []).map((m: any) => ({
            id: m.id,
            student: {
              id: m.id,
              first_name: m.first_name,
              last_name: m.last_name,
              photo_url: m.photo_url
            }
          }))
        }));
        setLabGroups(groupsWithMembers);
      }
    } catch (error) {
      console.error('Error fetching lab groups:', error);
    }
  };

  const fetchAllStudents = async (cohortId: string) => {
    try {
      const res = await fetch(`/api/lab-management/students?cohortId=${cohortId}`);
      const data = await res.json();
      if (data.success && data.students) {
        setAllStudents(data.students.map((s: any) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          photo_url: s.photo_url
        })));
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const updateRating = (criteriaId: string, rating: 'S' | 'NI' | 'U') => {
    setCriteriaRatings(prev =>
      prev.map(r => {
        if (r.criteria_id === criteriaId) {
          return { ...r, rating: r.rating === rating ? null : rating };
        }
        return r;
      })
    );
    triggerAutoSave();
  };

  const updateNotes = (criteriaId: string, notes: string) => {
    setCriteriaRatings(prev =>
      prev.map(r => r.criteria_id === criteriaId ? { ...r, notes } : r)
    );
    triggerAutoSave();
  };

  const updateSubItems = (criteriaId: string, subItems: SubItem[]) => {
    const suggestedRating = autoRatingFromSubItems(subItems);
    setCriteriaRatings(prev =>
      prev.map(r => {
        if (r.criteria_id !== criteriaId) return r;
        return { ...r, sub_items: subItems, rating: suggestedRating ?? r.rating };
      })
    );
    triggerAutoSave();
  };

  // Handle evaluation saved from SkillSheetPanel — auto-advance to next student
  const handleEvaluationSaved = useCallback((savedStudentId: string, evaluationId: string, evalStatus: 'complete' | 'in_progress') => {
    if (evalStatus === 'in_progress') {
      // Track as in-progress, don't advance
      setInProgressStudents(prev => ({ ...prev, [savedStudentId]: evaluationId }));
      return;
    }

    // Mark as completed
    setEvaluatedStudents(prev => ({ ...prev, [savedStudentId]: evaluationId }));
    // Remove from in-progress if it was there
    setInProgressStudents(prev => {
      const next = { ...prev };
      delete next[savedStudentId];
      return next;
    });

    // Auto-advance to next unevaluated, unstarted student (skip in-progress)
    const updatedEvaluated = { ...evaluatedStudents, [savedStudentId]: evaluationId };
    const nextStudent = allStudents.find(s =>
      !updatedEvaluated[s.id] && !inProgressStudents[s.id] && s.id !== savedStudentId
    );
    if (nextStudent) {
      setTimeout(() => {
        setSelectedStudentId(nextStudent.id);
      }, 500);
    }
  }, [allStudents, evaluatedStudents, inProgressStudents]);

  const handleSave = async (emailPref: string = 'queued', saveAsStatus: string = 'complete') => {
    const isInProgress = saveAsStatus === 'in_progress';

    // Validation - different for skills vs scenario stations
    if (isSkillsStation) {
      if (!selectedStudentId) {
        alert('Please select a student');
        return;
      }
    } else if (!isInProgress) {
      if (!selectedGroupId) {
        alert('Please select a lab group');
        return;
      }
      if (!teamLeaderId) {
        alert('Please select a team leader');
        return;
      }
      if (!allRated) {
        alert(`Please rate all ${criteriaRatings.length} criteria`);
        return;
      }

      const missingNotes = criteriaRatings.filter(r =>
        (r.rating === 'NI' || r.rating === 'U') && (!r.notes || r.notes.trim() === '')
      );
      if (missingNotes.length > 0) {
        const criteriaNames = missingNotes.map(r => r.criteria_name).join(', ');
        alert(`Please add notes for the following "Needs Improvement" or "Unsatisfactory" ratings: ${criteriaNames}`);
        return;
      }

      if (issueLevel === 'needs_followup' && flagCategories.length === 0) {
        alert('Please select at least one category when flagging for follow-up');
        return;
      }
    } else {
      // In-progress: only need group selected for scenarios
      if (!selectedGroupId) {
        alert('Please select a lab group');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        lab_station_id: stationId,
        lab_day_id: station?.lab_day?.id,
        cohort_id: station?.lab_day?.cohort?.id,
        rotation_number: rotationNumber,
        team_lead_id: isSkillsStation ? null : teamLeaderId,
        graded_by: session?.user?.email,
        criteria_ratings: criteriaRatings,
        overall_comments: overallComments,
        overall_score: satisfactoryCount,
        issue_level: issueLevel,
        flag_categories: flagCategories.length > 0 ? flagCategories : null,
        flagged_for_review: issueLevel === 'needs_followup',
        email_status: isInProgress ? 'pending' : emailPref,
        status: saveAsStatus,
      };

      const res = await fetch('/api/lab-management/assessments/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        if (!isSkillsStation && teamLeaderId) {
          await fetch('/api/lab-management/team-leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_id: teamLeaderId,
              lab_station_id: stationId,
              scenario_type: station?.scenario?.category || 'General',
              date: station?.lab_day?.date,
              performance_score: satisfactoryCount,
              notes: `Rotation ${rotationNumber}: ${satisfactoryCount}/8 S ratings`
            })
          });
        }

        setHasUnsavedChanges(false);

        // If Send Now, fire scenario email immediately
        if (!isInProgress && emailPref === 'sent' && data.assessment?.id) {
          try {
            await fetch('/api/lab-management/assessments/scenario/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ assessment_id: data.assessment.id }),
            });
          } catch { /* non-critical */ }
        }

        if (isInProgress) {
          alert('Progress saved — you can continue later');
        } else {
          alert('Assessment saved successfully!');
          router.push(`/labs/schedule/${station?.lab_day?.id}`);
        }
      } else {
        alert('Failed to save: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving assessment:', error);
      alert('Failed to save assessment');
    }
    setSaving(false);
  };

  // Auto-save function
  const autoSave = useCallback(async () => {
    if (isSkillsStation && !selectedStudentId) return;
    if (!isSkillsStation && !selectedGroupId) return;

    setSaveStatus('saving');
    setHasUnsavedChanges(false);

    try {
      const payload = {
        lab_station_id: stationId,
        lab_day_id: station?.lab_day?.id,
        cohort_id: station?.lab_day?.cohort?.id,
        rotation_number: rotationNumber,
        team_lead_id: isSkillsStation ? null : teamLeaderId,
        graded_by: session?.user?.email,
        criteria_ratings: criteriaRatings,
        overall_comments: overallComments,
        overall_score: satisfactoryCount,
        issue_level: issueLevel,
        flag_categories: flagCategories.length > 0 ? flagCategories : null,
        flagged_for_review: issueLevel === 'needs_followup',
        email_status: 'pending',
        status: 'in_progress',
      };

      const res = await fetch('/api/lab-management/assessments/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSaveStatus('saved');

        if (savedIndicatorTimerRef.current) {
          clearTimeout(savedIndicatorTimerRef.current);
        }
        savedIndicatorTimerRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Auto-save error:', error);
      setSaveStatus('error');
    }
  }, [
    stationId,
    station,
    rotationNumber,
    teamLeaderId,
    selectedStudentId,
    selectedGroupId,
    criteriaRatings,
    overallComments,
    satisfactoryCount,
    issueLevel,
    flagCategories,
    isSkillsStation,
    session?.user?.email
  ]);

  // Trigger auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    setHasUnsavedChanges(true);

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      autoSave();
    }, 2000);
  }, [autoSave]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (savedIndicatorTimerRef.current) {
        clearTimeout(savedIndicatorTimerRef.current);
      }
    };
  }, []);

  // Warn about unsaved changes before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  if (!station) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">Station not found</p>
          <Link href="/labs/schedule" className="text-blue-600 dark:text-blue-400 hover:underline mt-4 block">
            Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

  const scenario = station.scenario;

  // Get selected student name
  const selectedStudent = allStudents.find(s => s.id === selectedStudentId);
  const selectedStudentName = selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Timer Banner */}
      {station?.lab_day?.id && (
        <TimerBanner
          labDayId={station.lab_day.id}
          stationId={stationId}
          userEmail={session?.user?.email || undefined}
          userName={session?.user?.name || undefined}
          numRotations={4}
        />
      )}

      {/* Header */}
      <GradingHeader
        station={station}
        saveStatus={saveStatus}
        saving={saving}
        isSkillsStation={isSkillsStation}
        allRated={allRated}
        selectedStudentId={selectedStudentId}
        selectedGroupId={selectedGroupId}
        teamLeaderId={teamLeaderId}
        onSave={() => handleSave()}
      />

      {/* Embedded Skill Sheet Mode: Skills station with skill sheet available */}
      {useEmbeddedSkillSheet && panelSheetId ? (
        <main className="flex gap-6 max-w-7xl mx-auto px-4 py-4 pb-4">
          {/* Left: Student panel */}
          <div className="w-80 shrink-0 sticky top-0 h-screen overflow-y-auto pt-2 space-y-4">
            <StudentSelection
              isSkillsStation={isSkillsStation}
              station={station}
              allStudents={allStudents}
              labGroups={labGroups}
              selectedGroupId={selectedGroupId}
              selectedStudentId={selectedStudentId}
              teamLeaderId={teamLeaderId}
              rotationNumber={rotationNumber}
              onSetSelectedGroupId={setSelectedGroupId}
              onSetSelectedStudentId={setSelectedStudentId}
              onSetTeamLeaderId={setTeamLeaderId}
              onSetRotationNumber={setRotationNumber}
              triggerAutoSave={triggerAutoSave}
              evaluatedStudents={evaluatedStudents}
              inProgressStudents={inProgressStudents}
            />
          </div>

          {/* Right: Skill sheet */}
          <div className="flex-1 overflow-y-auto min-h-[60vh]">
            <SkillSheetPanel
              sheetId={panelSheetId}
              onClose={() => {
                setUseEmbeddedSkillSheet(false);
                setPanelSheetId(null);
              }}
              studentId={selectedStudentId || undefined}
              studentName={selectedStudentName}
              labDayId={station?.lab_day?.id}
              stationPoolId={stationId}
              studentQueue={studentQueue}
              onEvaluationSaved={handleEvaluationSaved}
              embedded={true}
            />
          </div>
        </main>
      ) : (
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4 pb-20">
        {/* Scenario/Skills Station Info */}
        <ScenarioGrading
          station={station}
          showScenarioDetails={showScenarioDetails}
          onToggleScenarioDetails={() => setShowScenarioDetails(!showScenarioDetails)}
          skillSheetIds={skillSheetIds}
          onOpenSkillSheet={(sheetId) => setPanelSheetId(sheetId)}
        />

        {/* Student/Group Selection */}
        <StudentSelection
          isSkillsStation={isSkillsStation}
          station={station}
          allStudents={allStudents}
          labGroups={labGroups}
          selectedGroupId={selectedGroupId}
          selectedStudentId={selectedStudentId}
          teamLeaderId={teamLeaderId}
          rotationNumber={rotationNumber}
          onSetSelectedGroupId={setSelectedGroupId}
          onSetSelectedStudentId={setSelectedStudentId}
          onSetTeamLeaderId={setTeamLeaderId}
          onSetRotationNumber={setRotationNumber}
          triggerAutoSave={triggerAutoSave}
          evaluatedStudents={evaluatedStudents}
          inProgressStudents={inProgressStudents}
        />

        {/* Critical Actions — ONLY for scenario stations */}
        {!isSkillsStation && scenario?.critical_actions && toArray(scenario.critical_actions).length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Critical Actions
            </h2>
            <div className="space-y-2">
              {toArray(scenario.critical_actions).map((action, index) => (
                <label
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer ${
                    criticalActions[`action-${index}`] ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={criticalActions[`action-${index}`] || false}
                    onChange={(e) => {
                      setCriticalActions(prev => ({
                        ...prev,
                        [`action-${index}`]: e.target.checked
                      }));
                      triggerAutoSave();
                    }}
                    className="mt-1 w-5 h-5"
                  />
                  <span className={`text-sm ${
                    criticalActions[`action-${index}`] ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                  }`}>
                    {action}
                  </span>
                  {criticalActions[`action-${index}`] ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 ml-auto shrink-0" />
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Evaluation Criteria — ONLY for scenario stations, NEVER for skill sheet stations */}
        {!isSkillsStation && <EvaluationCriteria
          activeCriteria={activeCriteria}
          criteriaRatings={criteriaRatings}
          isSkillsStation={isSkillsStation}
          satisfactoryCount={satisfactoryCount}
          needsImprovementCount={needsImprovementCount}
          unsatisfactoryCount={unsatisfactoryCount}
          allRated={allRated}
          totalCriteria={totalCriteria}
          skillsPass={skillsPass}
          skillsNeedsPractice={skillsNeedsPractice}
          phase1Pass={phase1Pass}
          phase2Pass={phase2Pass}
          onUpdateRating={updateRating}
          onUpdateNotes={updateNotes}
          onUpdateSubItems={updateSubItems}
        />}

        {/* Overall Comments — ONLY for scenario stations */}
        {!isSkillsStation && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Overall Comments</h2>
            <textarea
              value={overallComments}
              onChange={(e) => {
                setOverallComments(e.target.value);
                triggerAutoSave();
              }}
              placeholder="Additional comments, feedback, or observations..."
              rows={4}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
        )}

        {/* Flagging Section — ONLY for scenario stations */}
        {!isSkillsStation && (
          <FlaggingPanel
            issueLevel={issueLevel}
            flagCategories={flagCategories}
            onSetIssueLevel={setIssueLevel}
            onSetFlagCategories={setFlagCategories}
            triggerAutoSave={triggerAutoSave}
          />
        )}

        {/* Debrief Points — ONLY for scenario stations */}
        {!isSkillsStation && scenario?.debrief_points && toArray(scenario.debrief_points).length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Debrief Discussion Points</h2>
            <ul className="space-y-2">
              {toArray(scenario.debrief_points).map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-blue-500 dark:text-blue-400">•</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Save Buttons (Bottom) — ONLY for scenario stations */}
        {!isSkillsStation && (
          <div className="sticky bottom-4 space-y-2">
            {/* Finish Later */}
            <button
              onClick={() => handleSave('pending', 'in_progress')}
              disabled={saving || !selectedGroupId}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-medium"
            >
              <Save className="w-5 h-5" />
              Finish Later
            </button>

            {/* Primary save: Send Later */}
            <button
              onClick={() => handleSave('queued')}
              disabled={saving || !allRated || !selectedGroupId || !teamLeaderId}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg font-medium"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? 'Saving...' : `Save — Send Later${selectedStudentName ? ` (${selectedStudentName})` : ''}`}
            </button>

            {/* Secondary options */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSave('sent')}
                disabled={saving || !allRated || !selectedGroupId || !teamLeaderId}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow"
              >
                Save — Send Now
              </button>
              <button
                onClick={() => handleSave('do_not_send')}
                disabled={saving || !allRated || !selectedGroupId || !teamLeaderId}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow bg-white dark:bg-gray-800"
              >
                Do Not Send
              </button>
            </div>

            {(!selectedGroupId || !teamLeaderId || !allRated) && (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                {!selectedGroupId ? 'Select a lab group' :
                 !teamLeaderId ? 'Select a team leader' :
                 `Rate all ${totalCriteria} criteria to save`}
              </p>
            )}
          </div>
        )}
      </main>
      )}

      {/* Skill Sheet Slide-Out Panel (only in non-embedded mode) */}
      {panelSheetId && !useEmbeddedSkillSheet && (
        <SkillSheetPanel
          sheetId={panelSheetId}
          onClose={() => setPanelSheetId(null)}
          studentId={selectedStudentId || undefined}
          studentName={selectedStudentName}
          labDayId={station?.lab_day?.id}
          stationPoolId={stationId}
          studentQueue={isSkillsStation ? studentQueue : undefined}
          onEvaluationSaved={handleEvaluationSaved}
        />
      )}
    </div>
  );
}
