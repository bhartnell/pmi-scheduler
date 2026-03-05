'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { canAccessClinical, canAccessAffiliations, hasMinRole, type Role } from '@/lib/permissions';

/**
 * Clinical section layout guard.
 *
 * Enforces role-based access for every page under /clinical/*:
 *   - /clinical (hub)            → canAccessClinical OR canAccessAffiliations
 *   - /clinical/affiliations     → canAccessAffiliations (program_director OR lead_instructor+)
 *   - /clinical/preceptors       → instructor+
 *   - All other clinical pages   → lead_instructor+ (canAccessClinical)
 *
 * program_director is redirected to /clinical/affiliations if they try to
 * access any other clinical sub-page.
 */
export default function ClinicalLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    // Wait for session to be determined
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (!session?.user?.email) return;

    fetch('/api/instructor/me')
      .then(r => r.json())
      .then(data => {
        if (!data.success || !data.user) {
          setAllowed(false);
          router.push('/');
          return;
        }

        const role = data.user.role as Role;
        const isHubPage = pathname === '/clinical' || pathname === '/clinical/';
        const isAffiliationsPage = pathname?.startsWith('/clinical/affiliations');
        const isPreceptorsPage = pathname?.startsWith('/clinical/preceptors');

        if (isHubPage) {
          // Hub: allow clinical OR affiliations access
          if (canAccessClinical(role) || canAccessAffiliations(role)) {
            setAllowed(true);
          } else {
            setAllowed(false);
            router.push('/');
          }
        } else if (isAffiliationsPage) {
          // Affiliations: program_director OR lead_instructor+
          if (canAccessAffiliations(role)) {
            setAllowed(true);
          } else {
            setAllowed(false);
            router.push('/');
          }
        } else if (isPreceptorsPage) {
          // Preceptors: instructor+ can view
          if (hasMinRole(role, 'instructor')) {
            setAllowed(true);
          } else if (canAccessAffiliations(role)) {
            setAllowed(false);
            router.push('/clinical/affiliations');
          } else {
            setAllowed(false);
            router.push('/');
          }
        } else {
          // All other clinical pages: lead_instructor+ only
          if (canAccessClinical(role)) {
            setAllowed(true);
          } else if (canAccessAffiliations(role)) {
            // program_director → redirect to affiliations
            setAllowed(false);
            router.push('/clinical/affiliations');
          } else {
            setAllowed(false);
            router.push('/');
          }
        }
      })
      .catch(() => {
        setAllowed(false);
        router.push('/');
      });
  }, [session, status, router, pathname]);

  // While checking auth, show nothing (individual pages have their own loading states)
  if (allowed === null || allowed === false) {
    return null;
  }

  return <>{children}</>;
}
