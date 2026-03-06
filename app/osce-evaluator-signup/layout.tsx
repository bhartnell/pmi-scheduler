import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Evaluator Registration — Paramedic Clinical Capstone',
  description: 'Register as an evaluator for the Spring 2026 Paramedic OSCE Clinical Capstone at Pima Medical Institute.',
};

export default function OsceSignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
