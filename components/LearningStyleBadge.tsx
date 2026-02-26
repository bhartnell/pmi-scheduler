'use client';

/**
 * Shared Learning Style Badge component.
 * Displays a small colored pill badge showing a student's primary learning style.
 *
 * Existing learning style values in the DB:
 *   audio, visual, kinesthetic  (primary_style)
 *   social, independent         (social_style)
 */

export interface LearningStyleConfig {
  letter: string;
  label: string;
  bg: string;
  text: string;
  darkBg: string;
  darkText: string;
  fullBg: string;
  fullText: string;
  fullDarkBg: string;
  fullDarkText: string;
}

export const LEARNING_STYLE_CONFIG: Record<string, LearningStyleConfig> = {
  visual: {
    letter: 'V',
    label: 'Visual',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    darkBg: 'dark:bg-purple-900/40',
    darkText: 'dark:text-purple-300',
    fullBg: 'bg-purple-500',
    fullText: 'text-white',
    fullDarkBg: 'dark:bg-purple-600',
    fullDarkText: 'dark:text-white',
  },
  audio: {
    letter: 'A',
    label: 'Auditory',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    darkBg: 'dark:bg-blue-900/40',
    darkText: 'dark:text-blue-300',
    fullBg: 'bg-blue-500',
    fullText: 'text-white',
    fullDarkBg: 'dark:bg-blue-600',
    fullDarkText: 'dark:text-white',
  },
  kinesthetic: {
    letter: 'K',
    label: 'Kinesthetic',
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    darkBg: 'dark:bg-orange-900/40',
    darkText: 'dark:text-orange-300',
    fullBg: 'bg-orange-500',
    fullText: 'text-white',
    fullDarkBg: 'dark:bg-orange-600',
    fullDarkText: 'dark:text-white',
  },
  // reading/writing style — not in the current DB schema but
  // included here for forward-compatibility
  reading: {
    letter: 'R',
    label: 'Reading/Writing',
    bg: 'bg-green-100',
    text: 'text-green-700',
    darkBg: 'dark:bg-green-900/40',
    darkText: 'dark:text-green-300',
    fullBg: 'bg-green-500',
    fullText: 'text-white',
    fullDarkBg: 'dark:bg-green-600',
    fullDarkText: 'dark:text-white',
  },
};

/** Returns a config object for the given primary style (falls back gracefully). */
export function getLearningStyleConfig(style: string | null | undefined): LearningStyleConfig | null {
  if (!style) return null;
  return LEARNING_STYLE_CONFIG[style.toLowerCase()] || null;
}

interface LearningStyleBadgeProps {
  style: string | null | undefined;
  /** 'pill' = compact letter pill (default), 'label' = letter + full label text */
  variant?: 'pill' | 'label';
  className?: string;
}

/**
 * A small badge indicating a student's primary learning style.
 * Designed to be placed inline next to student names.
 *
 * Example: `<LearningStyleBadge style="kinesthetic" />`
 * Renders: [K] in an orange pill
 */
export default function LearningStyleBadge({
  style,
  variant = 'pill',
  className = '',
}: LearningStyleBadgeProps) {
  const config = getLearningStyleConfig(style);

  if (!config && !style) {
    // Not assessed — show a gray "?" badge
    return (
      <span
        className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-bold leading-none bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 ${className}`}
        title="Learning style not assessed"
      >
        ?
      </span>
    );
  }

  if (!config) return null;

  if (variant === 'label') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text} ${config.darkBg} ${config.darkText} ${className}`}
        title={config.label}
      >
        <span className="font-bold">{config.letter}</span>
        <span>{config.label}</span>
      </span>
    );
  }

  // Default: compact pill
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold leading-none ${config.bg} ${config.text} ${config.darkBg} ${config.darkText} ${className}`}
      title={config.label}
    >
      {config.letter}
    </span>
  );
}
