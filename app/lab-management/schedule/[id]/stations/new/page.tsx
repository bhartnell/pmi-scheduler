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

  // Skills station document fields
  const [skillSheetUrl, setSkillSheetUrl] = useState('');
  const [instructionsUrl, setInstructionsUrl] = useState('');
  const [stationNotes, setStationNotes] = useState('');

  // Skills modal
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');

  // Scenario modal
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [scenarioFilterCategory, setScenarioFilterCategory] = useState('');
  const [scenarioFilterDifficulty, setScenarioFilterDifficulty] = useState('');
  const [scenarioFilterProgram, setScenarioFilterProgram] = useState('');

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

      // Generate custom_title for skills stations from selected skills
      let customTitle: string | null = null;
      if (stationType === 'skills') {
        const skillNames = selectedSkills
          .map(skillId => skills.find(s => s.id === skillId)?.name)
          .filter(Boolean);
        const allSkillNames = [...skillNames, ...customSkills.filter(s => s.trim())];
        if (allSkillNames.length > 0) {
          // Use first 2-3 skill names, or all if fewer
          customTitle = allSkillNames.slice(0, 3).join(', ');
          if (allSkillNames.length > 3) {
            customTitle += ` (+${allSkillNames.length - 3} more)`;
          }
        } else {
          customTitle = 'Skills Station';
        }
      } else if (stationType === 'documentation') {
        customTitle = 'Documentation Station';
      }

      // Create station
      const stationRes = await fetch('/api/lab-management/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          station_number: nextStationNumber,
          station_type: stationType,
          scenario_id: stationType === 'scenario' ? scenarioId || null : null,
          custom_title: customTitle,
          instructor_name: instructorName || null,
          instructor_email: instructorEmail || null,
          room: room || null,
          notes: notes || null,
          // Skills station document fields
          skill_sheet_url: stationType === 'skills' ? skillSheetUrl || null : null,
          instructions_url: stationType === 'skills' ? instructionsUrl || null : null,
          station_notes: stationType === 'skills' ? stationNotes || null : null
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

  // Get unique scenario categories and difficulties for filters
  const scenarioCategories = [...new Set(scenarios.map(s => s.category).filter(Boolean))].sort();
  const scenarioDifficulties = ['basic', 'intermediate', 'advanced'];
  const scenarioPrograms = ['EMT', 'AEMT', 'Paramedic'];

  // Filter scenarios based on search and filters
  const filteredScenarios = scenarios.filter(scenario => {
    // Search filter - search across title, chief_complaint
    const searchLower = scenarioSearch.toLowerCase();
    const matchesSearch = !scenarioSearch ||
      scenario.title.toLowerCase().includes(searchLower) ||
      (scenario.chief_complaint && scenario.chief_complaint.toLowerCase().includes(searchLower)) ||
      (scenario.category && scenario.category.toLowerCase().includes(searchLower)) ||
      (scenario.patient_name && scenario.patient_name.toLowerCase().includes(searchLower));

    // Category filter
    const matchesCategory = !scenarioFilterCategory || scenario.category === scenarioFilterCategory;

    // Difficulty filter
    const matchesDifficulty = !scenarioFilterDifficulty || scenario.difficulty === scenarioFilterDifficulty;

    // Program filter - check if applicable_programs includes the selected program
    const matchesProgram = !scenarioFilterProgram ||
      (scenario.applicable_programs && scenario.applicable_programs.includes(scenarioFilterProgram));

    return matchesSearch && matchesCategory && matchesDifficulty && matchesProgram;
  });

  // Group filtered scenarios by category for display
  const scenariosByCategory = filteredScenarios.reduce((acc, scenario) => {
    const cat = scenario.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(scenario);
    return acc;
  }, {} as Record<string, Scenario[]>);

  // Get selected scenario details
  const selectedScenario = scenarios.find(s => s.id === scenarioId);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
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
            Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

  const stationTypeConfig = STATION_TYPES.find(t => t.value === stationType);
  const TypeIcon = stationTypeConfig?.icon || Stethoscope;

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
            <Link href={`/lab-management/schedule/${labDayId}`} className="hover:text-blue-600 dark:hover:text-blue-400">
              {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>New Station</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Add New Station</h1>
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {/* Station Type Selection */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-t-lg border-b dark:border-gray-600">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stationTypeConfig?.color || 'bg-gray-500'}`}>
                <TypeIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Station Type</h3>
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
                        setSkillSheetUrl('');
                        setInstructionsUrl('');
                        setStationNotes('');
                      }}
                      className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        stationType === type.value
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
          </div>

          <div className="p-4 space-y-6">
            {/* Scenario Selection (only for scenario type) */}
            {stationType === 'scenario' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Scenario
                </label>
                <button
                  type="button"
                  onClick={() => setShowScenarioModal(true)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {selectedScenario ? (
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{selectedScenario.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                          {selectedScenario.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          selectedScenario.difficulty === 'basic' ? 'bg-green-100 text-green-700' :
                          selectedScenario.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {selectedScenario.difficulty}
                        </span>
                        {selectedScenario.chief_complaint && (
                          <span className="text-gray-400">• {selectedScenario.chief_complaint}</span>
                        )}
                      </div>
                    </div>
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
            {stationType === 'skills' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Skills from Library ({selectedSkills.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSkillsModal(true)}
                    className="w-full px-3 py-2 border border-dashed dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Custom Skills (freetext)
                  </label>
                  <div className="space-y-2">
                    {customSkills.map((customSkill, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customSkill}
                          onChange={(e) => updateCustomSkill(index, e.target.value)}
                          className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
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

                {/* Station Documentation */}
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Station Documentation
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-green-700 dark:text-green-400 mb-1">Skill Sheet URL</label>
                      <input
                        type="url"
                        value={skillSheetUrl}
                        onChange={(e) => setSkillSheetUrl(e.target.value)}
                        placeholder="https://drive.google.com/... or paste URL"
                        className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-green-700 dark:text-green-400 mb-1">Instructions URL</label>
                      <input
                        type="url"
                        value={instructionsUrl}
                        onChange={(e) => setInstructionsUrl(e.target.value)}
                        placeholder="https://drive.google.com/... or paste URL"
                        className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-green-700 dark:text-green-400 mb-1">Station Notes</label>
                      <textarea
                        value={stationNotes}
                        onChange={(e) => setStationNotes(e.target.value)}
                        placeholder="Equipment needed, setup instructions, special notes..."
                        rows={3}
                        className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Documentation Station Info */}
            {stationType === 'documentation' && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Documentation station for PCR practice and review. Instructor assignment is optional.
                </p>
              </div>
            )}

            {/* Instructor Section */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Instructor
                </label>
                {!instructorEmail && (
                  <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full">
                    Open - Needs Instructor
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={instructorName}
                    onChange={(e) => setInstructorName(e.target.value)}
                    placeholder="Instructor name"
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={instructorEmail}
                    onChange={(e) => setInstructorEmail(e.target.value)}
                    placeholder="instructor@example.com"
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room</label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g., Sim Lab A"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special setup, equipment needed, etc."
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-4 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
            <Link
              href={`/lab-management/schedule/${labDayId}`}
              className="px-6 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Select Skills</h3>
              <button
                onClick={() => setShowSkillsModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
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
                Showing skills for {programLevel || 'all levels'} - {selectedSkills.length} selected
              </p>
            </div>

            {/* Skills List */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{category}</h4>
                  <div className="space-y-1">
                    {categorySkills.map(skill => {
                      const isSelected = selectedSkills.includes(skill.id);
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
                          <div className="flex gap-1 ml-auto">
                            {skill.certification_levels.map(level => (
                              <span key={level} className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
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
                onClick={() => setShowSkillsModal(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done ({selectedSkills.length} skills selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario Selection Modal */}
      {showScenarioModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Select Scenario</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{filteredScenarios.length} of {scenarios.length} scenarios</p>
              </div>
              <button
                onClick={() => setShowScenarioModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search and Filters */}
            <div className="p-4 border-b dark:border-gray-700 space-y-3 flex-shrink-0">
              {/* Search */}
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

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-2">
                {/* Program Filter */}
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

                {/* Category Filter */}
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

                {/* Difficulty Filter */}
                <select
                  value={scenarioFilterDifficulty}
                  onChange={(e) => setScenarioFilterDifficulty(e.target.value)}
                  className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700"
                >
                  <option value="">All Difficulties</option>
                  {scenarioDifficulties.map(diff => (
                    <option key={diff} value={diff} className="capitalize">{diff.charAt(0).toUpperCase() + diff.slice(1)}</option>
                  ))}
                </select>

                {/* Clear Filters */}
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
                          const isSelected = scenarioId === scenario.id;
                          return (
                            <button
                              key={scenario.id}
                              type="button"
                              onClick={() => {
                                setScenarioId(scenario.id);
                                setShowScenarioModal(false);
                              }}
                              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                isSelected
                                  ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 dark:text-white">{scenario.title}</div>
                                  {scenario.chief_complaint && (
                                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                                      CC: {scenario.chief_complaint}
                                    </div>
                                  )}
                                  {scenario.patient_name && scenario.patient_age && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      Patient: {scenario.patient_name}, {scenario.patient_age}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    scenario.difficulty === 'basic' ? 'bg-green-100 text-green-700' :
                                    scenario.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {scenario.difficulty}
                                  </span>
                                  {scenario.estimated_duration && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      ~{scenario.estimated_duration} min
                                    </span>
                                  )}
                                  <div className="flex gap-0.5">
                                    {scenario.applicable_programs?.map(prog => (
                                      <span key={prog} className="text-xs px-1 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
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
                {selectedScenario ? (
                  <span>Selected: <strong className="text-gray-900 dark:text-white">{selectedScenario.title}</strong></span>
                ) : (
                  <span>No scenario selected</span>
                )}
              </div>
              <div className="flex gap-2">
                {selectedScenario && (
                  <button
                    onClick={() => setScenarioId('')}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Clear Selection
                  </button>
                )}
                <button
                  onClick={() => setShowScenarioModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {selectedScenario ? 'Confirm Selection' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
