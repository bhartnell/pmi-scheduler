// PUBLIC: No auth required — token-based poll access
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Plus,
  X,
  Ambulance,
} from 'lucide-react';

interface PollData {
  id: string;
  title: string;
  deadline: string | null;
  status: string;
  cohort_id: string | null;
  semester_id: string | null;
  cohortLabel: string;
  semesterLabel: string;
}

const AVAILABLE_DAYS = [
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const SHIFT_OPTIONS = [
  { key: 'day', label: 'Day shift (3:00am - 11:00am start)' },
  { key: 'swing', label: 'Swing shift (12:00pm - 4:00pm start)' },
  { key: 'night', label: 'Night shift (5:00pm+ start)' },
  { key: 'no_preference', label: 'No preference' },
];

export default function RideAlongPollPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [poll, setPoll] = useState<PollData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [wasUpdate, setWasUpdate] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedDays, setSelectedDays] = useState<Record<string, boolean>>({});
  const [shiftPreference, setShiftPreference] = useState<string[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [newUnavailableDate, setNewUnavailableDate] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchPoll = useCallback(async () => {
    try {
      const res = await fetch(`/api/ride-along-poll/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Poll not found');
        return;
      }

      setPoll(data.poll);
    } catch {
      setError('Failed to load poll');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  const toggleDay = (dayKey: string) => {
    setSelectedDays(prev => ({ ...prev, [dayKey]: !prev[dayKey] }));
  };

  const toggleShift = (shiftKey: string) => {
    if (shiftKey === 'no_preference') {
      // If selecting "no preference", clear other selections
      setShiftPreference(prev =>
        prev.includes('no_preference') ? [] : ['no_preference']
      );
    } else {
      setShiftPreference(prev => {
        const without = prev.filter(s => s !== 'no_preference');
        return without.includes(shiftKey)
          ? without.filter(s => s !== shiftKey)
          : [...without, shiftKey];
      });
    }
  };

  const addUnavailableDate = () => {
    if (newUnavailableDate && !unavailableDates.includes(newUnavailableDate)) {
      setUnavailableDates(prev => [...prev, newUnavailableDate].sort());
      setNewUnavailableDate('');
    }
  };

  const removeUnavailableDate = (date: string) => {
    setUnavailableDates(prev => prev.filter(d => d !== date));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setFormError('Please enter your PMI email address.');
      return;
    }
    if (!email.trim().toLowerCase().endsWith('@my.pmi.edu')) {
      setFormError('Please use your @my.pmi.edu email address.');
      return;
    }

    const hasDay = Object.values(selectedDays).some(v => v);
    if (!hasDay) {
      setFormError('Please select at least one available day.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/ride-along-poll/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          available_days: selectedDays,
          preferred_shift_type: shiftPreference.length > 0 ? shiftPreference : ['no_preference'],
          unavailable_dates: unavailableDates,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Failed to submit. Please try again.');
        return;
      }

      setWasUpdate(data.updated);
      setSubmitted(true);
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-teal-600 mx-auto" />
          <p className="mt-3 text-gray-600">Loading poll...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md mx-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Poll Unavailable</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md mx-4">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600">
            {wasUpdate
              ? 'Your ride-along availability has been updated successfully.'
              : 'Your ride-along availability has been submitted successfully.'}
          </p>
          <p className="text-sm text-gray-500 mt-4">
            You can close this page. If you need to make changes, use the same link to resubmit.
          </p>
        </div>
      </div>
    );
  }

  const deadlineStr = poll?.deadline
    ? new Date(poll.deadline).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Ambulance className="w-8 h-8" />
              <h1 className="text-2xl font-bold">{poll?.title || 'EMT Ride-Along Availability'}</h1>
            </div>
            {(poll?.cohortLabel || poll?.semesterLabel) && (
              <p className="text-teal-100 text-sm">
                {[poll.cohortLabel, poll.semesterLabel].filter(Boolean).join(' — ')}
              </p>
            )}
            {deadlineStr && (
              <p className="text-teal-100 text-sm mt-1">
                Deadline: {deadlineStr}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Email</label>
              <input
                type="email"
                placeholder="yourname@my.pmi.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Use your @my.pmi.edu email address</p>
            </div>

            {/* Available Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Which days are you available? (check all that apply)
              </label>
              <div className="space-y-2">
                {AVAILABLE_DAYS.map(day => (
                  <label
                    key={day.key}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDays[day.key] || false}
                      onChange={() => toggleDay(day.key)}
                      className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-900">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Shift Preference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift preference
              </label>
              <div className="space-y-2">
                {SHIFT_OPTIONS.map(shift => (
                  <label
                    key={shift.key}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={shiftPreference.includes(shift.key)}
                      onChange={() => toggleShift(shift.key)}
                      className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-900">{shift.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Unavailable Dates */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dates you CANNOT ride (optional)
              </label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="date"
                  value={newUnavailableDate}
                  onChange={e => setNewUnavailableDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={addUnavailableDate}
                  disabled={!newUnavailableDate}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
              {unavailableDates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {unavailableDates.map(date => (
                    <span
                      key={date}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-md text-xs font-medium"
                    >
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      <button
                        type="button"
                        onClick={() => removeUnavailableDate(date)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Additional Comments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional comments (optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Any additional information or preferences..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
              />
            </div>

            {/* Error */}
            {formError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {formError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Availability'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-4">
          PMI Paramedic Program
        </p>
      </div>
    </div>
  );
}
