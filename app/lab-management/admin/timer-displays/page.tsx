'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Home,
  ChevronRight,
  Monitor,
  Plus,
  Copy,
  Check,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';

interface DisplayToken {
  id: string;
  token: string;
  room_name: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export default function TimerDisplaysAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<DisplayToken[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchTokens();
    }
  }, [session]);

  const fetchTokens = async () => {
    try {
      const res = await fetch('/api/lab-management/timer-displays');
      const data = await res.json();
      if (data.success) {
        setTokens(data.tokens || []);
      }
    } catch (err) {
      console.error('Error fetching tokens:', err);
      setError('Failed to load display tokens');
    }
    setLoading(false);
  };

  const createToken = async () => {
    if (!newRoomName.trim()) {
      setError('Please enter a room name');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/lab-management/timer-displays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_name: newRoomName.trim() })
      });

      const data = await res.json();
      if (data.success) {
        setTokens([data.token, ...tokens]);
        setNewRoomName('');
      } else {
        setError(data.error || 'Failed to create token');
      }
    } catch (err) {
      console.error('Error creating token:', err);
      setError('Failed to create token');
    }

    setCreating(false);
  };

  const toggleToken = async (id: string, currentState: boolean) => {
    try {
      const res = await fetch(`/api/lab-management/timer-displays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentState })
      });

      const data = await res.json();
      if (data.success) {
        setTokens(tokens.map(t => t.id === id ? data.token : t));
      }
    } catch (err) {
      console.error('Error toggling token:', err);
    }
  };

  const deleteToken = async (id: string) => {
    if (!confirm('Are you sure you want to delete this display token?')) return;

    try {
      const res = await fetch(`/api/lab-management/timer-displays/${id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        setTokens(tokens.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error('Error deleting token:', err);
    }
  };

  const copyUrl = (token: DisplayToken) => {
    const url = `${window.location.origin}/timer-display/${token.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(token.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-purple-600 dark:hover:text-purple-400">
              Lab Management
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/admin" className="hover:text-purple-600 dark:hover:text-purple-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Timer Displays</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Monitor className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timer Display Tokens</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage kiosk displays for Raspberry Pi or wall monitors</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Create New Token */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Display</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Room name (e.g., Lab Room 101)"
              className="flex-1 px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              onKeyDown={(e) => e.key === 'Enter' && createToken()}
            />
            <button
              onClick={createToken}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create Token
            </button>
          </div>
        </div>

        {/* Token List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Displays ({tokens.length})</h2>
          </div>

          {tokens.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No display tokens created yet</p>
              <p className="text-sm mt-1">Create a token to generate a URL for your kiosk display</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {tokens.map(token => (
                <div key={token.id} className={`p-4 ${!token.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${token.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{token.room_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Created {formatDate(token.created_at)} • Last used {formatDate(token.last_used_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Copy URL */}
                      <button
                        onClick={() => copyUrl(token)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        title="Copy display URL"
                      >
                        {copiedId === token.id ? (
                          <>
                            <Check className="w-4 h-4 text-green-500" />
                            <span className="text-green-500">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy URL
                          </>
                        )}
                      </button>

                      {/* Open in new tab */}
                      <Link
                        href={`/timer-display/${token.token}`}
                        target="_blank"
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        title="Open display in new tab"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>

                      {/* Toggle active */}
                      <button
                        onClick={() => toggleToken(token.id, token.is_active)}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        title={token.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {token.is_active ? (
                          <ToggleRight className="w-5 h-5 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteToken(token.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        title="Delete token"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* URL Preview */}
                  <div className="mt-2 ml-6 text-xs font-mono text-gray-400 dark:text-gray-500 truncate">
                    {typeof window !== 'undefined' && `${window.location.origin}/timer-display/${token.token}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Setup Instructions</h3>
          <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>1. Create a display token above with a descriptive room name</li>
            <li>2. Copy the display URL and open it on your Raspberry Pi or kiosk display</li>
            <li>3. The display will auto-refresh every 5 seconds to show the current timer status</li>
            <li>4. For Raspberry Pi: Use Chromium in kiosk mode: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">chromium-browser --kiosk [URL]</code></li>
            <li>5. Revoke tokens anytime by toggling them inactive or deleting them</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
