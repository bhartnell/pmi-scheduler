'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export function ActivityTracker() {
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.email) return;
    // Debounce: don't log rapid navigation
    const timer = setTimeout(() => {
      fetch('/api/admin/user-activity/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_path: pathname }),
      }).catch(() => {}); // fire and forget
    }, 2000);
    return () => clearTimeout(timer);
  }, [pathname, session]);

  return null;
}
