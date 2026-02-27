'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import OnboardingTour from './OnboardingTour';

interface CurrentUser {
  name: string;
  role: string;
}

// Pages where the tour should NOT be shown (auth/onboarding/redirect screens)
const EXCLUDED_PATHS = [
  '/auth/',
  '/request-access',
  '/guest',
  '/onboarding/student',
];

function shouldShowTour(pathname: string): boolean {
  return !EXCLUDED_PATHS.some(p => pathname.startsWith(p));
}

export default function OnboardingTourWrapper() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.email) return;

    let cancelled = false;

    fetch('/api/instructor/me')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.success && data.user) {
          const { name, role } = data.user as { name: string; role: string };
          // Don't show tour for pending users
          if (role && role !== 'pending') {
            setCurrentUser({ name: name || session.user?.name || '', role });
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [session, status]);

  // Don't render until authenticated and we have user data, and on an eligible page
  if (status !== 'authenticated' || !currentUser || !shouldShowTour(pathname)) {
    return null;
  }

  return (
    <OnboardingTour
      userName={currentUser.name || session?.user?.name || ''}
      role={currentUser.role}
    />
  );
}
