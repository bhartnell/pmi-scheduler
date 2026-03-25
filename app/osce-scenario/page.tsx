'use client';

import { useState, useEffect } from 'react';
import { FileText, ArrowRight, AlertTriangle } from 'lucide-react';

interface ScenarioSummary {
  id: string;
  scenario_letter: string;
  title: string;
  patient_name: string;
  patient_age: string;
  patient_gender: string;
  chief_complaint: string;
}

export default function OsceScenarioList() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/osce-scenarios')
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) setError('You must be signed in to view scenarios.');
          else setError('Failed to load scenarios.');
          return;
        }
        setScenarios(await res.json());
      })
      .catch(() => setError('Failed to load scenarios.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-700 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">OSCE Scenarios</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            PMI Paramedic Program — Select a scenario to view details.
          </p>
        </div>

        <div className="space-y-4">
          {scenarios.map((s) => (
            <a
              key={s.id}
              href={`/osce-scenario/${s.scenario_letter}`}
              className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600 text-white text-xl font-bold">
                    {s.scenario_letter}
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Scenario {s.scenario_letter}: {s.title}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {s.patient_name} — {s.patient_age}, {s.patient_gender === 'M' ? 'Male' : 'Female'} — {s.chief_complaint}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              </div>
            </a>
          ))}
        </div>

        {scenarios.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No scenarios available.
          </div>
        )}
      </div>
    </div>
  );
}
