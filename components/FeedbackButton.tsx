'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X, Send, Bug, Lightbulb, HelpCircle, Loader2, CheckCircle, Camera } from 'lucide-react';

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
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setReportType('bug');
      setSubmitted(false);
      setError(null);
      setScreenshotFile(null);
      setScreenshotPreviewUrl(null);
    }
  }, [isOpen]);

  // Revoke object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (screenshotPreviewUrl) {
        URL.revokeObjectURL(screenshotPreviewUrl);
      }
    };
  }, [screenshotPreviewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Screenshot must be a PNG or JPG image');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Screenshot must be under 5MB');
      e.target.value = '';
      return;
    }

    // Revoke previous preview URL before creating a new one
    if (screenshotPreviewUrl) {
      URL.revokeObjectURL(screenshotPreviewUrl);
    }

    setScreenshotFile(file);
    setScreenshotPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const removeScreenshot = () => {
    if (screenshotPreviewUrl) {
      URL.revokeObjectURL(screenshotPreviewUrl);
    }
    setScreenshotFile(null);
    setScreenshotPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please describe the issue or feedback');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('description', description.trim());
      formData.append('report_type', reportType);
      formData.append('page_url', pathname);
      formData.append('user_agent', typeof navigator !== 'undefined' ? navigator.userAgent : '');
      if (screenshotFile) {
        formData.append('screenshot', screenshotFile);
      }

      // Do NOT set Content-Type header - the browser sets it automatically with the multipart boundary
      const res = await fetch('/api/feedback', {
        method: 'POST',
        body: formData,
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
        aria-label="Submit Feedback"
      >
        <MessageSquare className="w-5 h-5" aria-hidden="true" />
        <span className="font-medium">Feedback</span>
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-modal-title"
        >
          {/* Modal */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 id="feedback-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" aria-hidden="true" />
                Submit Feedback
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close feedback form"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
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
                    <label htmlFor="feedback-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {reportType === 'bug' ? 'What happened?' : reportType === 'feature' ? 'What would you like?' : 'Your feedback'}{' '}
                      <span className="text-red-500" aria-hidden="true">*</span>
                      <span className="sr-only">(required)</span>
                    </label>
                    <textarea
                      id="feedback-description"
                      value={description}
                      onChange={(e) => {
                        if (e.target.value.length <= 1000) {
                          setDescription(e.target.value);
                          if (error) setError(null);
                        }
                      }}
                      placeholder={
                        reportType === 'bug'
                          ? 'Describe the issue you encountered...'
                          : reportType === 'feature'
                          ? 'Describe the feature you would like...'
                          : 'Share your thoughts...'
                      }
                      rows={4}
                      maxLength={1000}
                      aria-required="true"
                      aria-invalid={!!(error && !description.trim())}
                      className={`w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        error && !description.trim()
                          ? 'border-red-500 dark:border-red-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      autoFocus
                    />
                    <div className="flex justify-end text-xs text-gray-400 mt-1">
                      <span className={description.length >= 900 ? 'text-amber-500' : ''}>
                        {description.length}/1000
                      </span>
                    </div>
                  </div>

                  {/* Screenshot Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Screenshot <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Camera className="h-4 w-4" aria-hidden="true" />
                        Attach Screenshot
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleFileSelect}
                        className="hidden"
                        aria-label="Attach screenshot"
                      />
                      {screenshotFile && screenshotPreviewUrl && (
                        <div className="flex items-center gap-2">
                          <img
                            src={screenshotPreviewUrl}
                            alt="Screenshot preview"
                            className="h-10 w-10 object-cover rounded border border-gray-300 dark:border-gray-600"
                          />
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                            {screenshotFile.name}
                          </span>
                          <button
                            type="button"
                            onClick={removeScreenshot}
                            aria-label="Remove screenshot"
                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">PNG or JPG, max 5MB</p>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div
                      role="alert"
                      className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm"
                    >
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
