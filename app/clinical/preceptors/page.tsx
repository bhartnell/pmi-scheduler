'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Users,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  X,
  Check,
  Copy,
  Building2
} from 'lucide-react';
import { canEditClinical, canAccessClinical, isSuperadmin, type Role } from '@/lib/permissions';

interface Agency {
  id: string;
  name: string;
  abbreviation: string | null;
  type: 'ems' | 'hospital';
}

interface Preceptor {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  agency_id: string | null;
  agency_name: string | null;
  station: string | null;
  normal_schedule: string | null;
  snhd_trained_date: string | null;
  snhd_cert_expires: string | null;
  max_students: number;
  is_active: boolean;
  notes: string | null;
  agencies: Agency | null;
}

export default function PreceptorsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [preceptors, setPreceptors] = useState<Preceptor[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgency, setFilterAgency] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPreceptor, setEditingPreceptor] = useState<Preceptor | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    agency_id: '',
    station: '',
    normal_schedule: '',
    snhd_trained_date: '',
    snhd_cert_expires: '',
    max_students: 1,
    is_active: true,
    notes: '',
  });

  // Copy feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
      fetchCurrentUser();
    }
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUserRole(data.user.role);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [preceptorsRes, agenciesRes] = await Promise.all([
        fetch(`/api/clinical/preceptors?activeOnly=${!showInactive}`),
        fetch('/api/clinical/agencies'),
      ]);

      const preceptorsData = await preceptorsRes.json();
      const agenciesData = await agenciesRes.json();

      if (preceptorsData.success) {
        setPreceptors(preceptorsData.preceptors || []);
      }
      if (agenciesData.success) {
        setAgencies(agenciesData.agencies || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  // Refetch when filters change
  useEffect(() => {
    if (session) {
      fetchPreceptors();
    }
  }, [showInactive]);

  const fetchPreceptors = async () => {
    try {
      const res = await fetch(`/api/clinical/preceptors?activeOnly=${!showInactive}`);
      const data = await res.json();
      if (data.success) {
        setPreceptors(data.preceptors || []);
      }
    } catch (error) {
      console.error('Error fetching preceptors:', error);
    }
  };

  // Filter preceptors
  const filteredPreceptors = preceptors.filter(p => {
    const matchesSearch = !searchQuery ||
      p.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.agency_name && p.agency_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesAgency = !filterAgency || p.agency_id === filterAgency;

    return matchesSearch && matchesAgency;
  });

  const openAddModal = () => {
    setEditingPreceptor(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      agency_id: '',
      station: '',
      normal_schedule: '',
      snhd_trained_date: '',
      snhd_cert_expires: '',
      max_students: 1,
      is_active: true,
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (preceptor: Preceptor) => {
    setEditingPreceptor(preceptor);
    setFormData({
      first_name: preceptor.first_name,
      last_name: preceptor.last_name,
      email: preceptor.email || '',
      phone: preceptor.phone || '',
      agency_id: preceptor.agency_id || '',
      station: preceptor.station || '',
      normal_schedule: preceptor.normal_schedule || '',
      snhd_trained_date: preceptor.snhd_trained_date || '',
      snhd_cert_expires: preceptor.snhd_cert_expires || '',
      max_students: preceptor.max_students,
      is_active: preceptor.is_active,
      notes: preceptor.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      alert('First and last name are required');
      return;
    }

    setSaving(true);
    try {
      const url = editingPreceptor
        ? `/api/clinical/preceptors/${editingPreceptor.id}`
        : '/api/clinical/preceptors';

      const res = await fetch(url, {
        method: editingPreceptor ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          agency_id: formData.agency_id || null,
          snhd_trained_date: formData.snhd_trained_date || null,
          snhd_cert_expires: formData.snhd_cert_expires || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchPreceptors();
      } else {
        alert(data.error || 'Failed to save preceptor');
      }
    } catch (error) {
      console.error('Error saving preceptor:', error);
      alert('Failed to save preceptor');
    }
    setSaving(false);
  };

  const handleDelete = async (preceptor: Preceptor) => {
    if (!confirm(`Are you sure you want to delete ${preceptor.first_name} ${preceptor.last_name}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/clinical/preceptors/${preceptor.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        fetchPreceptors();
      } else {
        alert(data.error || 'Failed to delete preceptor');
      }
    } catch (error) {
      console.error('Error deleting preceptor:', error);
      alert('Failed to delete preceptor');
    }
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
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
            <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">Clinical & Internship</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Preceptors</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <Users className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Preceptor Directory</h1>
                <p className="text-gray-600 dark:text-gray-400">Field Training Officers and Preceptors</p>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <Plus className="w-5 h-5" />
                Add Preceptor
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or agency..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              />
            </div>

            {/* Agency Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterAgency}
                onChange={(e) => setFilterAgency(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              >
                <option value="">All Agencies</option>
                {agencies.filter(a => a.type === 'ems').map(agency => (
                  <option key={agency.id} value={agency.id}>
                    {agency.abbreviation || agency.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Show Inactive */}
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{preceptors.filter(p => p.is_active).length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active Preceptors</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {new Set(preceptors.filter(p => p.is_active).map(p => p.agency_id)).size}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Agencies</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {preceptors.filter(p => p.snhd_trained_date).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">SNHD Trained</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{filteredPreceptors.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Showing</div>
          </div>
        </div>

        {/* Preceptors List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {filteredPreceptors.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery || filterAgency ? 'No preceptors match your filters' : 'No preceptors found'}
              </p>
              {canEdit && !searchQuery && !filterAgency && (
                <button
                  onClick={openAddModal}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  <Plus className="w-4 h-4" />
                  Add First Preceptor
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Agency</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Station</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Schedule</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SNHD Trained</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredPreceptors.map((preceptor) => (
                    <tr
                      key={preceptor.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!preceptor.is_active ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {preceptor.first_name} {preceptor.last_name}
                        </div>
                        {!preceptor.is_active && (
                          <span className="text-xs text-red-500">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {preceptor.agencies?.abbreviation || preceptor.agency_name || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {preceptor.station || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {preceptor.email && (
                            <button
                              onClick={() => copyToClipboard(preceptor.email!, `email-${preceptor.id}`)}
                              className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
                              title="Click to copy"
                            >
                              {copiedField === `email-${preceptor.id}` ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <Mail className="w-3 h-3" />
                              )}
                              <span className="truncate max-w-[150px]">{preceptor.email}</span>
                            </button>
                          )}
                          {preceptor.phone && (
                            <button
                              onClick={() => copyToClipboard(preceptor.phone!, `phone-${preceptor.id}`)}
                              className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
                              title="Click to copy"
                            >
                              {copiedField === `phone-${preceptor.id}` ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <Phone className="w-3 h-3" />
                              )}
                              {preceptor.phone}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {preceptor.normal_schedule || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {preceptor.snhd_trained_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-green-500" />
                            <span className="text-green-600 dark:text-green-400">
                              {formatDate(preceptor.snhd_trained_date)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Not trained</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <button
                              onClick={() => openEditModal(preceptor)}
                              className="p-1.5 text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(preceptor)}
                              className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingPreceptor ? 'Edit Preceptor' : 'Add Preceptor'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Name Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    required
                  />
                </div>
              </div>

              {/* Contact Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
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
              </div>

              {/* Agency Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Agency
                  </label>
                  <select
                    value={formData.agency_id}
                    onChange={(e) => setFormData({ ...formData, agency_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  >
                    <option value="">Select Agency</option>
                    <optgroup label="EMS Agencies">
                      {agencies.filter(a => a.type === 'ems').map(agency => (
                        <option key={agency.id} value={agency.id}>
                          {agency.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Hospitals">
                      {agencies.filter(a => a.type === 'hospital').map(agency => (
                        <option key={agency.id} value={agency.id}>
                          {agency.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Station / Unit
                  </label>
                  <input
                    type="text"
                    value={formData.station}
                    onChange={(e) => setFormData({ ...formData, station: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    placeholder="Station 4, Unit 367, etc."
                  />
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Normal Schedule
                </label>
                <input
                  type="text"
                  value={formData.normal_schedule}
                  onChange={(e) => setFormData({ ...formData, normal_schedule: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  placeholder="Tues/Fri 0600-1800, Mon-Wed 24hr, etc."
                />
              </div>

              {/* SNHD Training */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SNHD Trained Date
                  </label>
                  <input
                    type="date"
                    value={formData.snhd_trained_date}
                    onChange={(e) => setFormData({ ...formData, snhd_trained_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SNHD Cert Expires
                  </label>
                  <input
                    type="date"
                    value={formData.snhd_cert_expires}
                    onChange={(e) => setFormData({ ...formData, snhd_cert_expires: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>

              {/* Max Students & Active */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Students
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={formData.max_students}
                    onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600 text-teal-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Active Preceptor</span>
                  </label>
                </div>
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
                  placeholder="Any additional notes about this preceptor..."
                />
              </div>
            </div>

            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Save Preceptor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
