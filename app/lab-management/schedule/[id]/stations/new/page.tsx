'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Save,
  Home,
  User,
  Stethoscope,
  FileText,
  ClipboardCheck,
  Search,
  X,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';

interface LabDay {
  id: string;
  date: string;
  title: string | null;
  cohort: {
    id: string;
    cohort_number: number;
    program: {
      name: string;
      abbreviation: string;
    };
  };
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
  station_number: number;
}

const STATION_TYPES = [
  { value: 'scenario', label: 'Scenario', icon: Stethoscope, color: 'bg-purple-500', description: 'Full scenario with grading' },
  { value: 'skills', label: 'Skills', icon: ClipboardCheck, color: 'bg-green-500', description: 'Skills practice station' },
  { value: 'documentation', label: 'Documentation', icon: FileText, color: 'bg-blue-500', description: 'Documentation/PCR station' }
];

export default function NewStationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const labDayId = params.id as string;

  const [labDay, setLabDay] = useState<LabDay | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [existingStations, setExistingStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [stationType, setStationType] = useState<'scenario' | 'skills' | 'documentation'>('scenario');
  const [scenarioId, setScenarioId] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [instructorName, setInstructorName] = useState('');
  const [instructorEmail, setInstructorEmail] = useState('');
  const [room, setRoom] = useState('');
  const [notes, setNotes] = useState('');

  // Skills modal
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && labDayId) {
      fetchData();
    }
  }, [session, labDayId]);

  const fetchData = async () => {
    try {
      // Fetch lab day details
      const labDayRes = await fetch(`/api/lab-management/lab-days/${labDayId}`);
      const labDayData = await labDayRes.json();
      if (labDayData.success) {
        setLabDay(labDayData.labDay);
      }

      // Fetch existing stations to determine next station number
      const stationsRes = await fetch(`/api/lab-management/stations?labDayId=${labDayId}`);
      const stationsData = await stationsRes.json();
      if (stationsData.success) {
        setExistingStations(stationsData.stations || []);
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

  const assignSelf = () => {
    setInstructorName(session?.user?.name || '');
    setInstructorEmail(session?.user?.email || '');
  };

  const toggleSkill = (skillId: string) => {
    if (selectedSkills.includes(skillId)) {
      setSelectedSkills(selectedSkills.filter(id => id !== skillId));
    } else {
      setSelectedSkills([...selectedSkills, skillId]);
    }
  };

  const addCustomSkill = () => {
    setCustomSkills([...customSkills, '']);
  };

  const updateCustomSkill = (index: number, value: string) => {
    const updated = [...customSkills];
    updated[index] = value;
    setCustomSkills(updated);
  };

  const removeCustomSkill = (index: number) => {
    setCustomSkills(customSkills.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Calculate next station number
      const nextStationNumber = existingStations.length > 0
        ? Math.max(...existingStations.map(s => s.station_number)) + 1
        : 1;

      // Create station
      const stationRes = await fetch('/api/lab-management/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          station_number: nextStationNumber,
          station_type: stationType,
          scenario_id: stationType === 'scenario' ? scenarioId || null : null,
          instructor_name: instructorName || null,
          instructor_email: instructorEmail || null,
          room: room || null,
          notes: notes || null
        })
      });

      const stationData = await stationRes.json();

      if (!stationData.success) {
        throw new Error(stationData.error || 'Failed to create station');
      }

      // If skills station, add skill links
      if (stationType === 'skills' && stationData.station) {
        // Add library skills
        for (const skillId of selectedSkills) {
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
        for (const customSkill of customSkills) {
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

      // Redirect back to lab day page
      router.push(`/lab-management/schedule/${labDayId}`);
    } catch (error) {
      console.error('Error saving station:', error);
      alert('Failed to save station');
    }
    setSaving(false);
  };

  // Get program level for filtering skills
  const programLevel = labDay?.cohort?.program?.abbreviation || '';

  // Filter skills by search and program level
  const filteredSkills = skills.filter(skill => {
    const matchesSearch = !skillSearch ||
      skill.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
      skill.category.toLowerCase().includes(skillSearch.toLowerCase());
    const matchesLevel = !programLevel ||
      skill.certification_levels.includes(programLevel) ||
      skill.certification_levels.includes('EMT');
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (!labDay) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Lab Day Not Found</h2>
          <p className="text-gray-600 mb-4">The requested lab day could not be found.</p>
          <Link
            href="/lab-management/schedule"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

  const stationTypeConfig = STATION_TYPES.find(t => t.value === stationType);
  const TypeIcon = stationTypeConfig?.icon || Stethoscope;

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
            <Link href={`/lab-management/schedule/${labDayId}`} className="hover:text-blue-600">
              {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>New Station</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Add New Station</h1>
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
              {saving ? 'Saving...' : 'Save Station'}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow">
          {/* Station Type Selection */}
          <div className="px-4 py-3 bg-gray-50 rounded-t-lg border-b">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stationTypeConfig?.color || 'bg-gray-500'}`}>
                <TypeIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Station Type</h3>
                <div className="flex gap-2 mt-1">
                  {STATION_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        setStationType(type.value as any);
                        setScenarioId('');
                        setSelectedSkills([]);
                        setCustomSkills([]);
                      }}
                      className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        stationType === type.value
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
          </div>

          <div className="p-4 space-y-6">
            {/* Scenario Selection (only for scenario type) */}
            {stationType === 'scenario' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scenario
                </label>
                <select
                  value={scenarioId}
                  onChange={(e) => setScenarioId(e.target.value)}
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
            {stationType === 'skills' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Skills from Library ({selectedSkills.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSkillsModal(true)}
                    className="w-full px-3 py-2 border border-dashed rounded-lg text-gray-600 hover:bg-gray-50 text-left"
                  >
                    {selectedSkills.length === 0 ? (
                      <span className="flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Select skills from library...
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {selectedSkills.map(skillId => {
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

                {/* Custom Skills */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Skills (freetext)
                  </label>
                  <div className="space-y-2">
                    {customSkills.map((customSkill, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customSkill}
                          onChange={(e) => updateCustomSkill(index, e.target.value)}
                          className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                          placeholder="Enter custom skill..."
                        />
                        <button
                          type="button"
                          onClick={() => removeCustomSkill(index)}
                          className="p-2 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addCustomSkill}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Plus className="w-4 h-4" /> Add custom skill
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Documentation Station Info */}
            {stationType === 'documentation' && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Documentation station for PCR practice and review. Instructor assignment is optional.
                </p>
              </div>
            )}

            {/* Instructor Section */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Instructor
                </label>
                {!instructorEmail && (
                  <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                    Open - Needs Instructor
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input
                    type="text"
                    value={instructorName}
                    onChange={(e) => setInstructorName(e.target.value)}
                    placeholder="Instructor name"
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={instructorEmail}
                    onChange={(e) => setInstructorEmail(e.target.value)}
                    placeholder="instructor@example.com"
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                  />
                </div>
              </div>

              {!instructorEmail && (
                <button
                  type="button"
                  onClick={assignSelf}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <User className="w-4 h-4" />
                  Assign myself
                </button>
              )}
            </div>

            {/* Room and Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g., Sim Lab A"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special setup, equipment needed, etc."
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-4 py-4 border-t flex justify-end gap-3">
            <Link
              href={`/lab-management/schedule/${labDayId}`}
              className="px-6 py-2 border text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? 'Saving...' : 'Save Station'}
            </button>
          </div>
        </div>
      </main>

      {/* Skills Selection Modal */}
      {showSkillsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Select Skills</h3>
              <button
                onClick={() => setShowSkillsModal(false)}
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
                Showing skills for {programLevel || 'all levels'} - {selectedSkills.length} selected
              </p>
            </div>

            {/* Skills List */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">{category}</h4>
                  <div className="space-y-1">
                    {categorySkills.map(skill => {
                      const isSelected = selectedSkills.includes(skill.id);
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
                            onChange={() => toggleSkill(skill.id)}
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
                onClick={() => setShowSkillsModal(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done ({selectedSkills.length} skills selected)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
