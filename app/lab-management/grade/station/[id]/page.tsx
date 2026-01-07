'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  ChevronLeft,
  Star,
  Check,
  AlertCircle,
  Send,
  Users,
  Clock
} from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  team_lead_count: number;
}

interface Station {
  id: string;
  station_number: number;
  station_type: string;
  scenario?: {
    id: string;
    title: string;
    category: string;
  };
  skill_name: string | null;
  custom_title: string | null;
  lab_day: {
    id: string;
    date: string;
    num_rotations: number;
    cohort: {
      id: string;
      cohort_number: number;
      program: {
        abbreviation: string;
      };
    };
  };
}

const SCORE_OPTIONS = [
  { value: 0, label: 'Critical Fail', color: 'bg-red-500', shortLabel: '0' },
  { value: 1, label: 'Needs Improvement', color: 'bg-orange-500', shortLabel: '1' },
  { value: 2, label: 'Inconsistent', color: 'bg-yellow-500', shortLabel: '2' },
  { value: 3, label: 'Proficient', color: 'bg-green-400', shortLabel: '3' },
  { value: 4, label: 'Highly Effective', color: 'bg-green-600', shortLabel: '4' },
];

export default function GradeStationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const stationId = params.id as string;

  const [station, setStation] = useState<Station | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Current rotation being graded
  const [currentRotation, setCurrentRotation] = useState(1);
  
  // Assessment form state
  const [selectedTeamLead, setSelectedTeamLead] = useState<string | null>(null);
  const [assessmentScore, setAssessmentScore] = useState<number | null>(null);
  const [treatmentScore, setTreatmentScore] = useState<number | null>(null);
  const [communicationScore, setCommunicationScore] = useState<number | null>(null);
  const [teamLeadIssues, setTeamLeadIssues] = useState('');
  const [comments, setComments] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && stationId) {
      fetchStationData();
    }
  }, [session, stationId]);

  const fetchStationData = async () => {
    setLoading(true);
    try {
      // Fetch station details
      const stationRes = await fetch(`/api/lab-management/stations/${stationId}`);
      const stationData = await stationRes.json();
      
      if (stationData.success) {
        setStation(stationData.station);
        
        // Fetch students with team lead counts
        const studentsRes = await fetch(
          `/api/lab-management/team-leads?cohortId=${stationData.station.lab_day.cohort.id}`
        );
        const studentsData = await studentsRes.json();
        
        if (studentsData.success) {
          setStudents(studentsData.students);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!station || assessmentScore === null) return;
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/lab-management/assessments/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_station_id: station.id,
          lab_day_id: station.lab_day.id,
          cohort_id: station.lab_day.cohort.id,
          rotation_number: currentRotation,
          assessment_score: assessmentScore,
          treatment_score: treatmentScore,
          communication_score: communicationScore,
          team_lead_id: selectedTeamLead,
          team_lead_issues: teamLeadIssues || null,
          comments: comments || null,
          // graded_by would come from session
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Move to next rotation or show completion
        if (currentRotation < (station.lab_day.num_rotations || 4)) {
          setCurrentRotation(prev => prev + 1);
          resetForm();
        } else {
          router.push(`/lab-management/schedule/${station.lab_day.id}?graded=${station.id}`);
        }
      } else {
        alert('Failed to save assessment: ' + data.error);
      }
    } catch (error) {
      console.error('Error submitting:', error);
      alert('Failed to save assessment');
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setSelectedTeamLead(null);
    setAssessmentScore(null);
    setTreatmentScore(null);
    setCommunicationScore(null);
    setTeamLeadIssues('');
    setComments('');
  };

  const canSubmit = assessmentScore !== null;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !station) return null;

  const numRotations = station.lab_day.num_rotations || 4;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Link 
              href={`/lab-management/schedule/${station.lab_day.id}`}
              className="flex items-center gap-1 text-gray-600"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Back</span>
            </Link>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Station {station.station_number}</div>
              <div className="text-xs text-gray-500">
                {station.lab_day.cohort.program.abbreviation} Group {station.lab_day.cohort.cohort_number}
              </div>
            </div>
            <div className="w-16" /> {/* Spacer for centering */}
          </div>
        </div>
        
        {/* Rotation indicators */}
        <div className="flex border-t">
          {Array.from({ length: numRotations }, (_, i) => i + 1).map((rotation) => (
            <button
              key={rotation}
              onClick={() => setCurrentRotation(rotation)}
              className={`flex-1 py-2 text-center text-sm font-medium border-b-2 transition-colors ${
                rotation === currentRotation
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : rotation < currentRotation
                  ? 'border-green-500 text-green-600 bg-green-50'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {rotation < currentRotation ? (
                <Check className="w-4 h-4 mx-auto" />
              ) : (
                `R${rotation}`
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Scenario Info */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="font-semibold text-gray-900 mb-1">
            {station.scenario?.title || station.skill_name || station.custom_title || `Station ${station.station_number}`}
          </h2>
          {station.scenario && (
            <p className="text-sm text-gray-600">{station.scenario.category}</p>
          )}
        </div>

        {/* Rotation Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Rotation {currentRotation} of {numRotations}
          </h3>
          <div className="flex items-center gap-1 text-gray-500 text-sm">
            <Clock className="w-4 h-4" />
            <span>{station.lab_day.date}</span>
          </div>
        </div>

        {/* Team Lead Selection */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Select Team Lead</h4>
            {selectedTeamLead && (
              <button
                onClick={() => setSelectedTeamLead(null)}
                className="text-sm text-blue-600"
              >
                Clear
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {students.map((student) => {
              const isSelected = selectedTeamLead === student.id;
              const needsMoreTL = student.team_lead_count < (students.reduce((sum, s) => sum + s.team_lead_count, 0) / students.length);
              
              return (
                <button
                  key={student.id}
                  onClick={() => setSelectedTeamLead(isSelected ? null : student.id)}
                  className={`relative p-1 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <div className="relative">
                    {student.photo_url ? (
                      <img
                        src={student.photo_url}
                        alt={`${student.first_name}`}
                        className="w-14 h-14 rounded-lg object-cover mx-auto"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center mx-auto">
                        <span className="text-lg font-bold text-gray-400">
                          {student.first_name[0]}{student.last_name[0]}
                        </span>
                      </div>
                    )}
                    
                    {/* TL count badge */}
                    <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                      needsMoreTL
                        ? 'bg-orange-400 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {student.team_lead_count}
                    </div>
                    
                    {/* Selection checkmark */}
                    {isSelected && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-center mt-1 text-gray-700 truncate">
                    {student.first_name}
                  </div>
                </button>
              );
            })}
          </div>
          
          {students.length > 0 && (
            <p className="text-xs text-gray-500 mt-3">
              <span className="inline-block w-3 h-3 bg-orange-400 rounded-full mr-1"></span>
              Orange badge = needs more TL opportunities
            </p>
          )}
        </div>

        {/* Scoring Section */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h4 className="font-medium text-gray-900 mb-4">Assessment Scores</h4>
          
          {/* Assessment Score */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assessment <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {SCORE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAssessmentScore(option.value)}
                  className={`flex-1 py-3 rounded-lg text-white font-bold text-lg transition-all ${
                    assessmentScore === option.value
                      ? `${option.color} ring-2 ring-offset-2 ring-gray-400`
                      : 'bg-gray-300'
                  }`}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
            {assessmentScore !== null && (
              <p className="text-sm text-gray-600 mt-1 text-center">
                {SCORE_OPTIONS.find(o => o.value === assessmentScore)?.label}
              </p>
            )}
          </div>

          {/* Treatment Score */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Treatment
            </label>
            <div className="flex gap-2">
              {SCORE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTreatmentScore(option.value)}
                  className={`flex-1 py-3 rounded-lg text-white font-bold text-lg transition-all ${
                    treatmentScore === option.value
                      ? `${option.color} ring-2 ring-offset-2 ring-gray-400`
                      : 'bg-gray-300'
                  }`}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Communication Score */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Communication
            </label>
            <div className="flex gap-2">
              {SCORE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setCommunicationScore(option.value)}
                  className={`flex-1 py-3 rounded-lg text-white font-bold text-lg transition-all ${
                    communicationScore === option.value
                      ? `${option.color} ring-2 ring-offset-2 ring-gray-400`
                      : 'bg-gray-300'
                  }`}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h4 className="font-medium text-gray-900 mb-3">Comments</h4>
          
          {selectedTeamLead && (
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team Lead Issues (if any)
              </label>
              <input
                type="text"
                value={teamLeadIssues}
                onChange={(e) => setTeamLeadIssues(e.target.value)}
                placeholder="e.g., struggled with delegation"
                className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
              />
            </div>
          )}
          
          <label className="block text-sm font-medium text-gray-700 mb-1">
            General Comments
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Additional observations..."
            rows={3}
            className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white resize-none"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={`w-full py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
            canSubmit && !submitting
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Saving...
            </>
          ) : currentRotation < numRotations ? (
            <>
              <Send className="w-5 h-5" />
              Submit & Next Rotation
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Submit & Finish
            </>
          )}
        </button>

        {!canSubmit && (
          <p className="text-center text-sm text-orange-600 mt-2 flex items-center justify-center gap-1">
            <AlertCircle className="w-4 h-4" />
            Assessment score is required
          </p>
        )}
      </div>
    </div>
  );
}
