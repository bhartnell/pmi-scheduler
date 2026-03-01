'use client';

/**
 * Admin Incident Report System
 *
 * Log and track safety incidents in lab/clinical settings.
 * Supports:
 * - Summary stats (open count, severity breakdown)
 * - Filterable table with color-coded severity/status badges
 * - Report new incident form
 * - Incident detail view with resolution tracking
 * - Status workflow: open -> investigating -> resolved -> closed
 * - Excel export for OSHA compliance
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  AlertTriangle,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  MapPin,
  User,
  CalendarDays,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { exportToExcel } from '@/lib/export-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'minor' | 'moderate' | 'major' | 'critical';
type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';

interface Incident {
  id: string;
  incident_date: string;
  incident_time: string | null;
  location: string;
  severity: Severity;
  description: string;
  people_involved: string | null;
  actions_taken: string | null;
  follow_up_required: boolean;
  follow_up_notes: string | null;
  witness_statements: string | null;
  resolution: string | null;
  status: IncidentStatus;
  reported_by: string;
  created_at: string;
  updated_at: string;
}

interface Stats {
  open: number;
  investigating: number;
  resolved: number;
  closed: number;
  minor: number;
  moderate: number;
  major: number;
  critical: number;
}

interface NewIncidentForm {
  incident_date: string;
  incident_time: string;
  location: string;
  severity: Severity;
  description: string;
  people_involved: string;
  actions_taken: string;
  follow_up_required: boolean;
  follow_up_notes: string;
  witness_statements: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<Severity, { label: string; badge: string; dot: string }> = {
  minor: {
    label: 'Minor',
    badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    dot: 'bg-green-500',
  },
  moderate: {
    label: 'Moderate',
    badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    dot: 'bg-yellow-500',
  },
  major: {
    label: 'Major',
    badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  critical: {
    label: 'Critical',
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
  },
};

const STATUS_CONFIG: Record<IncidentStatus, { label: string; badge: string; icon: typeof Clock }> = {
  open: {
    label: 'Open',
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    icon: AlertTriangle,
  },
  investigating: {
    label: 'Investigating',
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    icon: Search,
  },
  resolved: {
    label: 'Resolved',
    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    icon: CheckCircle2,
  },
  closed: {
    label: 'Closed',
    badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    icon: XCircle,
  },
};

const STATUS_WORKFLOW: Record<IncidentStatus, IncidentStatus | null> = {
  open: 'investigating',
  investigating: 'resolved',
  resolved: 'closed',
  closed: null,
};

const EMPTY_FORM: NewIncidentForm = {
  incident_date: new Date().toISOString().split('T')[0],
  incident_time: '',
  location: '',
  severity: 'minor',
  description: '',
  people_involved: '',
  actions_taken: '',
  follow_up_required: false,
  follow_up_notes: '',
  witness_statements: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminIncidentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewIncidentForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewIncidentForm, string>>>({});

  // Detail view
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Resolution
  const [resolutionText, setResolutionText] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      verifyAndLoad();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const verifyAndLoad = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!canAccessAdmin(data.user.role)) {
          router.push('/');
          return;
        }
        fetchIncidents();
      }
    } catch (err) {
      console.error('Error verifying admin:', err);
      setLoading(false);
    }
  };

  const buildQuery = (
    sFilter = statusFilter,
    sevFilter = severityFilter,
    from = fromDate,
    to = toDate
  ) => {
    const params = new URLSearchParams();
    if (sFilter !== 'all') params.set('status', sFilter);
    if (sevFilter !== 'all') params.set('severity', sevFilter);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString() ? `/api/admin/incidents?${params}` : '/api/admin/incidents';
  };

  const fetchIncidents = async (
    sFilter = statusFilter,
    sevFilter = severityFilter,
    from = fromDate,
    to = toDate
  ) => {
    setLoading(true);
    try {
      const res = await fetch(buildQuery(sFilter, sevFilter, from, to));
      const data = await res.json();
      if (data.success) {
        setIncidents(data.incidents ?? []);
        setStats(data.stats ?? null);
      }
    } catch (err) {
      console.error('Error fetching incidents:', err);
    }
    setLoading(false);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── Form handling ──────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NewIncidentForm, string>> = {};
    if (!form.incident_date) errors.incident_date = 'Date is required';
    if (!form.location.trim()) errors.location = 'Location is required';
    if (!form.description.trim()) errors.description = 'Description is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_date: form.incident_date,
          incident_time: form.incident_time || null,
          location: form.location.trim(),
          severity: form.severity,
          description: form.description.trim(),
          people_involved: form.people_involved.trim() || null,
          actions_taken: form.actions_taken.trim() || null,
          follow_up_required: form.follow_up_required,
          follow_up_notes: form.follow_up_notes.trim() || null,
          witness_statements: form.witness_statements.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Incident report submitted.', 'success');
        setShowForm(false);
        setForm(EMPTY_FORM);
        fetchIncidents();
      } else {
        showToast(data.error || 'Failed to submit report.', 'error');
      }
    } catch (err) {
      console.error('Error submitting incident:', err);
      showToast('Unexpected error. Please try again.', 'error');
    }
    setSaving(false);
  };

  // ─── Status workflow ─────────────────────────────────────────────────────────

  const advanceStatus = async (incident: Incident) => {
    const next = STATUS_WORKFLOW[incident.status];
    if (!next) return;

    // If advancing to resolved or closed, show resolution input
    if ((next === 'resolved' || next === 'closed') && !resolvingId) {
      setResolvingId(incident.id);
      setResolutionText(incident.resolution ?? '');
      return;
    }

    await updateIncident(incident.id, { status: next });
  };

  const submitResolution = async (incident: Incident) => {
    const next = STATUS_WORKFLOW[incident.status];
    if (!next) return;
    await updateIncident(incident.id, {
      status: next,
      resolution: resolutionText.trim() || null,
    });
    setResolvingId(null);
    setResolutionText('');
  };

  const updateIncident = async (id: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/incidents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setIncidents(prev =>
          prev.map(i => (i.id === id ? { ...i, ...data.incident } : i))
        );
        showToast('Incident updated.', 'success');
      } else {
        showToast(data.error || 'Update failed.', 'error');
      }
    } catch (err) {
      console.error('Error updating incident:', err);
      showToast('Unexpected error.', 'error');
    }
  };

  // ─── Export ──────────────────────────────────────────────────────────────────

  const handleExport = () => {
    exportToExcel({
      title: 'PMI Incident Reports',
      subtitle: `Exported ${new Date().toLocaleDateString()} - OSHA Compliance Record`,
      filename: `pmi-incidents-${new Date().toISOString().split('T')[0]}`,
      columns: [
        { key: 'incident_date', label: 'Date' },
        { key: 'incident_time', label: 'Time', getValue: r => r.incident_time ?? '' },
        { key: 'location', label: 'Location' },
        { key: 'severity', label: 'Severity' },
        { key: 'status', label: 'Status' },
        { key: 'description', label: 'Description' },
        { key: 'people_involved', label: 'People Involved', getValue: r => r.people_involved ?? '' },
        { key: 'actions_taken', label: 'Actions Taken', getValue: r => r.actions_taken ?? '' },
        { key: 'follow_up_required', label: 'Follow-Up Required', getValue: r => r.follow_up_required ? 'Yes' : 'No' },
        { key: 'follow_up_notes', label: 'Follow-Up Notes', getValue: r => r.follow_up_notes ?? '' },
        { key: 'witness_statements', label: 'Witness Statements', getValue: r => r.witness_statements ?? '' },
        { key: 'resolution', label: 'Resolution', getValue: r => r.resolution ?? '' },
        { key: 'reported_by', label: 'Reported By' },
        { key: 'created_at', label: 'Report Created', getValue: r => new Date(r.created_at).toLocaleString() },
      ],
      data: filteredIncidents,
    });
  };

  // ─── Filtered list ────────────────────────────────────────────────────────────

  const filteredIncidents = incidents.filter(i => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      i.description.toLowerCase().includes(q) ||
      i.location.toLowerCase().includes(q) ||
      (i.people_involved ?? '').toLowerCase().includes(q) ||
      i.reported_by.toLowerCase().includes(q)
    );
  });

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (!session) return null;

  const openCount = stats?.open ?? 0;
  const criticalCount = stats?.critical ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Incident Reports</span>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Incident Reports
                  </h1>
                  {openCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                      {openCount} open
                    </span>
                  )}
                  {criticalCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-800 text-white">
                      {criticalCount} critical
                    </span>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Log and track safety incidents in lab and clinical settings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export OSHA
              </button>
              <button
                onClick={() => { setShowForm(true); setSelectedId(null); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Report Incident
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Open', value: stats.open, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
              { label: 'Investigating', value: stats.investigating, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
              { label: 'Resolved', value: stats.resolved, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
              { label: 'Closed', value: stats.closed, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
            ].map(stat => (
              <div key={stat.label} className={`${stat.bg} border ${stat.border} rounded-lg p-4`}>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-1">
                  {stat.label}
                </p>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Severity Breakdown */}
        {stats && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Severity Breakdown (All Time)
            </h2>
            <div className="flex flex-wrap gap-3">
              {(['minor', 'moderate', 'major', 'critical'] as Severity[]).map(sev => {
                const cfg = SEVERITY_CONFIG[sev];
                const count = stats[sev];
                return (
                  <div key={sev} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {cfg.label}:
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Filter className="w-4 h-4" />
            Filters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Status filter */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => {
                  const v = e.target.value as IncidentStatus | 'all';
                  setStatusFilter(v);
                  fetchIncidents(v, severityFilter, fromDate, toDate);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Severity filter */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Severity</label>
              <select
                value={severityFilter}
                onChange={e => {
                  const v = e.target.value as Severity | 'all';
                  setSeverityFilter(v);
                  fetchIncidents(statusFilter, v, fromDate, toDate);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Severities</option>
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="major">Major</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => {
                  setFromDate(e.target.value);
                  fetchIncidents(statusFilter, severityFilter, e.target.value, toDate);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={e => {
                  setToDate(e.target.value);
                  fetchIncidents(statusFilter, severityFilter, fromDate, e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search description, location, people involved..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* New Incident Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Report New Incident
              </h2>
              <button
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormErrors({}); }}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Incident Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.incident_date}
                    onChange={e => setForm(f => ({ ...f, incident_date: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.incident_date
                        ? 'border-red-400 dark:border-red-600'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {formErrors.incident_date && (
                    <p className="text-xs text-red-500 mt-0.5">{formErrors.incident_date}</p>
                  )}
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time (optional)
                  </label>
                  <input
                    type="time"
                    value={form.incident_time}
                    onChange={e => setForm(f => ({ ...f, incident_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Severity
                  </label>
                  <select
                    value={form.severity}
                    onChange={e => setForm(f => ({ ...f, severity: e.target.value as Severity }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="major">Major</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g., Lab Room 3, Clinical Site - Banner Health"
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.location
                      ? 'border-red-400 dark:border-red-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {formErrors.location && (
                  <p className="text-xs text-red-500 mt-0.5">{formErrors.location}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Describe what happened in detail..."
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                    formErrors.description
                      ? 'border-red-400 dark:border-red-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {formErrors.description && (
                  <p className="text-xs text-red-500 mt-0.5">{formErrors.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* People Involved */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    People Involved
                  </label>
                  <textarea
                    value={form.people_involved}
                    onChange={e => setForm(f => ({ ...f, people_involved: e.target.value }))}
                    rows={2}
                    placeholder="Names of students, instructors, or others involved"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                {/* Actions Taken */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Immediate Actions Taken
                  </label>
                  <textarea
                    value={form.actions_taken}
                    onChange={e => setForm(f => ({ ...f, actions_taken: e.target.value }))}
                    rows={2}
                    placeholder="What was done immediately after the incident?"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Witness Statements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Witness Statements
                </label>
                <textarea
                  value={form.witness_statements}
                  onChange={e => setForm(f => ({ ...f, witness_statements: e.target.value }))}
                  rows={2}
                  placeholder="Any witness accounts of the incident"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Follow-up */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.follow_up_required}
                    onChange={e => setForm(f => ({ ...f, follow_up_required: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Follow-up required
                  </span>
                </label>
                {form.follow_up_required && (
                  <textarea
                    value={form.follow_up_notes}
                    onChange={e => setForm(f => ({ ...f, follow_up_notes: e.target.value }))}
                    rows={2}
                    placeholder="Describe required follow-up actions..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                )}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  {saving ? 'Submitting...' : 'Submit Report'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormErrors({}); }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Incidents Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''}
              {searchQuery && ' matching search'}
            </h2>
          </div>

          {filteredIncidents.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">No incidents found</p>
              {(statusFilter !== 'all' || severityFilter !== 'all' || searchQuery) && (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Try adjusting your filters
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredIncidents.map(incident => {
                const sevCfg = SEVERITY_CONFIG[incident.severity];
                const statusCfg = STATUS_CONFIG[incident.status];
                const StatusIcon = statusCfg.icon;
                const isExpanded = expandedId === incident.id;
                const nextStatus = STATUS_WORKFLOW[incident.status];
                const isResolvingThis = resolvingId === incident.id;

                return (
                  <div key={incident.id} className="p-4">
                    {/* Row header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Meta line */}
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {new Date(incident.incident_date + 'T12:00:00').toLocaleDateString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                              {incident.incident_time && (
                                <span className="text-gray-500 dark:text-gray-400">
                                  {' '}at {incident.incident_time}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {incident.location}
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className={`text-sm text-gray-700 dark:text-gray-300 mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}>
                          {incident.description}
                        </p>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-3 space-y-2 text-sm">
                            {incident.people_involved && (
                              <div className="flex gap-2">
                                <User className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    People Involved
                                  </span>
                                  <p className="text-gray-700 dark:text-gray-300">{incident.people_involved}</p>
                                </div>
                              </div>
                            )}
                            {incident.actions_taken && (
                              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Immediate Actions Taken</p>
                                <p className="text-gray-700 dark:text-gray-300">{incident.actions_taken}</p>
                              </div>
                            )}
                            {incident.witness_statements && (
                              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Witness Statements</p>
                                <p className="text-gray-700 dark:text-gray-300">{incident.witness_statements}</p>
                              </div>
                            )}
                            {incident.follow_up_required && (
                              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Follow-Up Required</p>
                                {incident.follow_up_notes && (
                                  <p className="text-gray-700 dark:text-gray-300">{incident.follow_up_notes}</p>
                                )}
                              </div>
                            )}
                            {incident.resolution && (
                              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Resolution</p>
                                <p className="text-gray-700 dark:text-gray-300">{incident.resolution}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Resolution input when advancing to resolved/closed */}
                        {isResolvingThis && (
                          <div className="mt-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 space-y-2">
                            <label className="block text-xs font-medium text-green-700 dark:text-green-400">
                              Resolution Notes (optional)
                            </label>
                            <textarea
                              value={resolutionText}
                              onChange={e => setResolutionText(e.target.value)}
                              rows={2}
                              placeholder="Describe how the incident was resolved..."
                              className="w-full px-3 py-2 border border-green-200 dark:border-green-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => submitResolution(incident)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium transition-colors"
                              >
                                Confirm &amp; Advance
                              </button>
                              <button
                                onClick={() => { setResolvingId(null); setResolutionText(''); }}
                                className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-xs transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Footer meta */}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          Reported by {incident.reported_by} &middot; {new Date(incident.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Right column: badges + actions */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sevCfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sevCfg.dot}`} />
                          {sevCfg.label}
                        </span>
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.badge}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusCfg.label}
                        </span>

                        <button
                          onClick={() => setExpandedId(isExpanded ? null : incident.id)}
                          className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {isExpanded ? (
                            <><ChevronUp className="w-3.5 h-3.5" /> Less</>
                          ) : (
                            <><ChevronDown className="w-3.5 h-3.5" /> More</>
                          )}
                        </button>

                        {nextStatus && !isResolvingThis && (
                          <button
                            onClick={() => advanceStatus(incident)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-medium"
                          >
                            {STATUS_CONFIG[nextStatus].label}
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
