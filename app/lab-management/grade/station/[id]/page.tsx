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
} from '@/components/grading/types';
import type {
  Student,
  LabGroup,
  Station,
  CriteriaRating,
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

  // Computed values
  const selectedGroup = labGroups.find(g => g.id === selectedGroupId);
  const satisfactoryCount = criteriaRatings.filter(r => r.rating === 'S').length;
  const needsImprovementCount = criteriaRatings.filter(r => r.rating === 'NI').length;
  const unsatisfactoryCount = criteriaRatings.filter(r => r.rating === 'U').length;
  const allRated = criteriaRatings.length > 0 && criteriaRatings.every(r => r.rating !== null);
  const totalCriteria = criteriaRatings.length;

  // Pass calculation - different for skills vs scenario
  // Skills: Pass (4/4), Needs Practice (3/4), Fail (<3/4)
  // Scenario: Phase 1 (6/8), Phase 2 (7/8)
  const skillsPass = satisfactoryCount === 4;
  const skillsNeedsPractice = satisfactoryCount >= 3 && satisfactoryCount < 4;
  const phase1Pass = isSkillsStation ? skillsPass : satisfactoryCount >= 6;
  const phase2Pass = isSkillsStation ? skillsPass : satisfactoryCount >= 7;

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
      setCriteriaRatings(criteria.map(c => ({
        criteria_id: c.id,
        criteria_name: c.name,
        rating: null,
        notes: ''
      })));
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
      // Also look up the station's main skill name
      // custom_title may include cohort/date prefix like "EMT4 03/04/26 - Skill Name"
      // Strip the prefix to get just the skill name for lookup
      let mainSkillName = station.skill_name || station.custom_title;
      if (mainSkillName) {
        // Strip "COHORT MM/DD/YY - " prefix pattern
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
      // Fallback to individual lookups if bulk endpoint not available
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
      // Fetch groups with members included in a single request
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
          // Toggle behavior: clicking selected rating deselects it
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

  const handleSave = async () => {
    // Validation - different for skills vs scenario stations
    if (isSkillsStation) {
      // Skills station: just need a student selected
      if (!selectedStudentId) {
        alert('Please select a student');
        return;
      }
      // Ratings are optional for skills stations
    } else {
      // Scenario station: need group, team lead, and all ratings
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

      // Validation: Require notes for Needs Improvement or Unsatisfactory ratings
      const missingNotes = criteriaRatings.filter(r =>
        (r.rating === 'NI' || r.rating === 'U') && (!r.notes || r.notes.trim() === '')
      );
      if (missingNotes.length > 0) {
        const criteriaNames = missingNotes.map(r => r.criteria_name).join(', ');
        alert(`Please add notes for the following "Needs Improvement" or "Unsatisfactory" ratings: ${criteriaNames}`);
        return;
      }

      // Validation: If flagged for follow-up, require at least one category selected
      if (issueLevel === 'needs_followup' && flagCategories.length === 0) {
        alert('Please select at least one category when flagging for follow-up');
        return;
      }
    }

    setSaving(true);
    try {
      // Build payload with EXACT DB column names only
      // Schema: id, lab_station_id, lab_day_id, cohort_id, rotation_number,
      // team_lead_id, graded_by, criteria_ratings, overall_comments, overall_score,
      // flagged_for_review, issue_level, flag_categories, created_at
      const payload = {
        // Required fields
        lab_station_id: stationId,
        lab_day_id: station?.lab_day?.id,
        cohort_id: station?.lab_day?.cohort?.id,
        rotation_number: rotationNumber,
        // Optional fields
        team_lead_id: isSkillsStation ? null : teamLeaderId,
        graded_by: session?.user?.email,
        // JSONB criteria ratings
        criteria_ratings: criteriaRatings,
        // Comments and score
        overall_comments: overallComments,
        overall_score: satisfactoryCount,
        // Flagging fields
        issue_level: issueLevel,
        flag_categories: flagCategories.length > 0 ? flagCategories : null,
        flagged_for_review: issueLevel === 'needs_followup'
      };

      const res = await fetch('/api/lab-management/assessments/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        // Only log team lead for scenario stations
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
        alert('Assessment saved successfully!');
        router.push(`/lab-management/schedule/${station?.lab_day?.id}`);
      } else {
        alert('Failed to save: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving assessment:', error);
      alert('Failed to save assessment');
    }
    setSaving(false);
  };

  // Auto-save function (no validation, silent save)
  const autoSave = useCallback(async () => {
    // Skip auto-save if no meaningful data yet
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
        flagged_for_review: issueLevel === 'needs_followup'
      };

      const res = await fetch('/api/lab-management/assessments/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        // Only log team lead for scenario stations
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

        setSaveStatus('saved');

        // Clear "saved" indicator after 3 seconds
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

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new 2-second debounce timer
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
          <Link href="/lab-management/schedule" className="text-blue-600 dark:text-blue-400 hover:underline mt-4 block">
            Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

  const scenario = station.scenario;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Timer Banner - shows synchronized timer for all instructors */}
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
        onSave={handleSave}
      />

      {/* Embedded Skill Sheet Mode: Skills station with skill sheet available */}
      {useEmbeddedSkillSheet && panelSheetId ? (
        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-4">
          {/* Student Selection (compact) */}
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
          />

          {/* Embedded Skill Sheet — full width, independently scrollable */}
          <div className="min-h-[60vh]">
            <SkillSheetPanel
              sheetId={panelSheetId}
              onClose={() => {
                setUseEmbeddedSkillSheet(false);
                setPanelSheetId(null);
              }}
              studentId={selectedStudentId || undefined}
              studentName={
                selectedStudentId
                  ? (() => {
                      const s = allStudents.find(s => s.id === selectedStudentId);
                      return s ? `${s.first_name} ${s.last_name}` : undefined;
                    })()
                  : undefined
              }
              labDayId={station?.lab_day?.id}
              embedded={true}
            />
          </div>
        </main>
      ) : (
        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-20">
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
          />

          {/* Critical Actions */}
          {scenario?.critical_actions && toArray(scenario.critical_actions).length > 0 && (
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

          {/* Evaluation Criteria */}
          <EvaluationCriteria
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
          />

          {/* Overall Comments */}
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

          {/* Flagging Section */}
          <FlaggingPanel
            issueLevel={issueLevel}
            flagCategories={flagCategories}
            onSetIssueLevel={setIssueLevel}
            onSetFlagCategories={setFlagCategories}
            triggerAutoSave={triggerAutoSave}
          />

          {/* Debrief Points */}
          {scenario?.debrief_points && toArray(scenario.debrief_points).length > 0 && (
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

          {/* Save Button (Bottom) */}
          <div className="sticky bottom-4">
            <button
              onClick={handleSave}
              disabled={saving || (isSkillsStation ? !selectedStudentId : (!allRated || !selectedGroupId || !teamLeaderId))}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? 'Saving...' : (
                isSkillsStation && selectedStudentId
                  ? `Save — ${allStudents.find(s => s.id === selectedStudentId)?.first_name || ''} ${allStudents.find(s => s.id === selectedStudentId)?.last_name || ''}`
                  : 'Save Assessment'
              )}
            </button>
            {isSkillsStation ? (
              !selectedStudentId && (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Select a student to save
                </p>
              )
            ) : (
              (!selectedGroupId || !teamLeaderId || !allRated) && (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {!selectedGroupId ? 'Select a lab group' :
                   !teamLeaderId ? 'Select a team leader' :
                   `Rate all ${totalCriteria} criteria to save`}
                </p>
              )
            )}
          </div>
        </main>
      )}

      {/* Skill Sheet Slide-Out Panel (only in non-embedded mode) */}
      {panelSheetId && !useEmbeddedSkillSheet && (
        <SkillSheetPanel
          sheetId={panelSheetId}
          onClose={() => setPanelSheetId(null)}
          studentId={selectedStudentId || undefined}
          studentName={
            selectedStudentId
              ? (() => {
                  const s = allStudents.find(s => s.id === selectedStudentId);
                  return s ? `${s.first_name} ${s.last_name}` : undefined;
                })()
              : undefined
          }
          labDayId={station?.lab_day?.id}
        />
      )}
    </div>
  );
}
