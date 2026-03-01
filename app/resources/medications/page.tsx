'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Search,
  X,
  Pill,
  Calculator,
  Printer,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Activity,
  Zap,
  Clock,
  Info,
  Filter,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Medication {
  id: string;
  name: string;
  brand_names: string[] | null;
  drug_class: string;
  indications: string[] | null;
  contraindications: string[] | null;
  side_effects: string[] | null;
  routes: string[] | null;
  adult_dose: string | null;
  pediatric_dose: string | null;
  onset: string | null;
  duration: string | null;
  concentration: string | null;
  dose_per_kg: number | null;
  max_dose: string | null;
  special_notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface CurrentUser {
  id: string;
  email: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

function getClassColor(drugClass: string): string {
  const lower = drugClass.toLowerCase();
  if (lower.includes('cardiac') || lower.includes('antidysrhythmic') || lower.includes('vasopressor') || lower.includes('catecholamine') || lower.includes('nitrate') || lower.includes('antiplatelet')) {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  }
  if (lower.includes('respiratory') || lower.includes('bronchodilator') || lower.includes('beta-2')) {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  }
  if (lower.includes('analgesic') || lower.includes('opioid') || lower.includes('nsaid')) {
    return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
  }
  if (lower.includes('sedative') || lower.includes('benzodiazepine') || lower.includes('anesthetic') || lower.includes('dissociative')) {
    return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
  }
  if (lower.includes('antidote') || lower.includes('antagonist') || lower.includes('reversal')) {
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
  }
  if (lower.includes('antihistamine') || lower.includes('antiemetic')) {
    return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
  }
  if (lower.includes('electrolyte') || lower.includes('crystalloid') || lower.includes('fluid') || lower.includes('alkalizing') || lower.includes('carbohydrate') || lower.includes('hormone') || lower.includes('buffer')) {
    return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300';
  }
  if (lower.includes('anticholinergic') || lower.includes('parasympatholytic')) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function getClassGroup(drugClass: string): string {
  const lower = drugClass.toLowerCase();
  if (lower.includes('cardiac') || lower.includes('antidysrhythmic') || lower.includes('vasopressor') || lower.includes('catecholamine') || lower.includes('nitrate') || lower.includes('antiplatelet') || lower.includes('sympathomimetic') || lower.includes('anticholinergic') || lower.includes('inotrope') || lower.includes('purine')) return 'Cardiac / Vasopressor';
  if (lower.includes('respiratory') || lower.includes('bronchodilator') || lower.includes('beta-2')) return 'Respiratory';
  if (lower.includes('analgesic') || lower.includes('opioid') || lower.includes('nsaid') || lower.includes('antipyretic')) return 'Analgesic / Pain';
  if (lower.includes('sedative') || lower.includes('benzodiazepine') || lower.includes('anesthetic') || lower.includes('dissociative')) return 'Sedative / Anesthetic';
  if (lower.includes('antidote') || lower.includes('antagonist') || lower.includes('reversal')) return 'Antidote / Reversal';
  if (lower.includes('antihistamine') || lower.includes('antiemetic') || lower.includes('serotonin')) return 'Antihistamine / Antiemetic';
  if (lower.includes('electrolyte') || lower.includes('crystalloid') || lower.includes('fluid') || lower.includes('alkalizing') || lower.includes('carbohydrate') || lower.includes('hormone') || lower.includes('buffer') || lower.includes('pancreatic') || lower.includes('antidiuretic')) return 'Electrolyte / Fluid';
  return 'Other';
}

// ---------------------------------------------------------------------------
// Medication Card Component
// ---------------------------------------------------------------------------

interface MedCardProps {
  med: Medication;
  canEdit: boolean;
  onEdit: (med: Medication) => void;
  onDelete: (med: Medication) => void;
  printMode?: boolean;
}

function MedicationCard({ med, canEdit, onEdit, onDelete, printMode = false }: MedCardProps) {
  const [expanded, setExpanded] = useState(printMode);
  const colorClass = getClassColor(med.drug_class);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-shadow ${printMode ? '' : 'hover:shadow-md'} overflow-hidden med-card`}
      data-med-id={med.id}
    >
      {/* Card Header */}
      <div
        className={`p-4 ${printMode ? '' : 'cursor-pointer select-none'}`}
        onClick={printMode ? undefined : () => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg mt-0.5">
              <Pill className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug">
                {med.name}
              </h3>
              {med.brand_names && med.brand_names.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {med.brand_names.join(', ')}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                  {med.drug_class}
                </span>
                {med.routes && med.routes.map((route) => (
                  <span
                    key={route}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  >
                    {route}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canEdit && !printMode && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(med); }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Edit medication"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(med); }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete medication"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            {!printMode && (
              <button
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded
                  ? <ChevronUp className="w-4 h-4" />
                  : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Quick summary - always visible */}
        {!expanded && med.indications && med.indications.length > 0 && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-1 pl-10">
            {med.indications.slice(0, 2).join(' • ')}
          </p>
        )}
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
          {/* Dosing Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {med.adult_dose && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">Adult Dose</span>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{med.adult_dose}</p>
              </div>
            )}
            {med.pediatric_dose && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Pediatric Dose</span>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{med.pediatric_dose}</p>
              </div>
            )}
          </div>

          {/* Pharmacokinetics Row */}
          <div className="flex flex-wrap gap-4">
            {med.onset && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="font-medium text-gray-700 dark:text-gray-300">Onset:</span>
                <span>{med.onset}</span>
              </div>
            )}
            {med.duration && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span className="font-medium text-gray-700 dark:text-gray-300">Duration:</span>
                <span>{med.duration}</span>
              </div>
            )}
            {med.concentration && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <Pill className="w-4 h-4 text-teal-500 flex-shrink-0" />
                <span className="font-medium text-gray-700 dark:text-gray-300">Concentration:</span>
                <span>{med.concentration}</span>
              </div>
            )}
            {med.max_dose && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <span className="font-medium text-gray-700 dark:text-gray-300">Max Dose:</span>
                <span>{med.max_dose}</span>
              </div>
            )}
          </div>

          {/* Indications / Contraindications / Side Effects */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {med.indications && med.indications.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Indications</h4>
                <ul className="space-y-1">
                  {med.indications.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {med.contraindications && med.contraindications.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Contraindications</h4>
                <ul className="space-y-1">
                  {med.contraindications.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {med.side_effects && med.side_effects.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Side Effects</h4>
                <ul className="space-y-1">
                  {med.side_effects.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Special Notes */}
          {med.special_notes && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide block mb-1">
                    Special Notes / Precautions
                  </span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {med.special_notes}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dosing Calculator Component
// ---------------------------------------------------------------------------

function DosingCalculator({ medications }: { medications: Medication[] }) {
  const [weightKg, setWeightKg] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [selectedMedId, setSelectedMedId] = useState('');
  const [isPediatric, setIsPediatric] = useState(false);

  const medsWithDosing = medications.filter((m) => m.dose_per_kg != null);
  const selectedMed = medsWithDosing.find((m) => m.id === selectedMedId);

  const weightInKg = weightUnit === 'lbs'
    ? parseFloat(weightKg) / 2.2046
    : parseFloat(weightKg);

  const calculatedDose = selectedMed && selectedMed.dose_per_kg && !isNaN(weightInKg) && weightInKg > 0
    ? weightInKg * selectedMed.dose_per_kg
    : null;

  // Parse max dose from text (very basic)
  function parseMaxDoseMg(text: string | null): number | null {
    if (!text) return null;
    const match = text.match(/([\d.]+)\s*mg/);
    return match ? parseFloat(match[1]) : null;
  }

  const maxDoseMg = selectedMed ? parseMaxDoseMg(selectedMed.max_dose) : null;
  const cappedDose = calculatedDose !== null && maxDoseMg !== null
    ? Math.min(calculatedDose, maxDoseMg)
    : calculatedDose;
  const isCapped = cappedDose !== null && calculatedDose !== null && cappedDose < calculatedDose;

  // Parse concentration to mL
  function parseConcentration(text: string | null): number | null {
    if (!text) return null;
    // Match patterns like "50 mcg/mL", "1 mg/mL", "0.4 mg/mL"
    const mgMatch = text.match(/([\d.]+)\s*mg\/mL/);
    if (mgMatch) return parseFloat(mgMatch[1]);
    // mcg/mL
    const mcgMatch = text.match(/([\d.]+)\s*mcg\/mL/);
    if (mcgMatch) return parseFloat(mcgMatch[1]) / 1000; // convert to mg/mL
    return null;
  }

  const concMgPerMl = selectedMed ? parseConcentration(selectedMed.concentration) : null;
  const volumeMl = cappedDose !== null && concMgPerMl !== null && concMgPerMl > 0
    ? cappedDose / concMgPerMl
    : null;

  const ageGroup = isPediatric ? 'Pediatric' : 'Adult';
  const doseToShow = isPediatric ? selectedMed?.pediatric_dose : selectedMed?.adult_dose;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dosing Calculator</h2>
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
          Educational Use Only
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Weight Input */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Patient Weight
          </label>
          <div className="flex gap-1">
            <input
              type="number"
              min="1"
              max="500"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="Weight"
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setWeightUnit(weightUnit === 'kg' ? 'lbs' : 'kg')}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              title="Toggle weight unit"
            >
              {weightUnit}
            </button>
          </div>
          {weightUnit === 'lbs' && weightKg && !isNaN(parseFloat(weightKg)) && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              = {(parseFloat(weightKg) / 2.2046).toFixed(1)} kg
            </p>
          )}
        </div>

        {/* Medication Select */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Medication
          </label>
          <select
            value={selectedMedId}
            onChange={(e) => setSelectedMedId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select medication...</option>
            {medsWithDosing.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.dose_per_kg} mg/kg)
              </option>
            ))}
          </select>
        </div>

        {/* Age Group */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Age Group
          </label>
          <div className="flex gap-1">
            <button
              onClick={() => setIsPediatric(false)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                !isPediatric
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Adult
            </button>
            <button
              onClick={() => setIsPediatric(true)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                isPediatric
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Pediatric
            </button>
          </div>
        </div>

        {/* Reset */}
        <div className="flex items-end">
          <button
            onClick={() => { setWeightKg(''); setSelectedMedId(''); setIsPediatric(false); }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Results */}
      {cappedDose !== null && selectedMed && (
        <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Calculated Dose: {selectedMed.name} ({ageGroup})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Weight Used</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {weightInKg.toFixed(1)} kg
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Dose (mg/kg)</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedMed.dose_per_kg} mg/kg
              </p>
            </div>
            <div className={`rounded-lg p-3 text-center ${isCapped ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-white dark:bg-gray-800'}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Calculated Dose {isCapped ? '(MAX CAPPED)' : ''}
              </p>
              <p className={`text-lg font-bold ${isCapped ? 'text-orange-700 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                {cappedDose.toFixed(2)} mg
              </p>
              {isCapped && (
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  Raw: {calculatedDose!.toFixed(2)} mg
                </p>
              )}
            </div>
            {volumeMl !== null ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Volume</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {volumeMl.toFixed(2)} mL
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  @ {concMgPerMl!} mg/mL
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center opacity-50">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Volume</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">N/A</p>
              </div>
            )}
          </div>
          {doseToShow && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {ageGroup} Dosing Reference
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{doseToShow}</p>
            </div>
          )}
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            For educational reference only. Always verify doses with your medical protocols and standing orders.
          </p>
        </div>
      )}

      {!selectedMedId && (
        <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
          Select a medication with weight-based dosing to calculate
        </div>
      )}

      {selectedMedId && !weightKg && (
        <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
          Enter patient weight to calculate dose
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add/Edit Modal
// ---------------------------------------------------------------------------

interface MedFormData {
  name: string;
  brand_names: string;
  drug_class: string;
  indications: string;
  contraindications: string;
  side_effects: string;
  routes: string;
  adult_dose: string;
  pediatric_dose: string;
  onset: string;
  duration: string;
  concentration: string;
  dose_per_kg: string;
  max_dose: string;
  special_notes: string;
}

const EMPTY_FORM: MedFormData = {
  name: '', brand_names: '', drug_class: '', indications: '', contraindications: '',
  side_effects: '', routes: '', adult_dose: '', pediatric_dose: '', onset: '',
  duration: '', concentration: '', dose_per_kg: '', max_dose: '', special_notes: '',
};

function medToForm(med: Medication): MedFormData {
  return {
    name: med.name,
    brand_names: med.brand_names?.join(', ') || '',
    drug_class: med.drug_class,
    indications: med.indications?.join('\n') || '',
    contraindications: med.contraindications?.join('\n') || '',
    side_effects: med.side_effects?.join('\n') || '',
    routes: med.routes?.join(', ') || '',
    adult_dose: med.adult_dose || '',
    pediatric_dose: med.pediatric_dose || '',
    onset: med.onset || '',
    duration: med.duration || '',
    concentration: med.concentration || '',
    dose_per_kg: med.dose_per_kg?.toString() || '',
    max_dose: med.max_dose || '',
    special_notes: med.special_notes || '',
  };
}

function formToPayload(form: MedFormData) {
  const splitLines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  const splitComma = (s: string) => s.split(',').map((l) => l.trim()).filter(Boolean);
  return {
    name: form.name.trim(),
    brand_names: splitComma(form.brand_names),
    drug_class: form.drug_class.trim(),
    indications: splitLines(form.indications),
    contraindications: splitLines(form.contraindications),
    side_effects: splitLines(form.side_effects),
    routes: splitComma(form.routes),
    adult_dose: form.adult_dose.trim() || null,
    pediatric_dose: form.pediatric_dose.trim() || null,
    onset: form.onset.trim() || null,
    duration: form.duration.trim() || null,
    concentration: form.concentration.trim() || null,
    dose_per_kg: form.dose_per_kg ? parseFloat(form.dose_per_kg) : null,
    max_dose: form.max_dose.trim() || null,
    special_notes: form.special_notes.trim() || null,
  };
}

interface MedModalProps {
  med: Medication | null;
  onClose: () => void;
  onSave: (data: ReturnType<typeof formToPayload>) => Promise<void>;
}

function MedModal({ med, onClose, onSave }: MedModalProps) {
  const [form, setForm] = useState<MedFormData>(med ? medToForm(med) : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const set = (field: keyof MedFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.drug_class.trim()) return;
    setSaving(true);
    try {
      await onSave(formToPayload(form));
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const textareaClass = `${inputClass} resize-none`;
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {med ? 'Edit Medication' : 'Add Medication'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Drug Name <span className="text-red-500">*</span></label>
              <input required type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Epinephrine" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Brand Names <span className="text-xs text-gray-400">(comma-separated)</span></label>
              <input type="text" value={form.brand_names} onChange={(e) => set('brand_names', e.target.value)} placeholder="e.g. Adrenalin, EpiPen" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Drug Class <span className="text-red-500">*</span></label>
              <input required type="text" value={form.drug_class} onChange={(e) => set('drug_class', e.target.value)} placeholder="e.g. Sympathomimetic / Vasopressor" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Routes <span className="text-xs text-gray-400">(comma-separated)</span></label>
              <input type="text" value={form.routes} onChange={(e) => set('routes', e.target.value)} placeholder="e.g. IV/IO, IM, IN" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Concentration</label>
              <input type="text" value={form.concentration} onChange={(e) => set('concentration', e.target.value)} placeholder="e.g. 1 mg/mL" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Onset</label>
              <input type="text" value={form.onset} onChange={(e) => set('onset', e.target.value)} placeholder="e.g. IV: 1-2 min" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Duration</label>
              <input type="text" value={form.duration} onChange={(e) => set('duration', e.target.value)} placeholder="e.g. 30-60 min" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Dose per kg (mg/kg)</label>
              <input type="number" step="0.0001" min="0" value={form.dose_per_kg} onChange={(e) => set('dose_per_kg', e.target.value)} placeholder="e.g. 0.01" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Max Dose</label>
              <input type="text" value={form.max_dose} onChange={(e) => set('max_dose', e.target.value)} placeholder="e.g. 1 mg per dose" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Adult Dose</label>
              <textarea rows={2} value={form.adult_dose} onChange={(e) => set('adult_dose', e.target.value)} placeholder="e.g. 1 mg IV/IO every 3-5 min" className={textareaClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Pediatric Dose</label>
              <textarea rows={2} value={form.pediatric_dose} onChange={(e) => set('pediatric_dose', e.target.value)} placeholder="e.g. 0.01 mg/kg IV/IO (max 1 mg)" className={textareaClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Indications <span className="text-xs text-gray-400">(one per line)</span></label>
              <textarea rows={3} value={form.indications} onChange={(e) => set('indications', e.target.value)} placeholder="Cardiac arrest&#10;Anaphylaxis" className={textareaClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Contraindications <span className="text-xs text-gray-400">(one per line)</span></label>
              <textarea rows={3} value={form.contraindications} onChange={(e) => set('contraindications', e.target.value)} placeholder="Known hypersensitivity&#10;Hypertension (relative)" className={textareaClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Side Effects <span className="text-xs text-gray-400">(one per line)</span></label>
              <textarea rows={3} value={form.side_effects} onChange={(e) => set('side_effects', e.target.value)} placeholder="Tachycardia&#10;Hypertension" className={textareaClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Special Notes / Precautions</label>
              <textarea rows={3} value={form.special_notes} onChange={(e) => set('special_notes', e.target.value)} placeholder="Important clinical pearls, warnings, tips..." className={textareaClass} />
            </div>
          </div>
        </form>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {med ? 'Save Changes' : 'Add Medication'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

interface DeleteModalProps {
  med: Medication;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function DeleteModal({ med, onConfirm, onClose }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try { await onConfirm(); onClose(); }
    finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Delete Medication</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to remove{' '}
          <span className="font-medium text-gray-900 dark:text-white">"{med.name}"</span>{' '}
          from the reference database?
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

// Drug class filter groups for the UI
const CLASS_FILTER_GROUPS = [
  { key: 'all', label: 'All' },
  { key: 'Cardiac / Vasopressor', label: 'Cardiac' },
  { key: 'Respiratory', label: 'Respiratory' },
  { key: 'Analgesic / Pain', label: 'Analgesics' },
  { key: 'Sedative / Anesthetic', label: 'Sedatives' },
  { key: 'Antidote / Reversal', label: 'Antidotes' },
  { key: 'Antihistamine / Antiemetic', label: 'Antiemetic' },
  { key: 'Electrolyte / Fluid', label: 'Electrolytes' },
  { key: 'Other', label: 'Other' },
] as const;

type ClassFilterKey = (typeof CLASS_FILTER_GROUPS)[number]['key'];

export default function MedicationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [fetching, setFetching] = useState(false);

  const [search, setSearch] = useState('');
  const [activeClass, setActiveClass] = useState<ClassFilterKey>('all');
  const [activeTab, setActiveTab] = useState<'browse' | 'calculator' | 'print'>('browse');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [deletingMed, setDeletingMed] = useState<Medication | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  // Load current user
  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/instructor/me')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) setCurrentUser(data.user);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [session]);

  // Fetch medications
  const fetchMedications = useCallback(async () => {
    setFetching(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/resources/medications?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setMedications(data.medications);
      }
    } catch (err) {
      console.error('Error fetching medications:', err);
      toast.error('Failed to load medications');
    } finally {
      setFetching(false);
    }
  }, [search, toast]);

  useEffect(() => {
    if (currentUser) fetchMedications();
  }, [currentUser, fetchMedications]);

  // Debounced search
  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => fetchMedications(), 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter by class group
  const filteredMedications = activeClass === 'all'
    ? medications
    : medications.filter((m) => getClassGroup(m.drug_class) === activeClass);

  // Permissions
  const canEdit = currentUser ? hasMinRole(currentUser.role, 'admin') : false;

  // Handlers
  const handleAdd = async (payload: ReturnType<typeof formToPayload>) => {
    const res = await fetch('/api/resources/medications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create medication');
    toast.success('Medication added');
    await fetchMedications();
  };

  const handleEdit = async (payload: ReturnType<typeof formToPayload>) => {
    if (!editingMed) return;
    const res = await fetch(`/api/resources/medications/${editingMed.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update medication');
    toast.success('Medication updated');
    await fetchMedications();
  };

  const handleDelete = async () => {
    if (!deletingMed) return;
    const res = await fetch(`/api/resources/medications/${deletingMed.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete medication');
    toast.success('Medication removed');
    await fetchMedications();
  };

  const handlePrint = () => window.print();

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  const medsToShow = filteredMedications;

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-show { display: block !important; }
          body { background: white !important; }
          .med-card { break-inside: avoid; margin-bottom: 12pt; border: 1px solid #ccc !important; box-shadow: none !important; }
          .min-h-screen { min-height: unset !important; }
        }
        @media screen {
          .print-show { display: none; }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm no-print">
          <div className="max-w-7xl mx-auto px-4 py-4">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
              <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
                <Home className="w-3 h-3" />
                Home
              </Link>
              <ChevronRight className="w-4 h-4" />
              <Link href="/resources" className="hover:text-blue-600 dark:hover:text-blue-400">Resources</Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-900 dark:text-white">Medications</span>
            </div>

            {/* Title + Actions */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Pill className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Medication Reference</h1>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    EMS medication quick reference, dosing calculator, and printable cards
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                {canEdit && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add Medication</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mt-4 border-b border-gray-200 dark:border-gray-700">
              {[
                { key: 'browse', label: 'Browse', icon: BookOpen },
                { key: 'calculator', label: 'Dosing Calculator', icon: Calculator },
                { key: 'print', label: 'Quick Reference', icon: Printer },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === key
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
          {/* Dosing Calculator Tab */}
          {activeTab === 'calculator' && (
            <DosingCalculator medications={medications} />
          )}

          {/* Browse Tab */}
          {(activeTab === 'browse' || activeTab === 'print') && (
            <>
              {/* Search + Filter - only in browse mode */}
              {activeTab === 'browse' && (
                <>
                  <div className="relative no-print">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search medications by name, class, or indication..."
                      className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Class Filter Pills */}
                  <div className="flex gap-1.5 flex-wrap no-print">
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mr-1">
                      <Filter className="w-3.5 h-3.5" />
                    </div>
                    {CLASS_FILTER_GROUPS.map((group) => (
                      <button
                        key={group.key}
                        onClick={() => setActiveClass(group.key as ClassFilterKey)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          activeClass === group.key
                            ? 'bg-blue-600 text-white shadow'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Print mode header */}
              {activeTab === 'print' && (
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Reference Cards</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">All medications expanded for print reference</p>
                  </div>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 no-print"
                  >
                    <Printer className="w-4 h-4" />
                    Print All Cards
                  </button>
                </div>
              )}

              {/* Results count */}
              <p className="text-xs text-gray-500 dark:text-gray-400 no-print">
                {fetching ? 'Loading...' : (
                  <>
                    {medsToShow.length} {medsToShow.length === 1 ? 'medication' : 'medications'}
                    {activeClass !== 'all' && ` in ${activeClass}`}
                    {search && ` matching "${search}"`}
                  </>
                )}
              </p>

              {/* Medication Cards Grid */}
              {fetching ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse h-32" />
                  ))}
                </div>
              ) : medsToShow.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                    <Pill className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">No medications found</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                    {search || activeClass !== 'all'
                      ? 'Try adjusting your search or filter.'
                      : 'No medications in the database yet.'}
                  </p>
                  {canEdit && !search && activeClass === 'all' && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add First Medication
                    </button>
                  )}
                </div>
              ) : (
                <div className={`grid gap-4 ${activeTab === 'print' ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                  {medsToShow.map((med) => (
                    <MedicationCard
                      key={med.id}
                      med={med}
                      canEdit={canEdit}
                      onEdit={(m) => setEditingMed(m)}
                      onDelete={(m) => setDeletingMed(m)}
                      printMode={activeTab === 'print'}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Disclaimer */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl no-print">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Educational Reference Only</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  This medication reference is for educational purposes only. Always follow your local EMS protocols,
                  standing orders, and medical direction. Dosing information may vary by jurisdiction.
                  Do not use this reference as a substitute for proper medical training and protocol adherence.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      {showAddModal && (
        <MedModal med={null} onClose={() => setShowAddModal(false)} onSave={handleAdd} />
      )}
      {editingMed && (
        <MedModal med={editingMed} onClose={() => setEditingMed(null)} onSave={handleEdit} />
      )}
      {deletingMed && (
        <DeleteModal med={deletingMed} onConfirm={handleDelete} onClose={() => setDeletingMed(null)} />
      )}
    </>
  );
}
