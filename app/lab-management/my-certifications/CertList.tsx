'use client';

import { useState, useRef } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import CETracker from './CETracker';
import { Award, Upload, Download, Calendar, Building, Hash, Edit2, Trash2, Plus, X } from 'lucide-react';

// Lazy-initialize Supabase client to avoid SSR build issues
let _supabase: SupabaseClient | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

type Certification = {
  id: string;
  cert_name: string;
  cert_number: string | null;
  issuing_body: string | null;
  issue_date: string | null;
  expiration_date: string;
  card_image_url: string | null;
  ce_requirement_id: string | null;
};

type Props = {
  initialCerts: Certification[];
  instructorId: string;
};

// Parse date string as local date (not UTC) to avoid timezone issues
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Get status color based on days until expiration
function getStatusColor(expirationDate: string): { bg: string; border: string; text: string; label: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = parseLocalDate(expirationDate);
  const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-400', text: 'text-red-600 dark:text-red-400', label: 'Expired' };
  } else if (daysUntil <= 30) {
    return { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-400', text: 'text-orange-600 dark:text-orange-400', label: `${daysUntil} days` };
  } else if (daysUntil <= 90) {
    return { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-400', text: 'text-yellow-600 dark:text-yellow-400', label: `${daysUntil} days` };
  } else {
    return { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-400', text: 'text-green-600 dark:text-green-400', label: 'Valid' };
  }
}

export default function CertList({ initialCerts, instructorId }: Props) {
  const [certs, setCerts] = useState<Certification[]>(initialCerts);
  const [showForm, setShowForm] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [loading, setLoading] = useState(false);
  const [ceTrackerCert, setCETrackerCert] = useState<Certification | null>(null);

  // Form state
  const [certName, setCertName] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [issuingBody, setIssuingBody] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [cardImage, setCardImage] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setCertName('');
    setCertNumber('');
    setIssuingBody('');
    setIssueDate('');
    setExpirationDate('');
    setCardImage(null);
    setExistingImageUrl(null);
    setUploadProgress(null);
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
    setCardImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Upload image to Supabase Storage
  const uploadImage = async (file: File, certId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const fileName = `${instructorId}/${certId}.${fileExt}`;

    setUploadProgress('Uploading image...');

    const supabase = getSupabase();
    const { error } = await supabase.storage
      .from('cert-images')
      .upload(fileName, file, { upsert: true });

    if (error) {
      console.error('Upload error:', error);
      setUploadProgress('Upload failed');
      return null;
    }

    const { data: urlData } = getSupabase().storage
      .from('cert-images')
      .getPublicUrl(fileName);

    setUploadProgress(null);
    return urlData.publicUrl;
  };

  // Delete image from Supabase Storage
  const deleteImage = async (imageUrl: string) => {
    const match = imageUrl.match(/cert-images\/(.+)$/);
    if (!match) return;

    await getSupabase().storage
      .from('cert-images')
      .remove([match[1]]);
  };

  // Handle file selection
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

  // Download cert image
  const downloadImage = async (imageUrl: string, certName: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = imageUrl.split('.').pop() || 'jpg';
      a.download = `${certName.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imageUrl: string | null = existingImageUrl;

      if (editingCert) {
        // Update existing cert
        if (cardImage) {
          if (existingImageUrl) {
            await deleteImage(existingImageUrl);
          }
          imageUrl = await uploadImage(cardImage, editingCert.id);
        }

        const res = await fetch(`/api/lab-management/certifications/${editingCert.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cert_name: certName,
            cert_number: certNumber || null,
            issuing_body: issuingBody || null,
            issue_date: issueDate || null,
            expiration_date: expirationDate,
            card_image_url: imageUrl,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setCerts(certs.map(c => c.id === editingCert.id ? data.certification : c)
            .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime()));
        }
      } else {
        // Create new cert
        const res = await fetch('/api/lab-management/certifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cert_name: certName,
            cert_number: certNumber || null,
            issuing_body: issuingBody || null,
            issue_date: issueDate || null,
            expiration_date: expirationDate,
          }),
        });

        const data = await res.json();
        if (data.success) {
          // Upload image if selected
          if (cardImage) {
            imageUrl = await uploadImage(cardImage, data.certification.id);
            if (imageUrl) {
              const updateRes = await fetch(`/api/lab-management/certifications/${data.certification.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ card_image_url: imageUrl }),
              });
              const updateData = await updateRes.json();
              if (updateData.success) {
                setCerts([...certs, updateData.certification]
                  .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime()));
              } else {
                setCerts([...certs, data.certification]
                  .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime()));
              }
            } else {
              setCerts([...certs, data.certification]
                .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime()));
            }
          } else {
            setCerts([...certs, data.certification]
              .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime()));
          }
        }
      }

      resetForm();
    } catch (error) {
      console.error('Error saving certification:', error);
      alert('Failed to save certification');
    }

    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this certification?')) return;

    const certToDelete = certs.find(c => c.id === id);

    const res = await fetch(`/api/lab-management/certifications/${id}`, {
      method: 'DELETE',
    });

    const data = await res.json();
    if (data.success) {
      if (certToDelete?.card_image_url) {
        await deleteImage(certToDelete.card_image_url);
      }
      setCerts(certs.filter(c => c.id !== id));
    }
  };

  const handleRemoveImage = async () => {
    if (!editingCert || !existingImageUrl) return;
    if (!confirm('Remove the card image?')) return;

    await deleteImage(existingImageUrl);

    const res = await fetch(`/api/lab-management/certifications/${editingCert.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_image_url: null }),
    });

    const data = await res.json();
    if (data.success) {
      setCerts(certs.map(c => c.id === editingCert.id ? data.certification : c));
      setExistingImageUrl(null);
    }
  };

  return (
    <div>
      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Add Certification
        </button>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {editingCert ? 'Edit Certification' : 'Add Certification'}
            </h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">
                Certification Name *
              </label>
              <input
                type="text"
                value={certName}
                onChange={(e) => setCertName(e.target.value)}
                required
                placeholder="e.g., Paramedic, ACLS, PALS"
                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">
                  Certification Number
                </label>
                <input
                  type="text"
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">
                  Issuing Body
                </label>
                <input
                  type="text"
                  value={issuingBody}
                  onChange={(e) => setIssuingBody(e.target.value)}
                  placeholder="e.g., NREMT, AHA, Arizona DHS"
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">
                  Issue Date
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">
                  Expiration Date *
                </label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Card Image Upload */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">
                Card Image (JPG, PNG, or PDF)
              </label>
              {existingImageUrl && !cardImage && (
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-green-600 text-sm">Image attached</span>
                  <button
                    type="button"
                    onClick={() => window.open(existingImageUrl, '_blank')}
                    className="text-blue-600 hover:text-blue-500 text-sm"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="text-red-600 hover:text-red-500 text-sm"
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
                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-semibold hover:file:bg-blue-700 file:cursor-pointer"
              />
              {cardImage && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Selected: {cardImage.name}</p>
              )}
              {uploadProgress && (
                <p className="mt-1 text-sm text-blue-600">{uploadProgress}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Saving...' : (editingCert ? 'Update' : 'Add Certification')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-3 px-6 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cert List */}
      {certs.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Award className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">No certifications yet.</p>
          <p className="text-gray-500 dark:text-gray-500">Add your first certification to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {certs.map((cert) => {
            const status = getStatusColor(cert.expiration_date);
            return (
              <div
                key={cert.id}
                className={`${status.bg} border-l-4 ${status.border} rounded-lg p-4 shadow-sm`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {cert.cert_name}
                      </h3>
                      <span className={`text-sm font-semibold px-2 py-0.5 rounded ${status.text} ${status.bg}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 text-sm space-y-1">
                      {cert.issuing_body && (
                        <p className="flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          {cert.issuing_body}
                        </p>
                      )}
                      {cert.cert_number && (
                        <p className="flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          {cert.cert_number}
                        </p>
                      )}
                      <p className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Expires: {parseLocalDate(cert.expiration_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {cert.card_image_url && (
                      <button
                        onClick={() => downloadImage(cert.card_image_url!, cert.cert_name)}
                        className="inline-flex items-center gap-1 text-green-600 hover:text-green-500 text-sm font-medium"
                        title="Download card image"
                      >
                        <Download className="w-4 h-4" />
                        Card
                      </button>
                    )}
                    <button
                      onClick={() => setCETrackerCert(cert)}
                      className="text-purple-600 hover:text-purple-500 text-sm font-medium"
                      title="Track CE hours"
                    >
                      CE Hours
                    </button>
                    <button
                      onClick={() => openEditForm(cert)}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-500 text-sm font-medium"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cert.id)}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-500 text-sm font-medium"
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

      {/* CE Tracker Modal */}
      {ceTrackerCert && (
        <CETracker
          certificationId={ceTrackerCert.id}
          certName={ceTrackerCert.cert_name}
          issueDate={ceTrackerCert.issue_date}
          expirationDate={ceTrackerCert.expiration_date}
          ceRequirementId={ceTrackerCert.ce_requirement_id}
          instructorId={instructorId}
          onClose={() => setCETrackerCert(null)}
          onRequirementLinked={(reqId) => {
            setCerts(certs.map(c =>
              c.id === ceTrackerCert.id
                ? { ...c, ce_requirement_id: reqId }
                : c
            ));
            setCETrackerCert(prev => prev ? { ...prev, ce_requirement_id: reqId } : null);
          }}
        />
      )}
    </div>
  );
}
