'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Search, CheckCircle, UserCheck, AlertCircle, Loader2 } from 'lucide-react';

interface StudentEntry {
  id: string;
  first_name: string;
  last_name: string;
  checked_in: boolean;
}

interface CheckInData {
  labDay: {
    id: string;
    date: string;
    title: string | null;
  };
  cohort: {
    id: string;
    cohort_number: number;
    program_name: string;
    program_abbreviation: string;
  };
  students: StudentEntry[];
}

type PageState = 'loading' | 'error' | 'ready';

export default function CheckInPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [data, setData] = useState<CheckInData | null>(null);
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Confirmation dialog state
  const [confirmStudent, setConfirmStudent] = useState<StudentEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');

  // Success flash state
  const [recentCheckIn, setRecentCheckIn] = useState<string | null>(null);

  const fetchCheckInData = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkin/${token}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(json.error || 'This check-in link is not valid or has been disabled.');
        setPageState('error');
        return;
      }

      setData(json);
      setStudents(json.students);
      setPageState('ready');
    } catch {
      setErrorMessage('Unable to connect. Please check your internet connection and try again.');
      setPageState('error');
    }
  }, [token]);

  useEffect(() => {
    fetchCheckInData();
  }, [fetchCheckInData]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleStudentTap = (student: StudentEntry) => {
    if (student.checked_in) return; // already checked in, no action
    setSubmitError('');
    setConfirmStudent(student);
  };

  const handleConfirmCheckIn = async () => {
    if (!confirmStudent) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch(`/api/checkin/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: confirmStudent.id }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setSubmitError(json.error || 'Check-in failed. Please try again.');
        setSubmitting(false);
        return;
      }

      // Update local student list optimistically
      const name = `${confirmStudent.first_name} ${confirmStudent.last_name}`;
      setStudents(prev =>
        prev.map(s => s.id === confirmStudent.id ? { ...s, checked_in: true } : s)
      );
      setRecentCheckIn(name);
      setTimeout(() => setRecentCheckIn(null), 4000);
      setConfirmStudent(null);
    } catch {
      setSubmitError('Network error. Please try again.');
    }

    setSubmitting(false);
  };

  const handleCancelConfirm = () => {
    setConfirmStudent(null);
    setSubmitError('');
  };

  // Filter students by search query
  const filteredStudents = students.filter(s => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const checkedInCount = students.filter(s => s.checked_in).length;
  const totalCount = students.length;

  // ---- Loading state ----
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading check-in...</p>
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          {/* PMI Branding */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
              <span className="text-white font-black text-xl">PMI</span>
            </div>
            <p className="text-gray-500 text-sm">Pima Medical Institute</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Check-In Unavailable</h1>
            <p className="text-gray-500 text-sm">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Ready state ----
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success flash banner */}
      {recentCheckIn && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{recentCheckIn} checked in!</span>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-3">
                <UserCheck className="w-7 h-7 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Confirm Check-In</h2>
              <p className="text-gray-500 text-sm mt-1">
                Is this you?
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-center mb-5">
              <p className="text-xl font-bold text-gray-900">
                {confirmStudent.first_name} {confirmStudent.last_name}
              </p>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700 text-center">
                {submitError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCancelConfirm}
                disabled={submitting}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCheckIn}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking in...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Yes, Check Me In
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-5">
        <div className="max-w-lg mx-auto">
          {/* PMI Branding */}
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 rounded-xl flex-shrink-0">
              <span className="text-white font-black text-sm">PMI</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 leading-none">Pima Medical Institute</p>
              <p className="text-xs text-gray-400 leading-none mt-0.5">Paramedic Program</p>
            </div>
          </div>

          {/* Lab Day Info */}
          {data && (
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {data.labDay.title || `Lab Day — ${data.cohort.program_abbreviation} Group ${data.cohort.cohort_number}`}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {formatDate(data.labDay.date)}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">
                {data.cohort.program_abbreviation} Group {data.cohort.cohort_number}
              </p>
            </div>
          )}

          {/* Progress indicator */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: totalCount > 0 ? `${(checkedInCount / totalCount) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-xs text-gray-500 flex-shrink-0 tabular-nums">
              {checkedInCount}/{totalCount} present
            </span>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="sticky top-0 bg-gray-50 border-b border-gray-100 px-4 py-3 z-10">
        <div className="max-w-lg mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search your name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="max-w-lg mx-auto px-4 pt-4 pb-2">
        <p className="text-sm text-gray-500 text-center">
          Tap your name to check in
        </p>
      </div>

      {/* Student List */}
      <div className="max-w-lg mx-auto px-4 pb-8">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400 text-sm">
              {searchQuery ? `No students found matching "${searchQuery}"` : 'No students in this cohort.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            {filteredStudents.map(student => (
              <button
                key={student.id}
                onClick={() => handleStudentTap(student)}
                disabled={student.checked_in}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border text-left transition-all ${
                  student.checked_in
                    ? 'bg-green-50 border-green-200 cursor-default'
                    : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98] cursor-pointer shadow-sm'
                }`}
              >
                <div>
                  <p className={`font-semibold ${student.checked_in ? 'text-green-800' : 'text-gray-900'}`}>
                    {student.last_name}, {student.first_name}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {student.checked_in ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-xs font-medium text-green-700">Already here</span>
                    </>
                  ) : (
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                      Tap to check in
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-gray-300">
        PMI EMS Scheduler &mdash; Student Check-In
      </div>
    </div>
  );
}
