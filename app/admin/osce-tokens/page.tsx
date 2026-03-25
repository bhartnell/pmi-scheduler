'use client';

import { useState, useEffect } from 'react';

interface Token {
  id: string;
  token: string;
  evaluator_name: string;
  evaluator_role: string | null;
  valid_from: string;
  valid_until: string;
  created_at: string;
}

export default function OsceTokenManagement() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>('');
  const [validHours, setValidHours] = useState(48);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { fetchTokens(); }, []);

  async function fetchTokens() {
    try {
      const res = await fetch('/api/osce/guest-tokens');
      const data = await res.json();
      if (data.success) setTokens(data.tokens);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/osce/guest-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluator_name: name.trim(),
          evaluator_role: role || null,
          valid_hours: validHours,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTokens(prev => [data.token, ...prev]);
        setName('');
        setRole('');
      } else {
        setError(data.error || 'Failed to create token');
      }
    } catch {
      setError('Request failed');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this token? The evaluator will lose access.')) return;
    try {
      const res = await fetch(`/api/osce/guest-tokens?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setTokens(prev => prev.filter(t => t.id !== id));
      }
    } catch { /* ignore */ }
  }

  function getLink(token: string) {
    return `${window.location.origin}/osce-scoring/enter?token=${token}`;
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(getLink(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  const isExpired = (t: Token) => new Date(t.valid_until) < new Date();

  const roleLabels: Record<string, string> = {
    md: 'Medical Director',
    faculty: 'Faculty',
    agency: 'Agency Rep',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OSCE Guest Tokens</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Generate and manage access tokens for external OSCE evaluators
        </p>
      </div>

      {/* Create token */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Generate Token</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Evaluator name"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Role (optional)</option>
            <option value="md">Medical Director</option>
            <option value="faculty">Faculty</option>
            <option value="agency">Agency Rep</option>
          </select>
          <select
            value={validHours}
            onChange={e => setValidHours(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={12}>Valid 12 hours</option>
            <option value={24}>Valid 24 hours</option>
            <option value={48}>Valid 48 hours</option>
            <option value={72}>Valid 72 hours</option>
            <option value={168}>Valid 1 week</option>
          </select>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {creating ? 'Creating...' : 'Generate Link'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* Token list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Active Tokens ({tokens.length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : tokens.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No tokens generated yet</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {tokens.map(t => (
              <div key={t.id} className={`p-4 ${isExpired(t) ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{t.evaluator_name}</span>
                      {t.evaluator_role && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                          {roleLabels[t.evaluator_role] || t.evaluator_role}
                        </span>
                      )}
                      {isExpired(t) && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full">
                          Expired
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Valid until {new Date(t.valid_until).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyLink(t.token)}
                      className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
                    >
                      {copied === t.token ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={() => handleRevoke(t.id)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
