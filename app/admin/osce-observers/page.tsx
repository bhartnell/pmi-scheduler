'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import { Users, Download, Trash2, ChevronDown, ChevronUp, Filter } from 'lucide-react';

interface ObserverBlock {
  id: string;
  label: string;
  day_number: number;
  date: string;
  start_time: string;
  end_time: string;
}

interface Observer {
  id: string;
  name: string;
  title: string;
  agency: string;
  email: string;
  phone: string;
  role: string;
  agency_preference: boolean;
  agency_preference_note: string;
  created_at: string;
  blocks: ObserverBlock[];
}

export default function OsceObserversAdmin() {
  const { data: session, status: authStatus } = useSession();
  const [observers, setObservers] = useState<Observer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<'all' | '1' | '2'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchObservers = useCallback(async () => {
    try {
      const res = await fetch('/api/osce/observers');
      if (res.ok) {
        const data = await res.json();
        setObservers(data.observers || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchObservers();
  }, [authStatus, fetchObservers]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/osce/observers/${id}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    fetchObservers();
  };

  const filtered = observers.filter(o => {
    if (dayFilter === 'all') return true;
    return o.blocks.some(b => b.day_number === parseInt(dayFilter));
  });

  if (authStatus === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  const blockStats = new Map<string, { label: string; count: number; max: number }>();
  observers.forEach(o => o.blocks.forEach(b => {
    if (!blockStats.has(b.id)) blockStats.set(b.id, { label: `Day ${b.day_number} - ${b.label}`, count: 0, max: 4 });
    blockStats.get(b.id)!.count++;
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OSCE Observer Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{observers.length} registered observer{observers.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <a href="/api/osce/observers/export" className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
          <Download className="w-4 h-4" /> Export CSV
        </a>
      </div>

      {/* Block capacity cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {Array.from(blockStats.entries()).map(([id, b]) => (
          <div key={id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{b.label}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (b.count / b.max) * 100)}%` }} />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{b.count}/{b.max}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Day filter */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-400" />
        {(['all', '1', '2'] as const).map(d => (
          <button key={d} onClick={() => setDayFilter(d)} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${dayFilter === d ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            {d === 'all' ? 'All Days' : `Day ${d}`}
          </button>
        ))}
      </div>

      {/* Observer table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {['Name', 'Title', 'Agency', 'Email', 'Blocks', 'Agency Pref', 'Registered', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map(o => (
              <Fragment key={o.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{o.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{o.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{o.agency}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{o.email}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {o.blocks.map(b => (
                        <span key={b.id} className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.day_number === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'}`}>
                          D{b.day_number} {b.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {o.agency_preference
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Yes</span>
                      : <span className="text-gray-400">No</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {expandedId === o.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      {deleteConfirm === o.id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleDelete(o.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Confirm</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setDeleteConfirm(o.id); }} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === o.id && (
                  <tr>
                    <td colSpan={8} className="px-4 py-3 bg-gray-50 dark:bg-gray-900">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="font-medium text-gray-500 dark:text-gray-400">Phone:</span> <span className="text-gray-900 dark:text-white">{o.phone || 'N/A'}</span></div>
                        <div><span className="font-medium text-gray-500 dark:text-gray-400">Role:</span> <span className="text-gray-900 dark:text-white">{o.role || 'N/A'}</span></div>
                        {o.agency_preference && o.agency_preference_note && (
                          <div className="col-span-2">
                            <span className="font-medium text-gray-500 dark:text-gray-400">Agency Note:</span>{' '}
                            <span className="text-gray-900 dark:text-white">{o.agency_preference_note}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">No observers registered yet.</div>
        )}
      </div>
    </div>
  );
}
