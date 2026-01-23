'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronLeft,
  Calendar,
  Plus,
  Edit2,
  ClipboardCheck,
  FileText,
  Users,
  MapPin,
  Clock,
  Check,
  AlertCircle,
  Printer,
  Download,
  X,
  Save,
  Trash2
} from 'lucide-react';

interface LabDay {
  id: string;
  date: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  week_number: number | null;
  day_number: number | null;
  num_rotations: number;
  rotation_duration: number;
  notes: string | null;
  cohort: {
    id: string;
    cohort_number: number;
    program: {
      name: string;
      abbreviation: string;
    };
  };
  stations: Station[];
}

interface Station {
  id: string;
  station_number: number;
  station_type: string;
  scenario?: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
  };
  skill_name: string | null;
  custom_title: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
  room: string | null;
  notes: string | null;
  rotation_minutes: number;
  num_rotations: number;
  // Legacy fields for backwards compatibility
  instructor?: {
    id: string;
    name: string;
  };
  location: string | null;
  documentation_required: boolean;
  platinum_required: boolean;
}

interface Scenario {
  id: string;
  title: string;
  category: string;
  difficulty: string;
}

interface Skill {
  id: string;
  name: string;
  category: string;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  role: string;
}

const STATION_TYPES = [
  { value: 'scenario', label: 'Scenario', description: 'Full scenario with grading' },
  { value: 'skills', label: 'Skills', description: 'Skills practice station' },
  { value: 'documentation', label: 'Documentation', description: 'Documentation/PCR station' }
];

const STATION_TYPE_COLORS: Record<string, string> = {
  scenario: 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30',
  skill: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/30',
  documentation: 'border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30',
  lecture: 'border-yellow-200 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/30',
  testing: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/30',
};

const STATION_TYPE_BADGES: Record<string, string> = {
  scenario: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  skill: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  documentation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  lecture: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  testing: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

export default function LabDayPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const labDayId = params.id as string;
  const justGraded = searchParams.get('graded');

  const [labDay, setLabDay] = useState<LabDay | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit station modal state
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [isCustomInstructor, setIsCustomInstructor] = useState(false);
  const [savingStation, setSavingStation] = useState(false);
  const [deletingStation, setDeletingStation] = useState(false);
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [editForm, setEditForm] = useState({
    station_type: 'scenario' as string,
    scenario_id: '',
    selectedSkills: [] as string[],
    custom_title: '',
    instructor_name: '',
    instructor_email: '',
    room: '',
    notes: ''
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && labDayId) {
      fetchLabDay();
    }
  }, [session, labDayId]);

  const fetchLabDay = async () => {
    setLoading(true);
    try {
      const [labDayRes, instructorsRes] = await Promise.all([
        fetch(`/api/lab-management/lab-days/${labDayId}`),
        fetch('/api/lab-management/instructors')
      ]);

      const labDayData = await labDayRes.json();
      const instructorsData = await instructorsRes.json();

      if (labDayData.success) {
        setLabDay(labDayData.labDay);
      } else {
        console.error('Failed to fetch lab day:', labDayData.error);
      }

      if (instructorsData.success) {
        setInstructors(instructorsData.instructors || []);
      }
    } catch (error) {
      console.error('Error fetching lab day:', error);
    }
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    // Parse date string as local date to avoid timezone issues
    // Adding T12:00:00 ensures the date displays correctly in any timezone
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return null;
    // timeString is in "HH:MM" or "HH:MM:SS" format
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStationTitle = (station: Station) => {
    // Prioritize custom_title as it contains the full descriptive name
    if (station.custom_title) return station.custom_title;
    // Fallback to scenario title or skill name
    if (station.scenario) return station.scenario.title;
    if (station.skill_name) return station.skill_name;
    return `Station ${station.station_number}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('lab-day-printable');

    if (!element) {
      alert('Could not find printable content');
      return;
    }

    // Temporarily show print-only elements and hide screen-only elements
    const printHiddenElements = element.querySelectorAll('.print\\:hidden');
    const printBlockElements = element.querySelectorAll('.print\\:block');

    printHiddenElements.forEach(el => (el as HTMLElement).style.display = 'none');
    printBlockElements.forEach(el => (el as HTMLElement).style.display = 'block');

    const cohortName = `${labDay?.cohort.program.abbreviation}-G${labDay?.cohort.cohort_number}`;
    const dateStr = labDay?.date || new Date().toISOString().split('T')[0];

    const options = {
      margin: 0.5,
      filename: `lab-day-${cohortName}-${dateStr}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in' as const, format: 'letter', orientation: 'portrait' as const }
    };

    try {
      await html2pdf().set(options).from(element).save();
    } finally {
      // Restore visibility
      printHiddenElements.forEach(el => (el as HTMLElement).style.display = '');
      printBlockElements.forEach(el => (el as HTMLElement).style.display = '');
    }
  };

  const fetchScenariosAndSkills = async () => {
    try {
      const [scenariosRes, skillsRes] = await Promise.all([
        fetch('/api/lab-management/scenarios'),
        fetch('/api/lab-management/skills')
      ]);
      const scenariosData = await scenariosRes.json();
      const skillsData = await skillsRes.json();
      if (scenariosData.success) {
        setScenarios(scenariosData.scenarios || []);
      }
      if (skillsData.success) {
        setSkills(skillsData.skills || []);
      }
    } catch (error) {
      console.error('Error fetching scenarios/skills:', error);
    }
  };

  const openEditModal = async (station: Station) => {
    setEditingStation(station);

    // Fetch station skills if it's a skills station
    let stationSkillIds: string[] = [];
    if (station.station_type === 'skills') {
      try {
        const res = await fetch(`/api/lab-management/stations?labDayId=${labDayId}`);
        const data = await res.json();
        if (data.success) {
          const fullStation = data.stations.find((s: any) => s.id === station.id);
          if (fullStation?.station_skills) {
            stationSkillIds = fullStation.station_skills.map((ss: any) => ss.skill?.id).filter(Boolean);
          }
        }
      } catch (error) {
        console.error('Error fetching station skills:', error);
      }
    }

    setEditForm({
      station_type: station.station_type || 'scenario',
      scenario_id: station.scenario?.id || '',
      selectedSkills: stationSkillIds,
      custom_title: station.custom_title || '',
      instructor_name: station.instructor_name || '',
      instructor_email: station.instructor_email || '',
      room: station.room || '',
      notes: station.notes || ''
    });

    // Set selectedInstructor based on existing instructor data
    if (station.instructor_name && station.instructor_email) {
      const matchingInstructor = instructors.find(
        (i) => i.name === station.instructor_name && i.email === station.instructor_email
      );
      if (matchingInstructor) {
        setSelectedInstructor(`${matchingInstructor.name}|${matchingInstructor.email}`);
        setIsCustomInstructor(false);
      } else {
        // Custom instructor not in the list
        setSelectedInstructor('custom');
        setIsCustomInstructor(true);
      }
    } else if (station.instructor_name) {
      // Only has name, no email
      setSelectedInstructor('custom');
      setIsCustomInstructor(true);
    } else {
      setSelectedInstructor('');
      setIsCustomInstructor(false);
    }

    // Fetch scenarios and skills if not already loaded
    if (scenarios.length === 0 || skills.length === 0) {
      fetchScenariosAndSkills();
    }
  };

  const toggleSkill = (skillId: string) => {
    setEditForm(prev => ({
      ...prev,
      selectedSkills: prev.selectedSkills.includes(skillId)
        ? prev.selectedSkills.filter(id => id !== skillId)
        : [...prev.selectedSkills, skillId]
    }));
  };

  const assignSelf = () => {
    setEditForm(prev => ({
      ...prev,
      instructor_name: session?.user?.name || '',
      instructor_email: session?.user?.email || ''
    }));
    setSelectedInstructor(`${session?.user?.name}|${session?.user?.email}`);
    setIsCustomInstructor(false);
  };

  const handleInstructorChange = (value: string) => {
    setSelectedInstructor(value);

    if (value === 'custom') {
      setIsCustomInstructor(true);
      setEditForm(prev => ({
        ...prev,
        instructor_name: '',
        instructor_email: ''
      }));
    } else if (value === '') {
      setIsCustomInstructor(false);
      setEditForm(prev => ({
        ...prev,
        instructor_name: '',
        instructor_email: ''
      }));
    } else {
      setIsCustomInstructor(false);
      const [name, email] = value.split('|');
      setEditForm(prev => ({
        ...prev,
        instructor_name: name,
        instructor_email: email
      }));
    }
  };

  // Group skills by category for the modal
  const filteredSkills = skills.filter(skill =>
    !skillSearch ||
    skill.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
    skill.category.toLowerCase().includes(skillSearch.toLowerCase())
  );

  const skillsByCategory = filteredSkills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  const closeEditModal = () => {
    setEditingStation(null);
  };

  const handleSaveStation = async () => {
    if (!editingStation) return;

    setSavingStation(true);
    try {
      // Update station basic info
      const res = await fetch(`/api/lab-management/stations/${editingStation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_type: editForm.station_type,
          scenario_id: editForm.station_type === 'scenario' ? (editForm.scenario_id || null) : null,
          custom_title: editForm.custom_title || null,
          instructor_name: editForm.instructor_name || null,
          instructor_email: editForm.instructor_email || null,
          room: editForm.room || null,
          notes: editForm.notes || null
        })
      });

      const data = await res.json();
      if (!data.success) {
        alert('Failed to save: ' + (data.error || 'Unknown error'));
        setSavingStation(false);
        return;
      }

      // If skills station, update skill links
      if (editForm.station_type === 'skills') {
        // Delete existing skill links
        await fetch(`/api/lab-management/station-skills?stationId=${editingStation.id}`, {
          method: 'DELETE'
        });

        // Add new skill links
        for (const skillId of editForm.selectedSkills) {
          await fetch('/api/lab-management/station-skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              station_id: editingStation.id,
              skill_id: skillId
            })
          });
        }
      }

      closeEditModal();
      fetchLabDay(); // Refresh the data
    } catch (error) {
      console.error('Error saving station:', error);
      alert('Failed to save station');
    }
    setSavingStation(false);
  };

  const handleDeleteStation = async () => {
    if (!editingStation) return;
    if (!confirm('Are you sure you want to delete this station? This cannot be undone.')) return;

    setDeletingStation(true);
    try {
      const res = await fetch(`/api/lab-management/stations/${editingStation.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        closeEditModal();
        fetchLabDay(); // Refresh the data
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting station:', error);
      alert('Failed to delete station');
    }
    setDeletingStation(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (!labDay) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Lab Day Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">The requested lab day could not be found.</p>
          <Link
            href="/lab-management/schedule"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div id="lab-day-printable" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 print:bg-white">
      {/* Success Toast */}
      {justGraded && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in print:hidden">
          <Check className="w-5 h-5" />
          <span>Assessment saved successfully!</span>
        </div>
      )}

      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block mb-4 p-4 border-b-2 border-gray-800">
        <h1 className="text-2xl font-bold text-center">LAB DAY SCHEDULE</h1>
        <div className="mt-2 flex justify-between text-sm">
          <div>
            <p><strong>Cohort:</strong> {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}</p>
            <p><strong>Date:</strong> {formatDate(labDay.date)}</p>
            {(labDay.start_time || labDay.end_time) && (
              <p><strong>Time:</strong> {formatTime(labDay.start_time)}{labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}</p>
            )}
          </div>
          <div className="text-right">
            {labDay.week_number && labDay.day_number && (
              <p><strong>Week {labDay.week_number}, Day {labDay.day_number}</strong></p>
            )}
            <p>{labDay.num_rotations} rotations × {labDay.rotation_duration} min</p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
                <ChevronRight className="w-4 h-4" />
                <Link href="/lab-management/schedule" className="hover:text-blue-600 dark:hover:text-blue-400">Schedule</Link>
                <ChevronRight className="w-4 h-4" />
                <span>{labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {formatDate(labDay.date)}
              </h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                {(labDay.start_time || labDay.end_time) && (
                  <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                    <Clock className="w-4 h-4" />
                    {formatTime(labDay.start_time)}{labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}
                  </span>
                )}
                {labDay.week_number && labDay.day_number && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Week {labDay.week_number}, Day {labDay.day_number}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  {labDay.num_rotations} rotations × {labDay.rotation_duration} min
                </span>
              </div>
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <Link
                href={`/lab-management/schedule/${labDayId}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Link>
              <Link
                href={`/lab-management/schedule/${labDayId}/stations/new`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Station
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Notes */}
        {labDay.notes && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">Notes</h3>
            <p className="text-yellow-700 dark:text-yellow-400 text-sm">{labDay.notes}</p>
          </div>
        )}

        {/* Stations Grid */}
        {labDay.stations.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Stations Yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Add stations to this lab day to get started.</p>
            <Link
              href={`/lab-management/schedule/${labDayId}/stations/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add First Station
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {labDay.stations.map((station) => (
              <div
                key={station.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 ${STATION_TYPE_COLORS[station.station_type] || 'border-gray-200 dark:border-gray-700'}`}
              >
                <div className="p-4">
                  {/* Station Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          Station {station.station_number}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATION_TYPE_BADGES[station.station_type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {station.station_type}
                        </span>
                        {station.platinum_required && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                            Platinum
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {getStationTitle(station)}
                      </h3>
                      {station.scenario && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{station.scenario.category}</p>
                      )}
                    </div>
                  </div>

                  {/* Station Details */}
                  <div className="space-y-2 text-sm mb-4">
                    {(station.instructor_name || station.instructor?.name) && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>{station.instructor_name || station.instructor?.name}</span>
                      </div>
                    )}
                    {(station.room || station.location) && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>{station.room || station.location}</span>
                      </div>
                    )}
                    {station.documentation_required && (
                      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                        <FileText className="w-4 h-4" />
                        <span>Documentation required</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t dark:border-gray-700 print:hidden">
                    <button
                      onClick={() => openEditModal(station)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    {station.scenario && (
                      <Link
                        href={`/lab-management/scenarios/${station.scenario.id}`}
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <FileText className="w-4 h-4" />
                        Scenario
                      </Link>
                    )}
                    <Link
                      href={`/lab-management/grade/station/${station.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      Grade
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <Link
            href={`/lab-management/students?cohortId=${labDay.cohort.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Users className="w-4 h-4" />
            View Students
          </Link>
          <Link
            href={`/lab-management/reports/team-leads?cohortId=${labDay.cohort.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ClipboardCheck className="w-4 h-4" />
            Team Lead Report
          </Link>
        </div>
      </main>

      {/* Edit Station Modal */}
      {editingStation && !skillsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Station {editingStation.station_number}
              </h2>
              <button
                onClick={closeEditModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Station Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Station Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {STATION_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, station_type: type.value })}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        editForm.station_type === type.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{type.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Station Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Station Name
                </label>
                <input
                  type="text"
                  value={editForm.custom_title}
                  onChange={(e) => setEditForm({ ...editForm, custom_title: e.target.value })}
                  placeholder="e.g., PM14 01/23/26 - Chest Pain Scenario"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Descriptive name shown on dashboard and schedule
                </p>
              </div>

              {/* Scenario Selection (for scenario type) */}
              {editForm.station_type === 'scenario' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Scenario
                  </label>
                  <select
                    value={editForm.scenario_id}
                    onChange={(e) => setEditForm({ ...editForm, scenario_id: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">Select a scenario...</option>
                    {scenarios.map(scenario => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.title} ({scenario.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Skills Selection (for skills type) */}
              {editForm.station_type === 'skills' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Skills
                  </label>
                  <button
                    type="button"
                    onClick={() => setSkillsModalOpen(true)}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <ClipboardCheck className="w-5 h-5 mx-auto mb-1" />
                    {editForm.selectedSkills.length > 0
                      ? `${editForm.selectedSkills.length} skills selected - Click to modify`
                      : 'Click to select skills from library'
                    }
                  </button>
                  {editForm.selectedSkills.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editForm.selectedSkills.map(skillId => {
                        const skill = skills.find(s => s.id === skillId);
                        return skill ? (
                          <span key={skillId} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm rounded">
                            {skill.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Documentation Info */}
              {editForm.station_type === 'documentation' && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-blue-800 dark:text-blue-300 text-sm">
                    Documentation station for PCR practice and review. Instructor assignment is optional.
                  </p>
                </div>
              )}

              {/* Instructor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instructor
                </label>
                <select
                  value={selectedInstructor}
                  onChange={(e) => handleInstructorChange(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select instructor...</option>
                  {instructors.map((instructor) => (
                    <option key={instructor.id} value={`${instructor.name}|${instructor.email}`}>
                      {instructor.name} ({instructor.email})
                    </option>
                  ))}
                  <option value="custom">+ Add custom name...</option>
                </select>

                {isCustomInstructor && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editForm.instructor_name}
                      onChange={(e) => setEditForm({ ...editForm, instructor_name: e.target.value })}
                      placeholder="Name (required for custom)"
                      className="px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                    <input
                      type="email"
                      value={editForm.instructor_email}
                      onChange={(e) => setEditForm({ ...editForm, instructor_email: e.target.value })}
                      placeholder="Email (optional)"
                      className="px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                  </div>
                )}

                {!selectedInstructor && !editForm.instructor_email && (
                  <button
                    type="button"
                    onClick={assignSelf}
                    className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Users className="w-4 h-4" />
                    Assign myself
                  </button>
                )}
              </div>

              {/* Room */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Room / Location
                </label>
                <input
                  type="text"
                  value={editForm.room}
                  onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                  placeholder="e.g., Sim Lab A"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Special instructions, equipment needed, etc."
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between p-4 border-t dark:border-gray-700">
              <button
                onClick={handleDeleteStation}
                disabled={deletingStation}
                className="inline-flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
              >
                {deletingStation ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>

              <div className="flex gap-3">
                <button
                  onClick={closeEditModal}
                  className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStation}
                  disabled={savingStation}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingStation ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skills Selection Modal */}
      {skillsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Select Skills</h3>
              <button
                onClick={() => setSkillsModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b dark:border-gray-700">
              <input
                type="text"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                placeholder="Search skills..."
                className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {editForm.selectedSkills.length} selected
              </p>
            </div>

            {/* Skills List */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{category}</h4>
                  <div className="space-y-1">
                    {categorySkills.map(skill => {
                      const isSelected = editForm.selectedSkills.includes(skill.id);
                      return (
                        <label
                          key={skill.id}
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                            isSelected ? 'bg-green-50 dark:bg-green-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSkill(skill.id)}
                            className="w-4 h-4 text-green-600"
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{skill.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {Object.keys(skillsByCategory).length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No skills found</p>
              )}
            </div>

            {/* Done Button */}
            <div className="p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setSkillsModalOpen(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done ({editForm.selectedSkills.length} skills selected)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
