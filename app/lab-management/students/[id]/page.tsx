'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  Edit2,
  Camera,
  Star,
  Calendar,
  ClipboardCheck,
  AlertCircle,
  Mail,
  Building,
  User,
  Trash2,
  Upload
} from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  photo_url: string | null;
  status: string;
  agency: string | null;
  notes: string | null;
  created_at: string;
  team_lead_count: number;
  last_team_lead_date: string | null;
  cohort?: {
    id: string;
    cohort_number: number;
    program: {
      name: string;
      abbreviation: string;
    };
  };
}

interface TeamLeadEntry {
  id: string;
  date: string;
  lab_day: { date: string; week_number: number; day_number: number };
  lab_station: { station_number: number; station_type: string };
  scenario: { title: string; category: string } | null;
}

interface Assessment {
  id: string;
  assessed_at: string;
  assessment_score?: number;
  treatment_score?: number;
  communication_score?: number;
  skill_name?: string;
  overall_competency?: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  graduated: 'bg-blue-100 text-blue-800',
  withdrawn: 'bg-red-100 text-red-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
};

const SCORE_COLORS: Record<number, string> = {
  0: 'bg-red-500',
  1: 'bg-orange-500',
  2: 'bg-yellow-500',
  3: 'bg-green-400',
  4: 'bg-green-600',
};

export default function StudentDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [student, setStudent] = useState<Student | null>(null);
  const [teamLeadHistory, setTeamLeadHistory] = useState<TeamLeadEntry[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAgency, setEditAgency] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && studentId) {
      fetchStudent();
      fetchTeamLeadHistory();
      fetchAssessments();
    }
  }, [session, studentId]);

  const fetchStudent = async () => {
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}`);
      const data = await res.json();
      if (data.success) {
        setStudent(data.student);
        // Populate edit form
        setEditFirstName(data.student.first_name);
        setEditLastName(data.student.last_name);
        setEditEmail(data.student.email || '');
        setEditAgency(data.student.agency || '');
        setEditStatus(data.student.status);
        setEditNotes(data.student.notes || '');
      }
    } catch (error) {
      console.error('Error fetching student:', error);
    }
    setLoading(false);
  };

  const fetchTeamLeadHistory = async () => {
    try {
      const res = await fetch(`/api/lab-management/team-leads?studentId=${studentId}`);
      const data = await res.json();
      if (data.success) {
        setTeamLeadHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching TL history:', error);
    }
  };

  const fetchAssessments = async () => {
    try {
      // Fetch scenario assessments where student was team lead
      const scenarioRes = await fetch(`/api/lab-management/assessments/scenario?studentId=${studentId}`);
      const scenarioData = await scenarioRes.json();
      
      // Fetch skill assessments for this student
      const skillRes = await fetch(`/api/lab-management/assessments/skill?studentId=${studentId}`);
      const skillData = await skillRes.json();
      
      const allAssessments = [
        ...(scenarioData.success ? scenarioData.assessments : []),
        ...(skillData.success ? skillData.assessments : []),
      ].sort((a, b) => new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime());
      
      setAssessments(allAssessments.slice(0, 10)); // Last 10
    } catch (error) {
      console.error('Error fetching assessments:', error);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For now, create a local URL - in production you'd upload to Supabase Storage
    setUploading(true);
    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('studentId', studentId);

      // TODO: Implement actual Supabase Storage upload
      // For demo, we'll use a data URL
      const reader = new FileReader();
      reader.onloadend = async () => {
        const photoUrl = reader.result as string;
        
        // Update student with photo URL
        const res = await fetch(`/api/lab-management/students/${studentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo_url: photoUrl }),
        });
        
        const data = await res.json();
        if (data.success) {
          setStudent(prev => prev ? { ...prev, photo_url: photoUrl } : null);
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: editFirstName,
          last_name: editLastName,
          email: editEmail || null,
          agency: editAgency || null,
          status: editStatus,
          notes: editNotes || null,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setStudent(data.student);
        setEditing(false);
      } else {
        alert('Failed to save: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${student?.first_name} ${student?.last_name}? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/lab-management/students/${studentId}`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      if (data.success) {
        router.push('/lab-management/students');
      } else {
        alert('Failed to delete: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Student Not Found</h2>
          <Link href="/lab-management/students" className="text-blue-600 hover:underline">Back to Students</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/students" className="hover:text-blue-600">Students</Link>
            <ChevronRight className="w-4 h-4" />
            <span>{student.first_name} {student.last_name}</span>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Photo */}
            <div className="flex flex-col items-center">
              <div 
                onClick={handlePhotoClick}
                className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-200 cursor-pointer group"
              >
                {student.photo_url ? (
                  <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-4xl font-bold text-gray-400">
                      {student.first_name[0]}{student.last_name[0]}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  ) : (
                    <Camera className="w-8 h-8 text-white" />
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                onClick={handlePhotoClick}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Upload className="w-4 h-4" />
                {student.photo_url ? 'Change Photo' : 'Add Photo'}
              </button>
            </div>

            {/* Info */}
            <div className="flex-1">
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input type="text" value={editLastName} onChange={e => setEditLastName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Agency</label>
                      <input type="text" value={editAgency} onChange={e => setEditAgency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white">
                        <option value="active">Active</option>
                        <option value="graduated">Graduated</option>
                        <option value="withdrawn">Withdrawn</option>
                        <option value="on_hold">On Hold</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">{student.first_name} {student.last_name}</h1>
                      {student.cohort && (
                        <p className="text-gray-600">{student.cohort.program.abbreviation} Group {student.cohort.cohort_number}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button onClick={handleDelete} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[student.status]}`}>
                        {student.status.charAt(0).toUpperCase() + student.status.slice(1).replace('_', ' ')}
                      </span>
                    </div>
                    {student.email && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${student.email}`} className="hover:text-blue-600">{student.email}</a>
                      </div>
                    )}
                    {student.agency && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Building className="w-4 h-4" />
                        <span>{student.agency}</span>
                      </div>
                    )}
                  </div>

                  {student.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                      <strong>Notes:</strong> {student.notes}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-yellow-600 mb-1">
              <Star className="w-5 h-5" />
              <span className="text-sm font-medium">Team Lead</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{student.team_lead_count}</div>
            <div className="text-xs text-gray-500">assignments</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-medium">Last TL</span>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {student.last_team_lead_date 
                ? new Date(student.last_team_lead_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '—'}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <ClipboardCheck className="w-5 h-5" />
              <span className="text-sm font-medium">Assessments</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{assessments.length}</div>
            <div className="text-xs text-gray-500">recorded</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <User className="w-5 h-5" />
              <span className="text-sm font-medium">Joined</span>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {new Date(student.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Team Lead History */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Team Lead History</h2>
          </div>
          {teamLeadHistory.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Star className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No team lead assignments yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {teamLeadHistory.map((entry) => (
                <div key={entry.id} className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Star className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {entry.scenario?.title || `Station ${entry.lab_station.station_number}`}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {entry.lab_day.week_number && ` • Week ${entry.lab_day.week_number}, Day ${entry.lab_day.day_number}`}
                    </div>
                  </div>
                  {entry.scenario?.category && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {entry.scenario.category}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Assessments */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Recent Assessments</h2>
          </div>
          {assessments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No assessments recorded yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {assessments.map((assessment) => (
                <div key={assessment.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600">
                      {new Date(assessment.assessed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    {assessment.skill_name && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Skill</span>
                    )}
                  </div>
                  {assessment.skill_name ? (
                    <div>
                      <div className="font-medium text-gray-900">{assessment.skill_name}</div>
                      {assessment.overall_competency && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm text-gray-600">Overall:</span>
                          <span className="font-bold">{assessment.overall_competency}/5</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      {assessment.assessment_score !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Assessment:</span>
                          <span className={`w-6 h-6 rounded text-white text-sm font-bold flex items-center justify-center ${SCORE_COLORS[assessment.assessment_score]}`}>
                            {assessment.assessment_score}
                          </span>
                        </div>
                      )}
                      {assessment.treatment_score !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Treatment:</span>
                          <span className={`w-6 h-6 rounded text-white text-sm font-bold flex items-center justify-center ${SCORE_COLORS[assessment.treatment_score]}`}>
                            {assessment.treatment_score}
                          </span>
                        </div>
                      )}
                      {assessment.communication_score !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Comm:</span>
                          <span className={`w-6 h-6 rounded text-white text-sm font-bold flex items-center justify-center ${SCORE_COLORS[assessment.communication_score]}`}>
                            {assessment.communication_score}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
