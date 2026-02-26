'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  BarChart3,
  Edit2,
  Check,
  X,
  AlertTriangle,
  AlertCircle,
  Download,
  RefreshCw,
  Users,
  Calendar,
  Hospital,
  Ambulance,
  Building2,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { canAccessClinical, hasMinRole, type Role } from '@/lib/permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CapacitySite {
  id: string;
  source: 'agency' | 'clinical_site';
  name: string;
  abbreviation: string | null;
  type: 'ems' | 'hospital';
  system?: string | null;
  max_students_per_day: number;
  max_students_per_rotation: number | null;
  capacity_notes: string | null;
  current_student_count: number;
  utilization_percentage: number;
  is_over_capacity: boolean;
}

interface CapacityData {
  date: string | null;
  agencies: CapacitySite[];
  clinical_sites: CapacitySite[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUtilizationColor(pct: number, isOver: boolean): { bar: string; text: string; bg: string; border: string } {
  if (isOver || pct > 100) {
    return {
      bar: 'bg-red-700',
      text: 'text-red-800 dark:text-red-200',
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-400 dark:border-red-700',
    };
  }
  if (pct >= 90) {
    return {
      bar: 'bg-red-500',
      text: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-300 dark:border-red-700',
    };
  }
  if (pct >= 70) {
    return {
      bar: 'bg-yellow-500',
      text: 'text-yellow-700 dark:text-yellow-300',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-300 dark:border-yellow-700',
    };
  }
  return {
    bar: 'bg-green-500',
    text: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-300 dark:border-green-700',
  };
}

function getStatusLabel(pct: number, isOver: boolean): string {
  if (isOver || pct > 100) return 'Over Capacity';
  if (pct >= 90) return 'Near Capacity';
  if (pct >= 70) return 'High Utilization';
  return 'Available';
}

function getStatusBadgeClasses(pct: number, isOver: boolean): string {
  if (isOver || pct > 100) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
  if (pct >= 90) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
  if (pct >= 70) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
  return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
}

// ─── Capacity Bar Component ────────────────────────────────────────────────────

function CapacityBar({ current, max, isOver }: { current: number; max: number; isOver: boolean }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 110) : 0; // cap visual at 110%
  const displayPct = max > 0 ? Math.round((current / max) * 100) : 0;
  const colors = getUtilizationColor(displayPct, isOver);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-400">
          {current} / {max} students
        </span>
        <span className={`font-semibold ${colors.text}`}>
          {displayPct}%
        </span>
      </div>
      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colors.bar}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Inline Edit Form ──────────────────────────────────────────────────────────

interface EditFormState {
  max_students_per_day: string;
  max_students_per_rotation: string;
  capacity_notes: string;
}

function EditCapacityForm({
  site,
  onSave,
  onCancel,
  saving,
}: {
  site: CapacitySite;
  onSave: (values: EditFormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<EditFormState>({
    max_students_per_day: String(site.max_students_per_day),
    max_students_per_rotation: site.max_students_per_rotation != null ? String(site.max_students_per_rotation) : '',
    capacity_notes: site.capacity_notes ?? '',
  });

  return (
    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Max / Day *
          </label>
          <input
            type="number"
            min="1"
            value={form.max_students_per_day}
            onChange={(e) => setForm({ ...form, max_students_per_day: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Max / Rotation
          </label>
          <input
            type="number"
            min="1"
            value={form.max_students_per_rotation}
            onChange={(e) => setForm({ ...form, max_students_per_rotation: e.target.value })}
            placeholder="Optional"
            className="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Capacity Notes
        </label>
        <textarea
          rows={2}
          value={form.capacity_notes}
          onChange={(e) => setForm({ ...form, capacity_notes: e.target.value })}
          placeholder="e.g. 2 students max on weekends..."
          className="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.max_students_per_day}
          className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? (
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Site Card ────────────────────────────────────────────────────────────────

function SiteCapacityCard({
  site,
  canEdit,
  onUpdated,
}: {
  site: CapacitySite;
  canEdit: boolean;
  onUpdated: (updated: CapacitySite) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colors = getUtilizationColor(site.utilization_percentage, site.is_over_capacity);
  const isHospital = site.type === 'hospital';

  const handleSave = async (form: EditFormState) => {
    const maxPerDay = parseInt(form.max_students_per_day, 10);
    if (!maxPerDay || maxPerDay < 1) {
      setError('Max per day must be at least 1');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/clinical/capacity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: site.id,
          source: site.source,
          max_students_per_day: maxPerDay,
          max_students_per_rotation: form.max_students_per_rotation ? parseInt(form.max_students_per_rotation, 10) : null,
          capacity_notes: form.capacity_notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEditing(false);
        // Update local data
        onUpdated({
          ...site,
          max_students_per_day: maxPerDay,
          max_students_per_rotation: form.max_students_per_rotation ? parseInt(form.max_students_per_rotation, 10) : null,
          capacity_notes: form.capacity_notes.trim() || null,
          utilization_percentage: maxPerDay > 0 ? Math.round((site.current_student_count / maxPerDay) * 100) : 0,
          is_over_capacity: site.current_student_count > maxPerDay,
        });
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('Failed to save capacity');
    }
    setSaving(false);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow border-l-4 ${colors.border} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isHospital ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
            {isHospital ? (
              <Hospital className={`w-5 h-5 ${isHospital ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`} />
            ) : (
              <Ambulance className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
              {site.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              {site.abbreviation && (
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {site.abbreviation}
                </span>
              )}
              {site.system && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {site.system}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClasses(site.utilization_percentage, site.is_over_capacity)}`}>
            {getStatusLabel(site.utilization_percentage, site.is_over_capacity)}
          </span>
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Edit capacity"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Capacity bar */}
      <CapacityBar
        current={site.current_student_count}
        max={site.max_students_per_day}
        isOver={site.is_over_capacity}
      />

      {/* Additional info row */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          <span>Max/day: <strong className="text-gray-700 dark:text-gray-300">{site.max_students_per_day}</strong></span>
        </div>
        {site.max_students_per_rotation && (
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Max/rotation: <strong className="text-gray-700 dark:text-gray-300">{site.max_students_per_rotation}</strong></span>
          </div>
        )}
      </div>

      {site.capacity_notes && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="italic">{site.capacity_notes}</span>
        </div>
      )}

      {/* Inline edit form */}
      {editing && (
        <EditCapacityForm
          site={site}
          onSave={handleSave}
          onCancel={() => { setEditing(false); setError(null); }}
          saving={saving}
        />
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CapacityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [capacityData, setCapacityData] = useState<CapacityData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'ems' | 'hospital' | 'clinical_site'>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Merge agency + clinical_sites into one flat list for display
  const allSites: CapacitySite[] = capacityData
    ? [...capacityData.agencies, ...capacityData.clinical_sites]
    : [];

  const filteredSites = allSites.filter((site) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'ems') return site.source === 'agency' && site.type === 'ems';
    if (activeTab === 'hospital') return site.source === 'agency' && site.type === 'hospital';
    if (activeTab === 'clinical_site') return site.source === 'clinical_site';
    return true;
  });

  // Summary stats
  const overCapacity = allSites.filter((s) => s.is_over_capacity).length;
  const nearCapacity = allSites.filter((s) => !s.is_over_capacity && s.utilization_percentage >= 70).length;
  const available = allSites.filter((s) => !s.is_over_capacity && s.utilization_percentage < 70).length;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const fetchCapacity = useCallback(async (date?: string) => {
    try {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      const res = await fetch(`/api/clinical/capacity?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCapacityData(data);
      } else {
        setErrorMessage(data.error || 'Failed to load capacity data');
      }
    } catch {
      setErrorMessage('Failed to load capacity data');
    }
  }, []);

  useEffect(() => {
    if (!session) return;

    const init = async () => {
      setLoading(true);
      try {
        const userRes = await fetch('/api/instructor/me');
        const userData = await userRes.json();
        if (userData.success && userData.user) {
          setUserRole(userData.user.role);
          if (!canAccessClinical(userData.user.role)) {
            router.push('/clinical');
            return;
          }
        }
        await fetchCapacity();
      } catch {
        setErrorMessage('Failed to initialize page');
      }
      setLoading(false);
    };

    init();
  }, [session, fetchCapacity, router]);

  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    setRefreshing(true);
    await fetchCapacity(newDate || undefined);
    setRefreshing(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCapacity(selectedDate || undefined);
    setRefreshing(false);
  };

  const handleSiteUpdated = (updated: CapacitySite) => {
    if (!capacityData) return;
    if (updated.source === 'agency') {
      setCapacityData({
        ...capacityData,
        agencies: capacityData.agencies.map((a) => (a.id === updated.id ? updated : a)),
      });
    } else {
      setCapacityData({
        ...capacityData,
        clinical_sites: capacityData.clinical_sites.map((s) => (s.id === updated.id ? updated : s)),
      });
    }
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!allSites.length) return;

    const headers = ['Name', 'Abbreviation', 'Type', 'Source', 'Max/Day', 'Max/Rotation', 'Current Students', 'Utilization %', 'Status', 'Notes'];
    const rows = allSites.map((site) => [
      site.name,
      site.abbreviation ?? '',
      site.type,
      site.source === 'agency' ? 'Agency' : 'Clinical Site',
      site.max_students_per_day,
      site.max_students_per_rotation ?? '',
      site.current_student_count,
      `${site.utilization_percentage}%`,
      getStatusLabel(site.utilization_percentage, site.is_over_capacity),
      site.capacity_notes ?? '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clinical-capacity-${selectedDate || new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const canEdit = userRole ? hasMinRole(userRole, 'admin') : false;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!session) return null;

  const emsCount = allSites.filter((s) => s.source === 'agency' && s.type === 'ems').length;
  const hospitalAgencyCount = allSites.filter((s) => s.source === 'agency' && s.type === 'hospital').length;
  const clinicalSiteCount = allSites.filter((s) => s.source === 'clinical_site').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">
              Clinical &amp; Internship
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Site Capacity</span>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <BarChart3 className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Site Capacity</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Track student placement limits across clinical sites and internship agencies
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Date picker */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {selectedDate && (
                  <button
                    onClick={() => handleDateChange('')}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Clear date filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <button
                onClick={handleExport}
                disabled={!allSites.length}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Error */}
        {errorMessage && (
          <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {errorMessage}
            <button onClick={() => setErrorMessage(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Date filter indicator */}
        {selectedDate && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2 text-blue-800 dark:text-blue-200 text-sm">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            Showing utilization for <strong>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{allSites.length}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Sites</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{available}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Available</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{nearCapacity}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Near Capacity</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
            <div className={`text-2xl font-bold ${overCapacity > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {overCapacity}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Over Capacity</div>
          </div>
        </div>

        {/* Over-capacity alerts */}
        {overCapacity > 0 && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
            <div className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-200 mb-2">
              <AlertTriangle className="w-5 h-5" />
              {overCapacity} site{overCapacity > 1 ? 's are' : ' is'} over capacity
            </div>
            <div className="space-y-1">
              {allSites
                .filter((s) => s.is_over_capacity)
                .map((site) => (
                  <div key={`${site.source}-${site.id}`} className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    <strong>{site.name}</strong>: {site.current_student_count} students (max {site.max_students_per_day})
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Filters / Tab bar */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: `All (${allSites.length})`, icon: Building2 },
            { key: 'ems', label: `EMS Agencies (${emsCount})`, icon: Ambulance },
            { key: 'hospital', label: `Hospital Agencies (${hospitalAgencyCount})`, icon: Hospital },
            { key: 'clinical_site', label: `Clinical Sites (${clinicalSiteCount})`, icon: Building2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-teal-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Admin note */}
        {canEdit && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <SlidersHorizontal className="w-4 h-4" />
            Click the edit button on any card to adjust capacity limits
          </div>
        )}

        {/* Site cards grid */}
        {filteredSites.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {refreshing ? 'Loading...' : 'No sites found for this filter'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSites.map((site) => (
              <SiteCapacityCard
                key={`${site.source}-${site.id}`}
                site={site}
                canEdit={canEdit}
                onUpdated={handleSiteUpdated}
              />
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Capacity Legend
          </h3>
          <div className="flex flex-wrap gap-4 text-sm">
            {[
              { label: 'Available', note: '< 70%', barClass: 'bg-green-500', textClass: 'text-green-700 dark:text-green-300' },
              { label: 'High Utilization', note: '70 – 89%', barClass: 'bg-yellow-500', textClass: 'text-yellow-700 dark:text-yellow-300' },
              { label: 'Near Capacity', note: '90 – 100%', barClass: 'bg-red-500', textClass: 'text-red-700 dark:text-red-300' },
              { label: 'Over Capacity', note: '> 100%', barClass: 'bg-red-700', textClass: 'text-red-800 dark:text-red-200' },
            ].map(({ label, note, barClass, textClass }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-4 h-2 rounded-full ${barClass}`} />
                <span className={`font-medium ${textClass}`}>{label}</span>
                <span className="text-gray-400 dark:text-gray-500">({note})</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
