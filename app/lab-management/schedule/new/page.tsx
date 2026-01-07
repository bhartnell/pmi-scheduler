'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  ChevronLeft,
  Calendar,
  Plus,
  Trash2,
  Save,
  Search
} from 'lucide-react';

interface Cohort {
  id: string;
  cohort_number: number;
  program: {
    name: string;
    abbreviation: string;
  };
}

interface Scenario {
  id: string;
  title: string;
  category: string;
  difficulty: string;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
}

interface StationForm {
  station_number: number;
  station_type: 'scenario' | 'skill' | 'documentation' | 'lecture' | 'testing';
  scenario_id: string;
  skill_name: string;
  custom_title: string;
  instructor_id: string;
  location: string;
  documentation_required: boolean;
  platinum_required: boolean;
}

const STATION_TYPES = [
  { value: 'scenario', label: 'Scenario' },
  { value: 'skill', label: 'Skill Station' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'lecture', label: 'Lecture' },
  { value: 'testing', label: 'Testing' },
];

const DEFAULT_STATION: StationForm = {
  station_number: 1,
  station_type: 'scenario',
  scenario_id: '',
  skill_name: '',
  custom_title: '',
  instructor_id: '',
  location: '',
  documentation_required: false,
  platinum_required: false,
};

export default function NewLabDayPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [selectedCohort, setSelectedCohort] = useState('');
  const [date, setDate] = useState('');
  const [weekNumber, setWeekNumber] = useState<number | ''>('');
  const [dayNumber, setDayNumber] = useState<number | ''>('');
  const [numRotations, setNumRotations] = useState(4);
  const [rotationDuration, setRotationDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [stations, setStations] = useState<StationForm[]>([
    { ...DEFAULT_STATION, station_number: 1 },
    { ...DEFAULT_STATION, station_number: 2 },
    { ...DEFAULT_STATION, station_number: 3 },
    { ...DEFAULT_STATION, station_number: 4 },
  ]);

  // Scenario search
  const [scenarioSearch, setScenarioSearch] = useState('');

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
    setLoading(true);
    try {
      // Fetch cohorts
      const cohortsRes = await fetch('/api/lab-management/cohorts');
      const cohortsData = await cohortsRes.json();
      if (cohortsData.success) {
        setCohorts(cohortsData.cohorts);
      }

      // Fetch scenarios
      const scenariosRes = await fetch('/api/lab-management/scenarios');
      const scenariosData = await scenariosRes.json();
      if (scenariosData.success) {
        setScenarios(scenariosData.scenarios);
      }

      // TODO: Fetch instructors when lab_users is populated
      // For now, leave empty - instructors can be assigned later
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const addStation = () => {
    setStations([
      ...stations,
      { ...DEFAULT_STATION, station_number: stations.length + 1 }
    ]);
  };

  const removeStation = (index: number) => {
    if (stations.length <= 1) return;
    const newStations = stations.filter((_, i) => i !== index);
    // Renumber stations
    setStations(newStations.map((s, i) => ({ ...s, station_number: i + 1 })));
  };

  const updateStation = (index: number, field: keyof StationForm, value: any) => {
    const newStations = [...stations];
    newStations[index] = { ...newStations[index], [field]: value };
    setStations(newStations);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCohort || !date) {
      alert('Please select a cohort and date');
      return;
    }

    setSaving(true);
    try {
      // Prepare stations data - only include stations with content
      const stationsData = stations
        .filter(s => s.scenario_id || s.skill_name || s.custom_title)
        .map(s => ({
          station_number: s.station_number,
          station_type: s.station_type,
          scenario_id: s.scenario_id || null,
          skill_name: s.skill_name || null,
          custom_title: s.custom_title || null,
          instructor_id: s.instructor_id || null,
          location: s.location || null,
          documentation_required: s.documentation_required,
          platinum_required: s.platinum_required,
        }));

      const res = await fetch('/api/lab-management/lab-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          cohort_id: selectedCohort,
          week_number: weekNumber || null,
          day_number: dayNumber || null,
          num_rotations: numRotations,
          rotation_duration: rotationDuration,
          notes: notes || null,
          stations: stationsData,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/lab-management/schedule/${data.labDay.id}`);
      } else {
        alert('Failed to create lab day: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating lab day:', error);
      alert('Failed to create lab day');
    }
    setSaving(false);
  };

  const filteredScenarios = scenarios.filter(s =>
    scenarioSearch === '' ||
    s.title.toLowerCase().includes(scenarioSearch.toLowerCase()) ||
    s.category.toLowerCase().includes(scenarioSearch.toLowerCase())
  );

  const selectedCohortData = cohorts.find(c => c.id === selectedCohort);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/schedule" className="hover:text-blue-600">Schedule</Link>
            <ChevronRight className="w-4 h-4" />
            <span>New Lab Day</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Create Lab Day</h1>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Lab Day Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cohort <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                >
                  <option value="">Select a cohort</option>
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
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Week Number
                </label>
                <input
                  type="number"
                  min="1"
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="e.g., 14"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day Number
                </label>
                <input
                  type="number"
                  min="1"
                  value={dayNumber}
                  onChange={(e) => setDayNumber(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="e.g., 1"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Rotations
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numRotations}
                  onChange={(e) => setNumRotations(parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rotation Duration (minutes)
                </label>
                <input
                  type="number"
                  min="10"
                  max="120"
                  step="5"
                  value={rotationDuration}
                  onChange={(e) => setRotationDuration(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                />
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any special notes for this lab day..."
                className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white resize-none"
              />
            </div>
          </div>

          {/* Stations */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Stations</h2>
              <button
                type="button"
                onClick={addStation}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                <Plus className="w-4 h-4" />
                Add Station
              </button>
            </div>

            <div className="space-y-4">
              {stations.map((station, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">Station {station.station_number}</h3>
                    {stations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStation(index)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Station Type
                      </label>
                      <select
                        value={station.station_type}
                        onChange={(e) => updateStation(index, 'station_type', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                      >
                        {STATION_TYPES.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>

                    {station.station_type === 'scenario' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Scenario
                        </label>
                        <select
                          value={station.scenario_id}
                          onChange={(e) => updateStation(index, 'scenario_id', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                        >
                          <option value="">Select a scenario</option>
                          {scenarios.map(scenario => (
                            <option key={scenario.id} value={scenario.id}>
                              {scenario.title} ({scenario.category})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {station.station_type === 'skill' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Skill Name
                        </label>
                        <input
                          type="text"
                          value={station.skill_name}
                          onChange={(e) => updateStation(index, 'skill_name', e.target.value)}
                          placeholder="e.g., IV Insertion"
                          className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                        />
                      </div>
                    )}

                    {(station.station_type === 'documentation' || station.station_type === 'lecture' || station.station_type === 'testing') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={station.custom_title}
                          onChange={(e) => updateStation(index, 'custom_title', e.target.value)}
                          placeholder="Station title"
                          className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={station.location}
                        onChange={(e) => updateStation(index, 'location', e.target.value)}
                        placeholder="e.g., Room 101"
                        className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={station.documentation_required}
                        onChange={(e) => updateStation(index, 'documentation_required', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      Documentation Required
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={station.platinum_required}
                        onChange={(e) => updateStation(index, 'platinum_required', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      Platinum Required
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Link
              href="/lab-management/schedule"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !selectedCohort || !date}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Create Lab Day
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
