'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Award,
  Plus,
  ChevronRight,
  Calendar,
  Download,
  Edit,
  Trash2,
  BookOpen,
  Home,
  ArrowLeft,
  Upload,
  X
} from 'lucide-react';

interface Certification {
  id: string;
  cert_name: string;
  cert_number: string | null;
  issuing_body: string | null;
  issue_date: string | null;
  expiration_date: string;
  card_image_url: string | null;
  ce_requirement_id: string | null;
  ce_requirement?: {
    id: string;
    display_name: string;
    total_hours_required: number;
    cycle_years: number;
  };
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Parse date as local date
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Get days until expiration
function getDaysUntil(dateString: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = parseLocalDate(dateString);
  return Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Get status styling
function getExpirationStatus(dateString: string): { bg: string; border: string; text: string; label: string } {
  const days = getDaysUntil(dateString);

  if (days < 0) {
    return {
      bg: 'bg-red-50 dark:bg-red-900/30',
      border: 'border-red-500',
      text: 'text-red-600 dark:text-red-400',
      label: `Expired ${Math.abs(days)} days ago`
    };
  } else if (days <= 30) {
    return {
      bg: 'bg-orange-50 dark:bg-orange-900/30',
      border: 'border-orange-500',
      text: 'text-orange-600 dark:text-orange-400',
      label: `${days} days remaining`
    };
  } else if (days <= 90) {
    return {
      bg: 'bg-yellow-50 dark:bg-yellow-900/30',
      border: 'border-yellow-500',
      text: 'text-yellow-600 dark:text-yellow-400',
      label: `${days} days remaining`
    };
  } else {
    return {
      bg: 'bg-green-50 dark:bg-green-900/30',
      border: 'border-green-500',
      text: 'text-green-600 dark:text-green-400',
      label: 'Valid'
    };
  }
}

export default function InstructorCertificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [certName, setCertName] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [issuingBody, setIssuingBody] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [cardImage, setCardImage] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setCertName('');
    setCertNumber('');
    setIssuingBody('');
    setIssueDate('');
    setExpirationDate('');
    setCardImage(null);
    setExistingImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setEditingCert(null);
    setShowForm(false);
  };

  const openEditForm = (cert: Certification) => {
    setEditingCert(cert);
    setCertName(cert.cert_name);
    setCertNumber(cert.cert_number || '');
    setIssuingBody(cert.issuing_body || '');
    setIssueDate(cert.issue_date || '');
    setExpirationDate(cert.expiration_date);
    setExistingImageUrl(cert.card_image_url);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Please select a JPG, PNG, or PDF file');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File must be under 5MB');
      e.target.value = '';
      return;
    }

    setCardImage(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setSaving(true);
    try {
      const certData = {
        cert_name: certName,
        cert_number: certNumber || null,
        issuing_body: issuingBody || null,
        issue_date: issueDate || null,
        expiration_date: expirationDate,
        card_image_url: existingImageUrl, // TODO: Handle image upload
      };

      let res;
      if (editingCert) {
        res = await fetch(`/api/lab-management/certifications/${editingCert.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(certData)
        });
      } else {
        res = await fetch('/api/lab-management/certifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(certData)
        });
      }

      const data = await res.json();
      if (data.success) {
        await loadData();
        resetForm();
      } else {
        alert('Failed to save: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving certification:', error);
      alert('Failed to save certification');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this certification?')) return;

    try {
      const res = await fetch(`/api/lab-management/certifications/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setCertifications(certifications.filter(c => c.id !== id));
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting certification:', error);
      alert('Failed to delete certification');
    }
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
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/instructor" className="hover:text-blue-600 dark:hover:text-blue-400">Instructor Portal</Link>
            <ChevronRight className="w-4 h-4" />
            <span>My Certifications</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/instructor" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Certifications</h1>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5" />
                Add Certification
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingCert ? 'Edit Certification' : 'Add Certification'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Certification Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={certName}
                  onChange={(e) => setCertName(e.target.value)}
                  required
                  placeholder="e.g., EMS Instructor, ACLS, PALS"
                  className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Certification Number
                  </label>
                  <input
                    type="text"
                    value={certNumber}
                    onChange={(e) => setCertNumber(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Issuing Body
                  </label>
                  <input
                    type="text"
                    value={issuingBody}
                    onChange={(e) => setIssuingBody(e.target.value)}
                    placeholder="e.g., PMI, AHA, NREMT"
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Expiration Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    required
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Card Image (JPG, PNG, or PDF)
                </label>
                {existingImageUrl && (
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-green-600 dark:text-green-400 text-sm">Image attached</span>
                    <button
                      type="button"
                      onClick={() => window.open(existingImageUrl, '_blank')}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => setExistingImageUrl(null)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-600 dark:file:text-blue-400 file:font-medium hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
                />
                {cardImage && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Selected: {cardImage.name}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                >
                  {saving ? 'Saving...' : (editingCert ? 'Update' : 'Add Certification')}
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

        {/* Certifications List */}
        {certifications.length === 0 && !showForm ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Award className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Certifications Yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Add your certifications to track expiration dates and CE requirements.</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Your First Certification
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {certifications.map((cert) => {
              const status = getExpirationStatus(cert.expiration_date);
              return (
                <div
                  key={cert.id}
                  className={`${status.bg} border-l-4 ${status.border} rounded-lg p-4 bg-white dark:bg-gray-800 shadow`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{cert.cert_name}</h3>
                        <span className={`text-sm font-medium ${status.text}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        {cert.issuing_body && <p>Issued by: {cert.issuing_body}</p>}
                        {cert.cert_number && <p>Number: {cert.cert_number}</p>}
                        <p className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Expires: {parseLocalDate(cert.expiration_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {cert.card_image_url && (
                        <button
                          onClick={() => window.open(cert.card_image_url!, '_blank')}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                        >
                          <Download className="w-4 h-4" />
                          View Card
                        </button>
                      )}
                      <Link
                        href={`/instructor/certifications/${cert.id}/ce`}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded"
                      >
                        <BookOpen className="w-4 h-4" />
                        CE Hours
                      </Link>
                      <button
                        onClick={() => openEditForm(cert)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(cert.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
