'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface AutoSaveDraft<T> {
  data: T;
  timestamp: string;
  version: 1;
}

export interface UseAutoSaveOptions<T> {
  /** localStorage key for this form draft */
  key: string;
  /** Current form data to track */
  data: T;
  /** Called with saved data when user accepts restore */
  onRestore?: (data: T) => void;
  /** Debounce delay in milliseconds (default: 5000) */
  debounceMs?: number;
  /** Enable/disable auto-save (default: true) */
  enabled?: boolean;
}

export interface UseAutoSaveReturn {
  /** Whether a saved draft exists in localStorage */
  hasDraft: boolean;
  /** ISO timestamp string of when the draft was last saved */
  draftTimestamp: string | null;
  /** Restore the saved draft (calls onRestore, dismisses prompt) */
  restoreDraft: () => void;
  /** Discard the saved draft (removes from localStorage, dismisses prompt) */
  discardDraft: () => void;
  /** Clear draft after successful save/submit */
  clearDraft: () => void;
  /** Current auto-save status */
  saveStatus: 'idle' | 'saving' | 'saved';
  /** Whether to show the restore-draft prompt on load */
  showRestorePrompt: boolean;
  /** Dismiss the restore prompt without restoring */
  dismissRestorePrompt: () => void;
}

function readDraft<T>(key: string): AutoSaveDraft<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutoSaveDraft<T>;
    // Basic shape validation
    if (parsed && parsed.version === 1 && parsed.data && parsed.timestamp) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const draft: AutoSaveDraft<T> = {
      data,
      timestamp: new Date().toISOString(),
      version: 1,
    };
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // localStorage may be unavailable (private mode quota exceeded, etc.)
  }
}

function removeDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function useAutoSave<T>({
  key,
  data,
  onRestore,
  debounceMs = 5000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStatusRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether this is the very first render so we skip auto-saving initial data
  const isMountedRef = useRef(false);
  // Remember the most recent data ref so the debounced callback always closes over current value
  const dataRef = useRef(data);
  dataRef.current = data;

  // On mount: check for an existing draft and show restore prompt if found
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      isMountedRef.current = true;
      return;
    }

    const draft = readDraft<T>(key);
    if (draft) {
      setHasDraft(true);
      setDraftTimestamp(draft.timestamp);
      setShowRestorePrompt(true);
    }

    // Mark as mounted AFTER checking draft so the data-change effect
    // doesn't fire a save on the very first render.
    isMountedRef.current = true;
  }, [key, enabled]);

  // On data change: debounce a save to localStorage
  useEffect(() => {
    if (!enabled || !isMountedRef.current) return;

    // Clear any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Clear any "saved" display timeout
    if (savedStatusRef.current) clearTimeout(savedStatusRef.current);

    setSaveStatus('saving');

    debounceRef.current = setTimeout(() => {
      writeDraft(key, dataRef.current);
      setHasDraft(true);
      setDraftTimestamp(new Date().toISOString());
      setSaveStatus('saved');

      // Reset back to idle after 2 seconds
      savedStatusRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key, debounceMs, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedStatusRef.current) clearTimeout(savedStatusRef.current);
    };
  }, []);

  const restoreDraft = useCallback(() => {
    const draft = readDraft<T>(key);
    if (draft && onRestore) {
      onRestore(draft.data);
    }
    setShowRestorePrompt(false);
  }, [key, onRestore]);

  const discardDraft = useCallback(() => {
    removeDraft(key);
    setHasDraft(false);
    setDraftTimestamp(null);
    setShowRestorePrompt(false);
  }, [key]);

  const clearDraft = useCallback(() => {
    removeDraft(key);
    setHasDraft(false);
    setDraftTimestamp(null);
    setShowRestorePrompt(false);
    setSaveStatus('idle');
  }, [key]);

  const dismissRestorePrompt = useCallback(() => {
    setShowRestorePrompt(false);
  }, []);

  return {
    hasDraft,
    draftTimestamp,
    restoreDraft,
    discardDraft,
    clearDraft,
    saveStatus,
    showRestorePrompt,
    dismissRestorePrompt,
  };
}
