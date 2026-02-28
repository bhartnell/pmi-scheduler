'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X,
  Sparkles,
  Shield,
  WifiOff,
  Loader2,
  Database,
  BookOpen,
  ScrollText,
  CheckSquare,
  Map,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { APP_VERSION, VERSION_DATE, WHATS_NEW_ITEMS } from '@/lib/version';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'pmi_whats_new_seen_version';

function hasSeenCurrentVersion(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === APP_VERSION;
  } catch {
    return true;
  }
}

function markVersionSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
  } catch {
    // localStorage unavailable — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Icon resolver
// Maps the string icon names stored in lib/version.ts to Lucide components.
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  'wifi-off': WifiOff,
  loader: Loader2,
  database: Database,
  'book-open': BookOpen,
  scroll: ScrollText,
  'check-square': CheckSquare,
  map: Map,
};

function FeatureIcon({ name }: { name: string }) {
  const Icon = ICON_MAP[name] ?? Sparkles;
  return <Icon className="w-4 h-4" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WhatsNewModalProps {
  /** When true the modal is always shown regardless of localStorage state.
   *  Useful when manually triggered from Settings. */
  forceShow?: boolean;
  /** Called when the user closes the modal. */
  onClose?: () => void;
}

export default function WhatsNewModal({ forceShow = false, onClose }: WhatsNewModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (forceShow || !hasSeenCurrentVersion()) {
      setVisible(true);
    }
  }, [forceShow]);

  function handleClose() {
    markVersionSeen();
    setVisible(false);
    onClose?.();
  }

  if (!visible) return null;

  const formattedDate = new Date(VERSION_DATE + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-7 text-white">
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Close What's New modal"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="whats-new-title" className="text-lg font-bold leading-tight">
                What&apos;s New in v{APP_VERSION}
              </h2>
              <p className="text-white/70 text-xs mt-0.5">{formattedDate}</p>
            </div>
          </div>

          <p className="text-white/80 text-sm leading-relaxed">
            Here are the highlights from the latest update to PMI Paramedic Tools.
          </p>
        </div>

        {/* Feature list */}
        <div className="px-6 py-5 max-h-[340px] overflow-y-auto">
          <ul className="space-y-3">
            {WHATS_NEW_ITEMS.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400">
                  <FeatureIcon name={item.icon} />
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pt-1">
                  {item.text}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/80">
          <Link
            href="/help#changelog"
            onClick={handleClose}
            className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Full changelog
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={handleClose}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Got it
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
