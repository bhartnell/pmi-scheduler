'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OsceObserversRedirect() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function redirect() {
      try {
        const res = await fetch('/api/osce/events');
        const data = await res.json();
        if (data.success && data.events?.length > 0) {
          // Redirect to the most recent event's detail page
          router.replace(`/admin/osce-events/${data.events[0].id}`);
        } else {
          // No events exist, go to events list
          router.replace('/admin/osce-events');
        }
      } catch {
        router.replace('/admin/osce-events');
      } finally {
        setLoading(false);
      }
    }
    redirect();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Redirecting to OSCE Events...</div>
      </div>
    );
  }

  return null;
}
