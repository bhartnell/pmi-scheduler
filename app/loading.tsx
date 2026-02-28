/**
 * Root Loading Page
 *
 * Next.js App Router loading UI for page-level transitions.
 * Displayed automatically while a page segment is loading.
 */

import { PageLoader } from '@/components/ui';

export default function Loading() {
  return <PageLoader message="Loading..." />;
}
