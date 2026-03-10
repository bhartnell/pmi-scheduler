'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import { canAccessLVFR, isLVFRStudent } from '@/lib/permissions';
import ConsentGate from '@/components/ConsentGate';
import { Loader2 } from 'lucide-react';

/**
 * Layout for /lvfr-aemt/* pages.
 * Enforces route guards: user must be authenticated and have LVFR access.
 * Agency roles get a ConsentGate for agency_data_sharing agreement.
 */
export default function LVFRLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const effectiveRole = useEffectiveRole(userRole);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    // Fetch user role
    fetch('/api/instructor/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user?.role) {
          setUserRole(data.user.role);
        } else {
          setUserRole('guest');
        }
        setLoading(false);
      })
      .catch(() => {
        setUserRole('guest');
        setLoading(false);
      });
  }, [status, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  // Check access
  const hasAccess = canAccessLVFR(effectiveRole || '') || isLVFRStudent(effectiveRole || '');

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Access Restricted
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don&apos;t have permission to access the LVFR AEMT section.
            Contact your administrator if you believe this is an error.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  // Agency roles need consent gate for agency data sharing
  const isAgencyRole = effectiveRole === 'agency_observer' || effectiveRole === 'agency_liaison';
  if (isAgencyRole) {
    return (
      <ConsentGate agreementType="agency_data_sharing">
        {children}
      </ConsentGate>
    );
  }

  return <>{children}</>;
}
