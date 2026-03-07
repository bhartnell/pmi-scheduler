import { useQuery } from '@tanstack/react-query';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  link: string | null;
  [key: string]: unknown;
}

interface NotificationsResult {
  notifications: Notification[];
  unreadCount: number;
}

async function fetchNotifications(): Promise<NotificationsResult> {
  const res = await fetch('/api/notifications');
  if (!res.ok) {
    return { notifications: [], unreadCount: 0 };
  }
  const data = await res.json();
  return {
    notifications: data.notifications || [],
    unreadCount: data.unreadCount || 0,
  };
}

export function useNotifications(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: fetchNotifications,
    staleTime: 30_000,
    enabled: options?.enabled !== false,
  });
}
