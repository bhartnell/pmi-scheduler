'use client';

import SectionErrorPage from '@/components/SectionErrorPage';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  return (
    <SectionErrorPage
      error={error}
      reset={reset}
      sectionName="Admin"
      dashboardHref="/admin"
    />
  );
}
