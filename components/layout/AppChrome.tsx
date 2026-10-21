'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import HomeTopBar from '@/components/home/HomeTopBar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';

// Public, sign-in and phone-first pages keep their own layout (TRIM 6/7b-1 scope 4-5).
const NO_CHROME_PREFIXES = [
  '/auth',
  '/request-access',
  '/osce-evaluator-signup',
  '/osce-scoring',
  '/poll',
  '/ride-along-poll',
  '/guest',
  '/checkin',
  '/open-lab',
  '/volunteer',
  '/volunteer-lab',
  '/preceptor',
  '/timer-display',
  '/student',
  '/lvfr-aemt/pharm/practice',
  '/sql',
];

export function chromeHiddenFor(pathname: string): boolean {
  return NO_CHROME_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * App-wide top bar + sub-navigation line, rendered once in the root layout so
 * it persists between page navigations. Signed-in only; students keep their
 * own phone-first layout.
 */
export default function AppChrome() {
  const pathname = usePathname() ?? '/';
  const { data: session } = useSession();
  const { data: user } = useCurrentUser({ enabled: !!session?.user?.email });
  const role = useEffectiveRole(user?.role ?? null);

  if (!session?.user?.email || chromeHiddenFor(pathname) || role === 'student') return null;
  return <HomeTopBar role={role} />;
}
