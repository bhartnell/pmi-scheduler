import type { Metadata } from 'next';
import OsceTimerBar from '@/components/osce/OsceTimerBar';

export const metadata: Metadata = {
  title: 'OSCE Clinical Capstone - Evaluator Portal',
  description: 'Digital scoring system for PMI Paramedic Clinical Capstone OSCE evaluations.',
};

export default function OsceScoringLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OsceTimerBar />
      {children}
    </>
  );
}
