'use client';

import { useEffect, useCallback } from 'react';
import type { AchievementDefinition } from '@/lib/achievements';

// ---------------------------------------------------------------------------
// AchievementCelebration — Full-screen celebration modal
// ---------------------------------------------------------------------------

interface AchievementCelebrationProps {
  achievement: AchievementDefinition | null;
  onClose: () => void;
}

export default function AchievementCelebration({
  achievement,
  onClose,
}: AchievementCelebrationProps) {
  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [achievement, onClose]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!achievement) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [achievement, handleKeyDown]);

  if (!achievement) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Achievement unlocked: ${achievement.name}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" />

      {/* Confetti particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="confetti-particle absolute"
            style={{
              left: `${Math.random() * 100}%`,
              top: '-10px',
              width: `${6 + Math.random() * 6}px`,
              height: `${6 + Math.random() * 6}px`,
              backgroundColor: [
                '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1',
                '#96CEB4', '#FF69B4', '#DDA0DD', '#98FB98',
                '#FFA07A', '#87CEEB',
              ][i % 10],
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animationDelay: `${Math.random() * 1.5}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Achievement card */}
      <div
        className="relative z-10 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-celebrationPop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ring */}
        <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 rounded-2xl opacity-30 blur-lg animate-pulse" />

        <div className="relative">
          {/* Icon */}
          <div className="text-6xl mb-4 animate-bounce" role="img" aria-label={achievement.name}>
            {achievement.icon}
          </div>

          {/* Badge */}
          <div className="inline-block px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold uppercase tracking-wider rounded-full mb-3">
            Achievement Unlocked
          </div>

          {/* Name */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {achievement.name}
          </h2>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {achievement.description}
          </p>

          {/* Nice work message */}
          <div className="text-lg font-semibold text-green-600 dark:text-green-400">
            Nice work!
          </div>

          {/* Click hint */}
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            Click anywhere to close
          </p>
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes celebrationPop {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-celebrationPop {
          animation: celebrationPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .confetti-particle {
          animation: confettiFall linear forwards;
        }
      `}</style>
    </div>
  );
}
