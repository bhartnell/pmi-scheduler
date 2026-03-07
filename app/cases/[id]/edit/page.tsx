'use client';

import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import CaseEditor from '@/components/cases/CaseEditor';
import { CaseStudy } from '@/types/case-studies';

export default function EditCasePage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<CaseStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Redirect to login
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [authStatus, router]);

  // Fetch existing case
  useEffect(() => {
    if (!caseId || authStatus !== 'authenticated') return;

    async function fetchCase() {
      try {
        const res = await fetch(`/api/cases/${caseId}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to load case');
          setLoading(false);
          return;
        }
        const data = await res.json();

        // Check if user can edit
        if (!data.isOwner && data.userRole !== 'admin' && data.userRole !== 'superadmin') {
          setError('You do not have permission to edit this case.');
          setLoading(false);
          return;
        }

        setCaseData(data.case);
      } catch {
        setError('Failed to load case study');
      } finally {
        setLoading(false);
      }
    }

    fetchCase();
  }, [caseId, authStatus]);

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {error || 'Case not found'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Unable to load this case study for editing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <CaseEditor existingCase={caseData} mode="edit" />;
}
