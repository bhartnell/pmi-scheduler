'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Shield, CheckCircle2, ScrollText } from 'lucide-react';

interface ConsentModalProps {
  agreementType: string;
  agreementText: string;
  version: number;
  title?: string;
  onAccept: () => void;
}

export default function ConsentModal({
  agreementType,
  agreementText,
  version,
  title,
  onAccept,
}: ConsentModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const agreementTitle = title || getDefaultTitle(agreementType);

  // Track scroll position to enable the accept button
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Consider "scrolled to bottom" when within 20px of the bottom
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    if (atBottom) setHasScrolledToBottom(true);
  }, []);

  // Auto-enable for short agreements that don't need scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // If content doesn't overflow, no scrolling needed
    if (el.scrollHeight <= el.clientHeight + 20) {
      setHasScrolledToBottom(true);
    }
  }, [agreementText]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const res = await fetch('/api/ferpa/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreement_type: agreementType,
          version,
        }),
      });

      if (res.ok) {
        setAccepted(true);
        // Brief delay to show the success state
        setTimeout(() => onAccept(), 800);
      } else {
        console.error('Failed to record acceptance');
        setIsAccepting(false);
      }
    } catch (error) {
      console.error('Error accepting agreement:', error);
      setIsAccepting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl rounded-xl bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
            <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {agreementTitle}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Version {version} — Please read and accept to continue
            </p>
          </div>
        </div>

        {/* Scrollable agreement text */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-80 overflow-y-auto px-6 py-4"
        >
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {agreementText.split('\n').map((paragraph, idx) => (
              <p key={idx} className="mb-3 text-gray-700 dark:text-gray-300">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Scroll indicator */}
          {!hasScrolledToBottom && (
            <div className="mt-2 flex items-center justify-center gap-1 text-xs text-gray-400">
              <ScrollText className="h-3 w-3" />
              Scroll to read the full agreement
            </div>
          )}
        </div>

        {/* Footer with accept button */}
        <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          {accepted ? (
            <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Agreement accepted</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                By clicking below, you acknowledge that you have read and agree to the terms above.
              </p>
              <button
                onClick={handleAccept}
                disabled={!hasScrolledToBottom || isAccepting}
                className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                  hasScrolledToBottom && !isAccepting
                    ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
                    : 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                }`}
              >
                {isAccepting ? 'Recording acceptance...' : 'I Acknowledge and Agree'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getDefaultTitle(type: string): string {
  switch (type) {
    case 'student_data_use':
      return 'Student Data Use Agreement';
    case 'agency_data_sharing':
      return 'Agency Data Sharing Agreement';
    case 'instructor_confidentiality':
      return 'Instructor Confidentiality Agreement';
    default:
      return 'Data Use Agreement';
  }
}
