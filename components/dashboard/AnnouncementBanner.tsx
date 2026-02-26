'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Info, AlertTriangle, AlertCircle, X } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: 'info' | 'warning' | 'critical';
  target_audience: 'all' | 'instructors' | 'students';
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  is_read: boolean;
}

const PRIORITY_CONFIG = {
  info: {
    icon: Info,
    label: 'INFO',
    containerClass:
      'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20',
    headerClass: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
    iconClass: 'text-blue-600 dark:text-blue-400',
    titleClass: 'text-blue-900 dark:text-blue-100',
    bodyClass: 'text-blue-800 dark:text-blue-200',
    dismissClass:
      'text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200',
  },
  warning: {
    icon: AlertTriangle,
    label: 'WARNING',
    containerClass:
      'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20',
    headerClass: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
    iconClass: 'text-amber-600 dark:text-amber-400',
    titleClass: 'text-amber-900 dark:text-amber-100',
    bodyClass: 'text-amber-800 dark:text-amber-200',
    dismissClass:
      'text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200',
  },
  critical: {
    icon: AlertCircle,
    label: 'CRITICAL',
    containerClass:
      'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20',
    headerClass: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200',
    iconClass: 'text-red-600 dark:text-red-400',
    titleClass: 'text-red-900 dark:text-red-100',
    bodyClass: 'text-red-800 dark:text-red-200',
    dismissClass: 'text-red-300 dark:text-red-600 cursor-not-allowed',
  },
};

function AnnouncementItem({
  announcement,
  onDismiss,
}: {
  announcement: Announcement;
  onDismiss: (id: string) => void;
}) {
  const config = PRIORITY_CONFIG[announcement.priority];
  const Icon = config.icon;
  const isCritical = announcement.priority === 'critical';

  return (
    <div
      className={`rounded-lg border-2 overflow-hidden ${config.containerClass} ${
        announcement.is_read && !isCritical ? 'opacity-60' : ''
      }`}
      role="alert"
    >
      {/* Header row */}
      <div className={`flex items-center justify-between px-4 py-2 ${config.headerClass}`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 flex-shrink-0 ${config.iconClass}`} />
          <span className="text-xs font-bold tracking-wider uppercase">
            {config.label}
          </span>
        </div>
        {isCritical ? (
          <span
            className={`p-1 rounded ${config.dismissClass}`}
            title="Critical announcements cannot be dismissed"
          >
            <X className="w-4 h-4" />
          </span>
        ) : (
          <button
            onClick={() => onDismiss(announcement.id)}
            className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${config.dismissClass}`}
            aria-label="Dismiss announcement"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <h4 className={`font-semibold text-sm mb-1 ${config.titleClass}`}>
          {announcement.title}
        </h4>
        <p className={`text-sm leading-relaxed ${config.bodyClass}`}>
          {announcement.body}
        </p>
      </div>
    </div>
  );
}

export default function AnnouncementBanner() {
  const { data: session } = useSession();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    if (!session?.user?.email) return;

    // Fetch user role and announcements in parallel
    Promise.all([
      fetch('/api/instructor/me').then((r) => r.json()),
      fetch('/api/announcements?active=true').then((r) => r.json()),
    ])
      .then(([userData, annData]) => {
        if (userData.success && userData.user) {
          setUserRole(userData.user.role);
        }
        if (annData.success) {
          setAnnouncements(annData.announcements || []);
        }
      })
      .catch(console.error);
  }, [session]);

  const handleDismiss = async (id: string) => {
    // Optimistically hide
    setDismissed((prev) => new Set([...prev, id]));

    // Mark as read in the backend
    try {
      await fetch(`/api/announcements/${id}/read`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to mark announcement as read:', err);
    }
  };

  // Filter by audience based on role
  const isStudent = userRole === 'student';
  const isInstructor =
    !isStudent &&
    ['instructor', 'lead_instructor', 'volunteer_instructor', 'admin', 'superadmin'].includes(
      userRole
    );

  const visible = announcements.filter((a) => {
    // Already dismissed this session
    if (dismissed.has(a.id)) return false;

    // Audience filtering
    if (a.target_audience === 'instructors' && isStudent) return false;
    if (a.target_audience === 'students' && isInstructor) return false;

    return true;
  });

  // Sort: unread first, then read (dimmed), critical always at top
  const sorted = [...visible].sort((a, b) => {
    if (a.priority === 'critical' && b.priority !== 'critical') return -1;
    if (b.priority === 'critical' && a.priority !== 'critical') return 1;
    if (!a.is_read && b.is_read) return -1;
    if (a.is_read && !b.is_read) return 1;
    return 0;
  });

  if (sorted.length === 0) return null;

  return (
    <div className="mb-6 max-w-5xl mx-auto space-y-3">
      {sorted.map((announcement) => (
        <AnnouncementItem
          key={announcement.id}
          announcement={announcement}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}
