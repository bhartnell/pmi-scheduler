'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  CalendarDays,
  Users,
  CheckCircle2,
  Loader2,
  AlertCircle,
  MapPin,
  Clock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VolunteerEvent {
  id: string;
  name: string;
  event_type: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  max_volunteers: number | null;
  registration_count: number;
}

interface InviteData {
  name: string;
  invite_type: 'instructor1' | 'general';
  message: string | null;
  deadline: string | null;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  volunteer_type: string;
  agency_affiliation: string;
  event_ids: string[];
  needs_evaluation: boolean;
  evaluation_skill: string;
  notes: string;
}

export default function VolunteerSignupPage() {
  const params = useParams();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [events, setEvents] = useState<VolunteerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    volunteer_type: '',
    agency_affiliation: '',
    event_ids: [],
    needs_evaluation: false,
    evaluation_skill: '',
    notes: '',
  });

  // ─── Fetch invite data ──────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await fetch(`/api/volunteer/invites/${token}`);
        const data = await res.json();

        if (!data.success) {
          setError(data.error || 'Invalid invite link');
          return;
        }

        setInvite(data.data.invite);
        setEvents(data.data.events);

        // Set default volunteer type based on invite
        if (data.data.invite.invite_type === 'instructor1') {
          setForm((prev) => ({ ...prev, volunteer_type: 'instructor1' }));
        } else {
          setForm((prev) => ({ ...prev, volunteer_type: 'general' }));
        }
      } catch {
        setError('Failed to load invite. Please check the link and try again.');
      } finally {
        setLoading(false);
      }
    }

    if (token) fetchInvite();
  }, [token]);

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.email || form.event_ids.length === 0) {
      setError('Please fill in your name, email, and select at least one event.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/volunteer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          invite_token: token,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Registration failed');
        return;
      }

      setSubmitted(true);
      setSubmitMessage(data.message || 'Registration successful!');
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading / Error / Success States ───────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Loading volunteer signup...</p>
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Invalid Invite
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Registration Complete!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{submitMessage}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Thank you for volunteering with PMI Paramedic Program. You will receive confirmation details at <strong>{form.email}</strong>.
          </p>
        </div>
      </div>
    );
  }

  const isInstructor1 = invite?.invite_type === 'instructor1';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            PMI Paramedic Program
          </h1>
          <h2 className="text-xl text-blue-600 dark:text-blue-400 font-semibold">
            {invite?.name || 'Volunteer Signup'}
          </h2>
          {invite?.message && (
            <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
              {invite.message}
            </p>
          )}
          {invite?.deadline && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 font-medium">
              Deadline: {new Date(invite.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Available Events */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-500" />
                Available Events — Select the dates you can attend
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {events.map((event) => {
                const isFull = event.max_volunteers !== null && event.registration_count >= event.max_volunteers;

                return (
                  <label
                    key={event.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition cursor-pointer ${
                      form.event_ids.includes(event.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    } ${isFull ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      disabled={isFull}
                      checked={form.event_ids.includes(event.id)}
                      onChange={(e) => {
                        const ids = e.target.checked
                          ? [...form.event_ids, event.id]
                          : form.event_ids.filter((id) => id !== event.id);
                        setForm({ ...form, event_ids: ids });
                      }}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {event.name}
                        {isFull && (
                          <span className="ml-2 text-xs text-red-500 font-normal">FULL</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap gap-3 mt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                        {event.start_time && event.end_time && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {event.start_time.slice(0, 5)} - {event.end_time.slice(0, 5)}
                          </span>
                        )}
                        {event.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {event.registration_count} registered
                          {event.max_volunteers ? ` / ${event.max_volunteers} max` : ''}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Your Information
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="John Doe"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="(702) 555-0123"
                  />
                </div>
              </div>

              {/* Instructor 1 specific fields */}
              {isInstructor1 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Agency Affiliation
                    </label>
                    <input
                      type="text"
                      value={form.agency_affiliation}
                      onChange={(e) => setForm({ ...form, agency_affiliation: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="AMR, MedicWest, Community Ambulance, etc."
                    />
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.needs_evaluation}
                        onChange={(e) => setForm({ ...form, needs_evaluation: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          I need a skills evaluation
                        </span>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          Check this if you need to be evaluated on a specific skill during the lab day
                        </p>
                      </div>
                    </label>
                    {form.needs_evaluation && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Evaluation Skill
                        </label>
                        <input
                          type="text"
                          value={form.evaluation_skill}
                          onChange={(e) => setForm({ ...form, evaluation_skill: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., CPR, IV Access, Patient Assessment"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* General volunteer fields */}
              {!isInstructor1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Connection to PMI
                  </label>
                  <select
                    value={form.volunteer_type}
                    onChange={(e) => setForm({ ...form, volunteer_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="general">General Volunteer</option>
                    <option value="former_student">Former Student / Alumni</option>
                    <option value="community">Community Member</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Additional Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={
                    isInstructor1
                      ? 'Any scheduling preferences or special needs...'
                      : 'Time preference (AM/PM/Full Day), dietary needs, etc.'
                  }
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || form.event_ids.length === 0}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                Register for {form.event_ids.length} Event{form.event_ids.length !== 1 ? 's' : ''}
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
            By registering, you agree to volunteer at the selected event(s). Contact the PMI Paramedic Program if you need to cancel.
          </p>
        </form>
      </div>
    </div>
  );
}
