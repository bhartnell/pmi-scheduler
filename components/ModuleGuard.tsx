'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { findParkedFlag, type ModuleFlag } from '@/lib/module-flags';

const ModuleFlagsContext = createContext<ModuleFlag[]>([]);

/** Parked modules (empty until loaded, and on any error: fails open). */
export function useParkedModules(): ModuleFlag[] {
  return useContext(ModuleFlagsContext);
}

export default function ModuleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const [flags, setFlags] = useState<ModuleFlag[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/module-flags')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!cancelled && Array.isArray(d?.flags)) setFlags(d.flags);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const parked = findParkedFlag(pathname, flags);

  return (
    <ModuleFlagsContext.Provider value={flags}>
      {parked ? (
        <main id="main-content" className="max-w-2xl mx-auto p-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">This section is parked</h1>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {parked.note || 'This part of the site is not in use right now. Nothing has been deleted.'}
          </p>
          <Link
            href="/admin/module-flags"
            className="inline-block mt-6 px-4 py-2 min-h-[44px] rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Module settings
          </Link>
        </main>
      ) : (
        children
      )}
    </ModuleFlagsContext.Provider>
  );
}
