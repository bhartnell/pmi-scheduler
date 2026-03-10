'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  ArrowLeft,
  Users,
  FileCheck,
  Eye,
  ScrollText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsentStats {
  studentConsent: { total: number; accepted: number; pending: number; pendingEmails: string[] };
  agencyConsent: { total: number; accepted: number; pending: number; pendingEmails: string[] };
}

interface FerpaRelease {
  id: string;
  first_name: string;
  last_name: string;
  cohort_id: string | null;
  status: string;
  ferpa_agency_release: boolean;
  ferpa_release_date: string | null;
  ferpa_release_agency: string | null;
}

interface AgencyUser {
  id: string;
  name: string;
  email: string;
  role: string;
  agency_affiliation: string | null;
  agency_scope: string[] | null;
  is_active: boolean;
  last_login: string | null;
  hasConsent: boolean;
  consentDate: string | null;
}

interface AccessLogEntry {
  id: string;
  user_email: string;
  user_role: string;
  student_id: string | null;
  data_type: string;
  action: string;
  route: string;
  details: Record<string, unknown> | null;
  accessed_at: string;
}

interface AgreementVersion {
  id: string;
  name: string;
  prompt_text: string;
  version: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'consent', label: 'Consent Status', icon: FileCheck },
  { id: 'releases', label: 'FERPA Releases', icon: Shield },
  { id: 'agency-users', label: 'Agency Users', icon: Users },
  { id: 'access-log', label: 'Access Log', icon: Eye },
  { id: 'agreements', label: 'Agreements', icon: ScrollText },
];

export default function FerpaCompliancePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('consent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab data
  const [consentStats, setConsentStats] = useState<ConsentStats | null>(null);
  const [releases, setReleases] = useState<FerpaRelease[]>([]);
  const [agencyUsers, setAgencyUsers] = useState<AgencyUser[]>([]);
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
  const [accessLogTotal, setAccessLogTotal] = useState(0);
  const [accessLogPage, setAccessLogPage] = useState(1);
  const [agreements, setAgreements] = useState<AgreementVersion[]>([]);

  const fetchTabData = useCallback(async (tab: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tab });
      if (tab === 'access-log') params.set('page', String(accessLogPage));
      const res = await fetch(`/api/admin/ferpa?${params}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();

      switch (tab) {
        case 'consent':
          setConsentStats(data);
          break;
        case 'releases':
          setReleases(data.students || []);
          break;
        case 'agency-users':
          setAgencyUsers(data.agencyUsers || []);
          break;
        case 'access-log':
          setAccessLog(data.entries || []);
          setAccessLogTotal(data.total || 0);
          break;
        case 'agreements':
          setAgreements(data.agreements || []);
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [accessLogPage]);

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  FERPA Compliance Dashboard
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Consent tracking, FERPA releases, and agency access management
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gray-100 text-red-600 dark:bg-gray-700 dark:text-red-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="mb-1 inline h-4 w-4" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-red-600" />
          </div>
        ) : (
          <>
            {activeTab === 'consent' && consentStats && <ConsentTab data={consentStats} />}
            {activeTab === 'releases' && <ReleasesTab releases={releases} onRefresh={() => fetchTabData('releases')} />}
            {activeTab === 'agency-users' && <AgencyUsersTab users={agencyUsers} />}
            {activeTab === 'access-log' && (
              <AccessLogTab
                entries={accessLog}
                total={accessLogTotal}
                page={accessLogPage}
                onPageChange={setAccessLogPage}
              />
            )}
            {activeTab === 'agreements' && <AgreementsTab agreements={agreements} onRefresh={() => fetchTabData('agreements')} />}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Consent Status
// ---------------------------------------------------------------------------

function ConsentTab({ data }: { data: ConsentStats }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <ConsentCard
          title="Student Data Use Agreement"
          total={data.studentConsent.total}
          accepted={data.studentConsent.accepted}
          pendingEmails={data.studentConsent.pendingEmails}
          color="cyan"
        />
        <ConsentCard
          title="Agency Data Sharing Agreement"
          total={data.agencyConsent.total}
          accepted={data.agencyConsent.accepted}
          pendingEmails={data.agencyConsent.pendingEmails}
          color="orange"
        />
      </div>
    </div>
  );
}

function ConsentCard({
  title,
  total,
  accepted,
  pendingEmails,
  color,
}: {
  title: string;
  total: number;
  accepted: number;
  pendingEmails: string[];
  color: string;
}) {
  const pct = total > 0 ? Math.round((accepted / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>

      {/* Progress bar */}
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          {accepted} of {total} accepted
        </span>
        <span className={`font-semibold ${pct === 100 ? 'text-green-600' : `text-${color}-600`}`}>
          {pct}%
        </span>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : `bg-${color}-500`}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Pending list */}
      {pendingEmails.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
            Pending ({pendingEmails.length}):
          </p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {pendingEmails.map((email) => (
              <div key={email} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <XCircle className="h-3 w-3 text-red-400" />
                {email}
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingEmails.length === 0 && total > 0 && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          All users have accepted
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: FERPA Releases
// ---------------------------------------------------------------------------

function ReleasesTab({ releases, onRefresh }: { releases: FerpaRelease[]; onRefresh: () => void }) {
  const [updating, setUpdating] = useState<string | null>(null);

  const toggleRelease = async (studentId: string, currentValue: boolean) => {
    setUpdating(studentId);
    try {
      await fetch('/api/ferpa/release', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          ferpa_agency_release: !currentValue,
          ferpa_release_agency: !currentValue ? 'LVFR' : null,
        }),
      });
      onRefresh();
    } catch (err) {
      console.error('Error toggling release:', err);
    } finally {
      setUpdating(null);
    }
  };

  const releasedCount = releases.filter(r => r.ferpa_agency_release).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {releasedCount} of {releases.length} students have FERPA releases
        </p>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">FERPA Release</th>
              <th className="px-4 py-3 font-medium">Agency</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {releases.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {s.last_name}, {s.first_name}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{s.status}</td>
                <td className="px-4 py-3">
                  {s.ferpa_agency_release ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" /> Released
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <XCircle className="h-3 w-3" /> Not Released
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {s.ferpa_release_agency || '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {s.ferpa_release_date || '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleRelease(s.id, s.ferpa_agency_release)}
                    disabled={updating === s.id}
                    className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    {updating === s.id ? '...' : s.ferpa_agency_release ? 'Revoke' : 'Grant'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Agency Users
// ---------------------------------------------------------------------------

function AgencyUsersTab({ users }: { users: AgencyUser[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Agency</th>
            <th className="px-4 py-3 font-medium">Scope</th>
            <th className="px-4 py-3 font-medium">Consent</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
          {users.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                No agency users found
              </td>
            </tr>
          ) : (
            users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.name}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.role === 'agency_liaison'
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
                  }`}>
                    {u.role === 'agency_liaison' ? 'Liaison' : 'Observer'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.agency_affiliation || '—'}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {u.agency_scope?.join(', ') || '—'}
                </td>
                <td className="px-4 py-3">
                  {u.hasConsent ? (
                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      <span className="text-xs">Accepted</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-xs">Pending</span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block h-2 w-2 rounded-full ${
                    u.is_active ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Access Log
// ---------------------------------------------------------------------------

function AccessLogTab({
  entries,
  total,
  page,
  onPageChange,
}: {
  entries: AccessLogEntry[];
  total: number;
  page: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / 50);

  const exportCsv = () => {
    const headers = ['Timestamp', 'User', 'Role', 'Data Type', 'Action', 'Route', 'Student ID'];
    const rows = entries.map(e => [
      new Date(e.accessed_at).toISOString(),
      e.user_email,
      e.user_role,
      e.data_type,
      e.action,
      e.route,
      e.student_id || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ferpa-access-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {total} total entries
        </p>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Timestamp</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Data Type</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Route</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No access log entries yet
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(e.accessed_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{e.user_email}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{e.user_role}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
                      {e.data_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      e.action === 'export' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      e.action === 'modify' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs font-mono">
                    {e.route}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Agreement Management
// ---------------------------------------------------------------------------

function AgreementsTab({ agreements, onRefresh }: { agreements: AgreementVersion[]; onRefresh: () => void }) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Group by name
  const grouped: Record<string, AgreementVersion[]> = {};
  for (const a of agreements) {
    if (!grouped[a.name]) grouped[a.name] = [];
    grouped[a.name].push(a);
  }

  const startEdit = (name: string, currentText: string) => {
    setEditingName(name);
    setEditText(currentText);
  };

  const publishNewVersion = async () => {
    if (!editingName || !editText.trim()) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/admin/ferpa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish_agreement',
          agreement_name: editingName,
          text: editText.trim(),
        }),
      });
      if (res.ok) {
        setEditingName(null);
        setEditText('');
        onRefresh();
      }
    } catch (err) {
      console.error('Error publishing:', err);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([name, versions]) => {
        const active = versions.find(v => v.is_active);
        const displayName = name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        return (
          <div key={name} className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{displayName}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Current version: {active?.version || '—'} |{' '}
                  {versions.length} version{versions.length !== 1 ? 's' : ''}
                </p>
              </div>
              {editingName !== name && (
                <button
                  onClick={() => startEdit(name, active?.prompt_text || '')}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  Edit & Publish New Version
                </button>
              )}
            </div>

            <div className="px-6 py-4">
              {editingName === name ? (
                <div className="space-y-4">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={8}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={publishNewVersion}
                      disabled={publishing}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {publishing ? 'Publishing...' : `Publish as Version ${(active?.version || 0) + 1}`}
                    </button>
                    <button
                      onClick={() => setEditingName(null)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Publishing a new version will require all users to re-accept this agreement.
                  </p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-gray-700 dark:prose-invert dark:text-gray-300">
                  <p>{active?.prompt_text || 'No active version'}</p>
                </div>
              )}

              {/* Version history */}
              {versions.length > 1 && editingName !== name && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                    Version history ({versions.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {versions.map((v) => (
                      <div
                        key={v.id}
                        className="rounded-lg border border-gray-100 p-3 text-xs dark:border-gray-700"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            v{v.version} {v.is_active && '(active)'}
                          </span>
                          <span className="text-gray-400">
                            {v.created_by} — {new Date(v.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
