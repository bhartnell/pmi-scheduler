'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

// Entry point for Testing > OSCE and the printed QR code. Admins land on the
// coordinator view (straight to the event when exactly one is live);
// everyone else, signed in or not, goes to evaluator entry as before.
// ?evaluator=1 forces evaluator entry for an admin testing the QR path.
const EVALUATOR_ENTRY = '/osce-scoring/enter';

function OsceEntry() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useSession();
  const forceEvaluator = params.get('evaluator') === '1';

  useEffect(() => {
    if (forceEvaluator || status === 'unauthenticated') {
      router.replace(EVALUATOR_ENTRY);
      return;
    }
    if (status !== 'authenticated') return;

    let cancelled = false;
    (async () => {
      let target = EVALUATOR_ENTRY;
      try {
        // Admin-only endpoint: non-admins get 403 and keep the evaluator entry.
        const res = await fetch('/api/osce/events');
        if (res.ok) {
          const data = await res.json();
          const live = (data.events || []).filter(
            (e: { status: string }) => e.status === 'open' || e.status === 'draft'
          );
          target = live.length === 1 ? `/admin/osce-events/${live[0].id}` : '/admin/osce-events';
        }
      } catch {
        /* fall through to evaluator entry */
      }
      if (!cancelled) router.replace(target);
    })();
    return () => { cancelled = true; };
  }, [status, forceEvaluator, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );
}

export default function OsceRedirect() {
  return (
    <Suspense fallback={null}>
      <OsceEntry />
    </Suspense>
  );
}
