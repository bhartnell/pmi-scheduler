'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronRight, Home } from 'lucide-react';

interface Flag {
  key: string;
  enabled: boolean;
  parked_at: string | null;
  note: string | null;
  updated_by: string | null;
}

export default function ModuleFlagsPage() {
  const { status } = useSession();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/module-flags');
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setFlags(d.flags);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  const save = async (k: string, enabled: boolean, n: string | null) => {
    const res = await fetch('/api/admin/module-flags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: k, enabled, note: n }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || 'Save failed');
      return;
    }
    setKey('');
    setNote('');
    load();
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Link href="/" className="hover:underline"><Home className="w-4 h-4" /></Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/admin" className="hover:underline">Admin</Link>
        <ChevronRight className="w-4 h-4" />
        <span>Module settings</span>
      </nav>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Module settings (park a section)</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-400">
        Parking hides a section behind a plain notice. Nothing is deleted, and unparking brings it straight back.
      </p>

      {error && <p className="mt-4 text-red-600" role="alert">{error}</p>}

      <div className="mt-6 grid grid-cols-3 max-md:grid-cols-1 gap-3 items-end">
        <label className="text-sm text-gray-700 dark:text-gray-300">
          Route prefix (e.g. /attendance)
          <input value={key} onChange={e => setKey(e.target.value)} className="mt-1 w-full min-h-[44px] px-3 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800" />
        </label>
        <label className="text-sm text-gray-700 dark:text-gray-300">
          Note shown on the parked page (optional)
          <input value={note} onChange={e => setNote(e.target.value)} className="mt-1 w-full min-h-[44px] px-3 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800" />
        </label>
        <button
          disabled={!key.trim()}
          onClick={() => save(key, false, note || null)}
          className="min-h-[44px] px-4 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Park this section
        </button>
      </div>

      <div className="mt-8">
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : flags.length === 0 ? (
          <p className="text-gray-500">Nothing is parked.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded">
            {flags.map(f => (
              <li key={f.key} className="flex items-center justify-between gap-4 p-3">
                <div>
                  <code className="text-sm">{f.key}</code>
                  <span className={`ml-3 text-xs px-2 py-0.5 rounded ${f.enabled ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                    {f.enabled ? 'Live' : 'Parked'}
                  </span>
                  {f.note && <p className="text-sm text-gray-600 dark:text-gray-400">{f.note}</p>}
                </div>
                <button
                  onClick={() => save(f.key, !f.enabled, f.note)}
                  className="min-h-[44px] px-4 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {f.enabled ? 'Park' : 'Unpark'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
