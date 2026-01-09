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
  Clock
} from 'lucide-react';

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

interface Station {
  id: string;
  station_number: number;
  scenario: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
    critical_actions: string[];
    instructor_notes: string;
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

const RATING_COLORS = {
  'S': 'bg-green-100 text-green-800 border-green-300',
  'NI': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'U': 'bg-red-100 text-red-800 border-red-300',
  null: 'bg-gray-100 text-gray-500 border-gray-300'
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Grading state
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [teamLeaderId, setTeamLeaderId] = useState<string>('');
  const [rotationNumber, setRotationNumber] = useState<number>(1);
  const [criticalActions, setCriticalActions] = useState<Record<string, boolean>>({});
  const [criteriaRatings, setCriteriaRatings] = useState<CriteriaRating[]>(
    EVALUATION_CRITERIA.map(c => ({ criteria_id: c.id, criteria_name: c.name, rating: null, notes: '' }))
  );
  const [overallComments, setOverallComments] = useState('');
  const [showScenarioDetails, setShowScenarioDetails] = useState(false);

  // Computed values
  const selectedGroup = labGroups.find(g => g.id === selectedGroupId);
  const satisfactoryCount = criteriaRatings.filter(r => r.rating === 'S').length;
  const needsImprovementCount = criteriaRatings.filter(r => r.rating === 'NI').length;
  const unsatisfactoryCount = criteriaRatings.filter(r => r.rating === 'U').length;
  const allRated = criteriaRatings.every(r => r.rating !== null);
  
  // Pass calculation (Phase 1: 6/8, Phase 2: 7/8)
  const phase1Pass = satisfactoryCount >= 6;
  const phase2Pass = satisfactoryCount >= 7;

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
      const res = await fetch(`/api/lab-management/lab-groups?cohortId=${cohortId}`);
      const data = await res.json();
      if (data.success) {
        setLabGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Error fetching lab groups:', error);
    }
  };

  const updateRating = (criteriaId: string, rating: 'S' | 'NI' | 'U') => {
    setCriteriaRatings(prev => 
      prev.map(r => r.criteria_id === criteriaId ? { ...r, rating } : r)
    );
  };

  const updateNotes = (criteriaId: string, notes: string) => {
    setCriteriaRatings(prev => 
      prev.map(r => r.criteria_id === criteriaId ? { ...r, notes } : r)
    );
  };

  const handleSave = async () => {
    // Validation
    if (!selectedGroupId) {
      alert('Please select a lab group');
      return;
    }
    if (!teamLeaderId) {
      alert('Please select a team leader');
      return;
    }
    if (!allRated) {
      alert('Please rate all 8 criteria');
      return;
    }

    // Check if NI or U ratings have notes
    const missingNotes = criteriaRatings.filter(
      r => (r.rating === 'NI' || r.rating === 'U') && !r.notes.trim()
    );
    if (missingNotes.length > 0) {
      alert(`Please add notes for: ${missingNotes.map(r => r.criteria_name).join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        station_id: stationId,
        scenario_id: station?.scenario?.id,
        lab_group_id: selectedGroupId,
        team_lead_id: teamLeaderId,
        rotation_number: rotationNumber,
        criteria_ratings: criteriaRatings,
        critical_actions_completed: criticalActions,
        satisfactory_count: satisfactoryCount,
        overall_comments: overallComments,
        graded_by: session?.user?.email,
        phase1_pass: phase1Pass,
        phase2_pass: phase2Pass
      };

      const res = await fetch('/api/lab-management/assessments/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        // Also log team lead
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  if (!station) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">Station not found</p>
          <Link href="/lab-management/schedule" className="text-blue-600 hover:underline mt-4 block">
            Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

  const labDay = station.lab_day;
  const scenario = station.scenario;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link href="/" className="hover:text-blue-600">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/lab-management/schedule/${labDay.id}`} className="hover:text-blue-600">
              {new Date(labDay.date).toLocaleDateString()}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Grade</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                Station {station.station_number} - Grade Rotation
              </h1>
              <p className="text-sm text-gray-600">
                {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !allRated || !selectedGroupId || !teamLeaderId}
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

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Scenario Info */}
        {scenario ? (
          <div className="bg-white rounded-lg shadow">
            <button
              onClick={() => setShowScenarioDetails(!showScenarioDetails)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <div>
                <h2 className="font-semibold text-gray-900">{scenario.title}</h2>
                <p className="text-sm text-gray-600">{scenario.category} • {scenario.difficulty}</p>
              </div>
              {showScenarioDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showScenarioDetails && scenario.instructor_notes && (
              <div className="px-4 pb-4 border-t">
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-800 mb-1">Instructor Notes</h3>
                  <p className="text-sm text-blue-700">{scenario.instructor_notes}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">No scenario assigned to this station</p>
          </div>
        )}

        {/* Group & Team Lead Selection */}
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Select Group & Team Lead
          </h2>

          {/* Rotation Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rotation Number</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setRotationNumber(num)}
                  className={`w-12 h-12 rounded-lg font-medium ${
                    rotationNumber === num 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Lab Group Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lab Group</label>
            {labGroups.length === 0 ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No lab groups found for this cohort. 
                  <Link href="/lab-management/admin/lab-groups" className="underline ml-1">
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
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{group.name}</div>
                    <div className="text-xs text-gray-500">{group.members?.length || 0} students</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Team Lead Selection */}
          {selectedGroup && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                      {member.student.photo_url ? (
                        <img src={member.student.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium text-gray-500">
                          {member.student.first_name[0]}{member.student.last_name[0]}
                        </span>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900 text-sm">
                        {member.student.first_name} {member.student.last_name}
                      </div>
                      {teamLeaderId === member.student.id && (
                        <div className="text-xs text-yellow-600 flex items-center gap-1">
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

        {/* Critical Actions */}
        {scenario?.critical_actions && scenario.critical_actions.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Critical Actions
            </h2>
            <div className="space-y-2">
              {scenario.critical_actions.map((action, index) => (
                <label
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer ${
                    criticalActions[`action-${index}`] ? 'bg-green-50' : 'bg-red-50'
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
                    criticalActions[`action-${index}`] ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {action}
                  </span>
                  {criticalActions[`action-${index}`] ? (
                    <CheckCircle className="w-5 h-5 text-green-500 ml-auto shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 ml-auto shrink-0" />
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 8 Criteria Grading */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Evaluation Criteria
            </h2>
            <div className="text-sm">
              <span className="text-green-600 font-medium">{satisfactoryCount} S</span>
              {needsImprovementCount > 0 && (
                <span className="text-yellow-600 font-medium ml-2">{needsImprovementCount} NI</span>
              )}
              {unsatisfactoryCount > 0 && (
                <span className="text-red-600 font-medium ml-2">{unsatisfactoryCount} U</span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {EVALUATION_CRITERIA.map((criteria, index) => {
              const rating = criteriaRatings.find(r => r.criteria_id === criteria.id);
              const needsNotes = rating?.rating === 'NI' || rating?.rating === 'U';
              
              return (
                <div key={criteria.id} className="border rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 rounded text-sm font-medium shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{criteria.name}</div>
                      <div className="text-xs text-gray-500 mb-2">{criteria.description}</div>
                      
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
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
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
                            className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white ${
                              !rating?.notes?.trim() ? 'border-red-300' : 'border-gray-300'
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
              phase2Pass ? 'bg-green-100 border border-green-300' :
              phase1Pass ? 'bg-yellow-100 border border-yellow-300' :
              'bg-red-100 border border-red-300'
            }`}>
              <div className="flex items-center gap-3">
                {phase2Pass ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : phase1Pass ? (
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
                <div>
                  <div className={`font-medium ${
                    phase2Pass ? 'text-green-800' :
                    phase1Pass ? 'text-yellow-800' :
                    'text-red-800'
                  }`}>
                    {satisfactoryCount}/8 Satisfactory
                  </div>
                  <div className={`text-sm ${
                    phase2Pass ? 'text-green-700' :
                    phase1Pass ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    {phase2Pass ? 'Phase 2 Pass (7/8 required)' :
                     phase1Pass ? 'Phase 1 Pass (6/8 required) - Does not meet Phase 2' :
                     'Does not meet Phase 1 or Phase 2 requirements'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Overall Comments */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Overall Comments</h2>
          <textarea
            value={overallComments}
            onChange={(e) => setOverallComments(e.target.value)}
            placeholder="Additional comments, feedback, or observations..."
            rows={4}
            className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
          />
        </div>

        {/* Debrief Points */}
        {scenario?.debrief_points && scenario.debrief_points.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Debrief Discussion Points</h2>
            <ul className="space-y-2">
              {scenario.debrief_points.map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-500">•</span>
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
            disabled={saving || !allRated || !selectedGroupId || !teamLeaderId}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saving ? 'Saving Assessment...' : 'Save Assessment'}
          </button>
          {(!selectedGroupId || !teamLeaderId || !allRated) && (
            <p className="text-center text-sm text-gray-500 mt-2">
              {!selectedGroupId ? 'Select a lab group' : 
               !teamLeaderId ? 'Select a team leader' :
               'Rate all 8 criteria to save'}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
