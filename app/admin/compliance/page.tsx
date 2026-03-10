'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  ClipboardCheck,
  ChevronRight,
  Download,
  RefreshCw,
  XCircle,
  Info,
  Calendar,
  User,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';
import { PageLoader } from '@/components/ui';

// ── Types ──────────────────────────────────────────────────────────────────

interface ComplianceAudit {
  id: string;
  audit_type: string;
  frequency: string;
  tool_method: string | null;
  description: string | null;
  last_completed_at: string | null;
  last_completed_by: string | null;
  last_result: 'pass' | 'fail' | 'info' | 'n_a' | null;
  last_findings: string | null;
  last_actions: string | null;
  next_due_at: string | null;
  is_overdue: boolean;
}

interface AuditLogEntry {
  id: string;
  audit_id: string;
  completed_at: string;
  completed_by: string;
  result: 'pass' | 'fail' | 'info' | 'n_a';
  findings: string | null;
  actions_taken: string | null;
  script_output: { stdout?: string; stderr?: string } | null;
  audit?: { audit_type?: string };
}

interface ComplianceStats {
  total: number;
  current: number;
  dueSoon: number;
  overdue: number;
  neverRun: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const FREQUENCY_LABELS: Record<string, string> = {
  per_deploy: 'Per Deploy',
  per_migration: 'Per Migration',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  per_enrollment: 'Per Enrollment',
};

const RESULT_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  pass: { icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Pass' },
  fail: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Fail' },
  info: { icon: Info, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Info' },
  n_a: { icon: Clock, color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', label: 'N/A' },
};

function canRunScript(auditType: string): boolean {
  return ['API Permission Audit', 'FK Ambiguity Check'].includes(auditType);
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    const futureDays = Math.abs(diffDays);
    if (futureDays === 0) return 'Today';
    if (futureDays === 1) return 'Tomorrow';
    return `In ${futureDays} days`;
  }
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'Event-triggered';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays}d`;
}

// ── Main Page Component ────────────────────────────────────────────────────

export default function ComplianceDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [audits, setAudits] = useState<ComplianceAudit[]>([]);
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [log, setLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');
  const [runningAudit, setRunningAudit] = useState<string | null>(null);
  const [logModal, setLogModal] = useState<ComplianceAudit | null>(null);
  const [logForm, setLogForm] = useState({ result: 'pass', findings: '', actions_taken: '' });
  const [scriptOutput, setScriptOutput] = useState<{ audit: string; stdout: string; stderr: string; result: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/compliance?log=true&limit=100');
      if (!res.ok) throw new Error('Failed to fetch compliance data');
      const data = await res.json();
      if (data.success) {
        setAudits(data.audits || []);
        setStats(data.stats || null);
        setLog(data.log || []);
      }
    } catch (err) {
      console.error('Error fetching compliance data:', err);
      showToast('Failed to load compliance data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchData();
  }, [status, fetchData]);

  // Run script audit
  const handleRunAudit = async (auditType: string) => {
    setRunningAudit(auditType);
    setScriptOutput(null);
    try {
      const res = await fetch('/api/admin/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', audit_type: auditType }),
      });
      const data = await res.json();
      if (data.success) {
        setScriptOutput({
          audit: auditType,
          stdout: data.script_output?.stdout || '',
          stderr: data.script_output?.stderr || '',
          result: data.result,
        });
        showToast(`${auditType} completed: ${data.result}`);
        fetchData();
      } else {
        showToast(data.error || 'Audit failed', 'error');
      }
    } catch {
      showToast('Failed to run audit', 'error');
    } finally {
      setRunningAudit(null);
    }
  };

  // Log manual audit
  const handleLogAudit = async () => {
    if (!logModal) return;
    try {
      const res = await fetch('/api/admin/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log',
          audit_type: logModal.audit_type,
          result: logForm.result,
          findings: logForm.findings || null,
          actions_taken: logForm.actions_taken || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${logModal.audit_type} logged successfully`);
        setLogModal(null);
        setLogForm({ result: 'pass', findings: '', actions_taken: '' });
        fetchData();
      } else {
        showToast(data.error || 'Failed to log audit', 'error');
      }
    } catch {
      showToast('Failed to log audit', 'error');
    }
  };

  // CSV export
  const handleExportCSV = () => {
    window.open('/api/admin/compliance?format=csv', '_blank');
  };

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session?.user || !canAccessAdmin((session.user as { role?: string })?.role || '')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <Breadcrumbs />
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-6 h-6 text-emerald-600" />
                  Compliance Audit Dashboard
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  Track and manage regulatory compliance audits
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => { setLoading(true); fetchData(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Total Audits" value={stats.total} icon={Shield} color="text-gray-600 dark:text-gray-400" />
            <StatCard label="Current" value={stats.current} icon={CheckCircle2} color="text-green-600 dark:text-green-400" />
            <StatCard label="Due Soon" value={stats.dueSoon} icon={Clock} color="text-amber-600 dark:text-amber-400" />
            <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} color="text-red-600 dark:text-red-400" />
            <StatCard label="Never Run" value={stats.neverRun} icon={XCircle} color="text-gray-500 dark:text-gray-500" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-1.5" />
            Audit Dashboard
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-1.5" />
            Audit History ({log.length})
          </button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="grid gap-4 md:grid-cols-2">
            {audits.map((audit) => (
              <AuditCard
                key={audit.id}
                audit={audit}
                running={runningAudit === audit.audit_type}
                onRun={() => handleRunAudit(audit.audit_type)}
                onLog={() => {
                  setLogModal(audit);
                  setLogForm({ result: 'pass', findings: '', actions_taken: '' });
                }}
              />
            ))}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {log.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No audit log entries yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Audit Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Result</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Performed By</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Findings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {log.map((entry) => {
                      const rc = RESULT_CONFIG[entry.result] || RESULT_CONFIG.info;
                      const ResultIcon = rc.icon;
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {entry.completed_at ? new Date(entry.completed_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {entry.audit?.audit_type || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${rc.bg} ${rc.color}`}>
                              <ResultIcon className="w-3 h-3" />
                              {rc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {entry.completed_by?.split('@')[0] || '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                            {entry.findings ? entry.findings.slice(0, 100) + (entry.findings.length > 100 ? '...' : '') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Script Output Modal */}
      {scriptOutput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{scriptOutput.audit} — Output</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Result: <span className={`font-medium ${scriptOutput.result === 'pass' ? 'text-green-600' : scriptOutput.result === 'fail' ? 'text-red-600' : 'text-blue-600'}`}>{scriptOutput.result.toUpperCase()}</span>
                </p>
              </div>
              <button onClick={() => setScriptOutput(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              {scriptOutput.stdout && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Standard Output</label>
                  <pre className="mt-1 p-3 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
                    {scriptOutput.stdout}
                  </pre>
                </div>
              )}
              {scriptOutput.stderr && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Errors / Warnings</label>
                  <pre className="mt-1 p-3 bg-gray-900 text-red-400 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                    {scriptOutput.stderr}
                  </pre>
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setScriptOutput(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Manual Audit Modal */}
      {logModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Log Audit: {logModal.audit_type}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{logModal.description}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Result</label>
                <select
                  value={logForm.result}
                  onChange={(e) => setLogForm(f => ({ ...f, result: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="info">Info / Noted</option>
                  <option value="n_a">N/A</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Findings</label>
                <textarea
                  value={logForm.findings}
                  onChange={(e) => setLogForm(f => ({ ...f, findings: e.target.value }))}
                  rows={3}
                  placeholder="Describe what was reviewed and any issues found..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actions Taken</label>
                <textarea
                  value={logForm.actions_taken}
                  onChange={(e) => setLogForm(f => ({ ...f, actions_taken: e.target.value }))}
                  rows={2}
                  placeholder="Any corrective actions or follow-ups..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setLogModal(null)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleLogAudit}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Log Audit Result
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── Sub-Components ─────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Shield; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function AuditCard({
  audit,
  running,
  onRun,
  onLog,
}: {
  audit: ComplianceAudit;
  running: boolean;
  onRun: () => void;
  onLog: () => void;
}) {
  const rc = audit.last_result ? RESULT_CONFIG[audit.last_result] : null;
  const ResultIcon = rc?.icon || Clock;

  // Determine status color for border
  let borderColor = 'border-gray-200 dark:border-gray-700';
  if (audit.is_overdue) borderColor = 'border-red-300 dark:border-red-700';
  else if (audit.last_result === 'pass') borderColor = 'border-green-200 dark:border-green-800';
  else if (audit.last_result === 'fail') borderColor = 'border-red-200 dark:border-red-800';

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border-2 ${borderColor} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{audit.audit_type}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{audit.description}</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 whitespace-nowrap">
          {FREQUENCY_LABELS[audit.frequency] || audit.frequency}
        </span>
      </div>

      {/* Status Row */}
      <div className="flex items-center gap-4 text-xs">
        {/* Last Result */}
        <div className="flex items-center gap-1">
          {rc ? (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${rc.bg} ${rc.color}`}>
              <ResultIcon className="w-3 h-3" />
              {rc.label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
              <Clock className="w-3 h-3" />
              Not run
            </span>
          )}
        </div>

        {/* Last Completed */}
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Calendar className="w-3 h-3" />
          {formatRelativeTime(audit.last_completed_at)}
        </div>

        {/* Due Date */}
        {audit.next_due_at && (
          <div className={`flex items-center gap-1 ${audit.is_overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
            <AlertTriangle className="w-3 h-3" />
            {formatDueDate(audit.next_due_at)}
          </div>
        )}
      </div>

      {/* Last completed by */}
      {audit.last_completed_by && (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <User className="w-3 h-3" />
          {audit.last_completed_by.split('@')[0]}
        </div>
      )}

      {/* Tool/method */}
      {audit.tool_method && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          Tool: {audit.tool_method}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
        {canRunScript(audit.audit_type) && (
          <button
            onClick={onRun}
            disabled={running}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              running
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-wait'
                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
            }`}
          >
            {running ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {running ? 'Running...' : 'Run Audit'}
          </button>
        )}
        <button
          onClick={onLog}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          Log Result
        </button>
      </div>
    </div>
  );
}
