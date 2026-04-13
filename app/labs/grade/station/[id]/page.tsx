'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Save,
  Lock,
} from 'lucide-react';
import TimerBanner from '@/components/TimerBanner';
import SkillSheetPanel from '@/components/SkillSheetPanel';
import NremtCandidateInstructions from '@/components/NremtCandidateInstructions';
import NremtTimer, { isDualStation } from '@/components/NremtTimer';
import type { NremtTimerHandle } from '@/components/NremtTimer';
import NremtStickyNotesPanel from '@/components/NremtStickyNotesPanel';

// Sub-components
import GradingHeader from '@/components/grading/GradingHeader';
import ScenarioGrading from '@/components/grading/ScenarioGrading';
import EvaluationCriteria from '@/components/grading/EvaluationCriteria';
import StudentSelection from '@/components/grading/StudentSelection';
import FlaggingPanel from '@/components/grading/FlaggingPanel';
import ScenarioReferencePanel from '@/components/grading/ScenarioReferencePanel';

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
  const searchParams = useSearchParams();
  const stationId = params?.id as string;

  // Retake mode detection from URL params
  const isRetakeMode = searchParams?.get('retake') === 'true';
  const retakeStudentId = searchParams?.get('student_id') || null;
  const retakeStudentName = searchParams?.get('student_name') || null;
  const retakeSkillSheetId = searchParams?.get('skill_sheet_id') || null;
  const retakeOriginalEvalId = searchParams?.get('original_evaluation_id') || null;

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
  const [scenarioNotes, setScenarioNotes] = useState('');
  const [showScenarioDetails, setShowScenarioDetails] = useState(true);

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

  // NREMT candidate instructions state
  const [nremtInstructionsRead, setNremtInstructionsRead] = useState(false);
  const [showTimerPrompt, setShowTimerPrompt] = useState(false);
  const nremtTimerRef = useRef<NremtTimerHandle>(null);

  // NREMT examiner panel state (sticky notes, critical fail, need assistance)
  const [examinerNotes, setExaminerNotes] = useState('');
  const [criticalFail, setCriticalFail] = useState(false);
  const [criticalFailNotes, setCriticalFailNotes] = useState('');
  const [assistanceRequested, setAssistanceRequested] = useState(false);
  const [assistanceAlertId, setAssistanceAlertId] = useState<string | null>(null);
  // FIX 3: Per-criterion critical failure tracking
  const [checkedCriticalCriteria, setCheckedCriticalCriteria] = useState<string[]>([]);
  const [skillSheetCriticalCriteria, setSkillSheetCriticalCriteria] = useState<string[]>([]);

  // NREMT skill sheet badge info
  const [nremtSheetSource, setNremtSheetSource] = useState<string | null>(null);
  const [nremtSheetCode, setNremtSheetCode] = useState<string | null>(null);

  // NREMT scenario reference (E201 trauma, E202 medical)
  const [nremtScenario, setNremtScenario] = useState<{
    id: string;
    title: string;
    skill_code: string;
    scenario_data: Record<string, unknown>;
  } | null>(null);

  // Dual-skill station state (O2/NRB + BVM tabbed interface)
  const [dualSkillActiveTab, setDualSkillActiveTab] = useState<number>(0);
  const [dualSkillTab2Unlocked, setDualSkillTab2Unlocked] = useState(false);
  const [dualSkillToast, setDualSkillToast] = useState<string | null>(null);

  // Reset signal for SkillSheetPanel — incremented to force its form to reset
  // from the outside (used when we defer reset for the dual-station handoff modal).
  const [skillSheetResetSignal, setSkillSheetResetSignal] = useState<number>(0);

  // Key for NremtCandidateInstructions — incremented to re-mount the component
  // (resets its local "expanded" / "read" state to defaults).
  const [nremtInstructionsKey, setNremtInstructionsKey] = useState<number>(0);

  // Handle need assistance - send alert to coordinator
  const handleNeedAssistance = useCallback(async () => {
    if (!station?.lab_day?.id || !stationId) return;
    try {
      const res = await fetch(`/api/lab-management/lab-days/${station.lab_day.id}/assistance-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: stationId,
          station_name: station.custom_title || station.skill_name || `Station ${station.station_number}`,
          notes: examinerNotes ? `Examiner notes: ${examinerNotes}` : null,
        }),
      });
      if (res.ok) {
        const resData = await res.json();
        setAssistanceRequested(true);
        if (resData.alert?.id) setAssistanceAlertId(resData.alert.id);
      }
    } catch (err) {
      console.error('Failed to send assistance alert:', err);
    }
  }, [station, stationId, examinerNotes]);

  // FIX 6: Clear an active assistance alert
  const handleClearAssistance = useCallback(async () => {
    if (!station?.lab_day?.id || !assistanceAlertId) {
      setAssistanceRequested(false);
      return;
    }
    try {
      await fetch(`/api/lab-management/lab-days/${station.lab_day.id}/assistance-alerts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: assistanceAlertId, resolve: true }),
      });
    } catch (err) {
      console.error('Failed to clear assistance alert:', err);
    }
    setAssistanceRequested(false);
    setAssistanceAlertId(null);
  }, [station, assistanceAlertId]);

  // Evaluation tracking for auto-advance
  const [evaluatedStudents, setEvaluatedStudents] = useState<Record<string, string>>({});
  const [inProgressStudents, setInProgressStudents] = useState<Record<string, string>>({});

  // Dual-station (O2/NRB E204 -> BVM E203) handoff state
  const [bvmStationId, setBvmStationId] = useState<string | null>(null);
  const [dualStationPrompt, setDualStationPrompt] = useState<null | {
    studentName: string;
    studentId: string;
    bvmStationId: string;
  }>(null);

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

  // Dual-skill station detection: when station has 2+ skill sheets available
  const skillSheetEntries = Object.entries(skillSheetIds);
  const isDualSkillStation = isSkillsStation && skillSheetEntries.length >= 2 &&
    isDualStation(station?.custom_title || station?.skill_name || '');
  const dualSkillSheets = isDualSkillStation ? skillSheetEntries.slice(0, 2) : [];

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

  // Auto-select student when in retake mode
  useEffect(() => {
    if (isRetakeMode && retakeStudentId && allStudents.length > 0) {
      setSelectedStudentId(retakeStudentId);
    }
  }, [isRetakeMode, retakeStudentId, allStudents]);

  // Dual-station handoff: when grading an O2/NRB (E204) station, look up the
  // sibling BVM (E203) station on the same lab day so we can prompt the
  // examiner to continue with the same student.
  useEffect(() => {
    const labDayId = station?.lab_day?.id;
    if (!labDayId || nremtSheetCode !== 'E204') {
      setBvmStationId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/lab-management/lab-days/${labDayId}/station-by-nremt-code?code=E203`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.success && data.station?.id) {
          setBvmStationId(data.station.id);
        }
      } catch {
        /* ignore — fall through to normal auto-advance */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [station?.lab_day?.id, nremtSheetCode]);

  // Handoff target: when navigating from a paired station with ?student=...,
  // pre-select that student once the roster is loaded.
  useEffect(() => {
    const handoffStudentId = searchParams?.get('student');
    if (handoffStudentId && allStudents.some(s => s.id === handoffStudentId)) {
      setSelectedStudentId(handoffStudentId);
    }
  }, [searchParams, allStudents]);

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

  // FIX 3: Fetch critical criteria from the skill sheet for the NREMT examiner panel
  // Also fetches NREMT badge info (source, nremt_code) for any skill sheet
  useEffect(() => {
    if (!panelSheetId) return;
    (async () => {
      try {
        const res = await fetch(`/api/skill-sheets/${panelSheetId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.sheet) {
            // Store NREMT badge info
            if (data.sheet.source) setNremtSheetSource(data.sheet.source);
            if (data.sheet.nremt_code) setNremtSheetCode(data.sheet.nremt_code);
            // Critical criteria only needed for NREMT testing mode
            if (station?.lab_day?.is_nremt_testing) {
              const critFailures = data.sheet.critical_failures || [];
              setSkillSheetCriticalCriteria(critFailures);
            }
          }
        }
      } catch { /* ignore */ }
    })();
  }, [panelSheetId, station?.lab_day?.is_nremt_testing]);

  // Fetch NREMT scenario reference when station + nremt_code are available
  // and a selected_scenario_id is stored on the station metadata.
  useEffect(() => {
    const code = nremtSheetCode;
    if (!station || !code) {
      setNremtScenario(null);
      return;
    }
    if (code !== 'E201' && code !== 'E202') {
      setNremtScenario(null);
      return;
    }
    const metadata = (station.metadata ?? null) as Record<string, unknown> | null;
    const selectedId = metadata && typeof metadata.selected_scenario_id === 'string'
      ? (metadata.selected_scenario_id as string)
      : null;
    if (!selectedId) {
      setNremtScenario(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/nremt-scenarios/${selectedId}`);
        if (!res.ok) {
          if (!cancelled) setNremtScenario(null);
          return;
        }
        const data = await res.json();
        if (!cancelled && data.success && data.scenario) {
          setNremtScenario(data.scenario);
        }
      } catch {
        if (!cancelled) setNremtScenario(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [station, nremtSheetCode]);

  // Dual-skill timer phase change handler
  const handleTimerPhaseChange = useCallback((phaseIdx: number, phaseName: string) => {
    // Phases: 0=O2 Prep, 1=O2 Eval, 2=BVM Prep, 3=BVM Eval
    // Unlock Tab 2 when BVM Prep starts (phase 2)
    if (phaseIdx >= 2 && !dualSkillTab2Unlocked) {
      setDualSkillTab2Unlocked(true);
      setDualSkillToast('O2/NRB time complete — BVM Ventilation now active');
      // Auto-switch to Tab 2
      setDualSkillActiveTab(1);
      // Clear toast after 5 seconds
      setTimeout(() => setDualSkillToast(null), 5000);
    }
  }, [dualSkillTab2Unlocked]);

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

  // Clear all parent-owned evaluation state after a submit so a fresh selection
  // starts clean. Does NOT auto-advance to the next student — the examiner
  // must explicitly pick the next student from the dropdown.
  const resetParentEvaluationState = useCallback(() => {
    setSelectedStudentId('');
    setExaminerNotes('');
    setCriticalFail(false);
    setCriticalFailNotes('');
    setCheckedCriticalCriteria([]);
    setAssistanceRequested(false);
    setAssistanceAlertId(null);
    // Re-mount the "Read to Candidate" instructions card so it returns to
    // its default expanded state for the next student.
    setNremtInstructionsKey(k => k + 1);
    setNremtInstructionsRead(false);
    setShowTimerPrompt(false);
  }, []);

  // Handle evaluation saved from SkillSheetPanel. We no longer auto-advance —
  // the form is simply reset (via onAfterSubmit) and the examiner selects the
  // next student manually.
  const handleEvaluationSaved = useCallback((savedStudentId: string, evaluationId: string, evalStatus: 'complete' | 'in_progress') => {
    if (evalStatus === 'in_progress') {
      setInProgressStudents(prev => ({ ...prev, [savedStudentId]: evaluationId }));
      return;
    }

    // Mark as completed
    setEvaluatedStudents(prev => ({ ...prev, [savedStudentId]: evaluationId }));
    setInProgressStudents(prev => {
      const next = { ...prev };
      delete next[savedStudentId];
      return next;
    });
  }, []);

  // Called from SkillSheetPanel AFTER a successful complete save. Returning
  // true tells the panel to DEFER its internal form reset — the parent will
  // trigger the reset later (via resetSignal) after dismissing a modal.
  const handleAfterSkillSheetSubmit = useCallback((): boolean => {
    // Dual-station handoff: if this is the O2/NRB (E204) station and a paired
    // BVM (E203) station exists, show the prompt BEFORE clearing anything.
    // The prompt's buttons will complete the reset.
    if (nremtSheetCode === 'E204' && bvmStationId && selectedStudentId) {
      const savedStudent = allStudents.find(s => s.id === selectedStudentId);
      const studentName = savedStudent
        ? `${savedStudent.first_name} ${savedStudent.last_name}`
        : 'this student';
      setDualStationPrompt({
        studentName,
        studentId: selectedStudentId,
        bvmStationId,
      });
      return true; // defer reset until modal is dismissed
    }

    // Normal path: clear parent state immediately. Panel will reset its own
    // internal form state (since we return false).
    resetParentEvaluationState();
    return false;
  }, [nremtSheetCode, bvmStationId, selectedStudentId, allStudents, resetParentEvaluationState]);

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
        scenario_notes: scenarioNotes || null,
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
        scenario_notes: scenarioNotes || null,
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
      {/* Timer Banner — FIX 4: Hidden on NREMT testing days (rotation timer irrelevant) */}
      {station?.lab_day?.id && !station?.lab_day?.is_nremt_testing && (
        <TimerBanner
          labDayId={station.lab_day.id}
          stationId={stationId}
          userEmail={session?.user?.email || undefined}
          userName={session?.user?.name || undefined}
          numRotations={4}
        />
      )}

      {/* NREMT Candidate Instructions */}
      {station?.lab_day?.is_nremt_testing && (
        <div className="max-w-7xl mx-auto px-4 pt-2 space-y-2">
          <NremtCandidateInstructions
            key={nremtInstructionsKey}
            stationName={station.custom_title || station.skill_name || ''}
            onInstructionsRead={(read) => {
              setNremtInstructionsRead(read);
              if (read && !nremtTimerRef.current?.isRunning) {
                setShowTimerPrompt(true);
              }
            }}
          />
        </div>
      )}

      {/* RETAKE ATTEMPT Banner */}
      {isRetakeMode && (
        <div className="bg-amber-500 text-white border-b border-amber-600">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <div>
              <div className="font-bold text-lg">RETAKE ATTEMPT</div>
              <div className="text-sm text-amber-100">
                {retakeStudentName ? `Student: ${retakeStudentName}` : 'Retake evaluation'} — This is a second attempt. Result will be compared with first attempt.
              </div>
            </div>
          </div>
        </div>
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
        isNremtSheet={nremtSheetSource === 'nremt'}
        nremtCode={nremtSheetCode}
      />

      {/* FIX 1: NREMT Timer — sticky bottom bar */}
      {station?.lab_day?.is_nremt_testing && (
        <NremtTimer
          ref={nremtTimerRef}
          stationName={station.custom_title || station.skill_name || ''}
          instructionsRead={nremtInstructionsRead}
          stickyBottom
          onPhaseChange={isDualSkillStation ? handleTimerPhaseChange : undefined}
        />
      )}

      {/* Auto-timer prompt after instructions read */}
      {showTimerPrompt && station?.lab_day?.is_nremt_testing && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center" onClick={() => setShowTimerPrompt(false)}>
          <div
            className="bg-white dark:bg-gray-800 w-full sm:w-auto sm:min-w-[400px] sm:max-w-md sm:rounded-xl rounded-t-xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Ready to Begin?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Instructions complete. Start the timer for{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {station.custom_title || station.skill_name || 'this station'}
              </span>{' '}
              ({nremtTimerRef.current?.timeLimitMinutes ?? 15} minutes)?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  nremtTimerRef.current?.start();
                  setShowTimerPrompt(false);
                }}
                className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors min-h-[48px]"
              >
                Start Timer
              </button>
              <button
                onClick={() => setShowTimerPrompt(false)}
                className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors min-h-[48px]"
              >
                Not Yet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dual-skill toast notification */}
      {dualSkillToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] animate-bounce">
          <div className="bg-purple-600 text-white px-6 py-3 rounded-lg shadow-lg font-medium text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {dualSkillToast}
          </div>
        </div>
      )}

      {/* Embedded Skill Sheet Mode: Skills station with skill sheet available */}
      {useEmbeddedSkillSheet && panelSheetId ? (
        <main
          className={
            station?.lab_day?.is_nremt_testing
              ? // NREMT: mobile stacked (<lg) becomes 3-col grid at lg+
                'max-w-[1800px] mx-auto px-4 py-4 pb-24 flex flex-col gap-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)_20rem] lg:gap-4 lg:items-start'
              : 'flex gap-6 max-w-7xl mx-auto px-4 py-4 pb-4'
          }
        >
          {/* Left: Student panel */}
          <div
            className={
              station?.lab_day?.is_nremt_testing
                ? 'lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto pt-2 space-y-3'
                : 'w-80 shrink-0 sticky top-0 max-h-screen overflow-y-auto pt-2 space-y-4'
            }
          >
            <StudentSelection
              isSkillsStation={isSkillsStation}
              isNremtTesting={!!station?.lab_day?.is_nremt_testing}
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

          {/* Center: Skill sheet(s) — tabbed if dual-skill station */}
          <div
            className={
              station?.lab_day?.is_nremt_testing
                ? 'min-h-[60vh] min-w-0'
                : 'flex-1 min-h-[60vh]'
            }
          >
            {/* NREMT scenario reference (E201/E202) — shown above skill sheet */}
            {nremtScenario && (
              <ScenarioReferencePanel scenario={nremtScenario} />
            )}
            {isDualSkillStation && dualSkillSheets.length === 2 ? (
              <>
                {/* Dual-skill tab bar */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                  {dualSkillSheets.map(([name], idx) => {
                    const isActive = dualSkillActiveTab === idx;
                    const isLocked = idx === 1 && !dualSkillTab2Unlocked;
                    return (
                      <button
                        key={name}
                        onClick={() => {
                          if (!isLocked) setDualSkillActiveTab(idx);
                        }}
                        disabled={isLocked}
                        className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                          isActive
                            ? 'text-purple-700 dark:text-purple-300 border-b-2 border-purple-600 dark:border-purple-400'
                            : isLocked
                              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-b-2 border-transparent'
                        }`}
                        title={isLocked ? 'Unlocks after Skill 1 timer completes' : `Skill ${idx + 1}: ${name}`}
                      >
                        {isLocked && <Lock className="w-3.5 h-3.5" />}
                        <span>Skill {idx + 1}: {name}</span>
                        {isActive && (
                          <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Render both panels but only show the active one */}
                {dualSkillSheets.map(([name, sheetId], idx) => (
                  <div key={sheetId} className={dualSkillActiveTab === idx ? '' : 'hidden'}>
                    <SkillSheetPanel
                      sheetId={sheetId}
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
                      onAfterSubmit={handleAfterSkillSheetSubmit}
                      resetSignal={skillSheetResetSignal}
                      embedded={true}
                      nremtMode={!!station?.lab_day?.is_nremt_testing}
                      defaultMode={station?.lab_day?.is_nremt_testing ? 'final' : undefined}
                      isNremtTesting={!!station?.lab_day?.is_nremt_testing}
                      criticalFail={criticalFail}
                      examinerNotes={examinerNotes}
                      checkedCriticalCriteria={checkedCriticalCriteria}
                      criticalFailNotes={criticalFailNotes}
                      isRetake={isRetakeMode}
                      originalEvaluationId={retakeOriginalEvalId || undefined}
                    />
                  </div>
                ))}
              </>
            ) : (
              /* Single skill sheet — original behavior */
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
                nremtMode={!!station?.lab_day?.is_nremt_testing}
                defaultMode={station?.lab_day?.is_nremt_testing ? 'final' : undefined}
                isNremtTesting={!!station?.lab_day?.is_nremt_testing}
                criticalFail={criticalFail}
                examinerNotes={examinerNotes}
                checkedCriticalCriteria={checkedCriticalCriteria}
                criticalFailNotes={criticalFailNotes}
                isRetake={isRetakeMode}
                originalEvaluationId={retakeOriginalEvalId || undefined}
              />
            )}
          </div>

          {/* Right: NREMT Examiner Panel (sticky notes, critical fail, assistance) */}
          {station?.lab_day?.is_nremt_testing && (
            <>
              {/* Desktop (lg+): inline column in 3-col grid */}
              <div className="hidden lg:block lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto pt-2">
                <NremtStickyNotesPanel
                  mode="desktop-inline"
                  notes={examinerNotes}
                  onNotesChange={setExaminerNotes}
                  criticalFail={criticalFail}
                  onCriticalFailChange={setCriticalFail}
                  criticalFailNotes={criticalFailNotes}
                  onCriticalFailNotesChange={setCriticalFailNotes}
                  onNeedAssistance={handleNeedAssistance}
                  assistanceRequested={assistanceRequested}
                  onClearAssistance={handleClearAssistance}
                  criticalCriteria={skillSheetCriticalCriteria}
                  checkedCriteria={checkedCriticalCriteria}
                  onCheckedCriteriaChange={setCheckedCriticalCriteria}
                  resultIsFail={criticalFail}
                />
              </div>
              {/* Mobile (<lg): floating drawer */}
              <div className="lg:hidden">
                <NremtStickyNotesPanel
                  notes={examinerNotes}
                  onNotesChange={setExaminerNotes}
                  criticalFail={criticalFail}
                  onCriticalFailChange={setCriticalFail}
                  criticalFailNotes={criticalFailNotes}
                  onCriticalFailNotesChange={setCriticalFailNotes}
                  onNeedAssistance={handleNeedAssistance}
                  assistanceRequested={assistanceRequested}
                  onClearAssistance={handleClearAssistance}
                  criticalCriteria={skillSheetCriticalCriteria}
                  checkedCriteria={checkedCriticalCriteria}
                  onCheckedCriteriaChange={setCheckedCriticalCriteria}
                  resultIsFail={criticalFail}
                />
              </div>
            </>
          )}
        </main>
      ) : (
      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4 pb-20">
        {/* Scenario/Skills Station Info */}
        <ScenarioGrading
          station={station}
          showScenarioDetails={showScenarioDetails}
          onToggleScenarioDetails={() => setShowScenarioDetails(!showScenarioDetails)}
          skillSheetIds={skillSheetIds}
          onOpenSkillSheet={(sheetId) => setPanelSheetId(sheetId)}
          scenarioNotes={scenarioNotes}
          onScenarioNotesChange={(notes) => {
            setScenarioNotes(notes);
            triggerAutoSave();
          }}
          isNremtTesting={!!station?.lab_day?.is_nremt_testing}
        />

        {/* Student/Group Selection */}
        <StudentSelection
          isSkillsStation={isSkillsStation}
          isNremtTesting={!!station?.lab_day?.is_nremt_testing}
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
        {/* NREMT Examiner Panel (non-embedded mode) */}
        {station?.lab_day?.is_nremt_testing && (
          <NremtStickyNotesPanel
            notes={examinerNotes}
            onNotesChange={setExaminerNotes}
            criticalFail={criticalFail}
            onCriticalFailChange={setCriticalFail}
            criticalFailNotes={criticalFailNotes}
            onCriticalFailNotesChange={setCriticalFailNotes}
            onNeedAssistance={handleNeedAssistance}
            assistanceRequested={assistanceRequested}
            onClearAssistance={handleClearAssistance}
            criticalCriteria={skillSheetCriticalCriteria}
            checkedCriteria={checkedCriticalCriteria}
            onCheckedCriteriaChange={setCheckedCriticalCriteria}
            resultIsFail={criticalFail}
          />
        )}
      </main>
      )}

      {/* Dual-station handoff prompt: O2/NRB (E204) -> BVM (E203) */}
      {dualStationPrompt && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dual-station-prompt-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <h2
              id="dual-station-prompt-title"
              className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
            >
              O2/NRB complete for {dualStationPrompt.studentName}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Proceed to BVM Ventilation?
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setDualStationPrompt(null);
                  // Now complete the deferred reset: clear parent state and
                  // signal the SkillSheetPanel to reset its internal form.
                  resetParentEvaluationState();
                  setSkillSheetResetSignal(n => n + 1);
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 font-medium"
              >
                Next Student
              </button>
              <button
                type="button"
                onClick={() => {
                  const { bvmStationId: targetId, studentId } = dualStationPrompt;
                  setDualStationPrompt(null);
                  router.push(`/labs/grade/station/${targetId}?student=${studentId}`);
                }}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium shadow"
              >
                Open BVM Station
              </button>
            </div>
          </div>
        </div>
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
          onAfterSubmit={handleAfterSkillSheetSubmit}
          resetSignal={skillSheetResetSignal}
          nremtMode={!!station?.lab_day?.is_nremt_testing}
          defaultMode={station?.lab_day?.is_nremt_testing ? 'final' : undefined}
          isNremtTesting={!!station?.lab_day?.is_nremt_testing}
          criticalFail={criticalFail}
          examinerNotes={examinerNotes}
          checkedCriticalCriteria={checkedCriticalCriteria}
          criticalFailNotes={criticalFailNotes}
          isRetake={isRetakeMode}
          originalEvaluationId={retakeOriginalEvalId || undefined}
        />
      )}
    </div>
  );
}
