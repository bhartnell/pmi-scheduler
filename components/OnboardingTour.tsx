'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { X, ChevronLeft, ChevronRight, Check, Map } from 'lucide-react';
import WelcomeModal from './WelcomeModal';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TourStep {
  /** CSS selector for the element to highlight. null = centered modal with no highlight */
  target: string | null;
  title: string;
  description: string;
  /** Preferred position of the tooltip relative to the target */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPosition {
  top: number;
  left: number;
  arrowSide: 'top' | 'bottom' | 'left' | 'right' | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tour step definitions by role group
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_STEPS: TourStep[] = [
  {
    target: null,
    title: 'Welcome to PMI Paramedic Tools',
    description: 'As an admin, you have full access to manage the program. This quick tour highlights the key areas you will use every day.',
    placement: 'center',
  },
  {
    target: '[href="/"]',
    title: 'Dashboard',
    description: 'Your dashboard gives you an at-a-glance overview of the program — notifications, lab assignments, and stats. You can customize it with the Customize button.',
    placement: 'bottom',
  },
  {
    target: '[href="/admin"]',
    title: 'Admin Settings',
    description: 'Manage users, roles, guest access, and system configuration. You can approve pending users and assign roles from here.',
    placement: 'bottom',
  },
  {
    target: '[href="/lab-management"]',
    title: 'Lab Management',
    description: 'Create and manage lab schedules, scenarios, students, and assessments. This is the core of daily operations.',
    placement: 'bottom',
  },
  {
    target: '[href="/reports"]',
    title: 'Reports',
    description: 'Export student data, clinical hours summaries, and program analytics. All reports support Excel and PDF output.',
    placement: 'bottom',
  },
  {
    target: '[href="/settings"]',
    title: 'Settings',
    description: 'Adjust your notification preferences, email frequency, and timer audio. You can also replay this tour any time from Settings.',
    placement: 'bottom',
  },
];

const INSTRUCTOR_STEPS: TourStep[] = [
  {
    target: null,
    title: 'Welcome to PMI Paramedic Tools',
    description: 'This tour covers the features you will use most as an instructor. Use the arrows to navigate or press Skip at any time.',
    placement: 'center',
  },
  {
    target: '[href="/"]',
    title: 'Your Dashboard',
    description: 'Your personal dashboard shows upcoming labs, notifications, and quick links. Click Customize to choose which widgets appear.',
    placement: 'bottom',
  },
  {
    target: '[href="/lab-management"]',
    title: 'Lab Management',
    description: 'View and manage lab schedules, run scenarios, track student performance, and record assessments.',
    placement: 'bottom',
  },
  {
    target: '[href="/lab-management/scenarios"]',
    title: 'Scenarios',
    description: 'Browse and build clinical simulation scenarios. You can create custom scenarios, set assessment criteria, and track completion.',
    placement: 'bottom',
  },
  {
    target: '[href="/tasks"]',
    title: 'Tasks',
    description: 'Assign and track tasks between instructors. Great for coordinating lab prep, student follow-ups, and administrative work.',
    placement: 'bottom',
  },
  {
    target: '[href="/settings"]',
    title: 'Settings',
    description: 'Manage your notification preferences and email settings. You can also replay this tour from here at any time.',
    placement: 'bottom',
  },
];

const STUDENT_STEPS: TourStep[] = [
  {
    target: null,
    title: 'Welcome to PMI Paramedic Tools',
    description: 'Welcome to your student portal! This tour will show you where to find your progress, clinical hours, and important resources.',
    placement: 'center',
  },
  {
    target: '[href="/student"]',
    title: 'Student Portal',
    description: 'Your home base — check your progress, upcoming labs, and any announcements from your instructors.',
    placement: 'bottom',
  },
  {
    target: '[href="/student/progress"]',
    title: 'My Progress',
    description: 'Track your skill completions, assessment scores, and overall program progress in one place.',
    placement: 'bottom',
  },
  {
    target: '[href="/student/clinical"]',
    title: 'Clinical Hours',
    description: 'View your logged clinical hours, field ride-along records, and compliance status.',
    placement: 'bottom',
  },
  {
    target: '[href="/settings"]',
    title: 'Settings',
    description: 'Update your notification preferences and email settings. You can also replay this tour from here.',
    placement: 'bottom',
  },
];

function getStepsForRole(role: string): TourStep[] {
  if (role === 'superadmin' || role === 'admin') return ADMIN_STEPS;
  if (role === 'student') return STUDENT_STEPS;
  // instructor, lead_instructor, volunteer_instructor, guest
  return INSTRUCTOR_STEPS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PADDING = 8; // px of space around the highlighted element
const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT_ESTIMATE = 180;

function getElementRect(selector: string): HighlightRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY - PADDING,
    left: rect.left + window.scrollX - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };
}

function computeTooltipPosition(
  highlight: HighlightRect | null,
  placement: TourStep['placement'],
): TooltipPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!highlight || placement === 'center') {
    return {
      top: vh / 2 - TOOLTIP_HEIGHT_ESTIMATE / 2 + window.scrollY,
      left: vw / 2 - TOOLTIP_WIDTH / 2,
      arrowSide: null,
    };
  }

  // Element center
  const elCenterX = highlight.left + highlight.width / 2;
  const elCenterY = highlight.top + highlight.height / 2 - window.scrollY; // viewport-relative

  let top = 0;
  let left = 0;
  let arrowSide: TooltipPosition['arrowSide'] = null;

  const margin = 12;

  switch (placement) {
    case 'bottom':
      top = highlight.top + highlight.height + margin + window.scrollY;
      left = Math.min(
        Math.max(elCenterX - TOOLTIP_WIDTH / 2, margin),
        vw - TOOLTIP_WIDTH - margin,
      );
      arrowSide = 'top';
      break;
    case 'top':
      top = highlight.top - TOOLTIP_HEIGHT_ESTIMATE - margin + window.scrollY;
      left = Math.min(
        Math.max(elCenterX - TOOLTIP_WIDTH / 2, margin),
        vw - TOOLTIP_WIDTH - margin,
      );
      arrowSide = 'bottom';
      break;
    case 'right':
      top = Math.min(
        Math.max(elCenterY - TOOLTIP_HEIGHT_ESTIMATE / 2 + window.scrollY, margin),
        vh - TOOLTIP_HEIGHT_ESTIMATE - margin + window.scrollY,
      );
      left = highlight.left + highlight.width + margin;
      arrowSide = 'left';
      break;
    case 'left':
      top = Math.min(
        Math.max(elCenterY - TOOLTIP_HEIGHT_ESTIMATE / 2 + window.scrollY, margin),
        vh - TOOLTIP_HEIGHT_ESTIMATE - margin + window.scrollY,
      );
      left = highlight.left - TOOLTIP_WIDTH - margin;
      arrowSide = 'right';
      break;
    default:
      top = highlight.top + highlight.height + margin + window.scrollY;
      left = Math.min(
        Math.max(elCenterX - TOOLTIP_WIDTH / 2, margin),
        vw - TOOLTIP_WIDTH - margin,
      );
      arrowSide = 'top';
  }

  return { top, left, arrowSide };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tour Overlay
// ─────────────────────────────────────────────────────────────────────────────

interface TourOverlayProps {
  steps: TourStep[];
  currentStep: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

function TourOverlay({ steps, currentStep, onNext, onBack, onSkip, onFinish }: TourOverlayProps) {
  const step = steps[currentStep];
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({
    top: 0,
    left: 0,
    arrowSide: null,
  });
  const animationRef = useRef<number | null>(null);

  const recalculate = useCallback(() => {
    const rect = step.target ? getElementRect(step.target) : null;
    setHighlight(rect);
    setTooltipPos(computeTooltipPosition(rect, step.placement));

    // Scroll element into view if it's off-screen
    if (rect) {
      const viewportTop = window.scrollY;
      const viewportBottom = window.scrollY + window.innerHeight;
      const elementTop = rect.top;
      const elementBottom = rect.top + rect.height;

      if (elementTop < viewportTop + 60 || elementBottom > viewportBottom - 60) {
        window.scrollTo({
          top: Math.max(0, elementTop - 100),
          behavior: 'smooth',
        });
      }
    }
  }, [step]);

  useEffect(() => {
    // Small delay so DOM updates (after navigation/page changes) have settled
    const t = setTimeout(recalculate, 150);
    return () => clearTimeout(t);
  }, [recalculate]);

  useEffect(() => {
    const handleResize = () => recalculate();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [recalculate]);

  useEffect(() => {
    const ref = animationRef;
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, []);

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <>
      {/* Dark overlay - implemented as four rectangles surrounding the highlight
          to allow the highlighted element to remain interactive */}
      {highlight ? (
        <>
          {/* Top strip */}
          <div
            className="fixed z-[60] bg-black/60 pointer-events-auto"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: `${highlight.top - window.scrollY}px`,
            }}
            onClick={onSkip}
          />
          {/* Bottom strip */}
          <div
            className="fixed z-[60] bg-black/60 pointer-events-auto"
            style={{
              top: `${highlight.top - window.scrollY + highlight.height}px`,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onClick={onSkip}
          />
          {/* Left strip */}
          <div
            className="fixed z-[60] bg-black/60 pointer-events-auto"
            style={{
              top: `${highlight.top - window.scrollY}px`,
              left: 0,
              width: `${highlight.left}px`,
              height: `${highlight.height}px`,
            }}
            onClick={onSkip}
          />
          {/* Right strip */}
          <div
            className="fixed z-[60] bg-black/60 pointer-events-auto"
            style={{
              top: `${highlight.top - window.scrollY}px`,
              left: `${highlight.left + highlight.width}px`,
              right: 0,
              height: `${highlight.height}px`,
            }}
            onClick={onSkip}
          />
          {/* Highlight ring */}
          <div
            className="fixed z-[61] rounded-lg pointer-events-none"
            style={{
              top: `${highlight.top - window.scrollY}px`,
              left: `${highlight.left}px`,
              width: `${highlight.width}px`,
              height: `${highlight.height}px`,
              boxShadow: '0 0 0 3px rgb(59 130 246), 0 0 0 5px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.25s ease',
            }}
          />
        </>
      ) : (
        /* Full overlay for center steps */
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm pointer-events-auto"
          onClick={onSkip}
        />
      )}

      {/* Tooltip card */}
      <div
        className="fixed z-[62] pointer-events-auto"
        style={{
          top: `${tooltipPos.top - window.scrollY}px`,
          left: `${tooltipPos.left}px`,
          width: `${TOOLTIP_WIDTH}px`,
          transition: 'top 0.25s ease, left 0.25s ease',
        }}
        role="dialog"
        aria-label={`Tour step ${currentStep + 1} of ${steps.length}: ${step.title}`}
      >
        {/* Arrow */}
        {tooltipPos.arrowSide === 'top' && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 rotate-45 border-t border-l border-gray-200 dark:border-gray-700" />
        )}
        {tooltipPos.arrowSide === 'bottom' && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 rotate-45 border-b border-r border-gray-200 dark:border-gray-700" />
        )}
        {tooltipPos.arrowSide === 'left' && (
          <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-gray-800 rotate-45 border-b border-l border-gray-200 dark:border-gray-700" />
        )}
        {tooltipPos.arrowSide === 'right' && (
          <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-gray-800 rotate-45 border-t border-r border-gray-200 dark:border-gray-700" />
        )}

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between px-4 pt-4 pb-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Map className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
                {step.title}
              </h3>
            </div>
            <button
              onClick={onSkip}
              className="ml-2 flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Skip tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 pt-2 pb-3">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
            {/* Step counter */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-200 ${
                    i === currentStep
                      ? 'w-4 h-2 bg-blue-600'
                      : i < currentStep
                      ? 'w-2 h-2 bg-blue-300 dark:bg-blue-700'
                      : 'w-2 h-2 bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}
              {isLast ? (
                <button
                  onClick={onFinish}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Done
                </button>
              ) : (
                <button
                  onClick={onNext}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main OnboardingTour Component
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingTourProps {
  /** User's display name */
  userName: string;
  /** User's role string */
  role: string;
  /** Called when tour or welcome modal is dismissed */
  onComplete?: () => void;
  /**
   * When true, skip the API check and the welcome modal and go straight
   * into tour steps. Used when the user clicks "Replay Tour" from Settings.
   */
  startImmediate?: boolean;
}

type TourPhase = 'idle' | 'welcome' | 'tour';

export default function OnboardingTour({
  userName,
  role,
  onComplete,
  startImmediate = false,
}: OnboardingTourProps) {
  const { data: session } = useSession();
  const [phase, setPhase] = useState<TourPhase>(startImmediate ? 'tour' : 'idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(!startImmediate);

  const steps = getStepsForRole(role);

  // On mount, check if tour has been completed (skip if startImmediate)
  useEffect(() => {
    if (startImmediate) return;
    if (!session?.user?.email) return;

    fetch('/api/user-preferences/tour')
      .then(res => res.json())
      .then(data => {
        if (!data.tour_completed) {
          setPhase('welcome');
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [session, startImmediate]);

  const markComplete = useCallback(async (step?: number) => {
    try {
      await fetch('/api/user-preferences/tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tour_completed: true,
          tour_step: step ?? currentStep,
        }),
      });
    } catch {
      // Fire and forget - don't block UI
    }
  }, [currentStep]);

  const handleStartTour = () => {
    setCurrentStep(0);
    setPhase('tour');
  };

  const handleSkipWelcome = async () => {
    await markComplete(0);
    setPhase('idle');
    onComplete?.();
  };

  const handleNext = () => {
    const nextStep = currentStep + 1;
    if (nextStep < steps.length) {
      setCurrentStep(nextStep);
      // Persist progress (fire and forget)
      fetch('/api/user-preferences/tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tour_step: nextStep }),
      }).catch(() => {});
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipTour = async () => {
    await markComplete();
    setPhase('idle');
    onComplete?.();
  };

  const handleFinish = async () => {
    await markComplete(steps.length - 1);
    setPhase('idle');
    onComplete?.();
  };

  if (loading || phase === 'idle') return null;

  if (phase === 'welcome') {
    return (
      <WelcomeModal
        userName={userName}
        role={role}
        onStartTour={handleStartTour}
        onSkip={handleSkipWelcome}
      />
    );
  }

  return (
    <TourOverlay
      steps={steps}
      currentStep={currentStep}
      onNext={handleNext}
      onBack={handleBack}
      onSkip={handleSkipTour}
      onFinish={handleFinish}
    />
  );
}
