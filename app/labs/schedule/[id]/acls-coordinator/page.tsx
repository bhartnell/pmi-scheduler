'use client';

// Route stays /labs/schedule/[id]/acls-coordinator for both courses (PALS
// P2b/4): CoordinatorTracker reads the lab day's own cert_course and renders
// the ACLS or PALS body from there.
import CoordinatorTracker from '@/components/aha/CoordinatorTracker';

export default function CoordinatorPage() {
  return <CoordinatorTracker />;
}
