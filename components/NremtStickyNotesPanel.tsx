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
  /** @deprecated — merged into examiner comments; prop retained for caller compatibility */
  criticalFailNotes: string;
  /** @deprecated — merged into examiner comments; prop retained for caller compatibility */
  onCriticalFailNotesChange: (notes: string) => void;
  onNeedAssistance: () => void;
  assistanceRequested?: boolean;
  /** FIX 6: Callback to clear an active assistance alert */
  onClearAssistance?: () => void;
  /** FIX 3: List of critical failure criteria from the skill sheet */
  criticalCriteria?: string[];
  /** FIX 3: Which criteria are currently checked (by index) */
  checkedCriteria?: string[];
  /** FIX 3: Callback when criteria checks change */
  onCheckedCriteriaChange?: (checked: string[]) => void;
  /** Whether the current result is fail — used to show red border on comments */
  resultIsFail?: boolean;
  /**
   * Render mode:
   * - "floating" (default): existing behavior — desktop sticky + mobile floating drawer
   * - "desktop-inline": render as a plain inline column for the desktop NREMT 3-column layout
   */
  mode?: 'floating' | 'desktop-inline';
}

function PanelContent({
  notes,
  onNotesChange,
  criticalFail,
  onCriticalFailChange,
  onNeedAssistance,
  assistanceRequested,
  onClearAssistance,
  criticalCriteria = [],
  checkedCriteria = [],
  onCheckedCriteriaChange,
  resultIsFail,
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

  // Coerce any criterion shape to a display/identity string. Defends against
  // DB rows that store objects like { description } or { step_number, status }
  // instead of plain strings.
  const criterionToText = (c: unknown): string => {
    if (typeof c === 'string') return c;
    if (c && typeof c === 'object') {
      const o = c as Record<string, unknown>;
      if (typeof o.description === 'string') return o.description;
      if (typeof o.text === 'string') return o.text;
      if (typeof o.label === 'string') return o.label;
      if (typeof o.criterion === 'string') return o.criterion;
      if ('step_number' in o) {
        const sn = o.step_number;
        const st = 'status' in o ? String(o.status) : '';
        return st ? `Step ${sn}: ${st}` : `Step ${sn}`;
      }
      try { return JSON.stringify(o); } catch { return String(o); }
    }
    return String(c);
  };

  // FIX 3: Toggle a specific critical criterion (by its text key)
  const toggleCriterion = (criterionKey: string) => {
    if (!onCheckedCriteriaChange) return;
    const isChecked = checkedCriteria.includes(criterionKey);
    const updated = isChecked
      ? checkedCriteria.filter(c => c !== criterionKey)
      : [...checkedCriteria, criterionKey];
    onCheckedCriteriaChange(updated);
    // Auto-set criticalFail based on whether any criterion is checked
    onCriticalFailChange(updated.length > 0);
  };

  // FIX 3: Determine if we're using per-criterion mode or legacy single checkbox
  const hasPerCriterionMode = criticalCriteria.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Examiner Comments — unified field (also captures critical failure explanation) */}
      <div>
        <label
          htmlFor="examiner-notes"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {criticalFail ? (
            <>
              Examiner Comments — Critical failure explanation required
              <span className="text-red-500 ml-1">*</span>
            </>
          ) : (
            <>
              Examiner Comments
              {resultIsFail && <span className="text-red-500 ml-1">* required</span>}
            </>
          )}
        </label>
        <textarea
          ref={notesRef}
          id="examiner-notes"
          rows={4}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          onInput={autoResize}
          placeholder={criticalFail ? 'Describe what happened...' : 'Add observations, comments, or feedback...'}
          className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 resize-none ${
            (resultIsFail || criticalFail) && !notes.trim()
              ? 'border-red-400 dark:border-red-600 focus:border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-950/20'
              : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-800'
          }`}
        />
      </div>

      {/* FIX 3: Critical Fail — Per-criterion checkboxes when criteria available */}
      {hasPerCriterionMode ? (
        <div
          className={`rounded-md border p-3 transition-colors ${
            criticalFail
              ? 'border-red-400 dark:border-red-600 border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/30'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-semibold text-red-700 dark:text-red-400">
              Critical Failure Criteria
            </span>
          </div>
          <div className="space-y-2">
            {criticalCriteria.map((criterion, idx) => {
              const text = criterionToText(criterion);
              const isChecked = checkedCriteria.includes(text);
              return (
                <label key={idx} className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCriterion(text)}
                    className="mt-0.5 h-4 w-4 rounded border-red-400 text-red-600 focus:ring-red-500 accent-red-600"
                  />
                  <span className={`text-xs ${
                    isChecked
                      ? 'text-red-700 dark:text-red-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {text}
                  </span>
                </label>
              );
            })}
          </div>

        </div>
      ) : (
        /* Legacy single checkbox mode (non-NREMT or no criteria) */
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

        </div>
      )}

      {/* Need Assistance */}
      {assistanceRequested ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Assistance Requested
            </span>
          </div>
          {onClearAssistance && (
            <button
              type="button"
              onClick={onClearAssistance}
              className="flex items-center gap-1 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear Alert
            </button>
          )}
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
  const { mode = 'floating', ...panelProps } = props;
  const [mobileOpen, setMobileOpen] = useState(false);

  // Desktop-inline mode: render as a plain column (no sticky, no floating button)
  if (mode === 'desktop-inline') {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-amber-500" />
          Examiner Panel
        </h3>
        <PanelContent {...panelProps} />
      </div>
    );
  }

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
        className="md:hidden fixed bottom-20 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 active:bg-amber-700 transition-colors"
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
