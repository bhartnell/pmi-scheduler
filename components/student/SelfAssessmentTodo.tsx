'use client';

// Student dashboard To-do card: the entry point to the Pre-Internship
// Self-Assessment, shown only while the student's cohort window is open.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, CheckCircle } from 'lucide-react';
import { SA_STORAGE } from '@/lib/preinternship-storage';

function fmt(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SelfAssessmentTodo() {
  const [state, setState] = useState<{ open: boolean; submitted: boolean; closesAt: string | null } | null>(null);

  useEffect(() => {
    SA_STORAGE.getMyStatus()
      .then((st) => setState({ open: st.open, submitted: !!st.response, closesAt: st.closesAt }))
      .catch(() => setState({ open: false, submitted: false, closesAt: null }));
  }, []);

  if (!state) return null;
  const title = state.closesAt
    ? `Pre-internship self-assessment, closes ${fmt(state.closesAt)}`
    : 'Pre-internship self-assessment';
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-8">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-2">To do</h2>
      {state.open ? (
        <Link href="/student/self-assessment" className="flex items-center gap-3 min-h-[44px] text-cyan-700 dark:text-cyan-400 hover:underline">
          {state.submitted ? <CheckCircle className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
          <span>
            {title}
            <span className="block text-sm text-gray-500 dark:text-gray-400">
              {state.submitted ? 'Submitted. Open to review or update.' : 'About 15 to 20 minutes.'}
            </span>
          </span>
        </Link>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">Nothing due right now.</p>
      )}
    </div>
  );
}
