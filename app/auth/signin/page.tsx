'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { Calendar, AlertCircle, Stethoscope } from 'lucide-react';

const SIGNIN_ERRORS: Record<string, string> = {
  OAuthSignin: 'Could not start sign-in. Please try again.',
  OAuthCallback: 'Authentication failed. Please try again.',
  OAuthAccountNotLinked: 'This email is linked to a different sign-in method.',
  AccessDenied: 'Access denied. Only authorized accounts can sign in.',
  AccessRestricted: 'Your account is not authorized. Contact your PMI program coordinator at bhartnell@pmi.edu to request access.',
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">PMI Paramedic Tools</h1>
          <p className="text-gray-600 dark:text-gray-400">Sign in to access the platform</p>
        </div>

        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
          </div>
        )}

        {/* Google Sign-In — PMI staff */}
        <div className="space-y-3">
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
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            PMI staff (@pmi.edu)
          </p>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500">or</span>
          </div>
        </div>

        {/* Microsoft Sign-In — Agency partners & external students */}
        <div className="space-y-3">
          <button
            onClick={() => signIn('azure-ad', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#2F2F2F] dark:bg-gray-600 border-2 border-[#2F2F2F] dark:border-gray-500 rounded-lg hover:bg-[#1a1a1a] dark:hover:bg-gray-500 font-medium text-white transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 21 21">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Sign in with Microsoft
          </button>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            Agency partners &amp; LVFR students
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Access restricted to authorized personnel only.
        </p>

        {/* PMI Program Link */}
        <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Interested in becoming a Paramedic?
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
              Learn about our programs at Pima Medical Institute
            </p>
            <button
              onClick={async () => {
                try {
                  await fetch('/api/analytics/link-click', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      link_id: 'pmi-paramedic-program',
                      source: 'signin-page',
                      timestamp: new Date().toISOString()
                    })
                  });
                } catch {} // Don't block navigation on tracking failure
                window.open('https://pmi.edu/on-campus-programs/associate/paramedic/', '_blank');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              Visit PMI Paramedic Program
              <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </div>
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
