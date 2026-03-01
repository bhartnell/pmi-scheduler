'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  BarChart2,
  Play,
  Save,
  Download,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Trash2,
  FileText,
  Share2,
  RefreshCw,
  Check,
  GripVertical,
} from 'lucide-react';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean';
}

interface DataSourceDef {
  key: string;
  label: string;
  columns: ColumnDef[];
}

interface FilterRow {
  id: string;
  column: string;
  operator: string;
  value: string;
  value2: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string | null;
  data_source: string;
  columns: string[];
  filters: FilterRow[];
  sort_by: string | null;
  sort_direction: string;
  group_by: string | null;
  is_shared: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ReportResult {
  data: Record<string, unknown>[];
  total_count: number | null;
  columns: string[];
  source_label: string;
}

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'lt', label: 'Less Than' },
  { value: 'between', label: 'Between' },
  { value: 'is_null', label: 'Is Empty' },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────

export default function ReportBuilderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Schema
  const [schema, setSchema] = useState<DataSourceDef[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);

  // Builder state
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [sortBy, setSortBy] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [groupBy, setGroupBy] = useState('');

  // Results
  const [result, setResult] = useState<ReportResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Save template modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [saveShared, setSaveShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Current template being edited
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Templates sidebar
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // Drag state for column reordering
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ── Auth guard ──────────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // ── Load schema ──────────────────────────────────
  useEffect(() => {
    if (!session) return;
    setSchemaLoading(true);
    fetch('/api/reports/builder?action=schema')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSchema(d.schema || []);
      })
      .catch(() => {})
      .finally(() => setSchemaLoading(false));
  }, [session]);

  // ── Load templates ───────────────────────────────
  const loadTemplates = useCallback(() => {
    if (!session) return;
    setTemplatesLoading(true);
    fetch('/api/reports/builder?action=templates')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setTemplates(d.templates || []);
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, [session]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ── Derived source info ──────────────────────────
  const sourceDef = schema.find((s) => s.key === selectedSource) ?? null;
  const availableColumns = sourceDef?.columns ?? [];

  // ── Handle source change ─────────────────────────
  const handleSourceChange = (src: string) => {
    setSelectedSource(src);
    setSelectedColumns([]);
    setFilters([]);
    setSortBy('');
    setGroupBy('');
    setResult(null);
    setRunError(null);
    setEditingTemplateId(null);
  };

  // ── Toggle column ────────────────────────────────
  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(availableColumns.map((c) => c.key));
  };

  const clearAllColumns = () => {
    setSelectedColumns([]);
  };

  // ── Column drag-reorder ──────────────────────────
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const reordered = [...selectedColumns];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    setSelectedColumns(reordered);
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // Move column up/down
  const moveColumn = (idx: number, dir: 'up' | 'down') => {
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= selectedColumns.length) return;
    const reordered = [...selectedColumns];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    setSelectedColumns(reordered);
  };

  // ── Filters ──────────────────────────────────────
  const addFilter = () => {
    setFilters((prev) => [
      ...prev,
      { id: uid(), column: availableColumns[0]?.key || '', operator: 'equals', value: '', value2: '' },
    ]);
  };

  const updateFilter = (id: string, field: keyof FilterRow, val: string) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: val } : f)));
  };

  const removeFilter = (id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  // ── Run report ───────────────────────────────────
  const handleRun = async () => {
    if (!selectedSource) return;
    setRunning(true);
    setRunError(null);
    setResult(null);

    try {
      const params = new URLSearchParams();
      params.set('action', 'run');
      params.set('data_source', selectedSource);
      selectedColumns.forEach((c) => params.append('columns[]', c));
      if (filters.length > 0) {
        params.set('filters', JSON.stringify(filters));
      }
      if (sortBy) {
        params.set('sort_by', sortBy);
        params.set('sort_direction', sortDirection);
      }
      if (groupBy) params.set('group_by', groupBy);
      params.set('limit', '50');

      const res = await fetch(`/api/reports/builder?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setRunError(data.error || 'Failed to run report');
      } else {
        setResult(data);
      }
    } catch {
      setRunError('Failed to run report. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  // ── Save template ─────────────────────────────────
  const handleSaveTemplate = async () => {
    if (!saveName.trim() || !selectedSource) return;
    setSaving(true);
    setSaveError(null);

    try {
      const payload = {
        id: editingTemplateId || undefined,
        name: saveName.trim(),
        description: saveDesc.trim() || null,
        data_source: selectedSource,
        columns: selectedColumns,
        filters,
        sort_by: sortBy || null,
        sort_direction: sortDirection,
        group_by: groupBy || null,
        is_shared: saveShared,
      };

      const method = editingTemplateId ? 'PUT' : 'POST';
      const res = await fetch('/api/reports/builder', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSaveError(data.error || 'Failed to save template');
      } else {
        setShowSaveModal(false);
        setSaveName('');
        setSaveDesc('');
        setSaveShared(false);
        if (data.template?.id) setEditingTemplateId(data.template.id);
        loadTemplates();
      }
    } catch {
      setSaveError('Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  // ── Load template ─────────────────────────────────
  const handleLoadTemplate = (tmpl: ReportTemplate) => {
    setSelectedSource(tmpl.data_source);
    setSelectedColumns(tmpl.columns || []);
    setFilters(
      (tmpl.filters || []).map((f: FilterRow) => ({
        ...f,
        id: f.id || uid(),
        value2: f.value2 || '',
      }))
    );
    setSortBy(tmpl.sort_by || '');
    setSortDirection((tmpl.sort_direction as 'asc' | 'desc') || 'asc');
    setGroupBy(tmpl.group_by || '');
    setEditingTemplateId(tmpl.id);
    setSaveName(tmpl.name);
    setSaveDesc(tmpl.description || '');
    setSaveShared(tmpl.is_shared);
    setResult(null);
    setRunError(null);
  };

  // ── Delete template ───────────────────────────────
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      const res = await fetch(`/api/reports/builder?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (editingTemplateId === id) {
          setEditingTemplateId(null);
          setSaveName('');
        }
        loadTemplates();
      }
    } catch {
      // silent
    }
  };

  // ── Export CSV ────────────────────────────────────
  const handleExportCSV = () => {
    if (!result || result.data.length === 0) return;
    const cols = result.columns;
    const headers = cols.map((c) => {
      const colDef = availableColumns.find((a) => a.key === c);
      return colDef ? colDef.label : c;
    });
    const rows = result.data.map((row) =>
      cols.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return '';
        return String(v).replace(/"/g, '""');
      })
    );
    const csv = [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${selectedSource}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!result || result.data.length === 0) return;
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${selectedSource}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render helpers ─────────────────────────────────
  const getColumnLabel = (key: string) => {
    return availableColumns.find((c) => c.key === key)?.label ?? key;
  };

  const formatCellValue = (val: unknown): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const myTemplates = templates.filter((t) => t.created_by === session?.user?.email);
  const sharedTemplates = templates.filter(
    (t) => t.is_shared && t.created_by !== session?.user?.email
  );

  if (status === 'loading' || schemaLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-5">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Reports</span>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Custom Report Builder</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <BarChart2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Custom Report Builder</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select a data source, choose columns, add filters, and run or save your report
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 py-6">
        <div className="flex gap-4 items-start">
          {/* ── Left: Templates sidebar ── */}
          <div className="w-64 flex-shrink-0 space-y-3">
            {/* My Templates */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  My Templates
                </h2>
                {templatesLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
              </div>
              <div className="divide-y dark:divide-gray-700">
                {myTemplates.length === 0 && (
                  <p className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
                    No saved templates yet
                  </p>
                )}
                {myTemplates.map((tmpl) => (
                  <TemplateItem
                    key={tmpl.id}
                    tmpl={tmpl}
                    isActive={editingTemplateId === tmpl.id}
                    onLoad={() => handleLoadTemplate(tmpl)}
                    onRun={() => {
                      handleLoadTemplate(tmpl);
                      setTimeout(() => handleRun(), 100);
                    }}
                    onDelete={() => handleDeleteTemplate(tmpl.id)}
                    showDelete
                  />
                ))}
              </div>
            </div>

            {/* Shared Templates */}
            {sharedTemplates.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b dark:border-gray-700">
                  <Share2 className="w-4 h-4 text-green-500" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Shared Templates</h2>
                </div>
                <div className="divide-y dark:divide-gray-700">
                  {sharedTemplates.map((tmpl) => (
                    <TemplateItem
                      key={tmpl.id}
                      tmpl={tmpl}
                      isActive={editingTemplateId === tmpl.id}
                      onLoad={() => handleLoadTemplate(tmpl)}
                      onRun={() => {
                        handleLoadTemplate(tmpl);
                        setTimeout(() => handleRun(), 100);
                      }}
                      onDelete={() => handleDeleteTemplate(tmpl.id)}
                      showDelete={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Center: Builder ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Data Source */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                1. Data Source
              </h2>
              <div className="flex flex-wrap gap-2">
                {schema.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => handleSourceChange(s.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      selectedSource === s.key
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Columns */}
            {sourceDef && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    2. Columns
                    {selectedColumns.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        ({selectedColumns.length} selected)
                      </span>
                    )}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllColumns}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <button
                      onClick={clearAllColumns}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {availableColumns.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-purple-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                        {col.label}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {col.type}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Column order (drag to reorder) */}
                {selectedColumns.length > 1 && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Drag to reorder columns:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedColumns.map((colKey, idx) => (
                        <div
                          key={colKey}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={() => handleDrop(idx)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium cursor-grab select-none transition-all ${
                            dragOverIdx === idx
                              ? 'bg-purple-100 dark:bg-purple-900/40 border-2 border-purple-400'
                              : 'bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <GripVertical className="w-3 h-3 text-gray-400" />
                          {getColumnLabel(colKey)}
                          <div className="flex gap-0.5 ml-1">
                            <button
                              onClick={() => moveColumn(idx, 'up')}
                              disabled={idx === 0}
                              className="disabled:opacity-30 hover:text-purple-600 dark:hover:text-purple-400"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => moveColumn(idx, 'down')}
                              disabled={idx === selectedColumns.length - 1}
                              className="disabled:opacity-30 hover:text-purple-600 dark:hover:text-purple-400"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => toggleColumn(colKey)}
                            className="hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Filters */}
            {sourceDef && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    3. Filters
                    {filters.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        ({filters.length} filter{filters.length !== 1 ? 's' : ''}, AND logic)
                      </span>
                    )}
                  </h2>
                  <button
                    onClick={addFilter}
                    className="flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    <Plus className="w-4 h-4" />
                    Add Filter
                  </button>
                </div>

                {filters.length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                    No filters applied — all records will be returned
                  </p>
                )}

                <div className="space-y-2">
                  {filters.map((f) => (
                    <FilterRowComponent
                      key={f.id}
                      filter={f}
                      columns={availableColumns}
                      onChange={(field, val) => updateFilter(f.id, field as keyof FilterRow, val)}
                      onRemove={() => removeFilter(f.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Sort & Group */}
            {sourceDef && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  4. Sort & Group
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">— No Sort —</option>
                      {availableColumns.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Direction
                    </label>
                    <select
                      value={sortDirection}
                      onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      disabled={!sortBy}
                    >
                      <option value="asc">Ascending (A to Z)</option>
                      <option value="desc">Descending (Z to A)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Group By
                    </label>
                    <select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">— No Grouping —</option>
                      {availableColumns.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {sourceDef && (
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={handleRun}
                  disabled={running || selectedColumns.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {running ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Run Report
                </button>

                <button
                  onClick={() => {
                    setSaveError(null);
                    setShowSaveModal(true);
                  }}
                  disabled={selectedColumns.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  {editingTemplateId ? 'Update Template' : 'Save Template'}
                </button>

                {result && result.data.length > 0 && (
                  <>
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Export JSON
                    </button>
                  </>
                )}

                {editingTemplateId && (
                  <button
                    onClick={() => {
                      setEditingTemplateId(null);
                      setSaveName('');
                      setSaveDesc('');
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    New Template
                  </button>
                )}
              </div>
            )}

            {/* Run error */}
            {runError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {runError}
              </div>
            )}

            {/* Results table */}
            {result && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      {result.source_label} Results
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Showing {result.data.length} rows
                      {result.total_count !== null && result.total_count > result.data.length && (
                        <span> of {result.total_count.toLocaleString()} total (first 50 shown)</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>{result.columns.length} column{result.columns.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {result.data.length === 0 ? (
                  <div className="py-16 text-center">
                    <BarChart2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">No records match your criteria</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-10">
                            #
                          </th>
                          {result.columns.map((col) => (
                            <th
                              key={col}
                              className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
                            >
                              {getColumnLabel(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {result.data.map((row, rowIdx) => (
                          <tr
                            key={rowIdx}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 select-none">
                              {rowIdx + 1}
                            </td>
                            {result.columns.map((col) => (
                              <td
                                key={col}
                                className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-xs truncate"
                                title={String(row[col] ?? '')}
                              >
                                {formatCellValue(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!sourceDef && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-16 text-center">
                <BarChart2 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Start Building Your Report
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Select a data source above to get started, or load a saved template from the sidebar.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Save Template Modal ── */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingTemplateId ? 'Update Template' : 'Save Report Template'}
              </h2>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g., Active Students by Cohort"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="saveShared"
                  checked={saveShared}
                  onChange={(e) => setSaveShared(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-purple-600"
                />
                <label htmlFor="saveShared" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-gray-400" />
                  Share with other instructors
                </label>
              </div>

              {saveError && (
                <div className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {saveError}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={saving || !saveName.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingTemplateId ? 'Update' : 'Save'} Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// FilterRow sub-component
// ─────────────────────────────────────────────────

function FilterRowComponent({
  filter,
  columns,
  onChange,
  onRemove,
}: {
  filter: FilterRow;
  columns: ColumnDef[];
  onChange: (field: string, val: string) => void;
  onRemove: () => void;
}) {
  const needsValue = filter.operator !== 'is_null';
  const needsValue2 = filter.operator === 'between';

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
      <select
        value={filter.column}
        onChange={(e) => onChange('column', e.target.value)}
        className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm flex-1 min-w-[120px]"
      >
        {columns.map((c) => (
          <option key={c.key} value={c.key}>{c.label}</option>
        ))}
      </select>

      <select
        value={filter.operator}
        onChange={(e) => onChange('operator', e.target.value)}
        className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {needsValue && (
        <input
          type="text"
          value={filter.value}
          onChange={(e) => onChange('value', e.target.value)}
          placeholder="Value"
          className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm flex-1 min-w-[100px]"
        />
      )}

      {needsValue2 && (
        <>
          <span className="text-xs text-gray-500 dark:text-gray-400">and</span>
          <input
            type="text"
            value={filter.value2}
            onChange={(e) => onChange('value2', e.target.value)}
            placeholder="End value"
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm flex-1 min-w-[100px]"
          />
        </>
      )}

      <button
        onClick={onRemove}
        className="p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        aria-label="Remove filter"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────
// TemplateItem sub-component
// ─────────────────────────────────────────────────

function TemplateItem({
  tmpl,
  isActive,
  onLoad,
  onRun,
  onDelete,
  showDelete,
}: {
  tmpl: ReportTemplate;
  isActive: boolean;
  onLoad: () => void;
  onRun: () => void;
  onDelete: () => void;
  showDelete: boolean;
}) {
  return (
    <div
      className={`px-3 py-2.5 transition-colors ${
        isActive ? 'bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <button
          onClick={onLoad}
          className="flex-1 text-left min-w-0"
        >
          <p className={`text-sm font-medium truncate ${
            isActive ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'
          }`}>
            {tmpl.name}
          </p>
          {tmpl.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{tmpl.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
              {tmpl.data_source.replace('_', ' ')}
            </span>
            {tmpl.is_shared && (
              <Share2 className="w-3 h-3 text-green-500" />
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onRun}
            title="Run this template"
            className="p-1 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
          </button>
          {showDelete && (
            <button
              onClick={onDelete}
              title="Delete template"
              className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
