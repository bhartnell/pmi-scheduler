'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, CheckCircle2 } from 'lucide-react';

const NREMT_INSTRUCTIONS: Record<string, string> = {
  'Cardiac Arrest Management / AED': `This station is designed to test your ability to manage a pre-hospital cardiac arrest by integrating CPR skills, defibrillation, and the use of an AED. You will have a maximum of 15 minutes to complete this station. As you enter the room, you will find a manikin lying supine on the floor. There is a bystander at the patient's side and an AED is nearby. You must verbalize everything you are assessing and all treatments you are performing. Do you have any questions?`,

  'Patient Assessment - Medical': `This station is designed to test your ability to perform a patient assessment of a patient with a chief complaint of a medical nature and voice treat all conditions discovered. You will have a maximum of 15 minutes to complete this station. There are tweezers, dressings, and bandages available if needed. As you progress through your assessment you will discover signs and symptoms which you must manage. I will provide additional information as needed. Do you have any questions?`,

  'Patient Assessment - Trauma': `This station is designed to test your ability to perform a patient assessment of a trauma patient and voice treat all conditions discovered. You will have a maximum of 10 minutes to complete this station. As you enter the room, you will find a manikin lying supine on the floor. There are tweezers, dressings, and bandages available if needed. As you progress through your assessment you will discover signs and symptoms which you must manage. When you assess a specific area I will provide you with findings in that area. Do you have any questions?`,

  'Spinal Immobilization (Supine Patient)': `This station is designed to test your ability to provide spinal immobilization on a supine patient using a long backboard. You will have a maximum of 10 minutes to complete this station. As you enter the room, you will find a supine patient who has a chief complaint consistent with a mechanism of injury requiring spinal immobilization. You must direct your assistant(s) to help you as needed. You are responsible for the final product. Do you have any questions?`,

  'BVM Ventilation of an Apneic Adult Patient': `This station is designed to test your ability to ventilate a patient using a bag-valve-mask (BVM). You will have a maximum of 5 minutes after the 2-minute preparation period. As you enter the room, you will find a manikin lying supine on the floor. The patient is apneic and has a pulse. You must ventilate the patient for at least 30 seconds. You will be evaluated on the adequacy of the volume of each ventilation. Do you have any questions?`,

  'Oxygen Administration by Non-Rebreather Mask': `This station is designed to test your ability to correctly assemble and administer supplemental oxygen to a patient using a non-rebreather mask. You will have a maximum of 5 minutes after the 2-minute preparation period. As you enter the room, you will find a patient seated in a chair who is complaining of difficulty breathing. An oxygen cylinder, regulator, and non-rebreather mask are available. Do you have any questions?`,

  'Bleeding Control/Shock Management': `This station is designed to test your ability to control hemorrhage and manage shock. You will have a maximum of 10 minutes to complete this station. As you enter the room, you will find a patient who has a wound to the right forearm and a wound to the right thigh. There are dressings, bandages, and a tourniquet available. You must manage all aspects of care for this patient. Do you have any questions?`,
};

function findInstruction(stationName: string): string | null {
  if (!stationName) return null;
  const lower = stationName.toLowerCase();
  // Try exact match first
  for (const [key, value] of Object.entries(NREMT_INSTRUCTIONS)) {
    if (key.toLowerCase() === lower) return value;
  }
  // Fuzzy: check if station name contains key or key contains station name
  for (const [key, value] of Object.entries(NREMT_INSTRUCTIONS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return value;
  }
  // Partial keyword match: check for significant words overlap
  for (const [key, value] of Object.entries(NREMT_INSTRUCTIONS)) {
    const keyWords = key.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchCount = keyWords.filter(w => lower.includes(w)).length;
    if (matchCount >= 2) return value;
  }
  return null;
}

interface NremtCandidateInstructionsProps {
  stationName: string;
  onInstructionsRead: (read: boolean) => void;
}

export default function NremtCandidateInstructions({ stationName, onInstructionsRead }: NremtCandidateInstructionsProps) {
  const instruction = findInstruction(stationName);
  const [expanded, setExpanded] = useState(true);
  const [read, setRead] = useState(false);

  if (!instruction) return null;

  const handleCheckboxChange = (checked: boolean) => {
    setRead(checked);
    onInstructionsRead(checked);
    if (checked) {
      setExpanded(false);
    }
  };

  return (
    <div className={`rounded-lg shadow border-l-4 ${read ? 'border-l-green-500' : 'border-l-blue-500'} bg-white dark:bg-gray-800 overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors min-h-[48px]"
      >
        <div className="flex items-center gap-2">
          {read ? (
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          ) : (
            <ClipboardList className="w-5 h-5 text-blue-500 shrink-0" />
          )}
          <span className="font-semibold text-gray-900 dark:text-white">
            Read to Candidate
          </span>
          {read && (
            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
              Complete
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <p className="text-base italic text-gray-800 dark:text-gray-200 leading-relaxed">
              &ldquo;{instruction}&rdquo;
            </p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 min-h-[48px]">
            <input
              type="checkbox"
              checked={read}
              onChange={(e) => handleCheckboxChange(e.target.checked)}
              className="w-5 h-5 rounded text-green-600 focus:ring-green-500"
            />
            <span className={`text-sm font-medium ${read ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
              Instructions read to candidate
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
