'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Target,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  Unlink,
  Plus,
  Edit2,
  Trash2,
  Star,
  Wand2,
  X,
  Check,
  ChevronRight,
} from 'lucide-react';
import { hasMinRole, type Role } from '@/lib/permissions';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * SMC admin page.
 *
 * Lets lead_instructor+ manage smc_requirements:
 *   - Filter by program / semester / link status
 *   - Link unlinked rows to the skills catalog (search picker)
 *   - Edit / add / soft-delete rows
 *   - Bulk auto-link via fuzzy suggestions
 *
 * Phase 2 of the SMC initiative (Phase 1 seeded 132 rows, 59 unlinked).
 */

interface SmcRow {
  id: string;
  program_id: string;
  semester: number;
  skill_id: string | null;
  skill_name: string;
  category: string | null;
  min_attempts: number;
  is_platinum: boolean;
  /** EMT: week number 1-14 when skill is introduced. Null for AEMT/Paramedic. */
  week_number: number | null;
  /** AEMT: CoAEMSP skills marked * allow simulation toward min_attempts. */
  sim_permitted: boolean;
  notes: string | null;
  display_order: number;
  is_active: boolean;
  linked_skill: { id: string; name: string; category: string | null } | null;
}

interface Program {
  id: string;
  name: string;
  abbreviation: string;
}

interface Skill {
  id: string;
  name: string;
  category: string | null;
  certification_levels: string[] | null;
  cert_levels: string[] | null;
}

interface ListResponse {
  success: boolean;
  rows?: SmcRow[];
  programs?: Program[];
  skills?: Skill[];
  error?: string;
}

interface SuggestionCandidate {
  skill_id: string;
  skill_name: string;
  category: string | null;
  confidence: number;
  method: 'exact' | 'contains' | 'fuzzy';
}

interface Suggestion {
  smc_id: string;
  program_id: string;
  semester: number;
  skill_name: string;
  category: string | null;
  candidates: SuggestionCandidate[];
  top_candidate: SuggestionCandidate | null;
}

interface SuggestResponse {
  success: boolean;
  suggestions?: Suggestion[];
  summary?: {
    total_unlinked: number;
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
    no_suggestions: number;
  };
  error?: string;
}

type LinkFilter = 'all' | 'linked' | 'unlinked';

export default function SmcAdminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<SmcRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(
    null
  );

  // Filters (can be set via query params on page load — cohort hub deep link)
  const [programFilter, setProgramFilter] = useState<string>(
    searchParams?.get('program_id') || 'all'
  );
  const [semesterFilter, setSemesterFilter] = useState<string>(
    searchParams?.get('semester') || 'all'
  );
  const [linkFilter, setLinkFilter] = useState<LinkFilter>(
    (searchParams?.get('link_status') as LinkFilter) || 'all'
  );
  const [search, setSearch] = useState('');

  // Modal state
  const [editingRow, setEditingRow] = useState<SmcRow | null>(null);
  const [addingFor, setAddingFor] = useState<{
    program_id: string;
    semester: number;
  } | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);

  // Access gate
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (!session?.user?.email) return;
    fetch('/api/instructor/me')
      .then((r) => r.json())
      .then((data) => {
        const role = (data.user?.role || data.role) as Role;
        setUserRole(role);
        if (!hasMinRole(role, 'lead_instructor')) {
          router.push('/');
        } else {
          setAccessChecked(true);
        }
      })
      .catch(() => router.push('/'));
  }, [session, sessionStatus, router]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchList = useCallback(async () => {
    if (!accessChecked) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (programFilter !== 'all') qs.set('program_id', programFilter);
      if (semesterFilter !== 'all') qs.set('semester', semesterFilter);
      if (linkFilter !== 'all') qs.set('link_status', linkFilter);
      const res = await fetch(
        `/api/lab-management/smc-admin${
          qs.toString() ? `?${qs.toString()}` : ''
        }`
      );
      const json: ListResponse = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load');
      } else {
        setRows(json.rows || []);
        setPrograms(json.programs || []);
        setSkills(json.skills || []);
      }
    } catch {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  }, [accessChecked, programFilter, semesterFilter, linkFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Lookup maps
  const programById = useMemo(() => {
    const m = new Map<string, Program>();
    for (const p of programs) m.set(p.id, p);
    return m;
  }, [programs]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.skill_name.toLowerCase().includes(q) ||
        (r.linked_skill?.name.toLowerCase().includes(q) ?? false) ||
        (r.category?.toLowerCase().includes(q) ?? false)
    );
  }, [rows, search]);

  const grouped = useMemo(() => {
    const g = new Map<string, SmcRow[]>();
    for (const r of filteredRows) {
      const key = `${r.program_id}|${r.semester}`;
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(r);
    }
    return g;
  }, [filteredRows]);

  const counts = useMemo(() => {
    const c = { total: 0, linked: 0, unlinked: 0, inactive: 0 };
    for (const r of rows) {
      c.total++;
      if (!r.is_active) c.inactive++;
      else if (r.skill_id) c.linked++;
      else c.unlinked++;
    }
    return c;
  }, [rows]);

  const handleSaveRow = async (
    id: string,
    patch: Partial<SmcRow>
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/lab-management/smc-admin/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setToast({ msg: json.error || 'Save failed', kind: 'err' });
        return false;
      }
      setToast({ msg: 'Saved', kind: 'ok' });
      await fetchList();
      return true;
    } catch {
      setToast({ msg: 'Save failed', kind: 'err' });
      return false;
    }
  };

  const handleCreate = async (row: Partial<SmcRow>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/lab-management/smc-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setToast({ msg: json.error || 'Create failed', kind: 'err' });
        return false;
      }
      setToast({ msg: 'Added', kind: 'ok' });
      await fetchList();
      return true;
    } catch {
      setToast({ msg: 'Create failed', kind: 'err' });
      return false;
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this SMC requirement? It will no longer count toward coverage.')) {
      return;
    }
    try {
      const res = await fetch(`/api/lab-management/smc-admin/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setToast({ msg: json.error || 'Delete failed', kind: 'err' });
        return;
      }
      setToast({ msg: 'Deactivated', kind: 'ok' });
      await fetchList();
    } catch {
      setToast({ msg: 'Delete failed', kind: 'err' });
    }
  };

  if (!accessChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/academics"
              className="flex items-center gap-1 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                SMC Administration
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage minimum competency requirements per program & semester
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSuggestOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              <Wand2 className="w-4 h-4" />
              <span className="hidden sm:inline">Auto-link suggestions</span>
            </button>
            <button
              onClick={() => {
                // Add picker defaults to current filter if set
                setAddingFor({
                  program_id:
                    programFilter !== 'all'
                      ? programFilter
                      : programs[0]?.id || '',
                  semester:
                    semesterFilter !== 'all' ? parseInt(semesterFilter, 10) : 1,
                });
              }}
              disabled={!programs.length}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add requirement</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={counts.total} />
          <StatCard label="Linked" value={counts.linked} tone="ok" />
          <StatCard label="Unlinked" value={counts.unlinked} tone="warn" />
          <StatCard label="Inactive" value={counts.inactive} tone="muted" />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skill name, category, or linked skill..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FilterGroup label="Program">
              <FilterButton
                active={programFilter === 'all'}
                onClick={() => setProgramFilter('all')}
              >
                All
              </FilterButton>
              {programs.map((p) => (
                <FilterButton
                  key={p.id}
                  active={programFilter === p.id}
                  onClick={() => setProgramFilter(p.id)}
                >
                  {p.abbreviation}
                </FilterButton>
              ))}
            </FilterGroup>
            <FilterGroup label="Semester">
              <FilterButton
                active={semesterFilter === 'all'}
                onClick={() => setSemesterFilter('all')}
              >
                All
              </FilterButton>
              {['1', '2', '3', '4'].map((s) => (
                <FilterButton
                  key={s}
                  active={semesterFilter === s}
                  onClick={() => setSemesterFilter(s)}
                >
                  {s}
                </FilterButton>
              ))}
            </FilterGroup>
            <FilterGroup label="Status">
              {(['all', 'linked', 'unlinked'] as LinkFilter[]).map((f) => (
                <FilterButton
                  key={f}
                  active={linkFilter === f}
                  onClick={() => setLinkFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </FilterButton>
              ))}
            </FilterGroup>
          </div>
        </div>

        {/* Rows (grouped by program/semester) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {error && (
            <div className="px-4 py-6 text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          {loading && !rows.length && (
            <div className="px-4 py-12 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading...
            </div>
          )}
          {!loading && filteredRows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              No SMC requirements match your filter.
            </div>
          )}
          {[...grouped.entries()].map(([key, groupRows]) => {
            const [progId, semStr] = key.split('|');
            const prog = programById.get(progId);
            return (
              <div key={key} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/40 flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {prog?.abbreviation || 'Unknown'} · Semester {semStr}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {groupRows.length} skill
                    {groupRows.length === 1 ? '' : 's'}
                  </div>
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {groupRows.map((r) => (
                    <RowCard
                      key={r.id}
                      row={r}
                      onEdit={() => setEditingRow(r)}
                      onDeactivate={() => handleDeactivate(r.id)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </main>

      {/* Edit modal */}
      {editingRow && (
        <EditRowModal
          row={editingRow}
          skills={skills}
          onClose={() => setEditingRow(null)}
          onSave={async (patch) => {
            const ok = await handleSaveRow(editingRow.id, patch);
            if (ok) setEditingRow(null);
          }}
        />
      )}

      {/* Add modal */}
      {addingFor && (
        <AddRowModal
          programs={programs}
          skills={skills}
          defaultProgramId={addingFor.program_id}
          defaultSemester={addingFor.semester}
          onClose={() => setAddingFor(null)}
          onSave={async (row) => {
            const ok = await handleCreate(row);
            if (ok) setAddingFor(null);
          }}
        />
      )}

      {/* Suggestions modal */}
      {suggestOpen && (
        <SuggestionsModal
          programFilter={programFilter}
          semesterFilter={semesterFilter}
          programs={programs}
          onClose={() => setSuggestOpen(false)}
          onRefresh={fetchList}
          setToast={setToast}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
            toast.kind === 'ok'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'ok' | 'warn' | 'muted';
}) {
  const toneClasses = {
    default: 'text-gray-900 dark:text-white',
    ok: 'text-green-600 dark:text-green-400',
    warn: 'text-amber-600 dark:text-amber-400',
    muted: 'text-gray-500 dark:text-gray-400',
  }[tone];
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${toneClasses}`}>{value}</div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        {label}:
      </span>
      {children}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-medium ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      {children}
    </button>
  );
}

function RowCard({
  row,
  onEdit,
  onDeactivate,
}: {
  row: SmcRow;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  const linked = !!row.skill_id;
  return (
    <li
      className={`px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
        !row.is_active ? 'opacity-50' : ''
      }`}
    >
      <div className="flex-shrink-0">
        {linked ? (
          <LinkIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
        ) : (
          <Unlink className="w-4 h-4 text-amber-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {typeof row.week_number === 'number' && row.week_number > 0 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 tabular-nums"
              title={`Introduced in week ${row.week_number}`}
            >
              Wk {row.week_number}
            </span>
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {row.skill_name}
          </span>
          {row.sim_permitted && (
            <span
              className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              title="Simulation permitted toward minimum attempts"
            >
              sim ok
            </span>
          )}
          {row.is_platinum && (
            <span className="inline-flex items-center gap-0.5 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Star className="w-2.5 h-2.5 fill-current" />
              platinum
            </span>
          )}
          {!row.is_active && (
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              inactive
            </span>
          )}
          {row.min_attempts > 1 && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              min {row.min_attempts}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
          {row.category && <span>{row.category}</span>}
          {row.linked_skill && (
            <>
              {row.category && <span>·</span>}
              <ChevronRight className="w-3 h-3" />
              <span className="text-green-700 dark:text-green-300">
                {row.linked_skill.name}
              </span>
            </>
          )}
          {!linked && (
            <span className="text-amber-600 dark:text-amber-400">
              — not linked to catalog
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"
          title="Edit"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        {row.is_active && (
          <button
            onClick={onDeactivate}
            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Deactivate"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </li>
  );
}

function EditRowModal({
  row,
  skills,
  onClose,
  onSave,
}: {
  row: SmcRow;
  skills: Skill[];
  onClose: () => void;
  onSave: (patch: Partial<SmcRow>) => Promise<void>;
}) {
  const [skillName, setSkillName] = useState(row.skill_name);
  const [skillId, setSkillId] = useState<string | null>(row.skill_id);
  const [category, setCategory] = useState(row.category || '');
  const [minAttempts, setMinAttempts] = useState(row.min_attempts);
  const [isPlatinum, setIsPlatinum] = useState(row.is_platinum);
  const [simPermitted, setSimPermitted] = useState(row.sim_permitted || false);
  const [weekNumber, setWeekNumber] = useState<string>(
    row.week_number != null ? String(row.week_number) : ''
  );
  const [notes, setNotes] = useState(row.notes || '');
  const [isActive, setIsActive] = useState(row.is_active);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    await onSave({
      skill_name: skillName,
      skill_id: skillId,
      category: category || null,
      min_attempts: minAttempts,
      is_platinum: isPlatinum,
      sim_permitted: simPermitted,
      week_number: weekNumber ? parseInt(weekNumber, 10) : null,
      notes: notes || null,
      is_active: isActive,
    });
    setSaving(false);
  };

  return (
    <ModalShell title="Edit SMC requirement" onClose={onClose}>
      <div className="space-y-3">
        <FormField label="Skill name">
          <input
            type="text"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </FormField>
        <FormField label="Linked skill (catalog)">
          <SkillPicker
            skills={skills}
            value={skillId}
            onChange={setSkillId}
          />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Category">
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </FormField>
          <FormField label="Min attempts">
            <input
              type="number"
              min={1}
              value={minAttempts}
              onChange={(e) =>
                setMinAttempts(parseInt(e.target.value, 10) || 1)
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </FormField>
          <FormField label="Week (EMT)">
            <input
              type="number"
              min={1}
              max={52}
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
              placeholder="—"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </FormField>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={isPlatinum}
              onChange={(e) => setIsPlatinum(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            Platinum skill
          </label>
          <label
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
            title="AEMT CoAEMSP: simulation counts toward minimum attempts"
          >
            <input
              type="checkbox"
              checked={simPermitted}
              onChange={(e) => setSimPermitted(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            Sim permitted (AEMT)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            Active
          </label>
        </div>
        <FormField label="Notes">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onClose}
          className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !skillName.trim()}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </ModalShell>
  );
}

function AddRowModal({
  programs,
  skills,
  defaultProgramId,
  defaultSemester,
  onClose,
  onSave,
}: {
  programs: Program[];
  skills: Skill[];
  defaultProgramId: string;
  defaultSemester: number;
  onClose: () => void;
  onSave: (row: Partial<SmcRow>) => Promise<void>;
}) {
  const [programId, setProgramId] = useState(defaultProgramId);
  const [semester, setSemester] = useState(defaultSemester);
  const [skillName, setSkillName] = useState('');
  const [skillId, setSkillId] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [minAttempts, setMinAttempts] = useState(1);
  const [isPlatinum, setIsPlatinum] = useState(false);
  const [saving, setSaving] = useState(false);

  // When user picks a catalog skill, default the skill_name to the catalog name
  const handlePickSkill = (id: string | null) => {
    setSkillId(id);
    if (id) {
      const s = skills.find((k) => k.id === id);
      if (s) {
        if (!skillName.trim()) setSkillName(s.name);
        if (!category.trim() && s.category) setCategory(s.category);
      }
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    await onSave({
      program_id: programId,
      semester,
      skill_name: skillName,
      skill_id: skillId,
      category: category || null,
      min_attempts: minAttempts,
      is_platinum: isPlatinum,
    });
    setSaving(false);
  };

  return (
    <ModalShell title="Add SMC requirement" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Program">
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.abbreviation}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Semester">
            <select
              value={semester}
              onChange={(e) => setSemester(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              {[1, 2, 3, 4].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField label="Catalog skill (optional — pick to auto-fill)">
          <SkillPicker skills={skills} value={skillId} onChange={handlePickSkill} />
        </FormField>
        <FormField label="Skill name (as it appears on the SMC)">
          <input
            type="text"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Category">
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </FormField>
          <FormField label="Min attempts">
            <input
              type="number"
              min={1}
              value={minAttempts}
              onChange={(e) => setMinAttempts(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={isPlatinum}
            onChange={(e) => setIsPlatinum(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          Platinum skill
        </label>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onClose}
          className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !skillName.trim() || !programId}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
    </ModalShell>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function SkillPicker({
  skills,
  value,
  onChange,
}: {
  skills: Skill[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = value ? skills.find((s) => s.id === value) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills.slice(0, 30);
    return skills
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.category?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 30);
  }, [skills, query]);

  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2 text-sm border border-green-300 dark:border-green-700 rounded bg-green-50 dark:bg-green-900/20">
          <LinkIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="flex-1 text-gray-900 dark:text-white">
            {selected.name}
          </span>
          {selected.category && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {selected.category}
            </span>
          )}
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search skills catalog or leave empty for no match"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
          {open && (
            <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-10">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No matches
                </div>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onChange(s.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-between"
                  >
                    <span className="text-gray-900 dark:text-white">
                      {s.name}
                    </span>
                    {s.category && (
                      <span className="text-xs text-gray-500">
                        {s.category}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SuggestionsModal({
  programFilter,
  semesterFilter,
  programs,
  onClose,
  onRefresh,
  setToast,
}: {
  programFilter: string;
  semesterFilter: string;
  programs: Program[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  setToast: (t: { msg: string; kind: 'ok' | 'err' }) => void;
}) {
  const [data, setData] = useState<SuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const programById = useMemo(() => {
    const m = new Map<string, Program>();
    for (const p of programs) m.set(p.id, p);
    return m;
  }, [programs]);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (programFilter !== 'all') qs.set('program_id', programFilter);
      if (semesterFilter !== 'all') qs.set('semester', semesterFilter);
      const res = await fetch(
        `/api/lab-management/smc-admin/suggest-matches${
          qs.toString() ? `?${qs.toString()}` : ''
        }`
      );
      const json: SuggestResponse = await res.json();
      setData(json);
    } catch {
      setToast({ msg: 'Failed to load suggestions', kind: 'err' });
    } finally {
      setLoading(false);
    }
  }, [programFilter, semesterFilter, setToast]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const confirmOne = async (smcId: string, skillId: string) => {
    setProcessing(smcId);
    try {
      const res = await fetch(`/api/lab-management/smc-admin/${smcId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_id: skillId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setToast({ msg: json.error || 'Link failed', kind: 'err' });
        return;
      }
      setToast({ msg: 'Linked', kind: 'ok' });
      setDismissed((prev) => new Set(prev).add(smcId));
    } catch {
      setToast({ msg: 'Link failed', kind: 'err' });
    } finally {
      setProcessing(null);
    }
  };

  const confirmAllHighConfidence = async () => {
    if (!data?.suggestions) return;
    const high = data.suggestions.filter(
      (s) =>
        s.top_candidate &&
        s.top_candidate.confidence >= 0.9 &&
        !dismissed.has(s.smc_id)
    );
    if (!high.length) {
      setToast({ msg: 'No high-confidence suggestions', kind: 'err' });
      return;
    }
    if (
      !confirm(
        `Link ${high.length} high-confidence suggestion${high.length === 1 ? '' : 's'} in one go?`
      )
    ) {
      return;
    }
    let ok = 0;
    let failed = 0;
    for (const s of high) {
      if (!s.top_candidate) continue;
      try {
        const res = await fetch(`/api/lab-management/smc-admin/${s.smc_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skill_id: s.top_candidate.skill_id }),
        });
        if (res.ok) {
          ok++;
          setDismissed((prev) => new Set(prev).add(s.smc_id));
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
    setToast({
      msg: `Linked ${ok}${failed ? `, ${failed} failed` : ''}`,
      kind: failed ? 'err' : 'ok',
    });
  };

  const visible = (data?.suggestions || []).filter(
    (s) => !dismissed.has(s.smc_id)
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-600" />
              Auto-link suggestions
            </h3>
            {data?.summary && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {data.summary.total_unlinked} unlinked · {data.summary.high_confidence} high
                confidence · {data.summary.medium_confidence} medium ·{' '}
                {data.summary.low_confidence} low · {data.summary.no_suggestions} no match
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {data?.summary && data.summary.high_confidence > 0 && (
          <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-purple-900 dark:text-purple-200">
              {data.summary.high_confidence} high-confidence match
              {data.summary.high_confidence === 1 ? '' : 'es'} ready to bulk-link.
            </span>
            <button
              onClick={confirmAllHighConfidence}
              className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 font-medium"
            >
              Link all high-confidence
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="px-4 py-12 flex items-center justify-center text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Scanning catalog...
            </div>
          )}
          {!loading && visible.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {dismissed.size > 0
                ? 'All suggestions processed. Close to refresh the list.'
                : 'No unlinked SMC requirements in this scope.'}
            </div>
          )}
          {!loading &&
            visible.map((s) => {
              const prog = programById.get(s.program_id);
              const cand = s.top_candidate;
              return (
                <div
                  key={s.smc_id}
                  className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {s.skill_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {prog?.abbreviation} · Sem {s.semester}
                        {s.category && <> · {s.category}</>}
                      </div>
                    </div>
                  </div>
                  {cand ? (
                    <div className="ml-3 space-y-1">
                      {s.candidates.map((c) => {
                        const isTop = c.skill_id === cand.skill_id;
                        return (
                          <div
                            key={c.skill_id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                              isTop
                                ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                            }`}
                          >
                            <ConfidenceBadge confidence={c.confidence} />
                            <span className="text-xs text-gray-500 uppercase">
                              {c.method}
                            </span>
                            <span className="flex-1 text-gray-900 dark:text-white truncate">
                              → {c.skill_name}
                            </span>
                            <button
                              onClick={() => confirmOne(s.smc_id, c.skill_id)}
                              disabled={processing === s.smc_id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" />
                              Link
                            </button>
                          </div>
                        );
                      })}
                      <button
                        onClick={() =>
                          setDismissed((prev) => new Set(prev).add(s.smc_id))
                        }
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mt-1"
                      >
                        Skip (no match in catalog)
                      </button>
                    </div>
                  ) : (
                    <div className="ml-3 flex items-center gap-2 text-xs text-gray-500">
                      <AlertCircle className="w-3.5 h-3.5" />
                      No similar skill found in catalog
                      <button
                        onClick={() =>
                          setDismissed((prev) => new Set(prev).add(s.smc_id))
                        }
                        className="ml-auto text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
          <button
            onClick={async () => {
              await onRefresh();
              onClose();
            }}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.9
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : confidence >= 0.6
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return (
    <span
      className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded tabular-nums ${color}`}
    >
      {pct}%
    </span>
  );
}
