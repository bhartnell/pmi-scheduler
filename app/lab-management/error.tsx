'use client';

import SectionErrorPage from '@/components/SectionErrorPage';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LabManagementError({ error, reset }: ErrorProps) {
  return (
    <SectionErrorPage
      error={error}
      reset={reset}
      sectionName="Lab Management"
      dashboardHref="/lab-management"
    />
  );
}
