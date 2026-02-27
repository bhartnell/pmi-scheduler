'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  ChevronUp,
  ChevronDown,
  Stethoscope,
  Lightbulb,
  Monitor,
  Heart,
  GraduationCap,
  Layers,
  CalendarCheck,
  Check,
} from 'lucide-react';
import { canAccessAdmin, hasMinRole } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { CurrentUser } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Scenario {
  id: string;
  title: string;
}

interface Cohort {
  id: string;
  cohort_number: string | number;
  program?: { id: string; name: string; abbreviation: string };
}

interface TemplateStation {
  id?: string;
  sort_order: number;
  station_type: 'scenario' | 'skill' | 'custom' | 'manikin' | 'lecture';
  scenario_id: string | null;
  station_name: string | null;
  skills: string[] | null;
  scenario?: { id: string; title: string } | null;
}

interface LabTemplate {
  id: string;
  name: string;
  description: string | null;
  program: string | null;
  semester: number;
  week_number: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  stations: TemplateStation[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATION_TYPES = ['scenario', 'skill', 'custom', 'manikin', 'lecture'] as const;
type StationType = (typeof STATION_TYPES)[number];

const STATION_TYPE_CONFIG: Record<StationType, { label: string; icon: React.ReactNode; color: string }> = {
  scenario: {
    label: 'Scenario',
    icon: <Stethoscope className="w-3.5 h-3.5" />,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  skill: {
    label: 'Skill',
    icon: <GraduationCap className="w-3.5 h-3.5" />,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  custom: {
    label: 'Custom',
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  manikin: {
    label: 'Manikin',
    icon: <Heart className="w-3.5 h-3.5" />,
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  lecture: {
    label: 'Lecture',
    icon: <Monitor className="w-3.5 h-3.5" />,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  },
};

const SEMESTERS = [1, 2, 3, 4];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStationLabel(station: TemplateStation): string {
  switch (station.station_type) {
    case 'scenario':
      return station.scenario?.title || 'Unnamed Scenario';
    case 'skill':
      return station.skills?.[0] || station.station_name || 'Unnamed Skill';
    case 'manikin':
      return station.station_name || 'Manikin Station';
    case 'lecture':
      return station.station_name || 'Lecture';
    case 'custom':
    default:
      return station.station_name || 'Custom Station';
  }
}

function newStation(sortOrder: number): TemplateStation {
  return {
    sort_order: sortOrder,
    station_type: 'scenario',
    scenario_id: null,
    station_name: null,
    skills: null,
  };
}

// ---------------------------------------------------------------------------
// Station Editor Row
// ---------------------------------------------------------------------------

interface StationRowProps {
  station: TemplateStation;
  index: number;
  total: number;
  scenarios: Scenario[];
  onChange: (index: number, updated: TemplateStation) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

function StationRow({ station, index, total, scenarios, onChange, onDelete, onMoveUp, onMoveDown }: StationRowProps) {
  const typeConfig = STATION_TYPE_CONFIG[station.station_type] || STATION_TYPE_CONFIG.custom;

  return (
    <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
      {/* Row header */}
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {station.sort_order}
        </span>

        {/* Type selector */}
        <select
          value={station.station_type}
          onChange={(e) => onChange(index, { ...station, station_type: e.target.value as StationType, scenario_id: null, station_name: null, skills: null })}
          className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {STATION_TYPES.map((t) => (
            <option key={t} value={t}>{STATION_TYPE_CONFIG[t].label}</option>
          ))}
        </select>

        {/* Reorder buttons */}
        <button
          type="button"
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
          title="Move up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMoveDown(index)}
          disabled={index === total - 1}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
          title="Move down"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="p-1 rounded text-red-400 hover:text-red-600 dark:hover:text-red-400"
          title="Remove station"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Type-specific fields */}
      <div className="pl-8">
        {station.station_type === 'scenario' && (
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Scenario</label>
            <select
              value={station.scenario_id || ''}
              onChange={(e) => onChange(index, { ...station, scenario_id: e.target.value || null })}
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">-- Select scenario --</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
        )}

        {station.station_type === 'skill' && (
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Skill Name</label>
            <input
              type="text"
              value={station.station_name || ''}
              onChange={(e) => onChange(index, { ...station, station_name: e.target.value || null })}
              placeholder="e.g., IV Access, Airway Management"
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        )}

        {(station.station_type === 'custom' || station.station_type === 'manikin' || station.station_type === 'lecture') && (
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Title</label>
            <input
              type="text"
              value={station.station_name || ''}
              onChange={(e) => onChange(index, { ...station, station_name: e.target.value || null })}
              placeholder="Station title"
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template Form Modal
// ---------------------------------------------------------------------------

interface TemplateFormModalProps {
  template: LabTemplate | null; // null = create mode
  scenarios: Scenario[];
  onClose: () => void;
  onSaved: (template: LabTemplate) => void;
}

function TemplateFormModal({ template, scenarios, onClose, onSaved }: TemplateFormModalProps) {
  const toast = useToast();
  const isEdit = !!template;

  const [program, setProgram] = useState(template?.program || '');
  const [semester, setSemester] = useState(template?.semester || 1);
  const [weekNumber, setWeekNumber] = useState(template?.week_number || 1);
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [stations, setStations] = useState<TemplateStation[]>(
    template?.stations || []
  );
  const [saving, setSaving] = useState(false);

  const addStation = () => {
    const nextOrder = stations.length > 0
      ? Math.max(...stations.map((s) => s.sort_order)) + 1
      : 1;
    setStations([...stations, newStation(nextOrder)]);
  };

  const updateStation = (index: number, updated: TemplateStation) => {
    const next = [...stations];
    next[index] = updated;
    setStations(next);
  };

  const deleteStation = (index: number) => {
    const next = stations.filter((_, i) => i !== index);
    // Renumber
    setStations(next.map((s, i) => ({ ...s, sort_order: i + 1 })));
  };

  const moveStation = (index: number, direction: 'up' | 'down') => {
    const next = [...stations];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    // Renumber
    setStations(next.map((s, i) => ({ ...s, sort_order: i + 1 })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!program.trim() || !name.trim()) {
      toast.error('Program and name are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        program: program.trim(),
        semester,
        week_number: weekNumber,
        name: name.trim(),
        description: description.trim() || null,
        stations: stations.map((s, i) => ({
          ...s,
          sort_order: i + 1,
        })),
      };

      const url = isEdit
        ? `/api/admin/lab-templates/${template!.id}`
        : '/api/admin/lab-templates';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Save failed');

      toast.success(isEdit ? 'Template updated' : 'Template created');
      onSaved(data.template);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Template' : 'Create Template'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Program + Semester row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Program <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                placeholder="e.g., Paramedic, EMT"
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Semester <span className="text-red-500">*</span>
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(parseInt(e.target.value))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SEMESTERS.map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Week Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Week Number <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={52}
                value={weekNumber}
                onChange={(e) => setWeekNumber(parseInt(e.target.value) || 1)}
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Airway & Cardiac Week"
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description of this lab day"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
            />
          </div>

          {/* Stations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Stations ({stations.length})
              </label>
              <button
                type="button"
                onClick={addStation}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-3 h-3" />
                Add Station
              </button>
            </div>

            {stations.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg">
                No stations yet. Click &quot;Add Station&quot; to begin.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {stations.map((station, i) => (
                  <StationRow
                    key={i}
                    station={station}
                    index={i}
                    total={stations.length}
                    scenarios={scenarios}
                    onChange={updateStation}
                    onDelete={deleteStation}
                    onMoveUp={(idx) => moveStation(idx, 'up')}
                    onMoveDown={(idx) => moveStation(idx, 'down')}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Form actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isEdit ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Apply to Cohort Section
// ---------------------------------------------------------------------------

interface ApplySectionProps {
  cohorts: Cohort[];
}

function ApplySection({ cohorts }: ApplySectionProps) {
  const toast = useToast();
  const [cohortId, setCohortId] = useState('');
  const [program, setProgram] = useState('');
  const [semester, setSemester] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ created_count: number; lab_days: any[] } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleApply = async () => {
    if (!cohortId || !program.trim() || !startDate) {
      toast.error('Please fill in all fields');
      return;
    }
    setApplying(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/lab-templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_id: cohortId, program: program.trim(), semester, start_date: startDate }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Apply failed');
      setResult(data);
      setShowConfirm(false);
      toast.success(`Created ${data.created_count} lab day${data.created_count !== 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply templates');
    } finally {
      setApplying(false);
    }
  };

  const selectedCohort = cohorts.find((c) => c.id === cohortId);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <CalendarCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
        <h2 className="font-semibold text-gray-900 dark:text-white">Apply Template Set to Cohort</h2>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cohort
            </label>
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">-- Select cohort --</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cohort_number} {c.program ? `(${c.program.abbreviation})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Program
            </label>
            <input
              type="text"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="e.g., Paramedic, EMT"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(parseInt(e.target.value))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {SEMESTERS.map((s) => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Confirmation prompt */}
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!cohortId || !program.trim() || !startDate || applying}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <CalendarCheck className="w-4 h-4" />
            Apply Templates
          </button>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Confirm: Apply all Semester {semester} templates from the{' '}
              <strong>{program}</strong> program to cohort{' '}
              <strong>{selectedCohort?.cohort_number}</strong> starting{' '}
              <strong>{startDate}</strong>?
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              This will create lab days for each template in the set. Lab days are scheduled by week number relative to the start date.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Confirm Apply
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={applying}
                className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-900 dark:text-green-100">
                Created {result.created_count} lab day{result.created_count !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-1">
              {result.lab_days.map((ld: any) => (
                <div key={ld.id} className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  {ld.date} &mdash; Week {ld.week_number}: {ld.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template Card
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: LabTemplate;
  isAdmin: boolean;
  onEdit: (template: LabTemplate) => void;
  onDelete: (template: LabTemplate) => void;
}

function TemplateCard({ template, isAdmin, onEdit, onDelete }: TemplateCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Card header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white leading-tight truncate">
            Week {template.week_number}: {template.name}
          </h3>
          {template.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
              {template.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {template.program && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {template.program}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              <Layers className="w-3 h-3" />
              {template.stations.length} station{template.stations.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onEdit(template)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(template)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Station list */}
      {template.stations.length > 0 ? (
        <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {template.stations.map((station) => {
            const config = STATION_TYPE_CONFIG[station.station_type] || STATION_TYPE_CONFIG.custom;
            return (
              <li key={station.id || station.sort_order} className="flex items-center gap-2 px-4 py-2">
                <span className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded ${config.color}`}>
                  {config.icon}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
                  <span className="text-gray-400 dark:text-gray-500 mr-1">#{station.sort_order}</span>
                  {getStationLabel(station)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 italic">
          No stations defined
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function LabTemplatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [templates, setTemplates] = useState<LabTemplate[]>([]);
  const [fetchingTemplates, setFetchingTemplates] = useState(false);

  // Filters
  const [filterProgram, setFilterProgram] = useState('');
  const [filterSemester, setFilterSemester] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LabTemplate | null>(null);

  // Delete confirm
  const [deletingTemplate, setDeletingTemplate] = useState<LabTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) initPage();
  }, [session]);

  const initPage = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!hasMinRole(data.user.role, 'lead_instructor')) {
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
        await Promise.all([fetchScenarios(), fetchCohorts()]);
      }
    } catch (err) {
      console.error('Error initializing page:', err);
    }
    setLoading(false);
  };

  const fetchScenarios = async () => {
    try {
      const res = await fetch('/api/lab-management/scenarios?limit=100');
      const data = await res.json();
      if (data.success) setScenarios(data.scenarios || []);
    } catch (err) {
      console.error('Error fetching scenarios:', err);
    }
  };

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const data = await res.json();
      if (data.success) setCohorts(data.cohorts || []);
    } catch (err) {
      console.error('Error fetching cohorts:', err);
    }
  };

  const fetchTemplates = useCallback(async () => {
    setFetchingTemplates(true);
    try {
      const params = new URLSearchParams();
      if (filterProgram) params.set('program', filterProgram);
      if (filterSemester) params.set('semester', filterSemester);
      const res = await fetch(`/api/admin/lab-templates?${params}`);
      const data = await res.json();
      if (data.success) setTemplates(data.templates || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setFetchingTemplates(false);
    }
  }, [filterProgram, filterSemester]);

  useEffect(() => {
    if (currentUser) fetchTemplates();
  }, [currentUser, fetchTemplates]);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setShowModal(true);
  };

  const handleOpenEdit = (template: LabTemplate) => {
    setEditingTemplate(template);
    setShowModal(true);
  };

  const handleModalSaved = (_saved: LabTemplate) => {
    setShowModal(false);
    fetchTemplates();
  };

  const handleDeleteClick = (template: LabTemplate) => {
    setDeletingTemplate(template);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/lab-templates/${deletingTemplate.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delete failed');
      toast.success('Template deleted');
      setDeletingTemplate(null);
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  const isAdmin = currentUser ? canAccessAdmin(currentUser.role) : false;

  // Group templates by week number
  const groupedByWeek = templates.reduce<Record<number, LabTemplate[]>>((acc, t) => {
    const week = t.week_number || 1;
    if (!acc[week]) acc[week] = [];
    acc[week].push(t);
    return acc;
  }, {});
  const sortedWeeks = Object.keys(groupedByWeek)
    .map(Number)
    .sort((a, b) => a - b);

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">Admin</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-900 dark:text-white">Lab Template Library</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Lab Template Library
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Reusable lab day templates organized by program, semester, and week
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {isAdmin && (
                <button
                  onClick={handleOpenCreate}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  New Template
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Filter Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Program:</label>
              <input
                type="text"
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                placeholder="Filter by program"
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Semester:</label>
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Semesters</option>
                {SEMESTERS.map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>

            {fetchingTemplates && (
              <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            )}
          </div>
        </div>

        {/* Template List */}
        {!fetchingTemplates && templates.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 px-6 py-16 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              No templates found
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {filterProgram || filterSemester
                ? 'No templates match the current filters.'
                : 'Get started by creating your first lab template.'}
            </p>
            {isAdmin && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Create First Template
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {sortedWeeks.map((week) => (
              <div key={week}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Week {week}
                  </h2>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {groupedByWeek[week].length} template{groupedByWeek[week].length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {groupedByWeek[week].map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      isAdmin={isAdmin}
                      onEdit={handleOpenEdit}
                      onDelete={handleDeleteClick}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Apply to Cohort Section */}
        {isAdmin && <ApplySection cohorts={cohorts} />}
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <TemplateFormModal
          template={editingTemplate}
          scenarios={scenarios}
          onClose={() => setShowModal(false)}
          onSaved={handleModalSaved}
        />
      )}

      {/* Delete Confirmation */}
      {deletingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Template</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Are you sure you want to delete{' '}
              <strong>Week {deletingTemplate.week_number}: {deletingTemplate.name}</strong>?
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-5">
              This will also delete all {deletingTemplate.stations.length} station{deletingTemplate.stations.length !== 1 ? 's' : ''} in this template. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingTemplate(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
