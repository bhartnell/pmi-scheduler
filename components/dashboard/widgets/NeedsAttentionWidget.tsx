'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Users, MessageSquare, Calendar, ChevronRight } from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

interface AttentionItem {
  id: string;
  type: 'unassigned_stations' | 'open_feedback' | 'missing_clearance';
  title: string;
  count: number;
  link: string;
  severity: 'high' | 'medium' | 'low';
}

export default function NeedsAttentionWidget() {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttentionItems = async () => {
      try {
        const attentionItems: AttentionItem[] = [];

        // Fetch open stations count
        const stationsRes = await fetch('/api/lab-management/stations?open=true&upcoming=true');
        if (stationsRes.ok) {
          const data = await stationsRes.json();
          const count = data.stations?.length || 0;
          if (count > 0) {
            attentionItems.push({
              id: 'unassigned_stations',
              type: 'unassigned_stations',
              title: `${count} station${count > 1 ? 's' : ''} need${count === 1 ? 's' : ''} instructors`,
              count,
              link: '/lab-management/schedule',
              severity: count >= 3 ? 'high' : 'medium',
            });
          }
        }

        // Fetch open feedback count
        const feedbackRes = await fetch('/api/feedback?status=new&limit=1');
        if (feedbackRes.ok) {
          const data = await feedbackRes.json();
          const count = data.total ?? data.totalCount ?? data.reports?.length ?? 0;
          if (count > 0) {
            attentionItems.push({
              id: 'open_feedback',
              type: 'open_feedback',
              title: `${count} new feedback report${count > 1 ? 's' : ''}`,
              count,
              link: '/lab-management/admin/feedback',
              severity: count >= 5 ? 'high' : 'low',
            });
          }
        }

        setItems(attentionItems);
      } catch (error) {
        console.error('Failed to fetch attention items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttentionItems();
  }, []);

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'unassigned_stations':
        return <Calendar className="w-4 h-4" />;
      case 'open_feedback':
        return <MessageSquare className="w-4 h-4" />;
      case 'missing_clearance':
        return <Users className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <WidgetCard
      title="Needs Attention"
      icon={<AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
      loading={loading}
    >
      {items.length === 0 ? (
        <WidgetEmpty
          icon={<AlertTriangle className="w-10 h-10 mx-auto" />}
          message="All caught up! Nothing needs attention."
        />
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <Link
              key={item.id}
              href={item.link}
              className={`flex items-center justify-between p-3 rounded-lg border ${getSeverityStyles(item.severity)} transition-colors hover:opacity-80`}
            >
              <div className="flex items-center gap-3">
                {getIcon(item.type)}
                <span className="text-sm font-medium">{item.title}</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
