'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import {
  Stethoscope,
  Key,
  User,
  LogIn,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  ChevronRight,
  Eye
} from 'lucide-react';

interface GuestSession {
  id: string;
  name: string;
  assigned_role: string | null;
  lab_day: {
    id: string;
    date: string;
    week_number: number | null;
    day_number: number | null;
    notes: string | null;
    cohort: {
      cohort_number: number;
      program: {
        name: string;
        abbreviation: string;
      };
    };
  } | null;
  stations: Array<{
    id: string;
    station_number: number;
    station_type: string;
    custom_title: string | null;
    location: string | null;
    scenario: {
      id: string;
      title: string;
      category: string;
    } | null;
    instructor: {
      name: string;
    } | null;
  }>;
}

export default function GuestPage() {
  const [accessInput, setAccessInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);

  // Check for existing guest session in localStorage
  useEffect(() => {
    const savedSession = localStorage.getItem('guestSession');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        // Check if session is still valid (not expired)
        if (session.expires_at && new Date(session.expires_at) < new Date()) {
          localStorage.removeItem('guestSession');
        } else {
          setGuestSession(session);
        }
      } catch {
        localStorage.removeItem('guestSession');
      }
    }
  }, []);

  const handleGuestLogin = async () => {
    if (!accessInput.trim()) {
      setError('Please enter your name or access code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/guest/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: accessInput.trim() })
      });

      const data = await res.json();

      if (data.success) {
        // Store session in localStorage
        localStorage.setItem('guestSession', JSON.stringify(data.guest));
        setGuestSession(data.guest);
      } else {
        setError(data.error || 'Access not found. Please check your name or code.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('guestSession');
    setGuestSession(null);
    setAccessInput('');
  };

  // Show guest dashboard if logged in
  if (guestSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-gray-900 dark:text-white">Welcome, {guestSession.name}</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {guestSession.assigned_role || 'Guest'} Access
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* View Only Notice */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Eye className="w-5 h-5" />
              <span className="font-medium">View-Only Access</span>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              You have view-only access to your assigned lab day schedule.
            </p>
          </div>

          {/* Lab Day Info */}
          {guestSession.lab_day ? (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Your Assigned Lab Day
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(guestSession.lab_day.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Program</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {guestSession.lab_day.cohort.program.name} - Cohort {guestSession.lab_day.cohort.cohort_number}
                    </p>
                  </div>
                  {guestSession.lab_day.week_number && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Week/Day</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Week {guestSession.lab_day.week_number}
                        {guestSession.lab_day.day_number && `, Day ${guestSession.lab_day.day_number}`}
                      </p>
                    </div>
                  )}
                  {guestSession.assigned_role && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Your Role</p>
                      <p className="font-medium text-gray-900 dark:text-white">{guestSession.assigned_role}</p>
                    </div>
                  )}
                </div>
                {guestSession.lab_day.notes && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{guestSession.lab_day.notes}</p>
                  </div>
                )}
              </div>

              {/* Stations */}
              {guestSession.stations.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lab Stations</h2>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {guestSession.stations.map(station => (
                      <div key={station.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm font-medium rounded">
                                Station {station.station_number}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">{station.station_type}</span>
                            </div>
                            <h3 className="font-medium text-gray-900 dark:text-white mt-1">
                              {station.custom_title || station.scenario?.title || 'TBD'}
                            </h3>
                            {station.scenario && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">{station.scenario.category}</p>
                            )}
                          </div>
                          <div className="text-right text-sm">
                            {station.instructor && (
                              <p className="text-gray-600 dark:text-gray-400">
                                <span className="text-gray-400 dark:text-gray-500">Instructor:</span> {station.instructor.name}
                              </p>
                            )}
                            {station.location && (
                              <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1 justify-end mt-1">
                                <MapPin className="w-3 h-3" />
                                {station.location}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">No Lab Day Assigned</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                You don't have a lab day assigned yet. Please contact an administrator.
              </p>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Show login form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PMI Paramedic Tools</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Guest Access</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Enter your name or access code
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={accessInput}
                onChange={(e) => setAccessInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGuestLogin()}
                placeholder="Name or code (e.g., KANG-ABC1)"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium disabled:bg-gray-400"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Eye className="w-5 h-5" />
                Access My Schedule
              </>
            )}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Regular instructor?</p>
          <button
            onClick={() => signIn('google')}
            className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
