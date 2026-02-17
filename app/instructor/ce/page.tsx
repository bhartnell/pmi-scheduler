'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  ChevronRight,
  Trash2,
  Calendar,
  ArrowLeft,
  Award,
  X
} from 'lucide-react';

interface Certification {
  id: string;
  cert_name: string;
  issue_date: string | null;
  expiration_date: string;
  ce_requirement?: {
    id: string;
    display_name: string;
    total_hours_required: number;
    cycle_years: number;
    category_requirements: Record<string, number> | null;
  };
}

import type { CurrentUser } from '@/types';

interface CERecord {
  id: string;
  certification_id: string | null;
  title: string;
  provider: string | null;
  hours: number;
  category: string | null;
  completion_date: string;
  notes: string | null;
}

// Parse date as local date
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function CETrackerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [ceRecords, setCERecords] = useState<CERecord[]>([]);
  const [selectedCert, setSelectedCert] = useState<Certification | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [hours, setHours] = useState('');
  const [category, setCategory] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get current user
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success) {
        setCurrentUser(userData.user);

        // Load certifications
        const certsRes = await fetch(`/api/lab-management/certifications?instructorId=${userData.user.id}&includeExpired=true`);
        const certsData = await certsRes.json();
        if (certsData.success) {
          setCertifications(certsData.certifications || []);
        }

        // Load all CE records
        const ceRes = await fetch('/api/instructor/ce-records');
        const ceData = await ceRes.json();
        if (ceData.success) {
          setCERecords(ceData.records || []);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle('');
    setProvider('');
    setHours('');
    setCategory('');
    setCompletionDate('');
    setNotes('');
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/instructor/ce-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certification_id: selectedCert?.id || null,
          title,
          provider: provider || null,
          hours: parseFloat(hours),
          category: category || null,
          completion_date: completionDate,
          notes: notes || null
        })
      });

      const data = await res.json();
      if (data.success) {
        setCERecords([data.record, ...ceRecords]);
        resetForm();
      } else {
        alert('Failed to add CE record: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding CE record:', error);
      alert('Failed to add CE record');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this CE record?')) return;

    try {
      const res = await fetch(`/api/instructor/ce-records/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setCERecords(ceRecords.filter(r => r.id !== id));
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting CE record:', error);
      alert('Failed to delete');
    }
  };

  // Calculate hours for a certification within its cycle
  const getHoursForCert = (cert: Certification) => {
    const cycleStart = cert.issue_date ? parseLocalDate(cert.issue_date) : new Date(0);
    const cycleEnd = parseLocalDate(cert.expiration_date);

    const relevantRecords = ceRecords.filter(r => {
      if (r.certification_id !== cert.id) return false;
      const recordDate = parseLocalDate(r.completion_date);
      return recordDate >= cycleStart && recordDate <= cycleEnd;
    });

    const total = relevantRecords.reduce((sum, r) => sum + Number(r.hours), 0);
    const byCategory: Record<string, number> = {};

    relevantRecords.forEach(r => {
      const cat = r.category || 'general';
      byCategory[cat] = (byCategory[cat] || 0) + Number(r.hours);
    });

    return { total, byCategory, records: relevantRecords };
  };

  // Calculate total CE hours this year (across all certs)
  const getTotalHoursThisYear = () => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    return ceRecords
      .filter(r => parseLocalDate(r.completion_date) >= yearStart)
      .reduce((sum, r) => sum + Number(r.hours), 0);
  };

  // Get category options
  const getCategoryOptions = (): string[] => {
    if (!selectedCert?.ce_requirement?.category_requirements) {
      return ['general', 'clinical', 'professional', 'instructional'];
    }
    return Object.keys(selectedCert.ce_requirement.category_requirements);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
            <Link href="/" className="hover:text-blue-600">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/instructor" className="hover:text-blue-600">Instructor Portal</Link>
            <ChevronRight className="w-4 h-4" />
            <span>CE Tracker</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/instructor" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">CE Hours Tracker</h1>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-600">{getTotalHoursThisYear().toFixed(1)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">Hours This Year</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Certification Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certifications.map(cert => {
            const { total, byCategory } = getHoursForCert(cert);
            const required = cert.ce_requirement?.total_hours_required || 0;
            const progress = required > 0 ? Math.min(100, (total / required) * 100) : 0;

            return (
              <div
                key={cert.id}
                onClick={() => setSelectedCert(cert)}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer transition hover:shadow-md ${
                  selectedCert?.id === cert.id ? 'ring-2 ring-purple-500' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{cert.cert_name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {cert.ce_requirement?.display_name || 'No CE requirement linked'}
                    </p>
                  </div>
                  <Award className="w-5 h-5 text-purple-500" />
                </div>

                {required > 0 ? (
                  <>
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden mb-2">
                      <div
                        className={`h-full transition-all ${
                          progress >= 100 ? 'bg-green-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{total.toFixed(1)} / {required} hours</span>
                      <span className={progress >= 100 ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'}>
                        {progress >= 100 ? 'Complete' : `${(required - total).toFixed(1)} remaining`}
                      </span>
                    </div>

                    {/* Category breakdown */}
                    {cert.ce_requirement?.category_requirements && (
                      <div className="mt-3 space-y-1">
                        {Object.entries(cert.ce_requirement.category_requirements).map(([cat, req]) => {
                          const catHours = byCategory[cat] || 0;
                          const catProgress = Math.min(100, (catHours / Number(req)) * 100);
                          return (
                            <div key={cat} className="flex items-center gap-2 text-xs">
                              <span className="w-24 text-gray-600 dark:text-gray-400 capitalize">{cat.replace('_', ' ')}</span>
                              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div
                                  className={`h-full rounded-full ${catProgress >= 100 ? 'bg-green-400' : 'bg-purple-400'}`}
                                  style={{ width: `${catProgress}%` }}
                                />
                              </div>
                              <span className="w-12 text-right text-gray-500 dark:text-gray-400">{catHours}/{req}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Link a CE requirement to track progress
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Add CE Record Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              {selectedCert ? `CE Records for ${selectedCert.cert_name}` : 'All CE Records'}
            </h2>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-4 h-4" />
                Add CE Hours
              </button>
            )}
          </div>

          {/* Add Form */}
          {showForm && (
            <div className="p-4 border-b dark:border-gray-700 bg-purple-50 dark:bg-purple-900/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Add CE Record</h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Course/Activity Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g., ACLS Renewal, Trauma Conference"
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Hours <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      required
                      placeholder="e.g., 4"
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Completion Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={completionDate}
                      onChange={(e) => setCompletionDate(e.target.value)}
                      required
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select category</option>
                      {getCategoryOptions().map(cat => (
                        <option key={cat} value={cat}>
                          {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provider</label>
                    <input
                      type="text"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      placeholder="e.g., AHA, EMS Training Center"
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                  >
                    {saving ? 'Adding...' : 'Add Record'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Records List */}
          <div className="p-4">
            {(() => {
              const records = selectedCert
                ? ceRecords.filter(r => r.certification_id === selectedCert.id)
                : ceRecords;

              if (records.length === 0) {
                return (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No CE records yet. Add your first one above.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {records.map(record => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">{record.title}</span>
                          <span className="text-purple-600 text-sm font-medium">{record.hours} hrs</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {parseLocalDate(record.completion_date).toLocaleDateString()}
                          {record.provider && ` • ${record.provider}`}
                          {record.category && ` • ${record.category.replace('_', ' ')}`}
                        </div>
                        {record.notes && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{record.notes}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </main>
    </div>
  );
}
