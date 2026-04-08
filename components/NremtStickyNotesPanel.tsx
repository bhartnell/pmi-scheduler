'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  StickyNote,
  X,
  AlertTriangle,
  Hand,
  CheckCircle,
  GripHorizontal,
} from 'lucide-react';

interface NremtStickyNotesPanelProps {
  notes: string;
  onNotesChange: (notes: string) => void;
  criticalFail: boolean;
  onCriticalFailChange: (fail: boolean) => void;
  criticalFailNotes: string;
  onCriticalFailNotesChange: (notes: string) => void;
  onNeedAssistance: () => void;
  assistanceRequested?: boolean;
}

function PanelContent({
  notes,
  onNotesChange,
  criticalFail,
  onCriticalFailChange,
  criticalFailNotes,
  onCriticalFailNotesChange,
  onNeedAssistance,
  assistanceRequested,
}: NremtStickyNotesPanelProps) {
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand notes textarea
  const autoResize = useCallback(() => {
    const el = notesRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [notes, autoResize]);

  return (
    <div className="flex flex-col gap-4">
      {/* Examiner Notes */}
      <div>
        <label
          htmlFor="examiner-notes"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Examiner Notes
        </label>
        <textarea
          ref={notesRef}
          id="examiner-notes"
          rows={4}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          onInput={autoResize}
          placeholder="Add observations, comments, or feedback..."
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Critical Fail */}
      <div
        className={`rounded-md border p-3 transition-colors ${
          criticalFail
            ? 'border-red-400 dark:border-red-600 border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/30'
            : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={criticalFail}
            onChange={(e) => onCriticalFailChange(e.target.checked)}
            className="h-5 w-5 rounded border-red-400 text-red-600 focus:ring-red-500 accent-red-600"
          />
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold text-red-700 dark:text-red-400">
            Critical Failure
          </span>
        </label>

        {criticalFail && (
          <div className="mt-3">
            <label
              htmlFor="critical-fail-notes"
              className="block text-xs font-medium text-red-600 dark:text-red-400 mb-1"
            >
              Explain the critical failure (required)
            </label>
            <textarea
              id="critical-fail-notes"
              rows={3}
              value={criticalFailNotes}
              onChange={(e) => onCriticalFailNotesChange(e.target.value)}
              placeholder="Describe what happened..."
              className="w-full rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-red-300 dark:placeholder-red-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none"
            />
          </div>
        )}
      </div>

      {/* Need Assistance */}
      {assistanceRequested ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 px-4 py-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            Assistance Requested
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onNeedAssistance}
          className="flex items-center justify-center gap-2 rounded-md bg-amber-500 hover:bg-amber-600 active:bg-amber-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors animate-pulse hover:animate-none"
        >
          <Hand className="h-5 w-5" />
          Need Assistance
        </button>
      )}
    </div>
  );
}

export default function NremtStickyNotesPanel(
  props: NremtStickyNotesPanelProps
) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop sticky panel */}
      <div className="hidden md:block sticky top-[80px] w-[300px] shrink-0 self-start">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-500" />
            Examiner Panel
          </h3>
          <PanelContent {...props} />
        </div>
      </div>

      {/* Mobile floating button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 active:bg-amber-700 transition-colors"
        aria-label="Open examiner notes"
      >
        <StickyNote className="h-6 w-6" />
      </button>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40 transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl px-4 pb-6 pt-2">
          {/* Drag handle */}
          <div className="flex justify-center py-2">
            <GripHorizontal className="h-5 w-6 text-gray-400" />
          </div>

          {/* Header with close */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-500" />
              Examiner Panel
            </h3>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close examiner panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <PanelContent {...props} />
        </div>
      </div>
    </>
  );
}
