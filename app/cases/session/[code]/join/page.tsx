'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  Loader2,
  LogIn,
  Stethoscope,
  User,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthUser {
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JoinSessionPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // State
  const [sessionCode, setSessionCode] = useState(code?.toUpperCase() || '');
  const [studentName, setStudentName] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is authenticated
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data?.user?.email) {
            setAuthUser(data);
          }
        }
      } catch {
        // Not authenticated, that's fine
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Pre-fill code from URL param
  useEffect(() => {
    if (code) {
      setSessionCode(code.toUpperCase());
    }
  }, [code]);

  // Auto-focus the code input if empty
  useEffect(() => {
    if (!sessionCode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [sessionCode]);

  // Format code as user types: uppercase, letters/numbers only, max 6
  const handleCodeChange = (value: string) => {
    const formatted = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setSessionCode(formatted);
    setError(null);
  };

  // Join session
  const handleJoin = async () => {
    if (!sessionCode || sessionCode.length !== 6) {
      setError('Please enter a valid 6-character session code');
      return;
    }

    if (!authUser && !studentName.trim()) {
      setError('Please enter your name');
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const body: Record<string, string> = {};
      if (authUser?.user?.email) {
        body.email = authUser.user.email;
        body.name = authUser.user.name || '';
      } else {
        body.name = studentName.trim();
      }

      const res = await fetch(`/api/case-sessions/${sessionCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        const message = data.error || 'Failed to join session';
        // Map common error codes to friendly messages
        if (res.status === 404) {
          throw new Error('Session not found');
        } else if (res.status === 410) {
          throw new Error('Session has ended');
        } else if (res.status === 409) {
          throw new Error('Session is full');
        }
        throw new Error(message);
      }

      const data = await res.json();

      // Store session info in sessionStorage
      if (data.student_session_id) {
        sessionStorage.setItem(
          `session_${sessionCode}`,
          JSON.stringify({
            student_session_id: data.student_session_id,
            initials: data.initials || '',
            name: authUser?.user?.name || studentName.trim(),
          })
        );
      }

      // Redirect to student view
      router.push(`/cases/session/${sessionCode}/student`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* PMI Branding Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-600 mb-4">
            <Stethoscope className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            PMI Case Session
          </h1>
          <p className="text-gray-400 mt-1">
            Join a live classroom session
          </p>
        </div>

        {/* Join Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700">
          {/* Session Code Input */}
          <div className="mb-6">
            <label
              htmlFor="session-code"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Session Code
            </label>
            <input
              ref={inputRef}
              id="session-code"
              type="text"
              value={sessionCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="ABC123"
              maxLength={6}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full text-center text-3xl font-mono font-bold tracking-[0.3em] uppercase
                px-4 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-600
                bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100
                placeholder-gray-300 dark:placeholder-gray-600
                focus:border-blue-500 focus:ring-0 outline-none transition-colors"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
              Enter the 6-character code from your instructor
            </p>
          </div>

          {/* Name / Auth Section */}
          <div className="mb-6">
            {authLoading ? (
              <div className="flex items-center justify-center py-3 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Checking authentication...</span>
              </div>
            ) : authUser?.user ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Joining as {authUser.user.name || authUser.user.email}
                  </p>
                  {authUser.user.email && authUser.user.name && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 truncate">
                      {authUser.user.email}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="student-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Your Name
                </label>
                <input
                  id="student-name"
                  type="text"
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    setError(null);
                  }}
                  placeholder="First Last"
                  autoComplete="name"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600
                    bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100
                    placeholder-gray-400 dark:placeholder-gray-600
                    focus:border-blue-500 focus:ring-0 outline-none transition-colors"
                />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Join Button */}
          <button
            onClick={handleJoin}
            disabled={joining || sessionCode.length !== 6}
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700
              disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl
              transition-colors flex items-center justify-center gap-2"
          >
            {joining ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                Join Session
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-6">
          Pima Medical Institute - Paramedic Program
        </p>
      </div>
    </div>
  );
}
