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
  BookOpen,
  AlertCircle,
  User,
  Home,
  Stethoscope,
  FileText,
  ClipboardCheck,
  Search,
  X
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
  difficulty: string;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  certification_levels: string[];
}

interface Station {
  id: string;
  station_number: number;
  station_type: 'scenario' | 'skills' | 'documentation';
  scenario_id: string;
  selected_skills: string[];  // For skills stations
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedCohort, setSelectedCohort] = useState('');
  const [labDate, setLabDate] = useState('');
  const [labTitle, setLabTitle] = useState('');
  const [labNotes, setLabNotes] = useState('');
  const [stations, setStations] = useState<Station[]>([
    createEmptyStation(1)
  ]);

  // Skills search
  const [skillSearch, setSkillSearch] = useState('');
  const [skillsModalStation, setSkillsModalStation] = useState<number | null>(null);

  function createEmptyStation(stationNumber: number): Station {
    return {
      id: `temp-${Date.now()}-${stationNumber}`,
      station_number: stationNumber,
      station_type: 'scenario',
      scenario_id: '',
      selected_skills: [],
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
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
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
          title: labTitle || null,
          notes: labNotes || null
        })
      });

      const labDayData = await labDayRes.json();
      if (!labDayData.success) {
        throw new Error(labDayData.error || 'Failed to create lab day');
      }

      const labDayId = labDayData.labDay.id;

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
        if (station.station_type === 'skills' && station.selected_skills.length > 0 && stationData.success) {
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

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const openStationsCount = stations.filter(s => !s.instructor_email).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/schedule" className="hover:text-blue-600">Schedule</Link>
            <ChevronRight className="w-4 h-4" />
            <span>New Lab Day</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Schedule New Lab Day</h1>
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
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Lab Day Details
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cohort <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={labDate}
                onChange={(e) => setLabDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title (optional)
              </label>
              <input
                type="text"
                value={labTitle}
                onChange={(e) => setLabTitle(e.target.value)}
                placeholder="e.g., Cardiac Day, Trauma Scenarios"
                className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <input
                type="text"
                value={labNotes}
                onChange={(e) => setLabNotes(e.target.value)}
                placeholder="Any special instructions..."
                className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Stations */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                Stations ({stations.length})
              </h2>
              {openStationsCount > 0 && (
                <p className="text-sm text-yellow-600 mt-1">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  {openStationsCount} station{openStationsCount > 1 ? 's' : ''} need{openStationsCount === 1 ? 's' : ''} instructor
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={addStation}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              <Plus className="w-4 h-4" /> Add Station
            </button>
          </div>

          <div className="p-4 space-y-6">
            {stations.map((station, index) => {
              const stationType = STATION_TYPES.find(t => t.value === station.station_type);
              const TypeIcon = stationType?.icon || Stethoscope;
              
              return (
                <div key={station.id} className="border rounded-lg">
                  {/* Station Header with Type Selection */}
                  <div className="px-4 py-3 bg-gray-50 flex items-center justify-between rounded-t-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${stationType?.color || 'bg-gray-500'}`}>
                        <TypeIcon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">Station {station.station_number}</h3>
                        <div className="flex gap-1 mt-1">
                          {STATION_TYPES.map(type => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => updateStation(index, { 
                                station_type: type.value as any,
                                scenario_id: '',
                                selected_skills: []
                              })}
                              className={`px-2 py-0.5 text-xs rounded ${
                                station.station_type === type.value
                                  ? `${type.color} text-white`
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
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
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Scenario Selection (only for scenario type) */}
                    {station.station_type === 'scenario' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Scenario
                        </label>
                        <select
                          value={station.scenario_id}
                          onChange={(e) => updateStation(index, { scenario_id: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                        >
                          <option value="">Select scenario...</option>
                          {scenarios.map(scenario => (
                            <option key={scenario.id} value={scenario.id}>
                              {scenario.title} ({scenario.category} - {scenario.difficulty})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Skills Selection (only for skills type) */}
                    {station.station_type === 'skills' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Skills ({station.selected_skills.length} selected)
                        </label>
                        <button
                          type="button"
                          onClick={() => setSkillsModalStation(index)}
                          className="w-full px-3 py-2 border border-dashed rounded-lg text-gray-600 hover:bg-gray-50 text-left"
                        >
                          {station.selected_skills.length === 0 ? (
                            <span className="flex items-center gap-2">
                              <Plus className="w-4 h-4" /> Select skills for this station...
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {station.selected_skills.map(skillId => {
                                const skill = skills.find(s => s.id === skillId);
                                return skill ? (
                                  <span key={skillId} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                    {skill.name}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Documentation Station Notes */}
                    {station.station_type === 'documentation' && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                          Documentation station for PCR practice and review. Instructor assignment is optional.
                        </p>
                      </div>
                    )}

                    {/* Instructor Section */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                          <User className="w-4 h-4" />
                          Instructor
                        </label>
                        {!station.instructor_email && (
                          <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                            Open - Needs Instructor
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Name</label>
                          <input
                            type="text"
                            value={station.instructor_name}
                            onChange={(e) => updateStation(index, { instructor_name: e.target.value })}
                            placeholder="Optional"
                            className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Email</label>
                          <input
                            type="email"
                            value={station.instructor_email}
                            onChange={(e) => updateStation(index, { instructor_email: e.target.value })}
                            placeholder="Optional"
                            className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white text-sm"
                          />
                        </div>
                      </div>
                      
                      {!station.instructor_email && (
                        <button
                          type="button"
                          onClick={() => assignSelfToStation(index)}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <User className="w-4 h-4" />
                          Assign myself
                        </button>
                      )}
                    </div>

                    {/* Room and Rotation Settings */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                        <input
                          type="text"
                          value={station.room}
                          onChange={(e) => updateStation(index, { room: e.target.value })}
                          placeholder="e.g., Sim Lab A"
                          className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rotations</label>
                        <select
                          value={station.num_rotations}
                          onChange={(e) => updateStation(index, { num_rotations: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                        >
                          {[2, 3, 4, 5, 6].map(n => (
                            <option key={n} value={n}>{n} rotations</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Minutes</label>
                        <select
                          value={station.rotation_minutes}
                          onChange={(e) => updateStation(index, { rotation_minutes: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                        >
                          {[15, 20, 25, 30, 45, 60].map(n => (
                            <option key={n} value={n}>{n} min</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={station.notes}
                        onChange={(e) => updateStation(index, { notes: e.target.value })}
                        placeholder="Special setup, equipment needed, etc."
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
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
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            + Add 4 Stations
          </button>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/lab-management/schedule"
            className="px-6 py-2 border text-gray-700 rounded-lg hover:bg-gray-50"
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
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Select Skills for Station {skillsModalStation + 1}</h3>
              <button
                onClick={() => setSkillsModalStation(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="Search skills..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 bg-white"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Showing skills for {programLevel || 'all levels'} • {stations[skillsModalStation]?.selected_skills.length || 0} selected
              </p>
            </div>
            
            {/* Skills List */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">{category}</h4>
                  <div className="space-y-1">
                    {categorySkills.map(skill => {
                      const isSelected = stations[skillsModalStation]?.selected_skills.includes(skill.id);
                      return (
                        <label
                          key={skill.id}
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                            isSelected ? 'bg-green-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSkill(skillsModalStation, skill.id)}
                            className="w-4 h-4 text-green-600"
                          />
                          <span className="text-sm text-gray-900">{skill.name}</span>
                          <div className="flex gap-1 ml-auto">
                            {skill.certification_levels.map(level => (
                              <span key={level} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
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
            <div className="p-4 border-t">
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
    </div>
  );
}
