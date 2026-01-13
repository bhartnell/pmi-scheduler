'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Trash2,
  Check,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Home,
  AlertTriangle
} from 'lucide-react';

interface DeletionRequest {
  id: string;
  table_name: string;
  record_id: string;
  record_title: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied';
  requested_at: string;
  reviewed_at: string | null;
  requester: {
    id: string;
    name: string;
    email: string;
  } | null;
  reviewer: {
    id: string;
    name: string;
    email: string;
  } | null;
}

const TABLE_LABELS: Record<string, string> = {
  'students': 'Student',
  'scenarios': 'Scenario',
  'lab_stations': 'Station',
  'lab_days': 'Lab Day',
  'cohorts': 'Cohort',
  'skills': 'Skill'
};

const TABS = [
  { value: 'pending', label: 'Pending', icon: Clock },
  { value: 'approved', label: 'Approved', icon: CheckCircle },
  { value: 'denied', label: 'Denied', icon: XCircle }
];

export default function DeletionRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchRequests();
    }
  }, [session]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lab-management/deletion-requests');
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching deletion requests:', error);
    }
    setLoading(false);
  };

  const handleAction = async (requestId: string, action: 'approve' | 'deny') => {
    setProcessing(requestId);
    try {
      const res = await fetch('/api/lab-management/deletion-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action })
      });

      const data = await res.json();
      if (data.success) {
        setRequests(requests.map(r => r.id === requestId ? data.request : r));
        showToast(
          action === 'approve' ? 'Request approved and item deleted' : 'Request denied',
          'success'
        );
      } else {
        showToast(data.error || 'Failed to process request', 'error');
      }
    } catch (error) {
      console.error('Error processing request:', error);
      showToast('Failed to process request', 'error');
    }
    setProcessing(null);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Filter requests based on active tab
  const filteredRequests = requests.filter(r => r.status === activeTab);

  // Count for pending badge
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/admin" className="hover:text-blue-600">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Deletion Requests</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Deletion Requests</h1>
              <p className="text-gray-600">Review and approve deletion requests from instructors</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.value
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.value === 'pending' && pendingCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No {activeTab} requests</h3>
              <p className="text-gray-500">
                {activeTab === 'pending'
                  ? 'All deletion requests have been processed.'
                  : `No ${activeTab} requests to show.`}
              </p>
            </div>
          ) : (
            filteredRequests.map(request => (
              <div key={request.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-50 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {request.record_title || 'Untitled'}
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs mr-2">
                          {TABLE_LABELS[request.table_name] || request.table_name}
                        </span>
                        Requested by {request.requester?.name || 'Unknown'}
                      </div>
                      {request.reason && (
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Reason:</span> {request.reason}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(request.requested_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {request.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleAction(request.id, 'deny')}
                          disabled={processing === request.id}
                          className="flex items-center gap-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          Deny
                        </button>
                        <button
                          onClick={() => handleAction(request.id, 'approve')}
                          disabled={processing === request.id}
                          className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {processing === request.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Approve & Delete
                        </button>
                      </>
                    ) : (
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                        request.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {request.status === 'approved' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        {request.status === 'approved' ? 'Approved' : 'Denied'}
                        {request.reviewer && (
                          <span className="text-xs opacity-75">
                            by {request.reviewer.name}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
