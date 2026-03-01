'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface QRCodeDisplayProps {
  /** The URL to encode into a QR code */
  url: string;
  /** Display size of the QR code in pixels (default 200) */
  size?: number;
  /** Whether to show the URL text below the QR code (default true) */
  showUrl?: boolean;
  /** Label shown above the QR code */
  label?: string;
}

/**
 * QRCodeDisplay
 *
 * Fetches an SVG QR code from /api/deep-links/qr and renders it inline.
 * Shows a loading spinner while fetching, and an error state on failure.
 */
export default function QRCodeDisplay({
  url,
  size = 200,
  showUrl = true,
  label,
}: QRCodeDisplayProps) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      setError('No URL provided');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSvgContent(null);

    const fetchQR = async () => {
      try {
        const params = new URLSearchParams({ url: encodeURIComponent(url) });
        const res = await fetch(`/api/deep-links/qr?${params.toString()}`);

        if (!res.ok) {
          throw new Error(`Failed to fetch QR code (${res.status})`);
        }

        const svg = await res.text();
        if (!cancelled) {
          setSvgContent(svg);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to generate QR code');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchQR();
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </p>
      )}

      {/* QR container */}
      <div
        className="flex items-center justify-center bg-white rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden"
        style={{ width: size, height: size }}
      >
        {loading && (
          <Loader2
            className="w-8 h-8 text-blue-500 animate-spin"
            aria-label="Loading QR code"
          />
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-1 p-3 text-center">
            <AlertCircle className="w-6 h-6 text-red-500" aria-hidden="true" />
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {svgContent && !loading && !error && (
          /* dangerouslySetInnerHTML is safe here — the SVG comes from our
             own API route which only generates geometric QR code shapes. */
          <div
            style={{ width: size, height: size }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
            aria-label={`QR code for ${url}`}
            role="img"
          />
        )}
      </div>

      {showUrl && url && (
        <p
          className="text-xs text-gray-500 dark:text-gray-400 font-mono max-w-[200px] truncate text-center"
          title={url}
        >
          {url}
        </p>
      )}
    </div>
  );
}
