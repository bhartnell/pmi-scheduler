'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ParkAwareLink as Link } from '@/components/ModuleGuard';
import { PageLoader } from '@/components/ui';
import { HOME_SECTIONS } from '@/components/home/sections';
import { hasMinRole } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import type { CurrentUser } from '@/types';
import type { Landing } from './landings';

/**
 * TRIM 6/7b-2a: one section landing. The sub-nav line and breadcrumb sit in the
 * app-wide chrome above; this renders the title with the page count and the
 * kept pages as cards grouped by when they are used. Cards the viewer's role
 * cannot open are hidden, not disabled. No narrative text: names, one-line
 * descriptions and counts only.
 */
export default function SectionLanding({ landing }: { landing: Landing }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const effectiveRole = useEffectiveRole(currentUser?.role ?? null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/instructor/me')
      .then((r) => r.json())
      .then((d) => { if (d.success && d.user) setCurrentUser(d.user); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session) return null;

  const section = HOME_SECTIONS.find((s) => s.key === landing.key);
  const color = section?.color ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';

  const groups = landing.groups
    .map((g) => ({
      ...g,
      cards: g.cards.filter((c) => (effectiveRole ? hasMinRole(effectiveRole, c.minRole ?? 'instructor') : false)),
    }))
    .filter((g) => g.cards.length > 0);
  const total = groups.reduce((n, g) => n + g.cards.length, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-[3000px] mx-auto px-[clamp(16px,2.75vw,96px)] py-6">
        <div className="mb-6 flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{landing.title}</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">{total} pages</span>
        </div>

        {groups.map((g) => (
          <section key={g.heading} className="mb-6">
            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {g.heading} <span className="font-normal">({g.cards.length})</span>
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[18px] max-sm:gap-4">
              {g.cards.map((c) => {
                const CardIcon = c.icon;
                return (
                  <Link
                    key={c.href + c.name}
                    href={c.href}
                    className="flex items-start gap-3 min-h-[44px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3.5 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  >
                    <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                      <CardIcon className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold text-gray-900 dark:text-white">{c.name}</span>
                      <span className="block text-[13px] text-gray-600 dark:text-gray-400">{c.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
