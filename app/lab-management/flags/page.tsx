'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  AlertTriangle,
  Star,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  MessageSquare,
  Filter,
  RefreshCw
} from 'lucide-react';

interface FlaggedItem {
  id: string;
  created_at: string;
  issue_level: string;
  flag_categories: string[] | null;
  flagged_for_review: boolean;
  flag_resolved: boolean;
  flag_resolution_notes: string | null;
  overall_comments: string | null;
  graded_by: string | null;
  scenario: { id: string; title: string; category: string } | null;
  station: {
    id: string;
    station_number: number;
    lab_day: { id: string; date: string } | null;
  } | null;
  lab_group: { id: string; name: string } | null;
  team_lead: { id: string; first_name: string; last_name: string } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  affective: 'Affective/Attitude',
  skill_performance: 'Skill Performance',
  safety: 'Safety Concern',
  remediation: 'Needs Remediation',
  positive: 'Positive Recognition'
};

export default function FlaggedItemsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [flaggedItems, setFlaggedItems] = useState<FlaggedItem[]>([]);
  const [needsAttention, setNeedsAttention] = useState<FlaggedItem[]>([]);
  const [positiveRecognition, setPositiveRecognition] = useState<FlaggedItem[]>([]);
  const [minorIssues, setMinorIssues] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [showResolved, setShowResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchFlaggedItems();
    }
  }, [session, days, showResolved]);

  const fetchFlaggedItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        days: days.toString(),
        ...(showResolved ? {} : { resolved: 'false' })
      });
      const res = await fetch(`/api/lab-management/flagged-items?${params}`);
      const data = await res.json();
      if (data.success) {
        setFlaggedItems(data.flaggedItems || []);
        setNeedsAttention(data.needsAttention || []);
        setPositiveRecognition(data.positiveRecognition || []);
        setMinorIssues(data.minorIssues || []);
      }
    } catch (error) {
      console.error('Error fetching flagged items:', error);
    }
    setLoading(false);
  };

  const handleResolve = async (itemId: string, resolved: boolean) => {
    try {
      const res = await fetch('/api/lab-management/flagged-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId: itemId,
          resolved,
          resolutionNotes: resolvingId === itemId ? resolutionNotes : null
        })
      });
      const data = await res.json();
      if (data.success) {
        setResolvingId(null);
        setResolutionNotes('');
        fetchFlaggedItems();
      }
    } catch (error) {
      console.error('Error updating resolution:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (status === 'loading' || loading) {
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
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">Flagged Items</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Flagged Items</h1>
                <p className="text-gray-600 dark:text-gray-400">Review flagged assessments and positive recognition</p>
              </div>
            </div>
            <button
              onClick={fetchFlaggedItems}
              className="flex items-center gap-2 px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
            </div>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={60}>Last 60 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Show Resolved</span>
            </label>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-1">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Needs Attention</span>
            </div>
            <div className="text-3xl font-bold text-red-800 dark:text-red-300">{needsAttention.length}</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 mb-1">
              <MessageSquare className="w-5 h-5" />
              <span className="font-medium">Minor Issues</span>
            </div>
            <div className="text-3xl font-bold text-yellow-800 dark:text-yellow-300">{minorIssues.length}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
              <Star className="w-5 h-5" />
              <span className="font-medium">Positive Recognition</span>
            </div>
            <div className="text-3xl font-bold text-green-800 dark:text-green-300">{positiveRecognition.length}</div>
          </div>
        </div>

        {/* Needs Attention */}
        {needsAttention.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5" />
              Needs Attention ({needsAttention.length})
            </h2>
            <div className="space-y-3">
              {needsAttention.map(item => (
                <FlaggedItemCard
                  key={item.id}
                  item={item}
                  type="attention"
                  resolvingId={resolvingId}
                  setResolvingId={setResolvingId}
                  resolutionNotes={resolutionNotes}
                  setResolutionNotes={setResolutionNotes}
                  onResolve={handleResolve}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </div>
        )}

        {/* Minor Issues */}
        {minorIssues.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5" />
              Minor Issues ({minorIssues.length})
            </h2>
            <div className="space-y-3">
              {minorIssues.map(item => (
                <FlaggedItemCard
                  key={item.id}
                  item={item}
                  type="minor"
                  resolvingId={resolvingId}
                  setResolvingId={setResolvingId}
                  resolutionNotes={resolutionNotes}
                  setResolutionNotes={setResolutionNotes}
                  onResolve={handleResolve}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </div>
        )}

        {/* Positive Recognition */}
        {positiveRecognition.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-green-700 dark:text-green-400 flex items-center gap-2 mb-3">
              <Star className="w-5 h-5" />
              Positive Recognition ({positiveRecognition.length})
            </h2>
            <div className="space-y-3">
              {positiveRecognition.map(item => (
                <FlaggedItemCard
                  key={item.id}
                  item={item}
                  type="positive"
                  resolvingId={resolvingId}
                  setResolvingId={setResolvingId}
                  resolutionNotes={resolutionNotes}
                  setResolutionNotes={setResolutionNotes}
                  onResolve={handleResolve}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {flaggedItems.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">All Clear!</h3>
            <p className="text-gray-600 dark:text-gray-400">
              No flagged items in the last {days} days.
              {!showResolved && ' Toggle "Show Resolved" to see resolved items.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// Separate component for flagged item cards
function FlaggedItemCard({
  item,
  type,
  resolvingId,
  setResolvingId,
  resolutionNotes,
  setResolutionNotes,
  onResolve,
  formatDate
}: {
  item: FlaggedItem;
  type: 'attention' | 'minor' | 'positive';
  resolvingId: string | null;
  setResolvingId: (id: string | null) => void;
  resolutionNotes: string;
  setResolutionNotes: (notes: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  formatDate: (date: string) => string;
}) {
  const borderColor = type === 'attention' ? 'border-red-200 dark:border-red-800' :
                      type === 'minor' ? 'border-yellow-200 dark:border-yellow-800' :
                      'border-green-200 dark:border-green-800';

  const bgColor = type === 'attention' ? 'bg-red-50 dark:bg-red-900/10' :
                  type === 'minor' ? 'bg-yellow-50 dark:bg-yellow-900/10' :
                  'bg-green-50 dark:bg-green-900/10';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Header with date and scenario */}
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="w-4 h-4" />
              {item.station?.lab_day?.date ? formatDate(item.station.lab_day.date) : 'N/A'}
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {item.scenario?.title || 'Unknown Scenario'}
            </span>
            {item.lab_group && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                - {item.lab_group.name}
              </span>
            )}
          </div>

          {/* Flagged by */}
          {item.graded_by && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
              <User className="w-4 h-4" />
              Flagged by: {item.graded_by}
            </div>
          )}

          {/* Team Lead */}
          {item.team_lead && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Team Lead: {item.team_lead.first_name} {item.team_lead.last_name}
            </div>
          )}

          {/* Categories */}
          {item.flag_categories && item.flag_categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {item.flag_categories.map(cat => (
                <span
                  key={cat}
                  className={`px-2 py-0.5 text-xs rounded ${
                    cat === 'positive' ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' :
                    cat === 'safety' ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' :
                    'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </span>
              ))}
            </div>
          )}

          {/* Comments */}
          {item.overall_comments && (
            <div className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded p-2 mt-2">
              &ldquo;{item.overall_comments}&rdquo;
            </div>
          )}

          {/* Resolution Status */}
          {item.flag_resolved && (
            <div className="mt-2 text-sm text-green-700 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Resolved
              {item.flag_resolution_notes && `: ${item.flag_resolution_notes}`}
            </div>
          )}
        </div>

        {/* Actions */}
        {type !== 'positive' && !item.flag_resolved && (
          <div className="flex flex-col gap-2">
            {resolvingId === item.id ? (
              <div className="space-y-2">
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Resolution notes (optional)..."
                  rows={2}
                  className="w-48 px-2 py-1 text-sm border dark:border-gray-600 rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => onResolve(item.id, true)}
                    className="flex-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => { setResolvingId(null); setResolutionNotes(''); }}
                    className="px-2 py-1 text-xs border dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setResolvingId(item.id)}
                className="px-3 py-1.5 text-sm border dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Mark Resolved
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
