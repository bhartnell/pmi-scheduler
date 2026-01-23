'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Save,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Star,
  FileText,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  ClipboardCheck
} from 'lucide-react';
import TimerBanner from '@/components/TimerBanner';

// Types
interface Student {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

interface LabGroup {
  id: string;
  name: string;
  members: {
    id: string;
    student: Student;
  }[];
}

interface ScenarioPhase {
  phase_name: string;
  vitals?: {
    bp?: string;
    hr?: string;
    rr?: string;
    spo2?: string;
    etco2?: string;
    temp?: string;
    glucose?: string;
    gcs?: string;
    pain?: string;
  };
  presentation_notes?: string;
  expected_interventions?: string[];
}

interface Station {
  id: string;
  station_number: number;
  station_type: string;
  skill_name: string | null;
  custom_title: string | null;
  station_details: string | null;
  skill_sheet_url: string | null;
  instructions_url: string | null;
  station_notes: string | null;
  scenario: {
    id: string;
    title: string;
    category: string;
    subcategory: string | null;
    difficulty: string;
    estimated_duration: number | null;
    instructor_notes: string | null;
    learning_objectives: string[] | null;
    dispatch_time: string | null;
    dispatch_location: string | null;
    chief_complaint: string | null;
    dispatch_notes: string | null;
    patient_name: string | null;
    patient_age: number | null;
    patient_sex: string | null;
    patient_weight: number | null;
    medical_history: string[] | null;
    medications: string[] | null;
    allergies: string[] | null;
    general_impression: string | null;
    initial_vitals: Record<string, string> | null;
    phases: ScenarioPhase[] | null;
    critical_actions: string[];
    debrief_points: string[];
  } | null;
  lab_day: {
    id: string;
    date: string;
    cohort: {
      id: string;
      cohort_number: number;
      program: { abbreviation: string };
    };
  };
}

interface CriteriaRating {
  criteria_id: string;
  criteria_name: string;
  rating: 'S' | 'NI' | 'U' | null;
  notes: string;
}

// Constants
const EVALUATION_CRITERIA = [
  { id: '1', name: 'Scene Safety', description: 'BSI, scene safety, situational awareness' },
  { id: '2', name: 'Initial Assessment', description: 'Primary survey, life threat identification' },
  { id: '3', name: 'History/Chief Complaint', description: 'SAMPLE, OPQRST, relevant history gathering' },
  { id: '4', name: 'Physical Exam/Vital Signs', description: 'Secondary assessment, vital signs, monitoring' },
  { id: '5', name: 'Protocol/Treatment', description: 'Appropriate interventions, medication dosing' },
  { id: '6', name: 'Affective Domain', description: 'Professionalism, empathy, stress management' },
  { id: '7', name: 'Communication', description: 'Team communication, patient rapport, documentation' },
  { id: '8', name: 'Skills', description: 'Technical proficiency, proper technique' }
];

// Simplified criteria for skills stations
const SKILLS_EVALUATION_CRITERIA = [
  { id: 's1', name: 'Technique/Procedure', description: 'Proper steps followed in correct sequence' },
  { id: 's2', name: 'Safety', description: 'BSI, patient safety, scene awareness maintained' },
  { id: 's3', name: 'Completion', description: 'Skill completed successfully within appropriate time' },
  { id: 's4', name: 'Overall Competency', description: 'Demonstrates understanding and ability to perform skill' }
];

const RATING_COLORS = {
  'S': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700',
  'NI': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  'U': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700',
  null: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'
};

const RATING_LABELS = {
  'S': 'Satisfactory',
  'NI': 'Needs Improvement',
  'U': 'Unsatisfactory'
};

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
      const initial: Record<string, boolean> = {};
      station.scenario.critical_actions.forEach((action, index) => {
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

  const fetchLabGroups = async (cohortId: string) => {
    try {
      // Fetch groups from student_groups (created in Cohort Manager)
      const res = await fetch(`/api/lab-management/groups?cohortId=${cohortId}`);
      const data = await res.json();
      if (data.success && data.groups) {
        // Fetch members for each group
        const groupsWithMembers = await Promise.all(
          data.groups.map(async (group: any) => {
            const membersRes = await fetch(`/api/lab-management/groups/${group.id}/members`);
            const membersData = await membersRes.json();
            return {
              id: group.id,
              name: group.name,
              members: (membersData.members || []).map((m: any) => ({
                id: m.id,
                student: {
                  id: m.id,
                  first_name: m.first_name,
                  last_name: m.last_name,
                  photo_url: m.photo_url
                }
              }))
            };
          })
        );
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
  };

  const updateNotes = (criteriaId: string, notes: string) => {
    setCriteriaRatings(prev => 
      prev.map(r => r.criteria_id === criteriaId ? { ...r, notes } : r)
    );
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

      // Check if NI or U ratings have notes (only for scenario stations)
      const missingNotes = criteriaRatings.filter(
        r => (r.rating === 'NI' || r.rating === 'U') && !r.notes.trim()
      );
      if (missingNotes.length > 0) {
        alert(`Please add notes for: ${missingNotes.map(r => r.criteria_name).join(', ')}`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        station_id: stationId,
        scenario_id: station?.scenario?.id,
        lab_group_id: isSkillsStation ? null : selectedGroupId,
        team_lead_id: isSkillsStation ? null : teamLeaderId,
        student_id: isSkillsStation ? selectedStudentId : null,
        rotation_number: rotationNumber,
        criteria_ratings: criteriaRatings,
        critical_actions_completed: criticalActions,
        satisfactory_count: satisfactoryCount,
        overall_comments: overallComments,
        graded_by: session?.user?.email,
        phase1_pass: phase1Pass,
        phase2_pass: phase2Pass,
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

  const labDay = station.lab_day;
  const scenario = station.scenario;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Timer Banner - shows synchronized timer for all instructors */}
      {station?.lab_day?.id && (
        <TimerBanner
          labDayId={station.lab_day.id}
          numRotations={4}
        />
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/lab-management/schedule/${labDay.id}`} className="hover:text-blue-600 dark:hover:text-blue-400">
              {new Date(labDay.date + 'T12:00:00').toLocaleDateString()}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Grade</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                Station {station.station_number} - Grade Rotation
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || (isSkillsStation ? !selectedStudentId : (!allRated || !selectedGroupId || !teamLeaderId))}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-20">
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

            {/* Station Details/Instructions */}
            {station.station_details && (
              <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700">
                <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Instructions:</div>
                <div className="text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap">{station.station_details}</div>
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
              onClick={() => setShowScenarioDetails(!showScenarioDetails)}
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
                {/* Dispatch Info */}
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
                {(scenario.medical_history?.length || scenario.medications?.length || scenario.allergies?.length) && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">History</h3>
                    <div className="text-sm text-orange-700 dark:text-orange-400 space-y-1">
                      {scenario.medical_history && scenario.medical_history.length > 0 && (
                        <p><span className="font-medium">PMHx:</span> {scenario.medical_history.join(', ')}</p>
                      )}
                      {scenario.medications && scenario.medications.length > 0 && (
                        <p><span className="font-medium">Meds:</span> {scenario.medications.join(', ')}</p>
                      )}
                      {scenario.allergies && scenario.allergies.length > 0 && (
                        <p><span className="font-medium">Allergies:</span> {scenario.allergies.join(', ')}</p>
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

                {/* Phases with Vitals Changes */}
                {scenario.phases && scenario.phases.length > 1 && (
                  <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                    <h3 className="text-sm font-medium text-cyan-800 dark:text-cyan-300 mb-2">Scenario Phases</h3>
                    <div className="space-y-3">
                      {scenario.phases.map((phase, index) => (
                        <div key={index} className="border-l-2 border-cyan-400 dark:border-cyan-600 pl-3">
                          <div className="font-medium text-cyan-700 dark:text-cyan-400 text-sm">{phase.phase_name}</div>
                          {phase.presentation_notes && (
                            <p className="text-xs text-cyan-600 dark:text-cyan-500 mt-1">{phase.presentation_notes}</p>
                          )}
                          {phase.vitals && Object.keys(phase.vitals).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2 text-xs">
                              {Object.entries(phase.vitals).map(([key, value]) => (
                                value && (
                                  <span key={key} className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-cyan-700 dark:text-cyan-400">
                                    {key.toUpperCase()}: {value}
                                  </span>
                                )
                              ))}
                            </div>
                          )}
                          {phase.expected_interventions && phase.expected_interventions.length > 0 && (
                            <div className="mt-2 text-xs text-cyan-600 dark:text-cyan-500">
                              <span className="font-medium">Expected:</span> {phase.expected_interventions.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Learning Objectives */}
                {scenario.learning_objectives && scenario.learning_objectives.length > 0 && (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-300 mb-2">Learning Objectives</h3>
                    <ul className="text-sm text-indigo-700 dark:text-indigo-400 space-y-1">
                      {scenario.learning_objectives.map((obj, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-indigo-400 dark:text-indigo-500">•</span>
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Instructor Notes */}
                {scenario.instructor_notes && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Instructor Notes</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-400">{scenario.instructor_notes}</p>
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

        {/* Student/Group Selection - Different UI for skills vs scenario */}
        {isSkillsStation ? (
          /* Skills Station: Simple student dropdown */
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
              Select Student
            </h2>

            {/* Student Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student</label>
              {allStudents.length === 0 ? (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Loading students...
                  </p>
                </div>
              ) : (
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select a student...</option>
                  {allStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Rotation Number (optional for skills) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rotation <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setRotationNumber(num)}
                    className={`w-12 h-12 rounded-lg font-medium ${
                      rotationNumber === num
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Scenario Station: Group & Team Lead Selection */
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Select Group & Team Lead
            </h2>

            {/* Rotation Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rotation Number</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setRotationNumber(num)}
                    className={`w-12 h-12 rounded-lg font-medium ${
                      rotationNumber === num
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Lab Group Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lab Group</label>
              {labGroups.length === 0 ? (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    No lab groups found for this cohort.
                    <Link href={`/lab-management/cohorts/${station.lab_day.cohort.id}/groups`} className="underline ml-1">
                      Create groups first
                    </Link>
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {labGroups.map(group => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setTeamLeaderId('');
                      }}
                      className={`p-3 rounded-lg border-2 text-left ${
                        selectedGroupId === group.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{group.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{group.members?.length || 0} students</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Team Lead Selection */}
            {selectedGroup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Team Leader <Star className="w-4 h-4 inline text-yellow-500" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedGroup.members?.map(member => (
                    <button
                      key={member.student.id}
                      type="button"
                      onClick={() => setTeamLeaderId(member.student.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 ${
                        teamLeaderId === member.student.id
                          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden shrink-0">
                        {member.student.photo_url ? (
                          <img src={member.student.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {member.student.first_name[0]}{member.student.last_name[0]}
                          </span>
                        )}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {member.student.first_name} {member.student.last_name}
                        </div>
                        {teamLeaderId === member.student.id && (
                          <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                            <Star className="w-3 h-3" /> Team Lead
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Critical Actions */}
        {scenario?.critical_actions && scenario.critical_actions.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Critical Actions
            </h2>
            <div className="space-y-2">
              {scenario.critical_actions.map((action, index) => (
                <label
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer ${
                    criticalActions[`action-${index}`] ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={criticalActions[`action-${index}`] || false}
                    onChange={(e) => setCriticalActions(prev => ({
                      ...prev,
                      [`action-${index}`]: e.target.checked
                    }))}
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

        {/* Evaluation Criteria - different for skills vs scenarios */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {isSkillsStation ? (
                <>
                  <ClipboardCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Skill Evaluation
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Evaluation Criteria
                </>
              )}
            </h2>
            <div className="text-sm">
              <span className="text-green-600 dark:text-green-400 font-medium">{satisfactoryCount} S</span>
              {needsImprovementCount > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400 font-medium ml-2">{needsImprovementCount} NI</span>
              )}
              {unsatisfactoryCount > 0 && (
                <span className="text-red-600 dark:text-red-400 font-medium ml-2">{unsatisfactoryCount} U</span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {activeCriteria.map((criteria, index) => {
              const rating = criteriaRatings.find(r => r.criteria_id === criteria.id);
              const needsNotes = rating?.rating === 'NI' || rating?.rating === 'U';

              return (
                <div key={criteria.id} className="border dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm font-medium shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white">{criteria.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{criteria.description}</div>

                      {/* Rating Buttons */}
                      <div className="flex gap-2 mb-2">
                        {(['S', 'NI', 'U'] as const).map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => updateRating(criteria.id, r)}
                            className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                              rating?.rating === r
                                ? RATING_COLORS[r]
                                : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                          >
                            {r === 'S' ? 'Satisfactory' : r === 'NI' ? 'Needs Improvement' : 'Unsatisfactory'}
                          </button>
                        ))}
                      </div>

                      {/* Notes (required for NI/U) */}
                      {needsNotes && (
                        <div>
                          <textarea
                            value={rating?.notes || ''}
                            onChange={(e) => updateNotes(criteria.id, e.target.value)}
                            placeholder="Required: Explain the issue and improvement plan..."
                            rows={2}
                            className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 ${
                              !rating?.notes?.trim() ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pass/Fail Summary */}
          {allRated && (
            <div className={`mt-4 p-4 rounded-lg ${
              isSkillsStation ? (
                skillsPass ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700' :
                skillsNeedsPractice ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700' :
                'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
              ) : (
                phase2Pass ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700' :
                phase1Pass ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700' :
                'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
              )
            }`}>
              <div className="flex items-center gap-3">
                {isSkillsStation ? (
                  skillsPass ? (
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  ) : skillsNeedsPractice ? (
                    <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  )
                ) : (
                  phase2Pass ? (
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  ) : phase1Pass ? (
                    <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  )
                )}
                <div>
                  <div className={`font-medium ${
                    isSkillsStation ? (
                      skillsPass ? 'text-green-800 dark:text-green-300' :
                      skillsNeedsPractice ? 'text-yellow-800 dark:text-yellow-300' :
                      'text-red-800 dark:text-red-300'
                    ) : (
                      phase2Pass ? 'text-green-800 dark:text-green-300' :
                      phase1Pass ? 'text-yellow-800 dark:text-yellow-300' :
                      'text-red-800 dark:text-red-300'
                    )
                  }`}>
                    {satisfactoryCount}/{totalCriteria} Satisfactory
                  </div>
                  <div className={`text-sm ${
                    isSkillsStation ? (
                      skillsPass ? 'text-green-700 dark:text-green-400' :
                      skillsNeedsPractice ? 'text-yellow-700 dark:text-yellow-400' :
                      'text-red-700 dark:text-red-400'
                    ) : (
                      phase2Pass ? 'text-green-700 dark:text-green-400' :
                      phase1Pass ? 'text-yellow-700 dark:text-yellow-400' :
                      'text-red-700 dark:text-red-400'
                    )
                  }`}>
                    {isSkillsStation ? (
                      skillsPass ? 'Pass - Skill demonstrated competently' :
                      skillsNeedsPractice ? 'Needs Practice - Additional training recommended' :
                      'Unsatisfactory - Remediation required'
                    ) : (
                      phase2Pass ? 'Phase 2 Pass (7/8 required)' :
                      phase1Pass ? 'Phase 1 Pass (6/8 required) - Does not meet Phase 2' :
                      'Does not meet Phase 1 or Phase 2 requirements'
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Overall Comments */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Overall Comments</h2>
          <textarea
            value={overallComments}
            onChange={(e) => setOverallComments(e.target.value)}
            placeholder="Additional comments, feedback, or observations..."
            rows={4}
            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
          />
        </div>

        {/* Flagging Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Flag for Review
          </h2>

          {/* Issue Level */}
          <div className="space-y-2 mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Issue Level</label>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-colors ${
                issueLevel === 'none' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}>
                <input
                  type="radio"
                  name="issueLevel"
                  value="none"
                  checked={issueLevel === 'none'}
                  onChange={() => { setIssueLevel('none'); setFlagCategories([]); }}
                  className="w-4 h-4 text-green-600"
                />
                <span className="text-gray-900 dark:text-white">No Issues</span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-colors ${
                issueLevel === 'minor' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}>
                <input
                  type="radio"
                  name="issueLevel"
                  value="minor"
                  checked={issueLevel === 'minor'}
                  onChange={() => setIssueLevel('minor')}
                  className="w-4 h-4 text-yellow-600"
                />
                <span className="text-gray-900 dark:text-white">Minor - Learning Opportunity</span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-colors ${
                issueLevel === 'needs_followup' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}>
                <input
                  type="radio"
                  name="issueLevel"
                  value="needs_followup"
                  checked={issueLevel === 'needs_followup'}
                  onChange={() => setIssueLevel('needs_followup')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-gray-900 dark:text-white flex items-center gap-2">
                  Needs Follow-up - Flag for Lead
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </span>
              </label>
            </div>
          </div>

          {/* Flag Categories (shown when minor or needs_followup) */}
          {issueLevel !== 'none' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Flag Categories (select all that apply)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'affective', label: 'Affective/Attitude' },
                  { value: 'skill_performance', label: 'Skill Performance' },
                  { value: 'safety', label: 'Safety Concern' },
                  { value: 'remediation', label: 'Needs Remediation' },
                  { value: 'positive', label: 'Positive Recognition 🌟' }
                ].map(category => (
                  <label
                    key={category.value}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${
                      flagCategories.includes(category.value)
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={flagCategories.includes(category.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFlagCategories([...flagCategories, category.value]);
                        } else {
                          setFlagCategories(flagCategories.filter(c => c !== category.value));
                        }
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{category.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Debrief Points */}
        {scenario?.debrief_points && scenario.debrief_points.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Debrief Discussion Points</h2>
            <ul className="space-y-2">
              {scenario.debrief_points.map((point, index) => (
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
            {saving ? 'Saving Assessment...' : 'Save Assessment'}
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
    </div>
  );
}
