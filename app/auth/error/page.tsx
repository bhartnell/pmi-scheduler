'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

const ERROR_MESSAGES: Record<string, { title: string; message: string }> = {
  AccessDenied: {
    title: 'Access Denied',
    message: 'Access is restricted to authorized accounts. Contact your administrator if you believe this is an error.',
  },
  AccessRestricted: {
    title: 'Account Not Authorized',
    message: 'Access to PMI Paramedic Tools is restricted to authorized personnel. If you are an agency partner or student and need access, contact your PMI program coordinator at bhartnell@pmi.edu.',
  },
  OAuthSignin: {
    title: 'Sign-In Failed',
    message: 'Could not start the sign-in process. Please try again.',
  },
  OAuthCallback: {
    title: 'Authentication Failed',
    message: 'Something went wrong during authentication. Please try again.',
  },
  OAuthAccountNotLinked: {
    title: 'Account Not Linked',
    message: 'This email is already associated with a different sign-in method.',
  },
  Verification: {
    title: 'Link Expired',
    message: 'The verification link has expired. Please request a new one.',
  },
  Default: {
    title: 'Authentication Error',
    message: 'An unexpected error occurred during sign-in. Please try again.',
  },
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error') || 'Default';
  const errorInfo = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.Default;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {errorInfo.title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          {errorInfo.message}
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Link>
          <Link
            href="/request-access"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Request Access
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mt-2"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
