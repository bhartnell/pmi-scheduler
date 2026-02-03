'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, ChevronRight, Bug, Lightbulb, HelpCircle } from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

interface FeedbackReport {
  id: string;
  type: 'bug' | 'feature' | 'question' | 'other';
  title: string;
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  submitted_by_email: string;
  created_at: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  bug: <Bug className="w-4 h-4 text-red-500" />,
  feature: <Lightbulb className="w-4 h-4 text-yellow-500" />,
  question: <HelpCircle className="w-4 h-4 text-blue-500" />,
  other: <MessageSquare className="w-4 h-4 text-gray-500" />,
};

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  in_progress: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  resolved: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  closed: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function RecentFeedbackWidget() {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const res = await fetch('/api/feedback?limit=5');
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
        }
      } catch (error) {
        console.error('Failed to fetch feedback:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, []);

  return (
    <WidgetCard
      title="Recent Feedback"
      icon={<MessageSquare className="w-5 h-5 text-pink-600 dark:text-pink-400" />}
      viewAllLink="/lab-management/admin/feedback"
      loading={loading}
    >
      {reports.length === 0 ? (
        <WidgetEmpty
          icon={<MessageSquare className="w-10 h-10 mx-auto" />}
          message="No feedback reports yet"
        />
      ) : (
        <div className="space-y-2">
          {reports.map(report => (
            <Link
              key={report.id}
              href={`/lab-management/admin/feedback?id=${report.id}`}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {TYPE_ICONS[report.type] || TYPE_ICONS.other}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {report.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{report.submitted_by_email?.split('@')[0]}</span>
                    <span>-</span>
                    <span>{formatTimeAgo(report.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[report.status] || STATUS_STYLES.new}`}>
                  {report.status === 'in_progress' ? 'In Progress' : report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
