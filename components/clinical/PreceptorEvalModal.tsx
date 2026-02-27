'use client';

import { useState, useEffect } from 'react';
import { X, Send, Loader2, CheckCircle2, Copy, ExternalLink, AlertCircle, Clock } from 'lucide-react';

interface EvalToken {
  id: string;
  token: string;
  preceptor_email: string;
  created_at: string;
  expires_at: string;
  status: 'active' | 'submitted' | 'expired';
  submitted_at: string | null;
}

interface PreceptorEvalModalProps {
  internshipId: string;
  studentName?: string;
  onClose: () => void;
}

export default function PreceptorEvalModal({
  internshipId,
  studentName = '',
  onClose,
}: PreceptorEvalModalProps) {
  const [preceptorEmail, setPreceptorEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentLink, setSentLink] = useState<string | null>(null);
  const [sentExpiry, setSentExpiry] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Existing tokens
  const [tokens, setTokens] = useState<EvalToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);

  useEffect(() => {
    fetchTokens();
  }, [internshipId]);

  const fetchTokens = async () => {
    setTokensLoading(true);
    try {
      const res = await fetch(`/api/clinical/preceptor-eval/tokens?internship_id=${internshipId}`);
      const data = await res.json();
      if (data.success) {
        setTokens(data.tokens || []);
      }
    } catch {
      // non-fatal
    }
    setTokensLoading(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!preceptorEmail.trim()) {
      setError('Preceptor email is required.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/clinical/preceptor-eval/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internship_id: internshipId,
          preceptor_email: preceptorEmail.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSentLink(data.link);
        setSentExpiry(data.expires_at);
        setPreceptorEmail('');
        fetchTokens();
      } else {
        setError(data.error || 'Failed to generate link.');
      }
    } catch {
      setError('A network error occurred. Please try again.');
    }
    setSending(false);
  };

  const handleCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const formatExpiry = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isExpired = (iso: string) => new Date(iso) < new Date();

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  const buildLink = (token: string) => `${getBaseUrl()}/preceptor/evaluate/${token}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Send Evaluation Request</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Student context */}
          {studentName && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Sending for student: <span className="font-medium text-gray-900 dark:text-white">{studentName}</span>
            </div>
          )}

          {/* Success panel after generating link */}
          {sentLink && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span className="text-sm font-medium text-green-800 dark:text-green-300">Evaluation link generated!</span>
              </div>
              <p className="text-xs text-green-700 dark:text-green-400">
                Copy this link and send it to the preceptor. It expires{' '}
                <strong>{sentExpiry ? formatExpiry(sentExpiry) : ''}</strong>.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={sentLink}
                  className="flex-1 px-2 py-1.5 text-xs border border-green-300 dark:border-green-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 truncate"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(sentLink)}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={sentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium border border-green-400 dark:border-green-600 text-green-700 dark:text-green-400 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Preview
                </a>
              </div>
            </div>
          )}

          {/* Generate new link form */}
          <form onSubmit={handleSend} className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {sentLink ? 'Generate Another Link' : 'Preceptor Details'}
            </h3>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Preceptor Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={preceptorEmail}
                onChange={(e) => setPreceptorEmail(e.target.value)}
                placeholder="preceptor@agency.org"
                disabled={sending}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Generate Evaluation Link
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              The link is valid for 7 days. Copy it and share with the preceptor via email or message.
            </p>
          </form>

          {/* Existing tokens */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Previously Sent Links</h3>
            {tokensLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-gray-400 dark:text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : tokens.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-2">No evaluation links have been sent yet.</p>
            ) : (
              <div className="space-y-2">
                {tokens.map((t) => {
                  const expired = isExpired(t.expires_at);
                  const link = buildLink(t.token);
                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                        t.status === 'submitted'
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : expired
                          ? 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700 opacity-70'
                          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {t.preceptor_email}
                        </span>
                        <span
                          className={`flex-shrink-0 px-1.5 py-0.5 rounded-full font-medium ${
                            t.status === 'submitted'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                              : expired
                              ? 'bg-gray-200 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                          }`}
                        >
                          {t.status === 'submitted' ? 'Submitted' : expired ? 'Expired' : 'Active'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3" />
                        {t.status === 'submitted' && t.submitted_at
                          ? `Submitted ${formatExpiry(t.submitted_at)}`
                          : expired
                          ? `Expired ${formatExpiry(t.expires_at)}`
                          : `Expires ${formatExpiry(t.expires_at)}`}
                      </div>
                      {t.status === 'active' && !expired && (
                        <div className="flex items-center gap-1 pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(link)}
                            className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            Copy Link
                          </button>
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Preview
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
