'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Plus,
  Trash2,
  Monitor,
  Smartphone,
  MapPin,
  Copy,
  Check,
  ExternalLink,
  Settings,
  Clock
} from 'lucide-react';

interface Location {
  id: string;
  name: string;
}

interface TimerToken {
  id: string;
  token: string;
  room_name: string;
  lab_room_id: string | null;
  timer_type: 'fixed' | 'mobile';
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  location?: { id: string; name: string } | null;
}

export default function TimerDisplaysAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tokens, setTokens] = useState<TimerToken[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Form state
  const [newTimerType, setNewTimerType] = useState<'fixed' | 'mobile'>('fixed');
  const [newRoomName, setNewRoomName] = useState('');
  const [newLabRoomId, setNewLabRoomId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      const [tokensRes, locationsRes] = await Promise.all([
        fetch('/api/timer-display'),
        fetch('/api/lab-management/locations?type=room')
      ]);

      const tokensData = await tokensRes.json();
      const locationsData = await locationsRes.json();

      if (tokensData.success) {
        setTokens(tokensData.tokens || []);
      }
      if (locationsData.success) {
        // Filter to only lab rooms if is_lab_room column exists
        setLocations(locationsData.locations || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleCreateToken = async () => {
    if (newTimerType === 'fixed' && !newLabRoomId) {
      alert('Please select a lab room for fixed displays');
      return;
    }
    if (newTimerType === 'mobile' && !newRoomName.trim()) {
      alert('Please enter a name for the mobile timer');
      return;
    }

    setCreating(true);
    try {
      const selectedLocation = locations.find(l => l.id === newLabRoomId);
      const res = await fetch('/api/timer-display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_name: newTimerType === 'fixed' ? selectedLocation?.name : newRoomName.trim(),
          lab_room_id: newTimerType === 'fixed' ? newLabRoomId : null,
          timer_type: newTimerType
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewTimerType('fixed');
        setNewRoomName('');
        setNewLabRoomId('');
        fetchData();
      } else {
        alert('Failed to create: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating token:', error);
      alert('Failed to create timer display');
    }
    setCreating(false);
  };

  const handleToggleActive = async (token: TimerToken) => {
    try {
      const res = await fetch('/api/timer-display', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: token.id,
          is_active: !token.is_active
        })
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error toggling token:', error);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to delete this timer display? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/timer-display?id=${tokenId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting token:', error);
    }
  };

  const copyToClipboard = async (token: string) => {
    const displayUrl = `${window.location.origin}/timer-display/${token}`;
    await navigator.clipboard.writeText(displayUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getDisplayUrl = (token: string) => {
    return `${window.location.origin}/timer-display/${token}`;
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/admin" className="hover:text-blue-600 dark:hover:text-blue-400">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Timer Displays</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Monitor className="w-7 h-7" />
                Timer Display Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage kiosk displays for lab rooms
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Display
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {tokens.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Monitor className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Timer Displays</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create timer displays for your lab rooms to show rotation countdowns.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create First Display
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {tokens.map(token => (
              <div
                key={token.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${
                  !token.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${
                      token.timer_type === 'fixed'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                    }`}>
                      {token.timer_type === 'fixed' ? (
                        <Monitor className="w-6 h-6" />
                      ) : (
                        <Smartphone className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {token.room_name}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          token.timer_type === 'fixed'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}>
                          {token.timer_type}
                        </span>
                        {!token.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            Disabled
                          </span>
                        )}
                      </h3>
                      {token.location && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          Linked to: {token.location.name}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        Last seen: {formatLastSeen(token.last_seen_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(token.token)}
                      className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                      title="Copy display URL"
                    >
                      {copiedToken === token.token ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                    <a
                      href={getDisplayUrl(token.token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                      title="Open display"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                    <button
                      onClick={() => handleToggleActive(token)}
                      className={`p-2 rounded ${
                        token.is_active
                          ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      title={token.is_active ? 'Disable' : 'Enable'}
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteToken(token.id)}
                      className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Display URL */}
                <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <code className="text-xs text-gray-600 dark:text-gray-300 break-all">
                    {getDisplayUrl(token.token)}
                  </code>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Timer Display</h2>

            {/* Type Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Display Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setNewTimerType('fixed');
                    setNewRoomName('');
                  }}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                    newTimerType === 'fixed'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Monitor className={`w-6 h-6 ${newTimerType === 'fixed' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${newTimerType === 'fixed' ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'}`}>
                    Fixed
                  </span>
                  <span className="text-xs text-gray-500">Linked to room</span>
                </button>
                <button
                  onClick={() => {
                    setNewTimerType('mobile');
                    setNewLabRoomId('');
                  }}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                    newTimerType === 'mobile'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Smartphone className={`w-6 h-6 ${newTimerType === 'mobile' ? 'text-purple-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${newTimerType === 'mobile' ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400'}`}>
                    Mobile
                  </span>
                  <span className="text-xs text-gray-500">Assign per lab</span>
                </button>
              </div>
            </div>

            {/* Fixed: Room Selection */}
            {newTimerType === 'fixed' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lab Room <span className="text-red-500">*</span>
                </label>
                <select
                  value={newLabRoomId}
                  onChange={(e) => setNewLabRoomId(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select a room...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Timer will automatically show for labs in this room
                </p>
              </div>
            )}

            {/* Mobile: Name Input */}
            {newTimerType === 'mobile' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g., Mobile Timer 1"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Assign this timer to specific lab days
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateToken}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {creating ? 'Creating...' : 'Create Display'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
