'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X, Send, Bug, Lightbulb, HelpCircle, Loader2, CheckCircle } from 'lucide-react';

type ReportType = 'bug' | 'feature' | 'other';

export default function FeedbackButton() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('bug');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setReportType('bug');
      setSubmitted(false);
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please describe the issue or feedback');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: reportType,
          description: description.trim(),
          page_url: pathname,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
        })
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
        setTimeout(() => {
          setIsOpen(false);
        }, 2000);
      } else {
        setError(data.error || 'Failed to submit feedback');
      }
    } catch (err) {
      setError('Failed to submit feedback. Please try again.');
    }

    setSubmitting(false);
  };

  const formatDate = () => {
    return new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getBrowserInfo = () => {
    if (typeof navigator === 'undefined') return 'Unknown';
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect browser
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';

    // Detect OS
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';

    return `${browser} / ${os}`;
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all hover:shadow-xl print:hidden"
        title="Submit Feedback"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="font-medium">Feedback</span>
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          {/* Modal */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Submit Feedback
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {submitted ? (
                // Success State
                <div className="py-8 text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Thank you!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Your feedback has been submitted.
                  </p>
                </div>
              ) : (
                <>
                  {/* Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Type
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReportType('bug')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                          reportType === 'bug'
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Bug className="w-5 h-5" />
                        <span>Bug Report</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportType('feature')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                          reportType === 'feature'
                            ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Lightbulb className="w-5 h-5" />
                        <span>Feature</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportType('other')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                          reportType === 'other'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <HelpCircle className="w-5 h-5" />
                        <span>Other</span>
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {reportType === 'bug' ? 'What happened?' : reportType === 'feature' ? 'What would you like?' : 'Your feedback'}
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        reportType === 'bug'
                          ? 'Describe the issue you encountered...'
                          : reportType === 'feature'
                          ? 'Describe the feature you would like...'
                          : 'Share your thoughts...'
                      }
                      rows={4}
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                      {error}
                    </div>
                  )}

                  {/* Auto-captured Info */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-1">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Auto-captured
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Page:</span>
                      <span className="font-mono text-xs">{pathname}</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">User:</span>
                      <span>{session?.user?.email || 'Not signed in'}</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Time:</span>
                      <span>{formatDate()}</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Browser:</span>
                      <span>{getBrowserInfo()}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!submitted && (
              <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !description.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Feedback
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
