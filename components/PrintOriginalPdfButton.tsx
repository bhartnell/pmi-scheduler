'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';

let cache: Promise<Set<string>> | null = null;

function loadCodes(): Promise<Set<string>> {
  if (!cache) {
    cache = fetch('/api/aha-source-pdfs')
      .then((r) => r.json())
      .then((d) => new Set<string>((d.files || []).map((f: { code: string }) => f.code)))
      .catch(() => {
        cache = null;
        return new Set<string>();
      });
  }
  return cache;
}

// Opens the original AHA PDF for a case/checklist. Renders nothing unless a PDF has been uploaded for the code.
export default function PrintOriginalPdfButton({ code, className = '' }: { code: string | null | undefined; className?: string }) {
  const [exists, setExists] = useState(false);

  useEffect(() => {
    if (!code) return;
    let live = true;
    loadCodes().then((s) => live && setExists(s.has(code)));
    return () => { live = false; };
  }, [code]);

  if (!code || !exists) return null;
  return (
    <a
      href={`/api/aha-source-pdfs/${encodeURIComponent(code)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${className}`}
    >
      <Printer className="w-4 h-4" /> Print original PDF
    </a>
  );
}
