'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Size definitions: maps a size key to its Tailwind col-span class and a label/icon hint
export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

const SIZE_CONFIG: Record<WidgetSize, { colSpan: string; label: string; title: string }> = {
  sm:   { colSpan: 'md:col-span-1', label: '1',  title: 'Small (1 column)'    },
  md:   { colSpan: 'md:col-span-2', label: '2',  title: 'Medium (2 columns)'  },
  lg:   { colSpan: 'md:col-span-3', label: '3',  title: 'Large (3 columns)'   },
  full: { colSpan: 'md:col-span-full', label: '■', title: 'Full width'        },
};

const SIZES: WidgetSize[] = ['sm', 'md', 'lg', 'full'];

const STORAGE_KEY = 'pmi_dashboard_widget_sizes';

// Load all sizes from localStorage
function loadSizes(): Record<string, WidgetSize> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Save one widget's size
function saveSize(widgetId: string, size: WidgetSize) {
  if (typeof window === 'undefined') return;
  try {
    const all = loadSizes();
    all[widgetId] = size;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Silently ignore storage errors
  }
}

// ---- Size toggle buttons rendered inside the widget header ---------------

interface SizeButtonsProps {
  widgetId: string;
  currentSize: WidgetSize;
  onChange: (size: WidgetSize) => void;
}

function SizeButtons({ widgetId, currentSize, onChange }: SizeButtonsProps) {
  return (
    <div
      className="flex items-center gap-0.5 opacity-0 group-hover/resizable:opacity-100 focus-within:opacity-100 transition-opacity duration-150 print:hidden"
      aria-label={`Resize ${widgetId} widget`}
      role="group"
    >
      {SIZES.map((size) => {
        const cfg = SIZE_CONFIG[size];
        const isActive = currentSize === size;
        return (
          <button
            key={size}
            onClick={() => onChange(size)}
            title={cfg.title}
            aria-pressed={isActive}
            aria-label={`Set ${widgetId} widget to ${cfg.title}`}
            className={`
              w-6 h-6 flex items-center justify-center rounded text-xs font-bold transition-colors
              ${isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
          >
            {/* Visual representation: tiny bars proportional to column count */}
            <SizeIcon size={size} active={isActive} />
          </button>
        );
      })}
    </div>
  );
}

function SizeIcon({ size, active }: { size: WidgetSize; active: boolean }) {
  const color = active ? 'bg-white' : 'bg-current';
  // Represent sizes as 1, 2, 3, or 4 equal blocks
  const blocks = size === 'sm' ? 1 : size === 'md' ? 2 : size === 'lg' ? 3 : 4;
  return (
    <span className="flex items-center gap-px" aria-hidden="true">
      {Array.from({ length: blocks }).map((_, i) => (
        <span
          key={i}
          className={`${color} rounded-sm`}
          style={{ width: blocks === 4 ? 2 : 3, height: 8 }}
        />
      ))}
    </span>
  );
}

// ---- The main ResizableWidget wrapper -----------------------------------

interface ResizableWidgetProps {
  widgetId: string;
  defaultSize?: WidgetSize;
  children: React.ReactNode;
}

export default function ResizableWidget({
  widgetId,
  defaultSize = 'md',
  children,
}: ResizableWidgetProps) {
  const [size, setSize] = useState<WidgetSize>(defaultSize);
  const initializedRef = useRef(false);

  // Load persisted size on mount (client-only)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const saved = loadSizes();
    if (saved[widgetId] && SIZES.includes(saved[widgetId] as WidgetSize)) {
      setSize(saved[widgetId] as WidgetSize);
    }
  }, [widgetId]);

  const handleSizeChange = useCallback((newSize: WidgetSize) => {
    setSize(newSize);
    saveSize(widgetId, newSize);
  }, [widgetId]);

  const colSpanClass = SIZE_CONFIG[size].colSpan;

  return (
    <div
      className={`${colSpanClass} col-span-full transition-all duration-300 ease-in-out group/resizable relative`}
      data-widget-id={widgetId}
      data-widget-size={size}
    >
      {/* Size controls overlay — injected before the widget's own DOM so
          they float above the widget header. We use absolute positioning
          anchored to the top-right of the wrapper so we don't need to
          modify the underlying widget components. */}
      <div
        className="
          absolute top-0 right-0 z-10
          flex items-center gap-1
          px-2 py-1.5
          opacity-0 group-hover/resizable:opacity-100 focus-within:opacity-100
          transition-opacity duration-150
          print:hidden
        "
        aria-hidden="false"
      >
        <SizeButtons
          widgetId={widgetId}
          currentSize={size}
          onChange={handleSizeChange}
        />
      </div>

      {/* The actual widget content — untouched */}
      {children}
    </div>
  );
}

// ---- Hook to reset all widget sizes -------------------------------------

export function useWidgetSizes() {
  const resetAll = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { resetAll };
}
