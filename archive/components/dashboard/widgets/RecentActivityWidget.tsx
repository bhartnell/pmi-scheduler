'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckSquare,
  Calendar,
  Users,
  Stethoscope,
  ClipboardList,
  Bell,
  ChevronDown,
  BookOpen,
} from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string;
  title: string;
  message: string;
  type: string;
  filterCategory: string;
  category: string;
  is_read: boolean;
  created_at: string;
  link: string | null;
  reference_type: string | null;
  reference_id: string | null;
  actor: string | null;
}

type FilterCategory = 'all' | 'tasks' | 'labs' | 'shifts' | 'students' | 'clinical';

const FILTER_PILLS: { id: FilterCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'labs', label: 'Labs' },
  { id: 'shifts', label: 'Shifts' },
  { id: 'students', label: 'Students' },
  { id: 'clinical', label: 'Clinical' },
];

const PAGE_SIZE = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a relative time string: "Just now", "2m ago", "3h ago",
 * "Yesterday", "3 days ago", or a short date like "Jan 12".
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Deterministic color index based on a string (name/email hash).
 * Returns one of 8 Tailwind color classes.
 */
function getAvatarColor(name: string): string {
  const COLORS = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-pink-500',
    'bg-teal-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

/**
 * Extracts a 1-2 character initial from a name/email.
 * "John Smith" → "JS", "jsmith@pmi.edu" → "J"
 */
function getInitial(nameOrEmail: string): string {
  if (!nameOrEmail) return '?';
  // Try to split on spaces for a real name
  const parts = nameOrEmail.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  // Email: use first letter before @
  return nameOrEmail[0].toUpperCase();
}

/**
 * Returns an icon + color for a given notification type.
 */
function getActivityIcon(type: string, filterCategory: string): { icon: React.ReactNode; ring: string } {
  switch (filterCategory) {
    case 'tasks':
      return {
        icon: <CheckSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
        ring: 'ring-amber-200 dark:ring-amber-800/50 bg-amber-50 dark:bg-amber-900/20',
      };
    case 'labs':
      return {
        icon: <Calendar className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />,
        ring: 'ring-green-200 dark:ring-green-800/50 bg-green-50 dark:bg-green-900/20',
      };
    case 'shifts':
      return {
        icon: <ClipboardList className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />,
        ring: 'ring-purple-200 dark:ring-purple-800/50 bg-purple-50 dark:bg-purple-900/20',
      };
    case 'students':
      return {
        icon: <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
        ring: 'ring-blue-200 dark:ring-blue-800/50 bg-blue-50 dark:bg-blue-900/20',
      };
    case 'clinical':
      return {
        icon: <Stethoscope className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />,
        ring: 'ring-teal-200 dark:ring-teal-800/50 bg-teal-50 dark:bg-teal-900/20',
      };
    case 'feedback':
      return {
        icon: <BookOpen className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
        ring: 'ring-rose-200 dark:ring-rose-800/50 bg-rose-50 dark:bg-rose-900/20',
      };
    default:
      return {
        icon: <Bell className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />,
        ring: 'ring-gray-200 dark:ring-gray-700 bg-gray-50 dark:bg-gray-800',
      };
  }
}

// ─── Avatar Component ────────────────────────────────────────────────────────

function ActivityAvatar({ name }: { name: string }) {
  const colorClass = getAvatarColor(name);
  const initial = getInitial(name);
  return (
    <div
      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${colorClass}`}
      title={name}
    >
      {initial}
    </div>
  );
}

// ─── Single Activity Row ─────────────────────────────────────────────────────

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const { icon, ring } = getActivityIcon(entry.type, entry.filterCategory);

  // Extract a display name from the notification title (best effort).
  // Many notification titles start with an actor name, e.g. "John assigned you a task".
  // We use the title's first word as a stand-in for the avatar.
  const avatarName = entry.actor || entry.title.split(' ')[0] || 'System';

  const rowContent = (
    <div className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      {/* Avatar */}
      <ActivityAvatar name={avatarName} />

      {/* Category icon badge */}
      <div
        className={`flex-shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-full ring-1 ${ring}`}
        aria-hidden="true"
      >
        {icon}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug truncate">
          {entry.title}
        </p>
        {entry.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {entry.message}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap pt-0.5">
        {formatTimeAgo(entry.created_at)}
      </span>
    </div>
  );

  if (entry.link) {
    return (
      <Link href={entry.link} className="block group">
        {rowContent}
      </Link>
    );
  }

  return <div>{rowContent}</div>;
}

// ─── Main Widget ─────────────────────────────────────────────────────────────

export default function RecentActivityWidget() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [offset, setOffset] = useState(0);

  // Fetch activities; if reset=true, replace the list; otherwise append
  const fetchActivities = useCallback(
    async (currentOffset: number, filter: FilterCategory, reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(currentOffset),
          ...(filter !== 'all' ? { category: filter } : {}),
        });
        const res = await fetch(`/api/dashboard/recent-activity?${params}`);
        if (res.ok) {
          const data = await res.json();
          const incoming: ActivityEntry[] = data.activities || [];
          if (reset) {
            setActivities(incoming);
          } else {
            setActivities(prev => [...prev, ...incoming]);
          }
          setTotal(data.total || 0);
          setOffset(currentOffset + incoming.length);
        }
      } catch (error) {
        console.error('Failed to fetch recent activity:', error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    setOffset(0);
    fetchActivities(0, activeFilter, true);
  }, [activeFilter, fetchActivities]);

  const handleLoadMore = () => {
    fetchActivities(offset, activeFilter, false);
  };

  const handleFilterChange = (f: FilterCategory) => {
    setActiveFilter(f);
    // fetchActivities will be triggered by the useEffect above via activeFilter change
  };

  const hasMore = activities.length < total;

  return (
    <WidgetCard
      title="Recent Activity"
      icon={<Activity className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
      viewAllLink="/notifications"
      viewAllText="View All"
      loading={loading}
    >
      {/* Filter Pills */}
      <div className="flex flex-wrap gap-1 mb-3 -mt-1">
        {FILTER_PILLS.map(pill => (
          <button
            key={pill.id}
            onClick={() => handleFilterChange(pill.id)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              activeFilter === pill.id
                ? 'bg-violet-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      {activities.length === 0 ? (
        <WidgetEmpty
          icon={<Activity className="w-10 h-10 mx-auto" />}
          message={
            activeFilter === 'all'
              ? 'No recent activity to show'
              : `No recent ${activeFilter} activity`
          }
        />
      ) : (
        <div className="space-y-0.5">
          {activities.map(entry => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="mt-3 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 border border-violet-200 dark:border-violet-800/50 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Load More ({total - activities.length} more)
              </>
            )}
          </button>
        </div>
      )}
    </WidgetCard>
  );
}
