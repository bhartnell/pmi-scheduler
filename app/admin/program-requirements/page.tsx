'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Settings,
  Save,
  History,
  AlertCircle,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Pencil,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProgramRequirement {
  id: string;
  program: string;
  requirement_type: string;
  category: string | null;
  required_value: number;
  version: number | null;
  effective_date: string;
  created_at: string;
  created_by: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROGRAMS = ['Paramedic', 'AEMT', 'EMT'] as const;
type Program = (typeof PROGRAMS)[number];

// Map display names to lowercase DB values
const PROGRAM_TO_DB: Record<Program, string> = {
  Paramedic: 'paramedic',
  AEMT: 'aemt',
  EMT: 'emt',
};

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'psych',        label: 'Psych' },
  { key: 'ed',           label: 'Emergency Dept' },
  { key: 'icu',          label: 'ICU' },
  { key: 'ob',           label: 'OB' },
  { key: 'or',           label: 'OR' },
  { key: 'peds_ed',      label: 'Peds ED' },
  { key: 'peds_icu',     label: 'Peds ICU' },
  { key: 'ems_field',    label: 'EMS Field' },
  { key: 'cardiology',   label: 'Cardiology' },
  { key: 'ems_ridealong',label: 'EMS Ridealong' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function findRequirement(
  reqs: ProgramRequirement[],
  program: string,
  type: string,
  category: string | null
): ProgramRequirement | undefined {
  return reqs.find(
    (r) =>
      r.program === program &&
      r.requirement_type === type &&
      (r.category ?? null) === category
  );
}

// ---------------------------------------------------------------------------
// Inline edit cell component
// ---------------------------------------------------------------------------

interface EditCellProps {
  req: ProgramRequirement | undefined;
  program: string;
  requirementType: string;
  category: string | null;
  label: string;
  unit: string;
  onSave: (params: {
    program: string;
    requirement_type: string;
    category: string | null;
    required_value: number;
  }) => Promise<void>;
}

function EditCell({ req, program, requirementType, category, label, unit, onSave }: EditCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(req?.required_value?.toString() ?? '0');
  const [saving, setSaving] = useState(false);

  // Sync value when req changes from outside
  useEffect(() => {
    if (!editing) {
      setValue(req?.required_value?.toString() ?? '0');
    }
  }, [req, editing]);

  const handleEdit = () => {
    setValue(req?.required_value?.toString() ?? '0');
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setValue(req?.required_value?.toString() ?? '0');
  };

  const handleSave = async () => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) return;
    setSaving(true);
    await onSave({ program, requirement_type: requirementType, category, required_value: parsed });
    setSaving(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
            {req?.effective_date && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Since {formatDate(req.effective_date)}
              </p>
            )}
          </div>
          <button
            onClick={handleEdit}
            title="Edit"
            className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {req?.required_value ?? 0}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{unit}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-400 dark:border-blue-600 p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">{label}</p>

      {/* Value input */}
      <div>
        <label className="text-xs text-blue-700 dark:text-blue-300 mb-1 block">
          Required {unit}
        </label>
        <input
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={handleCancel}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Version history section
// ---------------------------------------------------------------------------

interface HistoryEntry extends ProgramRequirement {}

function VersionHistory({ history, program }: { history: HistoryEntry[]; program: string }) {
  const [open, setOpen] = useState(false);

  const programHistory = history
    .filter((h) => h.program === program)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getCategoryLabel = (cat: string | null): string => {
    if (!cat) return '—';
    return CATEGORIES.find((c) => c.key === cat)?.label ?? cat;
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'clinical_hours': return 'Clinical Hours';
      case 'skills': return 'Skills Count';
      case 'scenarios': return 'Scenarios Count';
      default: return type;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="font-semibold text-gray-900 dark:text-white text-sm">
            Version History
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({programHistory.length} {programHistory.length === 1 ? 'entry' : 'entries'})
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        )}
      </button>

      {open && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {programHistory.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
              No history yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                      Category
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {programHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {getTypeLabel(entry.requirement_type)}
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                        {getCategoryLabel(entry.category)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">
                        {entry.required_value}
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400 hidden md:table-cell text-xs">
                        {entry.created_by ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ProgramRequirementsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeProgram, setActiveProgram] = useState<Program>('Paramedic');
  const [currentReqs, setCurrentReqs] = useState<ProgramRequirement[]>([]);
  const [historyReqs, setHistoryReqs] = useState<ProgramRequirement[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) fetchCurrentUser();
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!canAccessAdmin(data.user.role)) {
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
        await fetchRequirements();
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
    setLoading(false);
  };

  const fetchRequirements = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/program-requirements');
      const data = await res.json();
      if (data.success) {
        setCurrentReqs(data.requirements ?? []);
      }
    } catch (err) {
      console.error('Error fetching requirements:', err);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    if (historyReqs.length > 0) return; // already loaded
    setFetchingHistory(true);
    try {
      const res = await fetch('/api/admin/program-requirements?includeHistory=true');
      const data = await res.json();
      if (data.success) {
        setHistoryReqs(data.requirements ?? []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
    setFetchingHistory(false);
  }, [historyReqs.length]);

  // Fetch history when component mounts (after current reqs load)
  useEffect(() => {
    if (!loading && currentUser) {
      fetchHistory();
    }
  }, [loading, currentUser, fetchHistory]);

  const handleSave = useCallback(
    async (params: {
      program: string;
      requirement_type: string;
      category: string | null;
      required_value: number;
    }) => {
      try {
        const res = await fetch('/api/admin/program-requirements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program: params.program,
            requirement_type: params.requirement_type,
            category: params.category,
            required_value: params.required_value,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error ?? 'Save failed');

        // Refresh current reqs and invalidate history cache
        await fetchRequirements();
        setHistoryReqs([]); // will be refetched
        fetchHistory();

        toast.success('Requirement updated successfully');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save requirement');
        throw err; // re-throw so EditCell knows to stay open
      }
    },
    [fetchRequirements, fetchHistory, toast]
  );

  // Derive per-program current requirements using lowercase DB value
  const activeProgramDb = PROGRAM_TO_DB[activeProgram];
  const programCurrentReqs = currentReqs.filter((r) => r.program === activeProgramDb);

  const getReq = (type: string, category: string | null) =>
    findRequirement(programCurrentReqs, activeProgramDb, type, category);

  const skillsReq = getReq('skills', null);
  const scenariosReq = getReq('scenarios', null);

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Program Requirements</span>
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Program Requirements
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Configure required clinical hours, skills, and scenarios per program
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">Version-tracked requirements</p>
            <p className="text-blue-800 dark:text-blue-200 mt-0.5">
              Each change creates a new record with a date stamp. Old values are preserved for
              auditing. The most recent value is used as the current requirement.
            </p>
          </div>
        </div>

        {/* Program tabs */}
        <div className="flex gap-1 p-1 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 w-fit">
          {PROGRAMS.map((prog) => (
            <button
              key={prog}
              onClick={() => setActiveProgram(prog)}
              className={`px-5 py-2 text-sm font-medium rounded-md transition-colors ${
                activeProgram === prog
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {prog}
            </button>
          ))}
        </div>

        {/* ================================================================
            Clinical Hours Section
        ================================================================ */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Save className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Clinical Hours Requirements &mdash; {activeProgram}
            </h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map(({ key, label }) => (
              <EditCell
                key={`${activeProgram}-${key}`}
                req={getReq('clinical_hours', key)}
                program={activeProgramDb}
                requirementType="clinical_hours"
                category={key}
                label={label}
                unit="hours"
                onSave={handleSave}
              />
            ))}
          </div>
        </div>

        {/* ================================================================
            Skills & Scenarios Section
        ================================================================ */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Check className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Skills &amp; Scenarios &mdash; {activeProgram}
            </h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <EditCell
              key={`${activeProgram}-skills`}
              req={skillsReq}
              program={activeProgramDb}
              requirementType="skills"
              category={null}
              label="Required Skills"
              unit="skills"
              onSave={handleSave}
            />
            <EditCell
              key={`${activeProgram}-scenarios`}
              req={scenariosReq}
              program={activeProgramDb}
              requirementType="scenarios"
              category={null}
              label="Required Scenarios"
              unit="scenarios"
              onSave={handleSave}
            />
          </div>
        </div>

        {/* ================================================================
            Version History Section
        ================================================================ */}
        {fetchingHistory ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400 dark:text-gray-500 mr-2" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Loading history...</span>
          </div>
        ) : (
          <VersionHistory
            history={historyReqs}
            program={activeProgramDb}
          />
        )}
      </main>
    </div>
  );
}
