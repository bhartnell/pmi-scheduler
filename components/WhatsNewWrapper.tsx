'use client';

/**
 * WhatsNewWrapper
 *
 * Drop this into app/layout.tsx alongside the other global wrappers.
 * It waits until the user is authenticated (to avoid flashing on the
 * login page) and then shows the WhatsNewModal if the user hasn't
 * seen the current version yet.
 */

import { useSession } from 'next-auth/react';
import WhatsNewModal from './WhatsNewModal';

export default function WhatsNewWrapper() {
  const { status } = useSession();

  // Only show to authenticated users
  if (status !== 'authenticated') return null;

  return <WhatsNewModal />;
}
