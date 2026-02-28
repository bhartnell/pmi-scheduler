'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Megaphone,
  Users,
  Send,
  Clock,
  Link as LinkIcon,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Search,
  X,
  Loader2,
  Bell,
  Mail,
  LayoutGrid,
  History,
  ChevronDown,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { CurrentUser } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AudienceType = 'all' | 'roles' | 'cohort' | 'individual';
type NotificationType = 'in_app' | 'email' | 'both';
type Priority = 'normal' | 'important' | 'urgent';
type ScheduleMode = 'now' | 'scheduled';

interface Cohort {
  id: string;
  name: string;
  program?: { name: string; abbreviation: string };
}

interface LabUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface BroadcastHistory {
  id: string;
  title: string;
  message: string;
  audience_type: AudienceType;
  audience_filter: Record<string, any> | null;
  delivery_method: NotificationType;
  priority: Priority;
  recipient_count: number;
  sent_by: string;
  scheduled_at: string | null;
  sent_at: string;
  created_at: string;
}

const ROLES_OPTIONS = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'lead_instructor', label: 'Lead Instructor' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'volunteer_instructor', label: 'Volunteer Instructor' },
  { value: 'student', label: 'Student' },
  { value: 'guest', label: 'Guest' },
];

const PRIORITY_CONFIG: Record<Priority, { label: string; icon: typeof AlertCircle; badge: string; iconClass: string }> = {
  normal: {
    label: 'Normal',
    icon: Info,
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    iconClass: 'text-gray-500',
  },
  important: {
    label: 'Important',
    icon: AlertTriangle,
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    iconClass: 'text-amber-500',
  },
  urgent: {
    label: 'Urgent',
    icon: AlertCircle,
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    iconClass: 'text-red-500',
  },
};

const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, { label: string; icon: typeof Bell }> = {
  in_app: { label: 'In-app only', icon: Bell },
  email: { label: 'Email only', icon: Mail },
  both: { label: 'In-app + Email', icon: LayoutGrid },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Preview Card
// ---------------------------------------------------------------------------

function NotificationPreview({
  title,
  message,
  priority,
  linkUrl,
}: {
  title: string;
  message: string;
  priority: Priority;
  linkUrl: string;
}) {
  const cfg = PRIORITY_CONFIG[priority];
  const Icon = cfg.icon;

  const displayTitle = priority === 'urgent'
    ? `[URGENT] ${title || 'Notification Title'}`
    : priority === 'important'
    ? `[IMPORTANT] ${title || 'Notification Title'}`
    : title || 'Notification Title';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow p-4">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        Preview
      </p>
      <div className={`flex items-start gap-3 p-3 rounded-lg border ${
        priority === 'urgent'
          ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
          : priority === 'important'
          ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
      }`}>
        <div className={`flex-shrink-0 p-1.5 rounded-full ${
          priority === 'urgent'
            ? 'bg-red-100 dark:bg-red-900/30'
            : priority === 'important'
            ? 'bg-amber-100 dark:bg-amber-900/30'
            : 'bg-gray-100 dark:bg-gray-600'
        }`}>
          <Icon className={`w-4 h-4 ${cfg.iconClass}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
            {displayTitle}
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 leading-snug">
            {message || 'Your notification message will appear here.'}
          </p>
          {linkUrl && (
            <p className="text-blue-600 dark:text-blue-400 text-xs mt-1.5 flex items-center gap-1 truncate">
              <LinkIcon className="w-3 h-3 flex-shrink-0" />
              {linkUrl}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History Table
// ---------------------------------------------------------------------------

function BroadcastHistoryTable({ broadcasts }: { broadcasts: BroadcastHistory[] }) {
  if (broadcasts.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">No broadcasts sent yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/50">
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Audience</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Recipients</th>
            <th className="px-4 py-3">Sent By</th>
            <th className="px-4 py-3">Sent At</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {broadcasts.map((b) => {
            const priorityCfg = PRIORITY_CONFIG[b.priority];
            const PriorityIcon = priorityCfg.icon;

            const audienceLabel =
              b.audience_type === 'all'
                ? 'All Users'
                : b.audience_type === 'roles'
                ? `Roles (${(b.audience_filter?.roles || []).join(', ')})`
                : b.audience_type === 'cohort'
                ? `Cohort (${(b.audience_filter?.cohort_ids || []).length} selected)`
                : `Individual (${(b.audience_filter?.user_emails || []).length} users)`;

            return (
              <tr
                key={b.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-white">{b.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-xs truncate">{b.message}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
                    <Users className="w-3.5 h-3.5" />
                    {audienceLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 capitalize">
                  {NOTIFICATION_TYPE_CONFIG[b.delivery_method]?.label || b.delivery_method}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priorityCfg.badge}`}>
                    <PriorityIcon className="w-3 h-3" />
                    {priorityCfg.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900 dark:text-white">{b.recipient_count}</span>
                  <span className="text-gray-500 dark:text-gray-400"> users</span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">
                  {b.sent_by}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs whitespace-nowrap">
                  {formatDate(b.sent_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function BroadcastPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Options data
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [allUsers, setAllUsers] = useState<LabUser[]>([]);

  // Broadcast history
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audienceType, setAudienceType] = useState<AudienceType>('all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<LabUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [notificationType, setNotificationType] = useState<NotificationType>('in_app');
  const [priority, setPriority] = useState<Priority>('normal');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('now');
  const [scheduledFor, setScheduledFor] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // Send result
  const [lastSendResult, setLastSendResult] = useState<{ count: number; id: string } | null>(null);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
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
        fetchOptions();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const res = await fetch('/api/admin/broadcast');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
        setAllUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching broadcast options:', error);
    }
    setLoading(false);
  };

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/admin/broadcast/history?limit=20');
      const data = await res.json();
      if (data.success) {
        setHistory(data.broadcasts || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
    setHistoryLoading(false);
  }, []);

  const handleToggleHistory = () => {
    if (!showHistory) {
      fetchHistory();
    }
    setShowHistory(!showHistory);
  };

  // -------------------------------------------------------------------------
  // Recipient count preview
  // -------------------------------------------------------------------------
  const estimatedCount = (() => {
    if (audienceType === 'all') return allUsers.length;
    if (audienceType === 'roles') {
      return allUsers.filter(u => selectedRoles.includes(u.role)).length;
    }
    if (audienceType === 'cohort') return null; // fetched server-side
    if (audienceType === 'individual') return selectedUsers.length;
    return 0;
  })();

  // -------------------------------------------------------------------------
  // Audience helpers
  // -------------------------------------------------------------------------
  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const toggleCohort = (id: string) => {
    setSelectedCohortIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const addUser = (user: LabUser) => {
    if (!selectedUsers.find(u => u.email === user.email)) {
      setSelectedUsers(prev => [...prev, user]);
    }
    setUserSearch('');
  };

  const removeUser = (email: string) => {
    setSelectedUsers(prev => prev.filter(u => u.email !== email));
  };

  const filteredUserSearch = userSearch.length >= 2
    ? allUsers.filter(u =>
        (u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
         u.email.toLowerCase().includes(userSearch.toLowerCase())) &&
        !selectedUsers.find(s => s.email === u.email)
      ).slice(0, 10)
    : [];

  // -------------------------------------------------------------------------
  // Send
  // -------------------------------------------------------------------------
  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    if (audienceType === 'roles' && selectedRoles.length === 0) {
      toast.error('Select at least one role');
      return;
    }
    if (audienceType === 'cohort' && selectedCohortIds.length === 0) {
      toast.error('Select at least one cohort');
      return;
    }
    if (audienceType === 'individual' && selectedUsers.length === 0) {
      toast.error('Select at least one recipient');
      return;
    }
    if (scheduleMode === 'scheduled' && !scheduledFor) {
      toast.error('Please set a scheduled date/time');
      return;
    }

    // Build audience_filter
    let audienceFilter: Record<string, any> | null = null;
    if (audienceType === 'roles') {
      audienceFilter = { roles: selectedRoles };
    } else if (audienceType === 'cohort') {
      audienceFilter = { cohort_ids: selectedCohortIds };
    } else if (audienceType === 'individual') {
      audienceFilter = { user_emails: selectedUsers.map(u => u.email) };
    }

    setSending(true);
    setLastSendResult(null);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          audience_type: audienceType,
          audience_filter: audienceFilter,
          delivery_method: notificationType,
          priority,
          link_url: linkUrl.trim() || null,
          scheduled_at:
            scheduleMode === 'scheduled' && scheduledFor
              ? new Date(scheduledFor).toISOString()
              : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send broadcast');
      }

      toast.success(`Broadcast sent to ${data.recipient_count} user${data.recipient_count !== 1 ? 's' : ''}`);
      setLastSendResult({ count: data.recipient_count, id: data.broadcast_id });

      // Reset form
      setTitle('');
      setMessage('');
      setAudienceType('all');
      setSelectedRoles([]);
      setSelectedCohortIds([]);
      setSelectedUsers([]);
      setNotificationType('in_app');
      setPriority('normal');
      setScheduleMode('now');
      setScheduledFor('');
      setLinkUrl('');

      // Refresh history if visible
      if (showHistory) {
        fetchHistory();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send broadcast');
    }
    setSending(false);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }

  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
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
            <span className="text-gray-900 dark:text-white">Broadcast Notifications</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Megaphone className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Broadcast Notifications</h1>
                <p className="text-gray-600 dark:text-gray-400">Send notifications to targeted groups of users</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={handleToggleHistory}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <History className="w-4 h-4" />
                History
                <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Success banner */}
        {lastSendResult && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900 dark:text-green-100">Broadcast sent successfully</p>
              <p className="text-sm text-green-800 dark:text-green-200">
                Delivered to {lastSendResult.count} recipient{lastSendResult.count !== 1 ? 's' : ''}.
                {lastSendResult.id && (
                  <span className="ml-1 text-green-600 dark:text-green-400 text-xs">ID: {lastSendResult.id.slice(0, 8)}</span>
                )}
              </p>
            </div>
            <button
              onClick={() => setLastSendResult(null)}
              className="ml-auto text-green-500 hover:text-green-700 dark:hover:text-green-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* History panel */}
        {showHistory && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Send History</h2>
              {historyLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            <BroadcastHistoryTable broadcasts={history} />
          </div>
        )}

        {/* Compose + Preview grid */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Compose form - 3/5 width */}
          <div className="lg:col-span-3 space-y-5">
            {/* Message Composition */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-4">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Compose Message
              </h2>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Important Schedule Update"
                  maxLength={150}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Write your notification message here..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Link URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5" />
                  Link URL
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://... (users will be directed here when clicking)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Delivery Options */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-4">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Delivery Options
              </h2>

              {/* Notification Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Delivery Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(NOTIFICATION_TYPE_CONFIG) as [NotificationType, typeof NOTIFICATION_TYPE_CONFIG[NotificationType]][]).map(([val, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setNotificationType(val)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                          notificationType === val
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG[Priority]][]).map(([val, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPriority(val)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                          priority === val
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${priority === val ? 'text-indigo-600 dark:text-indigo-400' : cfg.iconClass}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  When to Send
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setScheduleMode('now')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      scheduleMode === 'now'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Now
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleMode('scheduled');
                      if (!scheduledFor) {
                        setScheduledFor(formatDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString()));
                      }
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      scheduleMode === 'scheduled'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Schedule
                  </button>
                </div>
                {scheduleMode === 'scheduled' && (
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={e => setScheduledFor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right column - 2/5 width: audience + preview */}
          <div className="lg:col-span-2 space-y-5">
            {/* Audience Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-4">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Audience
              </h2>

              {/* Audience type tabs */}
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { val: 'all', label: 'All Users' },
                  { val: 'roles', label: 'By Role' },
                  { val: 'cohort', label: 'By Cohort' },
                  { val: 'individual', label: 'Individual' },
                ] as { val: AudienceType; label: string }[]).map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAudienceType(val)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      audienceType === val
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* All Users */}
              {audienceType === 'all' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Notification will be sent to <strong>all {allUsers.length} active users</strong>.
                  </p>
                </div>
              )}

              {/* By Role */}
              {audienceType === 'roles' && (
                <div className="space-y-2">
                  {ROLES_OPTIONS.map(role => (
                    <label key={role.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.value)}
                        onChange={() => toggleRole(role.value)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{role.label}</span>
                      <span className="ml-auto text-xs text-gray-400">
                        {allUsers.filter(u => u.role === role.value).length}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* By Cohort */}
              {audienceType === 'cohort' && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {cohorts.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No active cohorts found</p>
                  ) : (
                    cohorts.map(cohort => (
                      <label key={cohort.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCohortIds.includes(cohort.id)}
                          onChange={() => toggleCohort(cohort.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300 leading-tight">
                          {cohort.name}
                          {cohort.program?.abbreviation && (
                            <span className="ml-1 text-xs text-gray-400">({cohort.program.abbreviation})</span>
                          )}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              )}

              {/* Individual */}
              {audienceType === 'individual' && (
                <div className="space-y-3">
                  {/* Search box */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* Search results dropdown */}
                  {filteredUserSearch.length > 0 && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-700 max-h-40 overflow-y-auto">
                      {filteredUserSearch.map(user => (
                        <button
                          key={user.email}
                          type="button"
                          onClick={() => addUser(user)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                          </div>
                          <span className="text-xs text-gray-400 capitalize">{user.role}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected users */}
                  {selectedUsers.length > 0 && (
                    <div className="space-y-1.5">
                      {selectedUsers.map(user => (
                        <div key={user.email} className="flex items-center gap-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeUser(user.email)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recipient count preview */}
              {estimatedCount !== null && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <strong className="text-gray-900 dark:text-white">{estimatedCount}</strong>
                    {estimatedCount === 1 ? ' recipient' : ' recipients'} will receive this notification
                  </p>
                </div>
              )}
              {audienceType === 'cohort' && selectedCohortIds.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {selectedCohortIds.length} cohort{selectedCohortIds.length !== 1 ? 's' : ''} selected
                    <span className="text-gray-400">(count resolved at send time)</span>
                  </p>
                </div>
              )}
            </div>

            {/* Preview */}
            <NotificationPreview
              title={title}
              message={message}
              priority={priority}
              linkUrl={linkUrl}
            />

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !title.trim() || !message.trim()}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {sending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  {scheduleMode === 'scheduled' ? 'Schedule Broadcast' : 'Send Broadcast'}
                </>
              )}
            </button>

            {scheduleMode === 'scheduled' && scheduledFor && (
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                Scheduled for {formatDate(new Date(scheduledFor).toISOString())}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
