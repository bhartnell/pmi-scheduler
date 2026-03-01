'use client';

import { useState } from 'react';
import { Share2, Copy, Check, ExternalLink } from 'lucide-react';

interface ShareLinkProps {
  /** The full web URL to share */
  url: string;
  /** Human-readable title for the share sheet */
  title?: string;
  /** Entity type used to construct the deep link (e.g. "lab", "student", "task") */
  entityType?: string;
  /** Entity id — appended to the deep link scheme  */
  entityId?: string;
  /** Optional CSS class overrides for the button */
  className?: string;
  /** Show as icon-only (no label) */
  iconOnly?: boolean;
}

/**
 * ShareLink
 *
 * Reusable share button that:
 *  - Uses the Web Share API on mobile (if available).
 *  - Falls back to copy-to-clipboard on desktop.
 *  - Also generates a pmi:// deep link for native app routing.
 */
export default function ShareLink({
  url,
  title = 'PMI EMS Scheduler',
  entityType,
  entityId,
  className = '',
  iconOnly = false,
}: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Build a deep link URL if entityType is provided
  const deepLink = entityType && entityId
    ? `pmi://${entityType}/${entityId}`
    : entityType
    ? `pmi://${entityType}`
    : null;

  const shareText = deepLink
    ? `${title}\n${url}\n\nOpen in app: ${deepLink}`
    : `${title}\n${url}`;

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);

    try {
      // Try Web Share API first (mobile browsers)
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title,
          text: deepLink ? `Open in app: ${deepLink}` : undefined,
          url,
        });
      } else {
        // Fallback: copy to clipboard
        await copyToClipboard();
      }
    } catch (err) {
      // User cancelled share or share failed — try copy as fallback
      if ((err as Error)?.name !== 'AbortError') {
        await copyToClipboard();
      }
    } finally {
      setSharing(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last-resort: select + execCommand
      const el = document.createElement('textarea');
      el.value = shareText;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const baseClass =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';

  const colorClass = copied
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleShare}
        disabled={sharing}
        className={`${baseClass} ${colorClass} ${className}`}
        aria-label={copied ? 'Copied!' : 'Share link'}
        title={copied ? 'Copied to clipboard!' : 'Share or copy link'}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" aria-hidden="true" />
            {!iconOnly && <span>Copied!</span>}
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4" aria-hidden="true" />
            {!iconOnly && <span>Share</span>}
          </>
        )}
      </button>

      {/* Separate "copy link" fallback button for desktop */}
      {!iconOnly && typeof navigator !== 'undefined' && !navigator.share && (
        <button
          onClick={copyToClipboard}
          className={`${baseClass} ${colorClass}`}
          aria-label="Copy link to clipboard"
          title="Copy link"
        >
          {copied ? (
            <Check className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Copy className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      )}

      {/* Deep link indicator */}
      {deepLink && !iconOnly && (
        <a
          href={deepLink}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono"
          title={`Deep link: ${deepLink}`}
          aria-label={`Open in app via ${deepLink}`}
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          {deepLink}
        </a>
      )}
    </div>
  );
}
