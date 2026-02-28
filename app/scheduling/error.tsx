'use client';

import SectionErrorPage from '@/components/SectionErrorPage';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SchedulingError({ error, reset }: ErrorProps) {
  return (
    <SectionErrorPage
      error={error}
      reset={reset}
      sectionName="Scheduling"
      dashboardHref="/scheduling"
    />
  );
}
