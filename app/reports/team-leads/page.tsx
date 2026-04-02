'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TeamLeadsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    const target = `/lab-management/reports/team-leads${params ? `?${params}` : ''}`;
    router.replace(target);
  }, [router, searchParams]);

  return null;
}
