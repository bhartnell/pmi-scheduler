'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, CheckCircle2, Timer, Play, BookOpen, X } from 'lucide-react';
import {
  findInstructionEntry,
  isMultiPart,
  PROCTOR_GENERAL_RESPONSIBILITIES,
  type SkillInstructionEntry,
} from '@/lib/nremt-instructions';

// ─── Proctor Essay Modal ─────────────────────────────────────────

function ProctorEssayModal({
  entry,
  onClose,
}: {
  entry: SkillInstructionEntry;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 rounded-t-xl flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider opacity-80">Examiner Reference</p>
            <h2 className="text-lg font-bold">{entry.skillName}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-blue-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* General Responsibilities (collapsible) */}
          <ProctorSection title="General Skill Examiner Responsibilities" defaultCollapsed>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {PROCTOR_GENERAL_RESPONSIBILITIES}
            </p>
          </ProctorSection>

          {/* Skill-specific essay */}
          <ProctorSection title={`${entry.skillName} — Proctor Essay`} defaultCollapsed={false}>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {entry.proctorEssay}
            </p>
          </ProctorSection>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ProctorSection({
  title,
  defaultCollapsed,
  children,
}: {
  title: string;
  defaultCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div className="border rounded-lg dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
      >
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{title}</span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
      </button>
      {!collapsed && <div className="p-4">{children}</div>}
    </div>
  );
}

// ─── Prep Timer Component ────────────────────────────────────────

function PrepTimer({
  durationSeconds,
  onComplete,
  onSkip,
}: {
  durationSeconds: number;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, remaining, onComplete]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  if (!running) {
    return (
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={() => setRunning(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium min-h-[44px]"
        >
          <Play className="w-4 h-4" />
          Start {minutes}:{seconds.toString().padStart(2, '0')} Prep Timer
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline min-h-[44px]"
        >
          Candidate is prepared — skip
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mt-3">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg">
        <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse" />
        <span className="text-lg font-mono font-bold text-amber-700 dark:text-amber-300">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
        <span className="text-sm text-amber-600 dark:text-amber-400 ml-1">prep time remaining</span>
      </div>
      <button
        onClick={() => { setRemaining(0); onSkip(); }}
        className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline min-h-[44px]"
      >
        &ldquo;I&rsquo;m prepared&rdquo; — skip
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

interface NremtCandidateInstructionsProps {
  stationName: string;
  onInstructionsRead: (read: boolean) => void;
}

export default function NremtCandidateInstructions({
  stationName,
  onInstructionsRead,
}: NremtCandidateInstructionsProps) {
  const entry = findInstructionEntry(stationName);
  const [expanded, setExpanded] = useState(true);
  const [read, setRead] = useState(false);
  const [showProctorModal, setShowProctorModal] = useState(false);

  // Multi-part state
  const [phase, setPhase] = useState<'part1' | 'waiting' | 'part2' | 'done'>('part1');

  const handleCheckboxChange = useCallback(
    (checked: boolean) => {
      setRead(checked);
      onInstructionsRead(checked);
      if (checked) {
        setExpanded(false);
      }
    },
    [onInstructionsRead]
  );

  const handlePrepComplete = useCallback(() => {
    setPhase('part2');
  }, []);

  const handlePrepSkip = useCallback(() => {
    setPhase('part2');
  }, []);

  const handleContinueReading = useCallback(() => {
    setPhase('part2');
  }, []);

  if (!entry) return null;

  const instr = entry.candidateInstruction;
  const isMulti = isMultiPart(instr);

  return (
    <>
      <div
        className={`rounded-lg shadow border-l-4 ${
          read ? 'border-l-green-500' : 'border-l-blue-500'
        } bg-white dark:bg-gray-800 overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 min-h-[48px]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-left flex-1 hover:opacity-80 transition-opacity"
          >
            {read ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            ) : (
              <ClipboardList className="w-5 h-5 text-blue-500 shrink-0" />
            )}
            <span className="font-semibold text-gray-900 dark:text-white">Read to Candidate</span>
            {read && (
              <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                Complete
              </span>
            )}
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400 shrink-0 ml-auto" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400 shrink-0 ml-auto" />
            )}
          </button>

          {/* Proctor Instructions Button */}
          <button
            onClick={() => setShowProctorModal(true)}
            className="ml-3 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors min-h-[36px]"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Proctor Instructions
          </button>
        </div>

        {/* Content */}
        {expanded && (
          <div className="px-4 pb-4 space-y-3">
            {isMulti ? (
              <MultiPartContent
                entry={entry}
                phase={phase}
                onPrepComplete={handlePrepComplete}
                onPrepSkip={handlePrepSkip}
                onContinueReading={handleContinueReading}
              />
            ) : (
              <SinglePartContent entry={entry} />
            )}

            <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 min-h-[48px]">
              <input
                type="checkbox"
                checked={read}
                onChange={(e) => handleCheckboxChange(e.target.checked)}
                className="w-5 h-5 rounded text-green-600 focus:ring-green-500"
              />
              <span
                className={`text-sm font-medium ${
                  read ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {isMulti && phase !== 'part2' && !read
                  ? 'All instructions read to candidate (complete both parts first)'
                  : 'Instructions read to candidate'}
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Proctor Modal */}
      {showProctorModal && (
        <ProctorEssayModal entry={entry} onClose={() => setShowProctorModal(false)} />
      )}
    </>
  );
}

// ─── Single Part Content ─────────────────────────────────────────

function SinglePartContent({ entry }: { entry: SkillInstructionEntry }) {
  const instr = entry.candidateInstruction;
  if (isMultiPart(instr)) return null;

  return (
    <>
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <p className="text-base italic text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
          &ldquo;{instr.text}&rdquo;
        </p>
      </div>
      {instr.closingNote && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-sm text-amber-800 dark:text-amber-300 italic">{instr.closingNote}</p>
        </div>
      )}
    </>
  );
}

// ─── Multi Part Content ──────────────────────────────────────────

function MultiPartContent({
  entry,
  phase,
  onPrepComplete,
  onPrepSkip,
  onContinueReading,
}: {
  entry: SkillInstructionEntry;
  phase: 'part1' | 'waiting' | 'part2' | 'done';
  onPrepComplete: () => void;
  onPrepSkip: () => void;
  onContinueReading: () => void;
}) {
  const instr = entry.candidateInstruction;
  if (!isMultiPart(instr)) return null;

  return (
    <div className="space-y-3">
      {/* Part 1 - Always shown */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded">
            Part 1
          </span>
          {phase !== 'part1' && (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          )}
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-base italic text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
            &ldquo;{instr.part1}&rdquo;
          </p>
        </div>
      </div>

      {/* Transition / Timer / Continue Button */}
      {phase === 'part1' && (
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
          <p className="text-sm text-amber-800 dark:text-amber-300 italic mb-1">{instr.transition}</p>
          {instr.waitType === 'prep_timer' && instr.prepDurationSeconds ? (
            <PrepTimer
              durationSeconds={instr.prepDurationSeconds}
              onComplete={onPrepComplete}
              onSkip={onPrepSkip}
            />
          ) : (
            <button
              onClick={onContinueReading}
              className="mt-2 flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium min-h-[44px]"
            >
              <Play className="w-4 h-4" />
              Candidate Ready — Continue Reading
            </button>
          )}
        </div>
      )}

      {/* Part 2 - Shown after prep/continue */}
      {(phase === 'part2' || phase === 'done') && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded">
              Part 2
            </span>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-base italic text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
              &ldquo;{instr.part2}&rdquo;
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
