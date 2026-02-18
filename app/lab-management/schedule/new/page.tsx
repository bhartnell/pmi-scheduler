'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Plus,
  Trash2,
  Save,
  Calendar,
  Clock,
  BookOpen,
  AlertCircle,
  User,
  Home,
  Stethoscope,
  FileText,
  ClipboardCheck,
  Search,
  X,
  Users
} from 'lucide-react';

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface Scenario {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  difficulty: string;
  applicable_programs: string[];
  chief_complaint: string | null;
  patient_name: string | null;
  patient_age: string | null;
  estimated_duration: number | null;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  certification_levels: string[];
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface LabUser {
  id: string;
  name: string;
  email: string;
}

interface Station {
  id: string;
  station_number: number;
  station_type: 'scenario' | 'skills' | 'documentation';
  scenario_id: string;
  selected_skills: string[];  // For skills stations
  custom_skills: string[];  // For freetext custom skills
  instructor_name: string;
  instructor_email: string;
  room: string;
  notes: string;
  rotation_minutes: number;
  num_rotations: number;
}

const STATION_TYPES = [
  { value: 'scenario', label: 'Scenario', icon: Stethoscope, color: 'bg-purple-500', description: 'Full scenario with grading' },
  { value: 'skills', label: 'Skills', icon: ClipboardCheck, color: 'bg-green-500', description: 'Skills practice station' },
  { value: 'documentation', label: 'Documentation', icon: FileText, color: 'bg-blue-500', description: 'Documentation/PCR station' }
];

export default function NewLabDayPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [users, setUsers] = useState<LabUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Lab Day Roles state
  const [labLeads, setLabLeads] = useState<string[]>([]);
  const [roamers, setRoamers] = useState<string[]>([]);
  const [observers, setObservers] = useState<string[]>([]);

  // Form state
  const [selectedCohort, setSelectedCohort] = useState('');
  const [labDate, setLabDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [labTitle, setLabTitle] = useState('');
  const [labNotes, setLabNotes] = useState('');
  const [semester, setSemester] = useState('');
  const [weekNumber, setWeekNumber] = useState('');
  const [dayNumber, setDayNumber] = useState('');
  const [stations, setStations] = useState<Station[]>([
    createEmptyStation(1)
  ]);

  // Custom duration input display state (for station rotation minutes)
  const [durationInputValues, setDurationInputValues] = useState<Record<string, string>>({});

  // Skills search
  const [skillSearch, setSkillSearch] = useState('');
  const [skillsModalStation, setSkillsModalStation] = useState<number | null>(null);

  // Scenario modal
  const [scenarioModalStation, setScenarioModalStation] = useState<number | null>(null);
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [scenarioFilterCategory, setScenarioFilterCategory] = useState('');
  const [scenarioFilterDifficulty, setScenarioFilterDifficulty] = useState('');
  const [scenarioFilterProgram, setScenarioFilterProgram] = useState('');

  function createEmptyStation(stationNumber: number): Station {
    return {
      id: `temp-${Date.now()}-${stationNumber}`,
      station_number: stationNumber,
      station_type: 'scenario',
      scenario_id: '',
      selected_skills: [],
      custom_skills: [],
      instructor_name: '',
      instructor_email: '',
      room: '',
      notes: '',
      rotation_minutes: 30,
      num_rotations: 4
    };
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      // Fetch cohorts
      const cohortsRes = await fetch('/api/lab-management/cohorts');
      const cohortsData = await cohortsRes.json();
      if (cohortsData.success) {
        setCohorts(cohortsData.cohorts || []);
      }

      // Fetch scenarios
      const scenariosRes = await fetch('/api/lab-management/scenarios');
      const scenariosData = await scenariosRes.json();
      if (scenariosData.success) {
        setScenarios(scenariosData.scenarios || []);
      }

      // Fetch skills
      const skillsRes = await fetch('/api/lab-management/skills');
      const skillsData = await skillsRes.json();
      if (skillsData.success) {
        setSkills(skillsData.skills || []);
      }

      // Fetch instructors
      const instructorsRes = await fetch('/api/lab-management/instructors');
      const instructorsData = await instructorsRes.json();
      if (instructorsData.success) {
        setInstructors(instructorsData.instructors || []);
      }

      // Fetch users for roles dropdown
      const usersRes = await fetch('/api/users/list');
      const usersData = await usersRes.json();
      if (usersData.success) {
        setUsers(usersData.users || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleInstructorChange = (index: number, value: string) => {
    if (value === 'custom') {
      // Clear the fields for custom entry
      updateStation(index, { instructor_name: '', instructor_email: '' });
    } else if (value === '') {
      // Clear instructor
      updateStation(index, { instructor_name: '', instructor_email: '' });
    } else {
      // Parse the "name|email" format
      const [name, email] = value.split('|');
      updateStation(index, { instructor_name: name, instructor_email: email });
    }
  };

  const getSelectedInstructorValue = (station: Station) => {
    if (!station.instructor_email) return '';
    // Check if it matches an instructor in the list
    const match = instructors.find(i => i.email === station.instructor_email);
    if (match) {
      return `${match.name}|${match.email}`;
    }
    // Custom entry
    return 'custom';
  };

  const addStation = () => {
    const nextNumber = stations.length + 1;
    setStations([...stations, createEmptyStation(nextNumber)]);
  };

  const removeStation = (index: number) => {
    if (stations.length <= 1) return;
    const updated = stations.filter((_, i) => i !== index);
    updated.forEach((s, i) => s.station_number = i + 1);
    setStations(updated);
  };

  const updateStation = (index: number, updates: Partial<Station>) => {
    const updated = [...stations];
    updated[index] = { ...updated[index], ...updates };
    setStations(updated);
  };

  const assignSelfToStation = (index: number) => {
    updateStation(index, {
      instructor_name: session?.user?.name || '',
      instructor_email: session?.user?.email || ''
    });
  };

  const toggleSkill = (stationIndex: number, skillId: string) => {
    const station = stations[stationIndex];
    const currentSkills = station.selected_skills;
    if (currentSkills.includes(skillId)) {
      updateStation(stationIndex, { 
        selected_skills: currentSkills.filter(id => id !== skillId) 
      });
    } else {
      updateStation(stationIndex, { 
        selected_skills: [...currentSkills, skillId] 
      });
    }
  };

  const handleSave = async () => {
    if (!selectedCohort) {
      alert('Please select a cohort');
      return;
    }
    if (!labDate) {
      alert('Please select a date');
      return;
    }

    setSaving(true);
    try {
      // Create lab day
      const labDayRes = await fetch('/api/lab-management/lab-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: selectedCohort,
          date: labDate,
          start_time: startTime || null,
          end_time: endTime || null,
          title: labTitle || null,
          notes: labNotes || null,
          semester: semester ? parseInt(semester) : null,
          week_number: weekNumber ? parseInt(weekNumber) : null,
          day_number: dayNumber ? parseInt(dayNumber) : null
        })
      });

      const labDayData = await labDayRes.json();
      if (!labDayData.success) {
        throw new Error(labDayData.error || 'Failed to create lab day');
      }

      const labDayId = labDayData.labDay.id;

      // Save lab day roles
      const allRoles = [
        ...labLeads.map(id => ({ instructor_id: id, role: 'lab_lead' as const })),
        ...roamers.map(id => ({ instructor_id: id, role: 'roamer' as const })),
        ...observers.map(id => ({ instructor_id: id, role: 'observer' as const }))
      ];

      for (const role of allRoles) {
        await fetch('/api/lab-management/lab-day-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lab_day_id: labDayId,
            instructor_id: role.instructor_id,
            role: role.role
          })
        });
      }

      // Create stations
      for (const station of stations) {
        const stationRes = await fetch('/api/lab-management/stations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lab_day_id: labDayId,
            station_number: station.station_number,
            station_type: station.station_type,
            scenario_id: station.station_type === 'scenario' ? station.scenario_id || null : null,
            instructor_name: station.instructor_name || null,
            instructor_email: station.instructor_email || null,
            room: station.room || null,
            notes: station.notes || null,
            rotation_minutes: station.rotation_minutes,
            num_rotations: station.num_rotations
          })
        });

        const stationData = await stationRes.json();
        
        // If skills station, add the skill links
        if (station.station_type === 'skills' && stationData.success) {
          // Add library skills
          for (const skillId of station.selected_skills) {
            await fetch('/api/lab-management/station-skills', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                station_id: stationData.station.id,
                skill_id: skillId
              })
            });
          }
          
          // Add custom skills
          for (const customSkill of station.custom_skills) {
            if (customSkill.trim()) {
              await fetch('/api/lab-management/custom-skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  station_id: stationData.station.id,
                  name: customSkill.trim()
                })
              });
            }
          }
        }
      }

      router.push(`/lab-management/schedule/${labDayId}`);
    } catch (error) {
      console.error('Error saving lab day:', error);
      alert('Failed to save lab day');
    }
    setSaving(false);
  };

  // Get cohort's program level for filtering skills
  const selectedCohortData = cohorts.find(c => c.id === selectedCohort);
  const programLevel = selectedCohortData?.program?.abbreviation || '';

  // Filter skills by search and program level
  const filteredSkills = skills.filter(skill => {
    const matchesSearch = !skillSearch || 
      skill.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
      skill.category.toLowerCase().includes(skillSearch.toLowerCase());
    const matchesLevel = !programLevel || 
      skill.certification_levels.includes(programLevel) ||
      skill.certification_levels.includes('EMT'); // EMT skills available to all
    return matchesSearch && matchesLevel;
  });

  // Group skills by category
  const skillsByCategory = filteredSkills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  // Scenario filtering
  const scenarioCategories = [...new Set(scenarios.map(s => s.category).filter(Boolean))].sort();
  const scenarioDifficulties = ['basic', 'intermediate', 'advanced'];
  const scenarioPrograms = ['EMT', 'AEMT', 'Paramedic'];

  const filteredScenarios = scenarios.filter(scenario => {
    const searchLower = scenarioSearch.toLowerCase();
    const matchesSearch = !scenarioSearch ||
      scenario.title.toLowerCase().includes(searchLower) ||
      (scenario.chief_complaint && scenario.chief_complaint.toLowerCase().includes(searchLower)) ||
      (scenario.category && scenario.category.toLowerCase().includes(searchLower)) ||
      (scenario.patient_name && scenario.patient_name.toLowerCase().includes(searchLower));
    const matchesCategory = !scenarioFilterCategory || scenario.category === scenarioFilterCategory;
    const matchesDifficulty = !scenarioFilterDifficulty || scenario.difficulty === scenarioFilterDifficulty;
    const matchesProgram = !scenarioFilterProgram ||
      (scenario.applicable_programs && scenario.applicable_programs.includes(scenarioFilterProgram));
    return matchesSearch && matchesCategory && matchesDifficulty && matchesProgram;
  });

  const scenariosByCategory = filteredScenarios.reduce((acc, scenario) => {
    const cat = scenario.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(scenario);
    return acc;
  }, {} as Record<string, Scenario[]>);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const openStationsCount = stations.filter(s => !s.instructor_email).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/schedule" className="hover:text-blue-600 dark:hover:text-blue-400">Schedule</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">New Lab Day</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Schedule New Lab Day</h1>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? 'Saving...' : 'Save Lab Day'}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Lab Day Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cohort <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              >
                <option value="">Select cohort...</option>
                {cohorts.map(cohort => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.program.abbreviation} Group {cohort.cohort_number}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={labDate}
                onChange={(e) => setLabDate(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title (optional)
              </label>
              <input
                type="text"
                value={labTitle}
                onChange={(e) => setLabTitle(e.target.value)}
                placeholder="e.g., Cardiac Day, Trauma Scenarios"
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (optional)
              </label>
              <input
                type="text"
                value={labNotes}
                onChange={(e) => setLabNotes(e.target.value)}
                placeholder="Any special instructions..."
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Semester
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              >
                <option value="">Select semester...</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Week #
              </label>
              <input
                type="number"
                min="1"
                max="52"
                value={weekNumber}
                onChange={(e) => setWeekNumber(e.target.value)}
                placeholder="e.g., 12"
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Day #
              </label>
              <input
                type="number"
                min="1"
                max="7"
                value={dayNumber}
                onChange={(e) => setDayNumber(e.target.value)}
                placeholder="e.g., 1"
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>
          </div>
        </div>

        {/* Lab Day Roles */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Lab Day Roles
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Assign instructors to roles for this lab day. These are day-wide assignments (not station rotations).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Lab Lead */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Lab Lead(s)
                <span className="ml-2 text-xs text-gray-500 font-normal block">Oversees the lab day</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
                {labLeads.map(id => {
                  const user = users.find(u => u.id === id);
                  return user ? (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm"
                    >
                      {user.name}
                      <button
                        type="button"
                        onClick={() => setLabLeads(labLeads.filter(l => l !== id))}
                        className="ml-1 hover:text-amber-600 dark:hover:text-amber-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && !labLeads.includes(e.target.value)) {
                    setLabLeads([...labLeads, e.target.value]);
                  }
                }}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
              >
                <option value="">Add a lab lead...</option>
                {users
                  .filter(u => !labLeads.includes(u.id))
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
              </select>
            </div>

            {/* Roamer */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Roamer(s)
                <span className="ml-2 text-xs text-gray-500 font-normal block">Floats between stations</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
                {roamers.map(id => {
                  const user = users.find(u => u.id === id);
                  return user ? (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm"
                    >
                      {user.name}
                      <button
                        type="button"
                        onClick={() => setRoamers(roamers.filter(r => r !== id))}
                        className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && !roamers.includes(e.target.value)) {
                    setRoamers([...roamers, e.target.value]);
                  }
                }}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
              >
                <option value="">Add a roamer...</option>
                {users
                  .filter(u => !roamers.includes(u.id))
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
              </select>
            </div>

            {/* Observer */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Observer(s)
                <span className="ml-2 text-xs text-gray-500 font-normal block">For training/shadowing</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
                {observers.map(id => {
                  const user = users.find(u => u.id === id);
                  return user ? (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-sm"
                    >
                      {user.name}
                      <button
                        type="button"
                        onClick={() => setObservers(observers.filter(o => o !== id))}
                        className="ml-1 hover:text-purple-600 dark:hover:text-purple-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && !observers.includes(e.target.value)) {
                    setObservers([...observers, e.target.value]);
                  }
                }}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
              >
                <option value="">Add an observer...</option>
                {users
                  .filter(u => !observers.includes(u.id))
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Stations ({stations.length})
              </h2>
              {openStationsCount > 0 && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  {openStationsCount} station{openStationsCount > 1 ? 's' : ''} need{openStationsCount === 1 ? 's' : ''} instructor
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={addStation}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50"
            >
              <Plus className="w-4 h-4" /> Add Station
            </button>
          </div>

          <div className="p-4 space-y-6">
            {stations.map((station, index) => {
              const stationType = STATION_TYPES.find(t => t.value === station.station_type);
              const TypeIcon = stationType?.icon || Stethoscope;
              
              return (
                <div key={station.id} className="border dark:border-gray-700 rounded-lg">
                  {/* Station Header with Type Selection */}
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-between rounded-t-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${stationType?.color || 'bg-gray-500'}`}>
                        <TypeIcon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Station {station.station_number}</h3>
                        <div className="flex gap-1 mt-1">
                          {STATION_TYPES.map(type => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => updateStation(index, {
                                station_type: type.value as any,
                                scenario_id: '',
                                selected_skills: [],
                                custom_skills: []
                              })}
                              className={`px-2 py-0.5 text-xs rounded ${
                                station.station_type === type.value
                                  ? `${type.color} text-white`
                                  : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                              }`}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {stations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStation(index)}
                        className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Scenario Selection (only for scenario type) */}
                    {station.station_type === 'scenario' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Scenario
                        </label>
                        <button
                          type="button"
                          onClick={() => setScenarioModalStation(index)}
                          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          {station.scenario_id ? (
                            (() => {
                              const selectedScenario = scenarios.find(s => s.id === station.scenario_id);
                              return selectedScenario ? (
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">{selectedScenario.title}</div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs">
                                      {selectedScenario.category}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      selectedScenario.difficulty === 'basic' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                      selectedScenario.difficulty === 'intermediate' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                    }`}>
                                      {selectedScenario.difficulty}
                                    </span>
                                    {selectedScenario.chief_complaint && (
                                      <span className="text-gray-400 dark:text-gray-500">• {selectedScenario.chief_complaint}</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">Scenario not found</span>
                              );
                            })()
                          ) : (
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                              <Search className="w-4 h-4" />
                              <span>Search and select a scenario... ({scenarios.length} available)</span>
                            </div>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Skills Selection (only for skills type) */}
                    {station.station_type === 'skills' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Skills from Library ({station.selected_skills.length} selected)
                          </label>
                          <button
                            type="button"
                            onClick={() => setSkillsModalStation(index)}
                            className="w-full px-3 py-2 border border-dashed dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                          >
                            {station.selected_skills.length === 0 ? (
                              <span className="flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Select skills from library...
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {station.selected_skills.map(skillId => {
                                  const skill = skills.find(s => s.id === skillId);
                                  return skill ? (
                                    <span key={skillId} className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">
                                      {skill.name}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </button>
                        </div>

                        {/* Custom/Other Skills */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Custom Skills (freetext)
                          </label>
                          <div className="space-y-2">
                            {station.custom_skills.map((customSkill, skillIndex) => (
                              <div key={skillIndex} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={customSkill}
                                  onChange={(e) => {
                                    const newCustomSkills = [...station.custom_skills];
                                    newCustomSkills[skillIndex] = e.target.value;
                                    updateStation(index, { custom_skills: newCustomSkills });
                                  }}
                                  className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                                  placeholder="Enter custom skill..."
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newCustomSkills = station.custom_skills.filter((_, i) => i !== skillIndex);
                                    updateStation(index, { custom_skills: newCustomSkills });
                                  }}
                                  className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                updateStation(index, { custom_skills: [...station.custom_skills, ''] });
                              }}
                              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                              <Plus className="w-4 h-4" /> Add custom skill
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Documentation Station Notes */}
                    {station.station_type === 'documentation' && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          Documentation station for PCR practice and review. Instructor assignment is optional.
                        </p>
                      </div>
                    )}

                    {/* Instructor Section */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                          <User className="w-4 h-4" />
                          Instructor
                        </label>
                        {!station.instructor_email && (
                          <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
                            Open - Needs Instructor
                          </span>
                        )}
                      </div>

                      {/* Instructor Dropdown */}
                      <div className="mb-3">
                        <select
                          value={getSelectedInstructorValue(station)}
                          onChange={(e) => handleInstructorChange(index, e.target.value)}
                          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                        >
                          <option value="">Select instructor (optional)...</option>
                          {instructors.map((instructor) => (
                            <option key={instructor.id} value={`${instructor.name}|${instructor.email}`}>
                              {instructor.name} ({instructor.role})
                            </option>
                          ))}
                          <option value="custom">+ Enter custom name...</option>
                        </select>
                      </div>

                      {/* Custom fields shown when "custom" is selected or when there's a non-matching entry */}
                      {(getSelectedInstructorValue(station) === 'custom' ||
                        (station.instructor_email && !instructors.find(i => i.email === station.instructor_email))) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
                            <input
                              type="text"
                              value={station.instructor_name}
                              onChange={(e) => updateStation(index, { instructor_name: e.target.value })}
                              placeholder="Enter name"
                              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Email</label>
                            <input
                              type="email"
                              value={station.instructor_email}
                              onChange={(e) => updateStation(index, { instructor_email: e.target.value })}
                              placeholder="Enter email"
                              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {!station.instructor_email && (
                        <button
                          type="button"
                          onClick={() => assignSelfToStation(index)}
                          className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                        >
                          <User className="w-4 h-4" />
                          Assign myself
                        </button>
                      )}
                    </div>

                    {/* Room and Rotation Settings */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room</label>
                        <input
                          type="text"
                          value={station.room}
                          onChange={(e) => updateStation(index, { room: e.target.value })}
                          placeholder="e.g., Sim Lab A"
                          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rotations</label>
                        <select
                          value={station.num_rotations}
                          onChange={(e) => updateStation(index, { num_rotations: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                        >
                          {[2, 3, 4, 5, 6].map(n => (
                            <option key={n} value={n}>{n} rotations</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Minutes</label>
                        <div className="space-y-2">
                          <input
                            type="number"
                            min="1"
                            max="120"
                            value={durationInputValues[station.id] ?? station.rotation_minutes}
                            onChange={(e) => {
                              // Allow free typing - just update display value
                              setDurationInputValues(prev => ({
                                ...prev,
                                [station.id]: e.target.value
                              }));
                            }}
                            onBlur={(e) => {
                              // Validate and clamp only when user leaves the field
                              let val = parseInt(e.target.value) || 15;
                              val = Math.max(1, Math.min(120, val));
                              setDurationInputValues(prev => ({
                                ...prev,
                                [station.id]: val.toString()
                              }));
                              updateStation(index, { rotation_minutes: val });
                            }}
                            onFocus={(e) => {
                              // Select all text for easy replacement
                              e.target.select();
                            }}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                          />
                          <div className="flex flex-wrap gap-1">
                            {[15, 20, 30, 45, 60].map(n => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => {
                                  // Update both the display value and actual state
                                  setDurationInputValues(prev => ({
                                    ...prev,
                                    [station.id]: n.toString()
                                  }));
                                  updateStation(index, { rotation_minutes: n });
                                }}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                  station.rotation_minutes === n
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                      <textarea
                        value={station.notes}
                        onChange={(e) => updateStation(index, { notes: e.target.value })}
                        placeholder="Special setup, equipment needed, etc."
                        rows={2}
                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Add Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const newStations: Station[] = [];
              for (let i = stations.length + 1; i <= stations.length + 4; i++) {
                newStations.push(createEmptyStation(i));
              }
              setStations([...stations, ...newStations]);
            }}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            + Add 4 Stations
          </button>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/lab-management/schedule"
            className="px-6 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || !selectedCohort || !labDate}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saving ? 'Saving...' : 'Save Lab Day'}
          </button>
        </div>
      </main>

      {/* Skills Selection Modal */}
      {skillsModalStation !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Select Skills for Station {skillsModalStation + 1}</h3>
              <button
                onClick={() => setSkillsModalStation(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="Search skills..."
                  className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Showing skills for {programLevel || 'all levels'} • {stations[skillsModalStation]?.selected_skills.length || 0} selected
              </p>
            </div>

            {/* Skills List */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{category}</h4>
                  <div className="space-y-1">
                    {categorySkills.map(skill => {
                      const isSelected = stations[skillsModalStation]?.selected_skills.includes(skill.id);
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
                            onChange={() => toggleSkill(skillsModalStation, skill.id)}
                            className="w-4 h-4 text-green-600"
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{skill.name}</span>
                          <div className="flex gap-1 ml-auto">
                            {skill.certification_levels.map(level => (
                              <span key={level} className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                {level}
                              </span>
                            ))}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Done Button */}
            <div className="p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setSkillsModalStation(null)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done ({stations[skillsModalStation]?.selected_skills.length || 0} skills selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario Selection Modal */}
      {scenarioModalStation !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Select Scenario for Station {scenarioModalStation + 1}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{filteredScenarios.length} of {scenarios.length} scenarios</p>
              </div>
              <button
                onClick={() => setScenarioModalStation(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Search and Filters */}
            <div className="p-4 border-b dark:border-gray-700 space-y-3 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={scenarioSearch}
                  onChange={(e) => setScenarioSearch(e.target.value)}
                  placeholder="Search by title, chief complaint, patient name..."
                  className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  autoFocus
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={scenarioFilterProgram}
                  onChange={(e) => setScenarioFilterProgram(e.target.value)}
                  className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700"
                >
                  <option value="">All Programs</option>
                  {scenarioPrograms.map(prog => (
                    <option key={prog} value={prog}>{prog}</option>
                  ))}
                </select>

                <select
                  value={scenarioFilterCategory}
                  onChange={(e) => setScenarioFilterCategory(e.target.value)}
                  className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700"
                >
                  <option value="">All Categories</option>
                  {scenarioCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <select
                  value={scenarioFilterDifficulty}
                  onChange={(e) => setScenarioFilterDifficulty(e.target.value)}
                  className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700"
                >
                  <option value="">All Difficulties</option>
                  {scenarioDifficulties.map(diff => (
                    <option key={diff} value={diff}>{diff.charAt(0).toUpperCase() + diff.slice(1)}</option>
                  ))}
                </select>

                {(scenarioSearch || scenarioFilterProgram || scenarioFilterCategory || scenarioFilterDifficulty) && (
                  <button
                    onClick={() => {
                      setScenarioSearch('');
                      setScenarioFilterProgram('');
                      setScenarioFilterCategory('');
                      setScenarioFilterDifficulty('');
                    }}
                    className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Scenarios List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredScenarios.length === 0 ? (
                <div className="text-center py-8">
                  <Stethoscope className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No scenarios match your filters</p>
                  <button
                    onClick={() => {
                      setScenarioSearch('');
                      setScenarioFilterProgram('');
                      setScenarioFilterCategory('');
                      setScenarioFilterDifficulty('');
                    }}
                    className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(scenariosByCategory).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryScenarios]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sticky top-0 bg-white dark:bg-gray-800 py-1">
                        {category} ({categoryScenarios.length})
                      </h4>
                      <div className="space-y-1">
                        {categoryScenarios.map(scenario => {
                          const isSelected = stations[scenarioModalStation]?.scenario_id === scenario.id;
                          return (
                            <button
                              key={scenario.id}
                              type="button"
                              onClick={() => {
                                updateStation(scenarioModalStation, { scenario_id: scenario.id });
                                setScenarioModalStation(null);
                              }}
                              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                isSelected ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 dark:text-white">{scenario.title}</div>
                                  {scenario.chief_complaint && (
                                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">CC: {scenario.chief_complaint}</div>
                                  )}
                                  {scenario.patient_name && scenario.patient_age && (
                                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                      Patient: {scenario.patient_name}, {scenario.patient_age}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    scenario.difficulty === 'basic' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                    scenario.difficulty === 'intermediate' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                  }`}>
                                    {scenario.difficulty}
                                  </span>
                                  {scenario.estimated_duration && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">~{scenario.estimated_duration} min</span>
                                  )}
                                  <div className="flex gap-0.5">
                                    {scenario.applicable_programs?.map(prog => (
                                      <span key={prog} className="text-xs px-1 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                        {prog}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t dark:border-gray-700 flex justify-between items-center flex-shrink-0">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {stations[scenarioModalStation]?.scenario_id ? (
                  <span>Selected: <strong className="text-gray-900 dark:text-white">{scenarios.find(s => s.id === stations[scenarioModalStation]?.scenario_id)?.title}</strong></span>
                ) : (
                  <span>No scenario selected</span>
                )}
              </div>
              <div className="flex gap-2">
                {stations[scenarioModalStation]?.scenario_id && (
                  <button
                    onClick={() => updateStation(scenarioModalStation, { scenario_id: '' })}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Clear Selection
                  </button>
                )}
                <button
                  onClick={() => setScenarioModalStation(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {stations[scenarioModalStation]?.scenario_id ? 'Confirm Selection' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
