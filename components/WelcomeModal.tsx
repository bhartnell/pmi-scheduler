'use client';

import { X, Stethoscope, ArrowRight, BookOpen } from 'lucide-react';

interface WelcomeModalProps {
  userName: string;
  role: string;
  onStartTour: () => void;
  onSkip: () => void;
}

const ROLE_MESSAGES: Record<string, { headline: string; body: string; color: string }> = {
  superadmin: {
    headline: 'Welcome, Super Admin!',
    body: 'You have full access to manage users, roles, system settings, reports, and all program features. Let us show you the key areas of the platform.',
    color: 'bg-purple-600',
  },
  admin: {
    headline: 'Welcome, Admin!',
    body: 'You can manage users, view reports, oversee lab schedules, and configure system settings. Let us give you a quick tour of the dashboard.',
    color: 'bg-red-600',
  },
  lead_instructor: {
    headline: 'Welcome, Lead Instructor!',
    body: 'You have access to lab management, clinical tracking, student rosters, scenarios, and reports. A quick tour will help you get oriented.',
    color: 'bg-blue-600',
  },
  instructor: {
    headline: 'Welcome, Instructor!',
    body: 'You can manage lab schedules, scenarios, student tracking, and tasks from your dashboard. Take a quick tour to see where everything lives.',
    color: 'bg-green-600',
  },
  volunteer_instructor: {
    headline: 'Welcome, Volunteer Instructor!',
    body: 'You have read-only access to lab schedules and can manage your shift availability. A quick tour will show you around.',
    color: 'bg-teal-600',
  },
  student: {
    headline: 'Welcome, Student!',
    body: 'You can track your clinical hours, view your progress, and access your portfolio from the student portal. Let us show you the key features.',
    color: 'bg-cyan-600',
  },
};

const DEFAULT_MESSAGE = {
  headline: 'Welcome to PMI Paramedic Tools!',
  body: 'This platform helps manage lab schedules, clinical tracking, and program administration for the Pima Paramedic program. Take a quick tour to get started.',
  color: 'bg-blue-600',
};

export default function WelcomeModal({ userName, role, onStartTour, onSkip }: WelcomeModalProps) {
  const msg = ROLE_MESSAGES[role] || DEFAULT_MESSAGE;
  const firstName = userName?.split(' ')[0] || 'there';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`${msg.color} px-6 py-8 text-white text-center relative`}>
          <button
            onClick={onSkip}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Close welcome modal"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h2 id="welcome-modal-title" className="text-2xl font-bold">
            {msg.headline.replace('Welcome,', `Welcome, ${firstName}!`).replace('! ', ' ').replace(firstName + '!', firstName + ' -')}
          </h2>
          <p className="text-white/80 text-sm mt-1">PMI Paramedic Tools</p>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-6">
            {msg.body}
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <span className="font-medium">Quick tip:</span> You can replay this tour any time from your{' '}
                <span className="font-medium">Settings</span> page.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onStartTour}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            >
              Take the Tour
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onSkip}
              className="w-full px-5 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
