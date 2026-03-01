'use client';

/**
 * Integration Webhooks Admin Page
 *
 * Manage outbound webhook integrations for the PMI EMS Scheduler.
 * Supports:
 * - List webhooks with delivery stats (success rate, last delivery)
 * - Create new webhooks with event subscriptions, custom headers, optional secret
 * - Edit and delete existing webhooks
 * - Toggle active/inactive per webhook
 * - Test delivery for any subscribed event
 * - Delivery log table with expandable payload/response detail
 * - Signature verification code example panel
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Webhook,
  Plus,
  Trash2,
  Pencil,
  X,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Play,
  RefreshCw,
  Code,
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  Activity,
  KeyRound,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_GROUPS } from '@/lib/webhooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookRecord {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  headers: Record<string, string>;
  created_by: string;
  created_at: string;
  updated_at: string;
  stats: {
    total_deliveries: number;
    success_count: number;
    failure_count: number;
    success_rate: number | null;
    last_delivery_at: string | null;
    last_delivery_success: boolean | null;
    last_delivery_status: number | null;
  };
}

interface WebhookLog {
  id: string;
  webhook_id: string;
  event: string;
  payload: object | null;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  retry_count: number;
  created_at: string;
}

interface HeaderEntry {
  key: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusColor(status: number | null): string {
  if (status === null) return 'text-gray-400';
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 400) return 'text-red-600 dark:text-red-400';
  return 'text-yellow-600 dark:text-yellow-400';
}

function statusBg(success: boolean): string {
  return success
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
}

// ---------------------------------------------------------------------------
// Create / Edit Webhook Modal
// ---------------------------------------------------------------------------

interface WebhookModalProps {
  initial: WebhookRecord | null;
  onClose: () => void;
  onSave: (payload: object) => Promise<void>;
}

function WebhookModal({ initial, onClose, onSave }: WebhookModalProps) {
  const isEditing = !!initial;

  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [secret, setSecret] = useState(initial?.secret ?? '');
  const [showSecret, setShowSecret] = useState(false);
  const [generateSecret, setGenerateSecret] = useState(!initial?.secret);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    new Set(initial?.events ?? [])
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [headers, setHeaders] = useState<HeaderEntry[]>(() => {
    const h = initial?.headers ?? {};
    return Object.entries(h).map(([key, value]) => ({ key, value }));
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  };

  const toggleGroup = (groupEvents: string[]) => {
    const allSelected = groupEvents.every((e) => selectedEvents.has(e));
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        groupEvents.forEach((e) => next.delete(e));
      } else {
        groupEvents.forEach((e) => next.add(e));
      }
      return next;
    });
  };

  const addHeader = () => setHeaders((prev) => [...prev, { key: '', value: '' }]);
  const removeHeader = (i: number) => setHeaders((prev) => prev.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: 'key' | 'value', val: string) => {
    setHeaders((prev) => prev.map((h, idx) => (idx === i ? { ...h, [field]: val } : h)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Name is required'); return; }
    if (!url.trim()) { setError('URL is required'); return; }
    try { new URL(url); } catch { setError('Invalid URL'); return; }
    if (selectedEvents.size === 0) { setError('Select at least one event'); return; }

    // Build headers object, skip empty keys
    const headersObj: Record<string, string> = {};
    headers.forEach(({ key, value }) => {
      if (key.trim()) headersObj[key.trim()] = value;
    });

    const payload: Record<string, unknown> = {
      name: name.trim(),
      url: url.trim(),
      events: Array.from(selectedEvents),
      is_active: isActive,
      headers: headersObj,
    };

    // Handle secret
    if (generateSecret) {
      payload.secret = ''; // server will generate
    } else {
      payload.secret = secret || null;
    }

    setSaving(true);
    try {
      await onSave(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/70 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEditing ? 'Edit Webhook' : 'New Webhook'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Webhook Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Zapier Student Events"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Endpoint URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.example.com/..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Signing Secret
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateSecret}
                  onChange={(e) => setGenerateSecret(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Auto-generate a random secret
                </span>
              </label>
              {!generateSecret && (
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="Optional signing secret"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-10 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Used to sign payloads with HMAC-SHA256. Sent as{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">X-Webhook-Signature</code>.
            </p>
          </div>

          {/* Events */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subscribed Events{' '}
              <span className="text-xs font-normal text-gray-500">
                ({selectedEvents.size} selected)
              </span>
            </label>
            <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              {Object.entries(WEBHOOK_EVENT_GROUPS).map(([groupName, groupEvents]) => {
                const allSelected = groupEvents.every((e) => selectedEvents.has(e));
                const someSelected = groupEvents.some((e) => selectedEvents.has(e));
                return (
                  <div key={groupName}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                        onChange={() => toggleGroup(groupEvents)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {groupName}
                      </span>
                    </div>
                    <div className="ml-6 flex flex-wrap gap-2">
                      {groupEvents.map((event) => (
                        <label
                          key={event}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer border transition-colors ${
                            selectedEvents.has(event)
                              ? 'bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-300'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEvents.has(event)}
                            onChange={() => toggleEvent(event)}
                            className="sr-only"
                          />
                          {event}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Headers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Custom Headers
              </label>
              <button
                type="button"
                onClick={addHeader}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Header
              </button>
            </div>
            {headers.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No custom headers. Click "Add Header" to add Authorization or other headers.
              </p>
            ) : (
              <div className="space-y-2">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={h.key}
                      onChange={(e) => updateHeader(i, 'key', e.target.value)}
                      placeholder="Header name"
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={h.value}
                      onChange={(e) => updateHeader(i, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeHeader(i)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Enable or pause this webhook</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
            >
              {isActive ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEditing ? 'Save Changes' : 'Create Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Panel – logs + test
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  webhook: WebhookRecord;
  onClose: () => void;
  onRefresh: () => void;
}

function DetailPanel({ webhook, onClose, onRefresh }: DetailPanelProps) {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPages, setLogsPages] = useState(1);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [testEvent, setTestEvent] = useState<string>(webhook.events[0] ?? WEBHOOK_EVENTS[0]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; status: number | null; body: string } | null>(null);
  const [showSignaturePanel, setShowSignaturePanel] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchLogs = useCallback(async (page: number) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/admin/webhooks/${webhook.id}/logs?page=${page}&limit=25`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        setLogsTotal(data.total);
        setLogsPages(data.pages);
        setLogsPage(page);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
    setLogsLoading(false);
  }, [webhook.id]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/webhooks/${webhook.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: testEvent }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, status: data.status, body: data.body });
      await fetchLogs(1);
      onRefresh();
    } catch (err) {
      setTestResult({ success: false, status: null, body: err instanceof Error ? err.message : 'Request failed' });
    }
    setTesting(false);
  };

  const signatureCode = `// Node.js example
const crypto = require('crypto');

function verifySignature(payload, secret, signature) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

// In your Express route:
app.post('/webhook', (req, res) => {
  const sig = req.headers['x-webhook-signature'];
  const body = JSON.stringify(req.body);
  if (!verifySignature(body, process.env.WEBHOOK_SECRET, sig)) {
    return res.status(401).send('Invalid signature');
  }
  // Handle event: req.headers['x-webhook-event']
  res.sendStatus(200);
});`;

  const copySignatureCode = () => {
    navigator.clipboard.writeText(signatureCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 mt-2">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
          {webhook.name} — Details
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Config summary */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Endpoint</p>
            <p className="text-gray-900 dark:text-white break-all">{webhook.url}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Events</p>
            <div className="flex flex-wrap gap-1">
              {webhook.events.map((ev) => (
                <span key={ev} className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                  {ev}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Signing Secret</p>
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300 text-xs">
                {webhook.secret ? 'Configured' : 'Not set'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Delivery Rate</p>
            <p className="text-gray-900 dark:text-white">
              {webhook.stats.success_rate !== null
                ? `${webhook.stats.success_rate}% (${webhook.stats.success_count}/${webhook.stats.total_deliveries})`
                : 'No deliveries yet'}
            </p>
          </div>
        </div>

        {/* Test section */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Send Test Delivery</p>
          <div className="flex gap-2">
            <select
              value={testEvent}
              onChange={(e) => setTestEvent(e.target.value)}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {webhook.events.map((ev) => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>
            <button
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Test
            </button>
          </div>
          {testResult && (
            <div
              className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                testResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              }`}
            >
              {testResult.success
                ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <div>
                <p className="font-medium">
                  {testResult.success ? 'Delivery successful' : 'Delivery failed'}
                  {testResult.status !== null && ` — HTTP ${testResult.status}`}
                </p>
                {testResult.body && (
                  <p className="text-xs mt-1 opacity-80 font-mono break-all line-clamp-3">
                    {testResult.body}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Signature Verification */}
        <div>
          <button
            onClick={() => setShowSignaturePanel(!showSignaturePanel)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <Code className="w-4 h-4" />
            Signature Verification Example
            {showSignaturePanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showSignaturePanel && (
            <div className="mt-3 bg-gray-900 dark:bg-gray-950 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                <span className="text-xs text-gray-400">Node.js / Express</span>
                <button
                  onClick={copySignatureCode}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-4 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap">
                {signatureCode}
              </pre>
            </div>
          )}
        </div>

        {/* Delivery Logs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Delivery Logs
              {logsTotal > 0 && (
                <span className="ml-1 text-xs text-gray-500">({logsTotal} total)</span>
              )}
            </p>
            <button
              onClick={() => fetchLogs(logsPage)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No deliveries yet</p>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Event</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Time</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Result</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      >
                        <td className="px-3 py-2">
                          <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                            {log.event}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="w-3 h-3" />
                            {timeAgo(log.created_at)}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-mono font-semibold ${statusColor(log.response_status)}`}>
                            {log.response_status ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBg(log.success)}`}>
                            {log.success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {expandedLog === log.id
                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </td>
                      </tr>
                      {expandedLog === log.id && (
                        <tr key={`${log.id}-expanded`} className="bg-gray-50 dark:bg-gray-900/30">
                          <td colSpan={5} className="px-3 py-3 space-y-2">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                Sent at: {formatDateTime(log.created_at)}
                              </p>
                            </div>
                            {log.payload && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Request Payload</p>
                                <pre className="bg-gray-900 dark:bg-gray-950 text-green-300 rounded p-2 text-xs overflow-x-auto max-h-40">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.response_body && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Response Body</p>
                                <pre className="bg-gray-900 dark:bg-gray-950 text-gray-300 rounded p-2 text-xs overflow-x-auto max-h-32">
                                  {log.response_body}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {logsPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Page {logsPage} of {logsPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchLogs(logsPage - 1)}
                      disabled={logsPage <= 1}
                      className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchLogs(logsPage + 1)}
                      disabled={logsPage >= logsPages}
                      className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WebhooksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<{ email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookRecord | null>(null);
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) fetchCurrentUser();
  }, [session]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
        await fetchWebhooks();
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
    setLoading(false);
  };

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/webhooks');
      const data = await res.json();
      if (data.success) setWebhooks(data.webhooks ?? []);
    } catch (err) {
      console.error('Error fetching webhooks:', err);
    }
  }, []);

  const handleCreate = async (payload: object) => {
    const res = await fetch('/api/admin/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error ?? 'Failed to create webhook');
    await fetchWebhooks();
    setShowModal(false);
    showToast('Webhook created', 'success');
  };

  const handleUpdate = async (id: string, payload: object) => {
    const res = await fetch(`/api/admin/webhooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error ?? 'Failed to update webhook');
    await fetchWebhooks();
    setEditingWebhook(null);
    showToast('Webhook updated', 'success');
  };

  const handleDelete = async (wh: WebhookRecord) => {
    if (!confirm(`Delete webhook "${wh.name}"? All delivery logs will also be deleted. This cannot be undone.`)) return;
    setDeletingId(wh.id);
    try {
      const res = await fetch(`/api/admin/webhooks/${wh.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchWebhooks();
      if (expandedWebhook === wh.id) setExpandedWebhook(null);
      showToast('Webhook deleted', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
    setDeletingId(null);
  };

  const handleToggleActive = async (wh: WebhookRecord) => {
    setTogglingId(wh.id);
    try {
      const res = await fetch(`/api/admin/webhooks/${wh.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !wh.is_active }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchWebhooks();
      showToast(`Webhook ${!wh.is_active ? 'activated' : 'paused'}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to toggle', 'error');
    }
    setTogglingId(null);
  };

  const activeCount = webhooks.filter((w) => w.is_active).length;

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <WebhookModal
          initial={null}
          onClose={() => setShowModal(false)}
          onSave={handleCreate}
        />
      )}

      {/* Edit Modal */}
      {editingWebhook && (
        <WebhookModal
          initial={editingWebhook}
          onClose={() => setEditingWebhook(null)}
          onSave={(payload) => handleUpdate(editingWebhook.id, payload)}
        />
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
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
            <span className="text-gray-900 dark:text-white">Integration Webhooks</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Webhook className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Integration Webhooks</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Send real-time event notifications to external systems
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Webhook
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="flex flex-wrap items-center gap-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{webhooks.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-400 dark:text-gray-500">
              {webhooks.length - activeCount}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Paused</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {WEBHOOK_EVENTS.length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Event Types</p>
          </div>
        </div>

        {/* Info panel */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">How webhooks work</p>
            <p className="text-blue-800 dark:text-blue-200 mt-1">
              When a subscribed event occurs in the system, an HTTP POST request is sent to your
              endpoint with a JSON payload. Include a signing secret to verify requests using the{' '}
              <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded text-xs">
                X-Webhook-Signature
              </code>{' '}
              header (HMAC-SHA256). Your endpoint should respond within 10 seconds with a 2xx status.
            </p>
          </div>
        </div>

        {/* Webhook list */}
        {webhooks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <Webhook className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No webhooks yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Create a webhook to start receiving real-time event notifications in external systems like
              Zapier, Slack, or your own API.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create First Webhook
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div key={wh.id}>
                {/* Webhook row card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Status indicator */}
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        wh.is_active ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                          {wh.name}
                        </p>
                        {wh.stats.last_delivery_success === false && (
                          <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded-full font-medium">
                            Last failed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {wh.url}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {wh.events.slice(0, 4).map((ev) => (
                          <span
                            key={ev}
                            className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded text-xs"
                          >
                            {ev}
                          </span>
                        ))}
                        {wh.events.length > 4 && (
                          <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
                            +{wh.events.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delivery stats */}
                    <div className="hidden md:block text-right flex-shrink-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {wh.stats.success_rate !== null ? `${wh.stats.success_rate}%` : '—'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {wh.stats.total_deliveries > 0
                          ? `${wh.stats.total_deliveries} deliveries`
                          : 'No deliveries'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {timeAgo(wh.stats.last_delivery_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Toggle active */}
                      <button
                        onClick={() => handleToggleActive(wh)}
                        disabled={togglingId === wh.id}
                        title={wh.is_active ? 'Pause webhook' : 'Activate webhook'}
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                          wh.is_active
                            ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
                            : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {togglingId === wh.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : wh.is_active ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </button>

                      {/* Expand */}
                      <button
                        onClick={() => setExpandedWebhook(expandedWebhook === wh.id ? null : wh.id)}
                        title="View details & logs"
                        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        {expandedWebhook === wh.id
                          ? <ChevronUp className="w-4 h-4" />
                          : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => setEditingWebhook(wh)}
                        title="Edit webhook"
                        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(wh)}
                        disabled={deletingId === wh.id}
                        title="Delete webhook"
                        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        {deletingId === wh.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {expandedWebhook === wh.id && (
                  <DetailPanel
                    webhook={wh}
                    onClose={() => setExpandedWebhook(null)}
                    onRefresh={fetchWebhooks}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
