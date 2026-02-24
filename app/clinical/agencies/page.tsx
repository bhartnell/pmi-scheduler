'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Building2,
  Hospital,
  Ambulance,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  MapPin,
  Globe,
  X,
  Check,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { canEditClinical, canAccessClinical, isSuperadmin, type Role } from '@/lib/permissions';

interface Agency {
  id: string;
  name: string;
  abbreviation: string | null;
  type: 'ems' | 'hospital';
  address: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

function AgenciesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') as 'ems' | 'hospital' | null;

  // Normalize type — default to showing both, or the filtered type
  const activeType: 'ems' | 'hospital' | null = typeParam === 'ems' || typeParam === 'hospital' ? typeParam : null;

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    type: (activeType || 'hospital') as 'ems' | 'hospital',
    address: '',
    phone: '',
    website: '',
    notes: '',
    is_active: true,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session, showInactive]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      const params = new URLSearchParams();
      if (!showInactive) params.append('activeOnly', 'true');
      else params.append('activeOnly', 'false');
      // Fetch all agencies regardless of type filter — we filter client-side for tab switching
      const res = await fetch(`/api/clinical/agencies?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAgencies(data.agencies || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  // Client-side filter: by type tab and search query
  const filteredAgencies = agencies.filter(a => {
    const matchesType = !activeType || a.type === activeType;
    const matchesSearch = !searchQuery ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.abbreviation && a.abbreviation.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.address && a.address.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const openAddModal = () => {
    setEditingAgency(null);
    setFormData({
      name: '',
      abbreviation: '',
      type: activeType || 'hospital',
      address: '',
      phone: '',
      website: '',
      notes: '',
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (agency: Agency) => {
    setEditingAgency(agency);
    setFormData({
      name: agency.name,
      abbreviation: agency.abbreviation || '',
      type: agency.type,
      address: agency.address || '',
      phone: agency.phone || '',
      website: agency.website || '',
      notes: agency.notes || '',
      is_active: agency.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setErrorMessage('Name is required');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const url = editingAgency
        ? `/api/clinical/agencies/${editingAgency.id}`
        : '/api/clinical/agencies';

      const res = await fetch(url, {
        method: editingAgency ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          abbreviation: formData.abbreviation.trim() || null,
          type: formData.type,
          address: formData.address.trim() || null,
          phone: formData.phone.trim() || null,
          website: formData.website.trim() || null,
          notes: formData.notes.trim() || null,
          is_active: formData.is_active,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setSuccessMessage(editingAgency ? 'Agency updated' : 'Agency added');
        setTimeout(() => setSuccessMessage(null), 3000);
        await fetchData();
      } else {
        setErrorMessage(data.error || 'Failed to save agency');
      }
    } catch (error) {
      console.error('Error saving agency:', error);
      setErrorMessage('Failed to save agency');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/clinical/agencies/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirm(null);
        setSuccessMessage('Agency deleted');
        setTimeout(() => setSuccessMessage(null), 3000);
        await fetchData();
      } else {
        setErrorMessage(data.error || 'Failed to delete agency');
      }
    } catch (error) {
      console.error('Error deleting agency:', error);
      setErrorMessage('Failed to delete agency');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const canEdit = userRole && canEditClinical(userRole);
  const canDelete = userRole && isSuperadmin(userRole);

  const isHospitalView = activeType === 'hospital';
  const isEmsView = activeType === 'ems';

  const pageTitle = isHospitalView
    ? 'Clinical Sites'
    : isEmsView
    ? 'Internship Agencies'
    : 'Sites & Agencies';

  const pageDesc = isHospitalView
    ? 'Hospitals and ERs where students complete clinical rotations'
    : isEmsView
    ? 'Fire departments and ambulance services for field internships'
    : 'All clinical sites and internship agencies';

  const hospitalCount = agencies.filter(a => a.type === 'hospital').length;
  const emsCount = agencies.filter(a => a.type === 'ems').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">
              Clinical &amp; Internship
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>{pageTitle}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isHospitalView ? 'bg-blue-100 dark:bg-blue-900/30' : isEmsView ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-teal-100 dark:bg-teal-900/30'}`}>
                {isHospitalView ? (
                  <Hospital className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                ) : isEmsView ? (
                  <Ambulance className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                ) : (
                  <Building2 className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{pageTitle}</h1>
                <p className="text-gray-600 dark:text-gray-400">{pageDesc}</p>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add {isHospitalView ? 'Clinical Site' : isEmsView ? 'Agency' : 'Agency'}
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Success / Error Messages */}
        {successMessage && (
          <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg flex items-center gap-2 text-green-800 dark:text-green-200">
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="w-5 h-5" />
            {errorMessage}
            <button onClick={() => setErrorMessage(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Type Tabs */}
        <div className="flex gap-2">
          <Link
            href="/clinical/agencies"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !activeType
                ? 'bg-teal-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow'
            }`}
          >
            All ({hospitalCount + emsCount})
          </Link>
          <Link
            href="/clinical/agencies?type=hospital"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isHospitalView
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow'
            }`}
          >
            <Hospital className="w-4 h-4" />
            Clinical Sites ({hospitalCount})
          </Link>
          <Link
            href="/clinical/agencies?type=ems"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isEmsView
                ? 'bg-orange-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow'
            }`}
          >
            <Ambulance className="w-4 h-4" />
            Internship Agencies ({emsCount})
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, abbreviation, or address..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Show inactive
            </label>
          </div>
        </div>

        {/* Agencies Grid */}
        {filteredAgencies.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No agencies match your search' : `No ${isHospitalView ? 'clinical sites' : isEmsView ? 'internship agencies' : 'agencies'} found`}
            </p>
            {canEdit && !searchQuery && (
              <button
                onClick={openAddModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First {isHospitalView ? 'Clinical Site' : 'Agency'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgencies.map((agency) => (
              <div
                key={agency.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow p-5 border-l-4 ${
                  agency.type === 'hospital'
                    ? 'border-blue-500'
                    : 'border-orange-500'
                } ${!agency.is_active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      agency.type === 'hospital'
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'bg-orange-100 dark:bg-orange-900/30'
                    }`}>
                      {agency.type === 'hospital' ? (
                        <Hospital className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Ambulance className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">
                        {agency.name}
                      </h3>
                      {agency.abbreviation && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {agency.abbreviation}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!agency.is_active && (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">
                        Inactive
                      </span>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => openEditModal(agency)}
                        className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => setDeleteConfirm(agency.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  {agency.phone && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{agency.phone}</span>
                    </div>
                  )}
                  {agency.address && (
                    <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{agency.address}</span>
                    </div>
                  )}
                  {agency.website && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                      <a
                        href={agency.website.startsWith('http') ? agency.website : `https://${agency.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-teal-600 dark:hover:text-teal-400 hover:underline truncate"
                      >
                        {agency.website}
                      </a>
                    </div>
                  )}
                  {agency.notes && (
                    <p className="text-gray-500 dark:text-gray-500 italic text-xs mt-2 line-clamp-2">
                      {agency.notes}
                    </p>
                  )}
                </div>

                {/* Delete Confirmation */}
                {deleteConfirm === agency.id && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-800 dark:text-red-200 text-sm mb-2">Delete this agency?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(agency.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingAgency ? 'Edit Agency' : 'Add Agency'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type *
                </label>
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.type === 'hospital'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="type"
                      value="hospital"
                      checked={formData.type === 'hospital'}
                      onChange={() => setFormData({ ...formData, type: 'hospital' })}
                      className="sr-only"
                    />
                    <Hospital className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Clinical Site</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">(Hospital/ER)</span>
                  </label>
                  <label className={`flex-1 flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.type === 'ems'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="type"
                      value="ems"
                      checked={formData.type === 'ems'}
                      onChange={() => setFormData({ ...formData, type: 'ems' })}
                      className="sr-only"
                    />
                    <Ambulance className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Field Agency</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">(EMS/Fire)</span>
                  </label>
                </div>
              </div>

              {/* Name & Abbreviation */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    placeholder="Full agency name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Abbreviation
                  </label>
                  <input
                    type="text"
                    value={formData.abbreviation}
                    onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    placeholder="SVH"
                    maxLength={20}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  placeholder="(702) 555-1234"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  placeholder="123 Main St, Las Vegas, NV 89101"
                />
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  placeholder="https://example.com"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  placeholder="Any additional notes..."
                />
              </div>

              {/* Active */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600 text-teal-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
              </label>

              {errorMessage && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : editingAgency ? 'Save Changes' : 'Add Agency'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgenciesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    }>
      <AgenciesContent />
    </Suspense>
  );
}
