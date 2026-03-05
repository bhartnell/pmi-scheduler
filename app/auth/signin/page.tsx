'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { Calendar, AlertCircle } from 'lucide-react';

const SIGNIN_ERRORS: Record<string, string> = {
  OAuthSignin: 'Could not start sign-in. Please try again.',
  OAuthCallback: 'Authentication failed. Please try again.',
  OAuthAccountNotLinked: 'This email is linked to a different sign-in method.',
  AccessDenied: 'Access denied. Only authorized accounts can sign in.',
  Verification: 'Verification link expired. Please try again.',
  Default: 'An error occurred. Please try again.',
};

function SignInContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error');
  const errorMessage = errorCode
    ? SIGNIN_ERRORS[errorCode] || SIGNIN_ERRORS.Default
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <Calendar className="h-16 w-16 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">PMI EMS Scheduler</h1>
          <p className="text-gray-600 dark:text-gray-400">Sign in with your PMI.edu Google account</p>
        </div>

        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
          </div>
        )}

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 font-medium text-gray-900 dark:text-white transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Only authorized PMI.edu accounts can access admin features
        </p>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
