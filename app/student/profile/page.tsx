'use client';

/**
 * Student Self-Service Profile Page
 *
 * Lets students view read-only program info and edit their own contact
 * details, emergency contact, and learning preferences.
 *
 * Sections:
 *   - Personal Info (read-only): Name, email, student number
 *   - Program Info (read-only): Cohort, enrollment date, program
 *   - Contact Info (editable): Phone, address
 *   - Emergency Contact (editable): Name, phone, relationship
 *   - Preferences (editable): Learning style
 */

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Heart,
  BookOpen,
  GraduationCap,
  Calendar,
  Pencil,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Home,
  Hash,
  Bell,
  MessageSquare,
  Clock,
  Globe,
  BellOff,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LabUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Cohort {
  id: string;
  cohort_number: string;
  start_date: string | null;
  program: {
    id: string;
    name: string;
    abbreviation: string;
  } | null;
}

interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  student_number: string | null;
  enrollment_date: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  learning_style: string | null;
  cohort: Cohort | null;
  preferred_contact_method: string | null;
  best_contact_times: string[] | null;
  language_preference: string | null;
  opt_out_non_essential: boolean | null;
}

interface ProfileData {
  lab_user: LabUser;
  student: StudentRecord | null;
  message?: string;
}

// Editable fields per section
interface ContactForm {
  phone: string;
  address: string;
}

interface EmergencyForm {
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
}

interface PreferencesForm {
  learning_style: string;
}

interface CommPrefsForm {
  preferred_contact_method: string;
  best_contact_times: string;
  language_preference: string;
  opt_out_non_essential: boolean;
}

type ActiveSection = 'contact' | 'emergency' | 'preferences' | 'commprefs' | null;

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(value: string): string {
  // Strip non-digits
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function isValidPhone(phone: string): boolean {
  if (!phone || phone.trim() === '') return true; // optional
  return /^\(\d{3}\) \d{3}-\d{4}$/.test(phone.trim());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReadOnlyField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
          {value || <span className="text-gray-400 dark:text-gray-500 font-normal">Not set</span>}
        </p>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
  iconColor,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
  canEdit,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
      </div>
      {canEdit && (
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={onCancel}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            </>
          ) : (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 border border-gray-300 dark:border-gray-600 hover:border-cyan-400 dark:hover:border-cyan-600 rounded-lg transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentProfilePage() {
  const { data: session } = useSession();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Per-section form state
  const [contactForm, setContactForm] = useState<ContactForm>({ phone: '', address: '' });
  const [emergencyForm, setEmergencyForm] = useState<EmergencyForm>({
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
  });
  const [prefsForm, setPrefsForm] = useState<PreferencesForm>({ learning_style: '' });
  const [commPrefsForm, setCommPrefsForm] = useState<CommPrefsForm>({
    preferred_contact_method: 'email',
    best_contact_times: '',
    language_preference: 'en',
    opt_out_non_essential: false,
  });

  // ─── Toast helpers ─────────────────────────────────────────────────────────

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ─── Fetch profile ─────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/student/profile');
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        // Pre-populate form state from fetched data
        const s = data.profile.student as StudentRecord | null;
        if (s) {
          setContactForm({
            phone: s.phone ?? '',
            address: s.address ?? '',
          });
          setEmergencyForm({
            emergency_contact_name: s.emergency_contact_name ?? '',
            emergency_contact_phone: s.emergency_contact_phone ?? '',
            emergency_contact_relationship: s.emergency_contact_relationship ?? '',
          });
          setPrefsForm({
            learning_style: s.learning_style ?? '',
          });
          setCommPrefsForm({
            preferred_contact_method: s.preferred_contact_method ?? 'email',
            best_contact_times: Array.isArray(s.best_contact_times) ? s.best_contact_times.join(', ') : (s.best_contact_times ?? ''),
            language_preference: s.language_preference ?? 'en',
            opt_out_non_essential: s.opt_out_non_essential ?? false,
          });
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      fetchProfile();
    }
  }, [session, fetchProfile]);

  // ─── Edit helpers ──────────────────────────────────────────────────────────

  function startEditing(section: ActiveSection) {
    // Reset form from current profile before editing
    const s = profile?.student;
    if (!s) return;
    if (section === 'contact') {
      setContactForm({ phone: s.phone ?? '', address: s.address ?? '' });
    } else if (section === 'emergency') {
      setEmergencyForm({
        emergency_contact_name: s.emergency_contact_name ?? '',
        emergency_contact_phone: s.emergency_contact_phone ?? '',
        emergency_contact_relationship: s.emergency_contact_relationship ?? '',
      });
    } else if (section === 'preferences') {
      setPrefsForm({ learning_style: s.learning_style ?? '' });
    } else if (section === 'commprefs') {
      setCommPrefsForm({
        preferred_contact_method: s.preferred_contact_method ?? 'email',
        best_contact_times: Array.isArray(s.best_contact_times) ? s.best_contact_times.join(', ') : (s.best_contact_times ?? ''),
        language_preference: s.language_preference ?? 'en',
        opt_out_non_essential: s.opt_out_non_essential ?? false,
      });
    }
    setActiveSection(section);
  }

  function cancelEditing() {
    setActiveSection(null);
  }

  // ─── Save handlers ─────────────────────────────────────────────────────────

  async function saveSection(section: ActiveSection) {
    if (!section) return;

    let payload: Record<string, string | boolean | null> = {};
    let apiUrl = '/api/student/profile';
    let validationError: string | null = null;

    if (section === 'contact') {
      if (contactForm.phone && !isValidPhone(contactForm.phone)) {
        validationError = 'Phone must be in (555) 555-5555 format.';
      }
      payload = {
        phone: contactForm.phone || null,
        address: contactForm.address || null,
      };
    } else if (section === 'emergency') {
      if (
        emergencyForm.emergency_contact_phone &&
        !isValidPhone(emergencyForm.emergency_contact_phone)
      ) {
        validationError = 'Emergency contact phone must be in (555) 555-5555 format.';
      }
      payload = {
        emergency_contact_name: emergencyForm.emergency_contact_name || null,
        emergency_contact_phone: emergencyForm.emergency_contact_phone || null,
        emergency_contact_relationship: emergencyForm.emergency_contact_relationship || null,
      };
    } else if (section === 'preferences') {
      payload = {
        learning_style: prefsForm.learning_style || null,
      };
    } else if (section === 'commprefs') {
      payload = {
        preferred_contact_method: commPrefsForm.preferred_contact_method || 'email',
        best_contact_times: commPrefsForm.best_contact_times || null,
        language_preference: commPrefsForm.language_preference || 'en',
        opt_out_non_essential: commPrefsForm.opt_out_non_essential,
      };
      apiUrl = '/api/student/communication-preferences';
    }

    if (validationError) {
      addToast('error', validationError);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh profile from server
        await fetchProfile();
        setActiveSection(null);
        addToast('success', 'Profile updated successfully.');
      } else {
        addToast('error', data.error || 'Failed to save changes.');
      }
    } catch (err) {
      addToast('error', 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600" />
      </div>
    );
  }

  if (!profile) return null;

  const { lab_user, student } = profile;

  // Display name for the avatar
  const displayName = student
    ? `${student.first_name} ${student.last_name}`
    : lab_user.name;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const cohort = student?.cohort;
  const program = cohort?.program;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link
          href="/student"
          className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <Home className="w-4 h-4" />
          Dashboard
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 dark:text-white">My Profile</span>
      </nav>

      {/* Page heading + avatar */}
      <div className="flex items-center gap-5 mb-8">
        {/* Avatar with initials */}
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-md">
            {initials}
          </div>
          {/* Status dot */}
          <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 border-2 border-white dark:border-gray-900 rounded-full" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{lab_user.email}</p>
          {program && (
            <span className="inline-block mt-1 text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-2 py-0.5 rounded-full font-medium">
              {program.abbreviation} &mdash; Cohort {cohort?.cohort_number}
            </span>
          )}
        </div>
      </div>

      {/* No student record warning */}
      {!student && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Profile not fully set up
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                {profile.message ||
                  'Your student record has not been linked yet. Please contact your instructor.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* ── Personal Info (read-only) ──────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Personal Information</h2>
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">Read-only</span>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <ReadOnlyField
              icon={User}
              label="Full Name"
              value={
                student
                  ? `${student.first_name} ${student.last_name}`
                  : lab_user.name
              }
            />
            <ReadOnlyField
              icon={Mail}
              label="Email Address"
              value={student?.email ?? lab_user.email}
            />
            {student?.student_number && (
              <ReadOnlyField
                icon={Hash}
                label="Student ID"
                value={student.student_number}
              />
            )}
          </div>
        </div>

        {/* ── Program Info (read-only) ───────────────────────────────────────── */}
        {student && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Program Information</h2>
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">Read-only</span>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {program && (
                <ReadOnlyField
                  icon={BookOpen}
                  label="Program"
                  value={program.name}
                />
              )}
              {cohort && (
                <ReadOnlyField
                  icon={GraduationCap}
                  label="Cohort"
                  value={`Cohort ${cohort.cohort_number}`}
                />
              )}
              {student.enrollment_date && (
                <ReadOnlyField
                  icon={Calendar}
                  label="Enrollment Date"
                  value={new Date(student.enrollment_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                />
              )}
              {cohort?.start_date && (
                <ReadOnlyField
                  icon={Calendar}
                  label="Program Start"
                  value={new Date(cohort.start_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Contact Info (editable) ───────────────────────────────────────── */}
        {student && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <SectionHeader
              title="Contact Information"
              icon={Phone}
              iconColor="text-green-600 dark:text-green-400"
              editing={activeSection === 'contact'}
              canEdit={true}
              onEdit={() => startEditing('contact')}
              onCancel={cancelEditing}
              onSave={() => saveSection('contact')}
              saving={saving}
            />
            <div className="p-6">
              {activeSection === 'contact' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={contactForm.phone}
                      onChange={(e) => {
                        const formatted = formatPhone(e.target.value);
                        setContactForm((prev) => ({ ...prev, phone: formatted }));
                      }}
                      placeholder="(555) 555-5555"
                      maxLength={14}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                    />
                    {contactForm.phone && !isValidPhone(contactForm.phone) && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        Use format (555) 555-5555
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Address
                    </label>
                    <textarea
                      value={contactForm.address}
                      onChange={(e) =>
                        setContactForm((prev) => ({ ...prev, address: e.target.value }))
                      }
                      placeholder="Street address, city, state, ZIP"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400 resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <ReadOnlyField icon={Phone} label="Phone Number" value={student.phone} />
                  <ReadOnlyField icon={MapPin} label="Address" value={student.address} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Emergency Contact (editable) ──────────────────────────────────── */}
        {student && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <SectionHeader
              title="Emergency Contact"
              icon={Heart}
              iconColor="text-red-500 dark:text-red-400"
              editing={activeSection === 'emergency'}
              canEdit={true}
              onEdit={() => startEditing('emergency')}
              onCancel={cancelEditing}
              onSave={() => saveSection('emergency')}
              saving={saving}
            />
            <div className="p-6">
              {activeSection === 'emergency' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={emergencyForm.emergency_contact_name}
                      onChange={(e) =>
                        setEmergencyForm((prev) => ({
                          ...prev,
                          emergency_contact_name: e.target.value,
                        }))
                      }
                      placeholder="Full name"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={emergencyForm.emergency_contact_phone}
                      onChange={(e) => {
                        const formatted = formatPhone(e.target.value);
                        setEmergencyForm((prev) => ({
                          ...prev,
                          emergency_contact_phone: formatted,
                        }));
                      }}
                      placeholder="(555) 555-5555"
                      maxLength={14}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                    />
                    {emergencyForm.emergency_contact_phone &&
                      !isValidPhone(emergencyForm.emergency_contact_phone) && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          Use format (555) 555-5555
                        </p>
                      )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Relationship
                    </label>
                    <select
                      value={emergencyForm.emergency_contact_relationship}
                      onChange={(e) =>
                        setEmergencyForm((prev) => ({
                          ...prev,
                          emergency_contact_relationship: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                    >
                      <option value="">Select relationship</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Partner">Partner</option>
                      <option value="Parent">Parent</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Child">Child</option>
                      <option value="Friend">Friend</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <ReadOnlyField
                    icon={User}
                    label="Contact Name"
                    value={student.emergency_contact_name}
                  />
                  <ReadOnlyField
                    icon={Phone}
                    label="Contact Phone"
                    value={student.emergency_contact_phone}
                  />
                  <ReadOnlyField
                    icon={Heart}
                    label="Relationship"
                    value={student.emergency_contact_relationship}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Preferences (editable) ────────────────────────────────────────── */}
        {student && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <SectionHeader
              title="Learning Preferences"
              icon={BookOpen}
              iconColor="text-amber-600 dark:text-amber-400"
              editing={activeSection === 'preferences'}
              canEdit={true}
              onEdit={() => startEditing('preferences')}
              onCancel={cancelEditing}
              onSave={() => saveSection('preferences')}
              saving={saving}
            />
            <div className="p-6">
              {activeSection === 'preferences' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Learning Style
                    </label>
                    <select
                      value={prefsForm.learning_style}
                      onChange={(e) =>
                        setPrefsForm({ learning_style: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                    >
                      <option value="">Select style</option>
                      <option value="visual">Visual</option>
                      <option value="auditory">Auditory</option>
                      <option value="kinesthetic">Kinesthetic (hands-on)</option>
                      <option value="reading">Reading / Writing</option>
                    </select>
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      Helps instructors tailor teaching methods to your needs.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <ReadOnlyField
                    icon={BookOpen}
                    label="Learning Style"
                    value={
                      student.learning_style
                        ? {
                            visual: 'Visual',
                            auditory: 'Auditory',
                            kinesthetic: 'Kinesthetic (hands-on)',
                            reading: 'Reading / Writing',
                          }[student.learning_style] ?? student.learning_style
                        : null
                    }
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Communication Preferences (editable) ─────────────────────────── */}
        {student && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <SectionHeader
              title="Communication Preferences"
              icon={MessageSquare}
              iconColor="text-cyan-600 dark:text-cyan-400"
              editing={activeSection === 'commprefs'}
              canEdit={true}
              onEdit={() => startEditing('commprefs')}
              onCancel={cancelEditing}
              onSave={() => saveSection('commprefs')}
              saving={saving}
            />
            <div className="p-6">
              {activeSection === 'commprefs' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Preferred contact method */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Preferred Contact Method
                    </label>
                    <select
                      value={commPrefsForm.preferred_contact_method}
                      onChange={(e) =>
                        setCommPrefsForm((prev) => ({
                          ...prev,
                          preferred_contact_method: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                    >
                      <option value="email">Email</option>
                      <option value="phone">Phone call</option>
                      <option value="text">Text / SMS</option>
                      <option value="in_person">In person</option>
                    </select>
                  </div>

                  {/* Best times to contact */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Best Times to Contact
                    </label>
                    <input
                      type="text"
                      value={commPrefsForm.best_contact_times}
                      onChange={(e) =>
                        setCommPrefsForm((prev) => ({
                          ...prev,
                          best_contact_times: e.target.value,
                        }))
                      }
                      placeholder="e.g. mornings, after 3pm"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                    />
                  </div>

                  {/* Language preference */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Language Preference
                    </label>
                    <select
                      value={commPrefsForm.language_preference}
                      onChange={(e) =>
                        setCommPrefsForm((prev) => ({
                          ...prev,
                          language_preference: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="zh">Chinese (Mandarin)</option>
                      <option value="vi">Vietnamese</option>
                      <option value="tl">Tagalog</option>
                      <option value="ar">Arabic</option>
                      <option value="ko">Korean</option>
                      <option value="ru">Russian</option>
                      <option value="pt">Portuguese</option>
                    </select>
                  </div>

                  {/* Opt-out toggle */}
                  <div className="flex items-start gap-3 sm:col-span-2">
                    <div className="flex items-center h-5 mt-0.5">
                      <input
                        id="opt_out_non_essential"
                        type="checkbox"
                        checked={commPrefsForm.opt_out_non_essential}
                        onChange={(e) =>
                          setCommPrefsForm((prev) => ({
                            ...prev,
                            opt_out_non_essential: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-cyan-600 focus:ring-cyan-500 dark:focus:ring-cyan-400 bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="opt_out_non_essential"
                        className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        Opt out of non-essential contact
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        When checked, instructors will only contact you for urgent or required
                        program matters.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <ReadOnlyField
                    icon={MessageSquare}
                    label="Preferred Contact Method"
                    value={
                      {
                        email: 'Email',
                        phone: 'Phone call',
                        text: 'Text / SMS',
                        in_person: 'In person',
                      }[student.preferred_contact_method ?? 'email'] ??
                      student.preferred_contact_method
                    }
                  />
                  <ReadOnlyField
                    icon={Clock}
                    label="Best Times to Contact"
                    value={Array.isArray(student.best_contact_times) ? student.best_contact_times.join(', ') : student.best_contact_times}
                  />
                  <ReadOnlyField
                    icon={Globe}
                    label="Language Preference"
                    value={
                      {
                        en: 'English',
                        es: 'Spanish',
                        fr: 'French',
                        zh: 'Chinese (Mandarin)',
                        vi: 'Vietnamese',
                        tl: 'Tagalog',
                        ar: 'Arabic',
                        ko: 'Korean',
                        ru: 'Russian',
                        pt: 'Portuguese',
                      }[student.language_preference ?? 'en'] ?? student.language_preference
                    }
                  />
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg shrink-0 mt-0.5">
                      <BellOff className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                        Non-Essential Contact
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {student.opt_out_non_essential
                          ? 'Opted out'
                          : 'Receiving all communications'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Notification Preferences link ─────────────────────────────────── */}
        {student && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Bell className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Notifications</h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Manage how and when you receive notifications from the PMI Student Portal.
              </p>
              <Link
                href="/student/notifications"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors"
              >
                <Bell className="w-4 h-4" />
                Notification Preferences
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Toast stack ─────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto transition-all ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
