'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Data Export Archives — consolidated into /admin/data-export.
 * This page now redirects to the main Data Export page.
 */
export default function DataExportsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/data-export');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <p className="text-gray-600 dark:text-gray-400">Redirecting to Data Export...</p>
    </div>
  );
}
