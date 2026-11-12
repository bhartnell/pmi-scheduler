'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Printer, ArrowLeft } from 'lucide-react';
import OsceScenarioView from '@/components/osce/OsceScenarioView';
import type { ScenarioApi } from '@/components/osce/scenarioMapping';

export default function OsceScenarioViewer() {
  const params = useParams();
  const letter = (params.letter as string)?.toUpperCase();

  const [scenario, setScenario] = useState<ScenarioApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!letter) return;
    fetch(`/api/osce-scenarios/${letter}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            setError('You must be signed in to view scenarios.');
          } else if (res.status === 404) {
            setError('Scenario not found.');
          } else {
            setError('Failed to load scenario.');
          }
          return;
        }
        const data = await res.json();
        setScenario(data);
      })
      .catch(() => setError('Failed to load scenario.'))
      .finally(() => setLoading(false));
  }, [letter]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading scenario...</p>
        </div>
      </div>
    );
  }

  if (error || !scenario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {error || 'Scenario not found'}
          </h1>
          <a
            href="/osce-scenario"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 inline-flex items-center gap-1 mt-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to scenarios
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 print:bg-white">
      <div className="w-full px-6 py-6">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <a
            href="/osce-scenario"
            className="min-h-[44px] text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            All Scenarios
          </a>
          <button
            onClick={() => window.print()}
            className="min-h-[44px] text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 inline-flex items-center gap-1"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
        <OsceScenarioView scenario={scenario} letter={letter} />
      </div>
    </div>
  );
}
