'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  Save,
  AlertCircle,
  Stethoscope,
  ClipboardCheck,
  FileText,
  User,
  Search,
  X,
  Plus
} from 'lucide-react';

interface LabDay {
  id: string;
  date: string;
  cohort: {
    id: string;
    cohort_number: number;
    program: {
      name: string;
      abbreviation: string;
    };
  };
  stations: { station_number: number }[];
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

interface Instructor {
  id: string;
  name: string;
  email: string;
  role: string;
}

const STATION_TYPES = [
  { value: 'scenario', label: 'Scenario', icon: Stethoscope, color: 'bg-purple-500', description: 'Full scenario with grading' },
  { value: 'skills', label: 'Skills', icon: ClipboardCheck, color: 'bg-green-500', description: 'Skills practice station' },
  { value: 'documentation', label: 'Documentation', icon: FileText, color: 'bg-blue-500', description: 'Documentation/PCR station' }
];

export default function AddStationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const labDayId = params.id as string;

  const [labDay, setLabDay] = useState<LabDay | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [stationType, setStationType] = useState<'scenario' | 'skills' | 'documentation'>('scenario');
  const [scenarioId, setScenarioId] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [instructorName, setInstructorName] = useState('');
  const [instructorEmail, setInstructorEmail] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [isCustomInstructor, setIsCustomInstructor] = useState(false);
  const [room, setRoom] = useState('');
  const [notes, setNotes] = useState('');

  // Skills modal
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);
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
      // Fetch lab day
      const labDayRes = await fetch(`/api/lab-management/lab-days/${labDayId}`);
      const labDayData = await labDayRes.json();
      if (labDayData.success) {
        setLabDay(labDayData.labDay);
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
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const getNextStationNumber = () => {
    if (!labDay?.stations?.length) return 1;
    const maxNumber = Math.max(...labDay.stations.map(s => s.station_number));
    return maxNumber + 1;
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

  const assignSelf = () => {
    setInstructorName(session?.user?.name || '');
    setInstructorEmail(session?.user?.email || '');
    setSelectedInstructor(`${session?.user?.name}|${session?.user?.email}`);
    setIsCustomInstructor(false);
  };

  const handleInstructorChange = (value: string) => {
    setSelectedInstructor(value);

    if (value === 'custom') {
      setIsCustomInstructor(true);
      setInstructorName('');
      setInstructorEmail('');
    } else if (value === '') {
      setIsCustomInstructor(false);
      setInstructorName('');
      setInstructorEmail('');
    } else {
      setIsCustomInstructor(false);
      const [name, email] = value.split('|');
      setInstructorName(name);
      setInstructorEmail(email);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Create station
      const stationRes = await fetch('/api/lab-management/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          station_number: getNextStationNumber(),
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

      router.push(`/lab-management/schedule/${labDayId}`);
    } catch (error) {
      console.error('Error saving station:', error);
      alert('Failed to save station');
    }
    setSaving(false);
  };

  // Filter skills by search and program level
  const programLevel = labDay?.cohort?.program?.abbreviation || '';
  const filteredSkills = skills.filter(skill => {
    const matchesSearch = !skillSearch || 
      skill.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
      skill.category.toLowerCase().includes(skillSearch.toLowerCase());
    const matchesLevel = !programLevel || skill.certification_levels.includes(programLevel) || skill.certification_levels.includes('Paramedic');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/schedule" className="hover:text-blue-600">Schedule</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/lab-management/schedule/${labDayId}`} className="hover:text-blue-600">
              {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Add Station</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Add Station</h1>
          <p className="text-gray-600 mt-1">
            Station {getNextStationNumber()} for {new Date(labDay.date + 'T12:00:00').toLocaleDateString()}
          </p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Station Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Station Type</label>
            <div className="grid grid-cols-3 gap-3">
              {STATION_TYPES.map(type => {
                const Icon = type.icon;
                const isSelected = stationType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setStationType(type.value as any)}
                    className={`p-4 rounded-lg border-2 text-center transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full ${type.color} flex items-center justify-center mx-auto mb-2`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="font-medium text-gray-900">{type.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{type.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scenario Selection (for scenario type) */}
          {stationType === 'scenario' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scenario</label>
              <select
                value={scenarioId}
                onChange={(e) => setScenarioId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
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
          {stationType === 'skills' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skills from Library</label>
                <button
                  type="button"
                  onClick={() => setSkillsModalOpen(true)}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <ClipboardCheck className="w-5 h-5 mx-auto mb-1" />
                  {selectedSkills.length > 0 
                    ? `${selectedSkills.length} skills selected - Click to modify`
                    : 'Click to select skills from library'
                  }
                </button>
                {selectedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedSkills.map(skillId => {
                      const skill = skills.find(s => s.id === skillId);
                      return skill ? (
                        <span key={skillId} className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded">
                          {skill.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              {/* Custom Skills */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Skills</label>
                <div className="space-y-2">
                  {customSkills.map((skill, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={skill}
                        onChange={(e) => updateCustomSkill(index, e.target.value)}
                        placeholder="Enter custom skill name"
                        className="flex-1 px-3 py-2 border rounded-lg text-gray-900 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeCustomSkill(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addCustomSkill}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add custom skill
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Documentation Station Info */}
          {stationType === 'documentation' && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-blue-800 text-sm">
                Documentation station for PCR practice and review. Instructor assignment is optional.
              </p>
            </div>
          )}

          {/* Instructor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
            <select
              value={selectedInstructor}
              onChange={(e) => handleInstructorChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
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
                  value={instructorName}
                  onChange={(e) => setInstructorName(e.target.value)}
                  placeholder="Name (required for custom)"
                  className="px-3 py-2 border rounded-lg text-gray-900 bg-white"
                />
                <input
                  type="email"
                  value={instructorEmail}
                  onChange={(e) => setInstructorEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="px-3 py-2 border rounded-lg text-gray-900 bg-white"
                />
              </div>
            )}

            {!selectedInstructor && !instructorEmail && (
              <button
                type="button"
                onClick={assignSelf}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <User className="w-4 h-4" />
                Assign myself
              </button>
            )}
          </div>

          {/* Room */}
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

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions, equipment needed, etc."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link
              href={`/lab-management/schedule/${labDayId}`}
              className="px-6 py-2 border text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              Add Station
            </button>
          </div>
        </div>
      </main>

      {/* Skills Selection Modal */}
      {skillsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Select Skills</h3>
              <button
                onClick={() => setSkillsModalOpen(false)}
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
                {selectedSkills.length} selected
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
                onClick={() => setSkillsModalOpen(false)}
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
