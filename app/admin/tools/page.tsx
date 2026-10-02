'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, ChevronRight, Wrench, ExternalLink } from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import { TUCKED_AWAY_FEATURES } from '@/lib/tucked-away-features';

/**
 * Guaranteed home for every "Tucked away" feature (Feature Register, Notion Agent Ops Hub).
 * "Tucked away" means kept and working, just out of the main nav — this page is the one
 * link that can never itself go missing, since it's wired into the admin settings page
 * and the admin hub. Do not add pages here directly; add them to
 * lib/tucked-away-features.ts once Ben marks the row "Tucked away" in the register.
 */
export default function AdminToolsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user && canAccessAdmin(data.user.role)) {
        setAllowed(true);
      } else {
        router.push('/');
        return;
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }

  if (!session || !allowed) return null;

  const areas = Array.from(new Set(TUCKED_AWAY_FEATURES.map((f) => f.area)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Admin Tools</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Wrench className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Tools</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Every feature kept but out of the main nav — the guaranteed home for &quot;tucked away&quot; tools.
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {areas.map((area) => (
          <section key={area}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{area}</h2>
            <div className="grid grid-cols-1 max-md:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {TUCKED_AWAY_FEATURES.filter((f) => f.area === area).map((f) => (
                <Link
                  key={f.href}
                  href={f.href}
                  className="group block bg-white dark:bg-gray-800 rounded-lg shadow p-5 min-h-[44px] hover:shadow-md hover:ring-2 hover:ring-blue-500 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {f.feature}
                    </h3>
                    <ExternalLink className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 flex-shrink-0 mt-1" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{f.description}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 font-mono">{f.href}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {TUCKED_AWAY_FEATURES.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
            Nothing tucked away right now.
          </div>
        )}
      </main>
    </div>
  );
}
