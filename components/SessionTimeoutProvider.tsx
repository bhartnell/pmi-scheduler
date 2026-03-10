'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import SessionTimeoutWatcher from '@/components/SessionTimeoutWatcher';

/**
 * Wrapper that fetches the current user's role and passes it to SessionTimeoutWatcher.
 * Only fetches when the user is authenticated. Lightweight — a single API call on mount.
 * Include in the Providers tree so all pages benefit from agency session timeout.
 */
export default function SessionTimeoutProvider() {
  const { status } = useSession();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;

    async function fetchRole() {
      try {
        const res = await fetch('/api/instructor/me');
        const data = await res.json();
        if (data.success && data.user?.role) {
          setUserRole(data.user.role);
        }
      } catch {
        // Fail silently — timeout is a nice-to-have, not critical
      }
    }

    fetchRole();
  }, [status]);

  if (!userRole) return null;

  return <SessionTimeoutWatcher userRole={userRole} />;
}
