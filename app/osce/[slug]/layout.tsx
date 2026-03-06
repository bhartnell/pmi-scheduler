import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OSCE Evaluator Registration — PMI Paramedic Program',
  description: 'Register as an evaluator for Pima Medical Institute Paramedic OSCE assessments.',
};

export default function OsceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
