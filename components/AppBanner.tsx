'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Smartphone } from 'lucide-react';

const DISMISS_KEY = 'pmi_app_banner_dismissed';

/**
 * AppBanner
 *
 * A mobile-only top banner prompting users to open the PMI EMS native app.
 * - Only rendered on mobile devices (detected via user agent).
 * - Dismissed state is persisted to localStorage.
 * - Provides a deep link (pmi://open) and a fallback app-store link.
 * - Sits at the top of the page, can be closed with X.
 */
export default function AppBanner() {
  const [show, setShow] = useState(false);
  // Ref to track whether we have already run the visibility check so
  // we do not call setShow multiple times in Strict Mode double-invocation.
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    // Only show on mobile browsers
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Respect user dismissal stored in localStorage
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // localStorage may be blocked in private/incognito — fall through and show
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true);
  }, []);

  const handleDismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore
    }
  };

  const handleOpenApp = () => {
    // Attempt native app via custom URL scheme
    window.location.href = 'pmi://open';

    // Fallback to app store after 1.5 s if the app did not intercept
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const storeUrl = isIOS
      ? 'https://apps.apple.com/app/pmi-ems-scheduler'
      : 'https://play.google.com/store/apps/details?id=edu.pmi.ems_scheduler';

    setTimeout(() => {
      window.open(storeUrl, '_blank', 'noopener,noreferrer');
    }, 1500);
  };

  if (!show) return null;

  return (
    <div
      role="banner"
      className="relative z-50 flex items-center gap-3 px-4 py-2 bg-blue-600 text-white print:hidden"
      aria-label="Open in PMI EMS App"
    >
      {/* App icon placeholder */}
      <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
        <Smartphone className="w-5 h-5" aria-hidden="true" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">PMI EMS App</p>
        <p className="text-xs text-blue-100 leading-tight">Better experience in the native app</p>
      </div>

      {/* Open button */}
      <button
        onClick={handleOpenApp}
        className="flex-shrink-0 px-3 py-1 bg-white text-blue-600 text-sm font-medium rounded-full hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
        aria-label="Open PMI EMS App"
      >
        Open
      </button>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Dismiss app banner"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
