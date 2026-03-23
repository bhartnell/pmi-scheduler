'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { ChevronRight, Save, UserPlus, Loader2 } from 'lucide-react';
import FormField from '@/components/FormField';
import { validators } from '@/lib/validation';
import { PageLoader } from '@/components/ui';

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

function NewStudentContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get returnTo and cohortId from URL params
  const returnTo = searchParams.get('returnTo');
  const preselectedCohortId = searchParams.get('cohortId');

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [cohortId, setCohortId] = useState(preselectedCohortId || '');
  const [agency, setAgency] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
    }
  }, [session]);

  // Pre-select cohort if provided in URL
  useEffect(() => {
    if (preselectedCohortId && !cohortId) {
      setCohortId(preselectedCohortId);
    }
  }, [preselectedCohortId]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
    setLoading(false);
  };

  const validateStudentForm = (): boolean => {
    const errors: Record<string, string> = {};

    const firstErr = validators.required(firstName, 'First name');
    if (firstErr) errors.first_name = firstErr;

    const lastErr = validators.required(lastName, 'Last name');
    if (lastErr) errors.last_name = lastErr;

    if (email) {
      const emailErr = validators.email(email);
      if (emailErr) errors.email = emailErr;
    }

    if (phone) {
      const phoneErr = validators.phone(phone);
      if (phoneErr) errors.phone = phoneErr;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlurField = (field: string, value: string) => {
    let error: string | null = null;

    if (field === 'first_name') error = validators.required(value, 'First name');
    else if (field === 'last_name') error = validators.required(value, 'Last name');
    else if (field === 'email') error = value ? validators.email(value) : null;
    else if (field === 'phone') error = value ? validators.phone(value) : null;

    setFormErrors(prev => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStudentForm()) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/lab-management/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          cohort_id: cohortId || null,
          agency: agency || null,
          notes: notes || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Redirect to returnTo if provided, otherwise to student detail page
        router.push(returnTo || `/lab-management/students/${data.student.id}`);
      } else {
        alert('Failed to create student: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating student:', error);
      alert('Failed to create student');
    }
    setSaving(false);
  };

  if (status === 'loading' || loading) {
    return <PageLoader message="Loading student form..." />;
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/students" className="hover:text-blue-600 dark:hover:text-blue-400">Students</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">New</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Student</h1>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b dark:border-gray-700">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <UserPlus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Student Information</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Add a new student to the system</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="First Name"
              htmlFor="student-first-name"
              required
              error={formErrors.first_name}
            >
              <input
                id="student-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={(e) => handleBlurField('first_name', e.target.value)}
                aria-invalid={!!formErrors.first_name}
                required
                placeholder="John"
                className={`w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 ${
                  formErrors.first_name
                    ? 'border-red-400 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
            </FormField>
            <FormField
              label="Last Name"
              htmlFor="student-last-name"
              required
              error={formErrors.last_name}
            >
              <input
                id="student-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={(e) => handleBlurField('last_name', e.target.value)}
                aria-invalid={!!formErrors.last_name}
                required
                placeholder="Doe"
                className={`w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 ${
                  formErrors.last_name
                    ? 'border-red-400 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
            </FormField>
          </div>

          <FormField
            label="Email"
            htmlFor="student-email"
            error={formErrors.email}
          >
            <input
              id="student-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e) => handleBlurField('email', e.target.value)}
              aria-invalid={!!formErrors.email}
              placeholder="john.doe@email.com"
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 ${
                formErrors.email
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
          </FormField>

          <FormField
            label="Phone"
            htmlFor="student-phone"
            error={formErrors.phone}
            helpText="Optional. Include area code."
          >
            <input
              id="student-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={(e) => handleBlurField('phone', e.target.value)}
              aria-invalid={!!formErrors.phone}
              placeholder="(555) 123-4567"
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 ${
                formErrors.phone
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
          </FormField>

          <div>
            <label htmlFor="student-cohort" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cohort
            </label>
            <select
              id="student-cohort"
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="">No cohort assigned</option>
              {cohorts.map(cohort => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.program.abbreviation} Group {cohort.cohort_number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="student-agency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Agency
            </label>
            <input
              id="student-agency"
              type="text"
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              placeholder="e.g., AMR, Las Vegas Fire"
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>

          <div>
            <label htmlFor="student-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              id="student-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional notes about this student..."
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
            <Link
              href={returnTo || '/lab-management/students'}
              className="px-6 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Add Student
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick tip */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Tip:</strong> Need to add multiple students at once?{' '}
            <Link href="/lab-management/students/import" className="font-medium underline">
              Use the import feature
            </Link>{' '}
            to paste from Excel or upload a CSV file.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function NewStudentPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading student form..." />}>
      <NewStudentContent />
    </Suspense>
  );
}
