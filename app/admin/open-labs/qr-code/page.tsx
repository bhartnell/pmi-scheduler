'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Download,
  Copy,
  CheckCircle,
  Link as LinkIcon,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';
import { PageLoader } from '@/components/ui';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import type { CurrentUser } from '@/types';

const OPEN_LAB_URL = 'https://www.pmiparamedic.tools/open-lab';

export default function OpenLabQRCodePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [copied, setCopied] = useState(false);

  // Auth + role check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status === 'authenticated' && session?.user?.email) {
      // /api/auth/me does not exist; use the real endpoint.
      fetch('/api/instructor/me')
        .then((r) => r.json())
        .then((data) => {
          const user = data.user || data;
          setCurrentUser(user);
          if (!canAccessAdmin(user.role)) {
            router.push('/');
          }
        })
        .catch(() => router.push('/'));
    }
  }, [status, session, router]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(OPEN_LAB_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, []);

  const handleDownloadPng = useCallback(() => {
    // Find the SVG inside the QR container
    const svgEl = document.querySelector('[aria-label^="QR code"]')?.querySelector('svg');
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 600, 600);

      ctx.drawImage(img, 0, 0, 600, 600);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'open-lab-qr-code.png';
        a.click();
        URL.revokeObjectURL(a.href);
      }, 'image/png');
    };
    img.src = url;
  }, []);

  if (status === 'loading' || !currentUser) {
    return <PageLoader message="Loading..." />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs
        customSegments={{
          'admin/open-labs': 'Open Labs',
          'admin/open-labs/qr-code': 'QR Code',
        }}
        className="mb-4"
      />

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Open Lab QR Code
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center">
        {/* QR Code */}
        <QRCodeDisplay
          url={OPEN_LAB_URL}
          size={300}
          label="Open Lab Sign-Up"
        />

        {/* Action buttons */}
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleDownloadPng}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
          >
            <Download className="w-4 h-4" />
            Download PNG
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Link
              </>
            )}
          </button>
        </div>

        {/* URL display */}
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <LinkIcon className="w-3.5 h-3.5" />
          <span className="font-mono">{OPEN_LAB_URL}</span>
        </div>
      </div>

      {/* Note */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          This QR code always shows the next 4 weeks of open lab dates. Post it on Blackboard or
          print it for the building &mdash; it never expires.
        </p>
      </div>
    </div>
  );
}
