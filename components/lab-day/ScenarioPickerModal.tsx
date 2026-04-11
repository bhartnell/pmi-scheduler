'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Save, Loader2, Trash2, ClipboardList, Check } from 'lucide-react';
import type { Station } from './types';

interface NremtScenario {
  id: string;
  skill_code: string;
  title: string;
  scenario_data: Record<string, unknown> & { dispatch?: string };
  is_active: boolean;
  created_at: string;
}

interface ScenarioPickerModalProps {
  station: Station;
  skillCode: 'E201' | 'E202';
  skillName: string;
  // All stations on the current lab day — used to detect same-skill siblings
  // that already have a scenario assigned so we can suggest a different one.
  allStations: Station[];
  // Map station_id -> nremt_code (E201 / E202) so we can find sibling stations
  // that share the same skill code.
  stationNremtCodes: Record<string, 'E201' | 'E202' | undefined>;
  onClose: () => void;
  onSaved: () => void;
}

export default function ScenarioPickerModal({
  station,
  skillCode,
  skillName,
  allStations,
  stationNremtCodes,
  onClose,
  onSaved,
}: ScenarioPickerModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scenarios, setScenarios] = useState<NremtScenario[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    (station.metadata as Record<string, unknown> | undefined)?.selected_scenario_id as
      | string
      | null
      | undefined ?? null
  );
  const [error, setError] = useState<string | null>(null);

  // Sibling stations with same skill_code that already have a scenario assigned
  const siblingAssignments = useMemo(() => {
    const map = new Map<string, { stationNumber: number }>();
    for (const s of allStations) {
      if (s.id === station.id) continue;
      if (stationNremtCodes[s.id] !== skillCode) continue;
      const sid = (s.metadata as Record<string, unknown> | undefined)
        ?.selected_scenario_id as string | undefined;
      if (sid) {
        map.set(sid, { stationNumber: s.station_number });
      }
    }
    return map;
  }, [allStations, station.id, stationNremtCodes, skillCode]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/nremt-scenarios?skill_code=${skillCode}`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.success) {
          setError(data.error || 'Failed to load scenarios');
          setScenarios([]);
        } else {
          const list: NremtScenario[] = data.scenarios || [];
          setScenarios(list);

          // Auto-suggest: if nothing is currently selected, prefer a scenario
          // not already in use by a sibling station.
          const existingSelected =
            (station.metadata as Record<string, unknown> | undefined)
              ?.selected_scenario_id as string | null | undefined;
          if (!existingSelected) {
            const firstUnused = list.find((s) => !siblingAssignments.has(s.id));
            if (firstUnused) {
              setSelectedId(firstUnused.id);
            } else if (list.length > 0) {
              setSelectedId(list[0].id);
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Error loading NREMT scenarios:', e);
          setError('Failed to load scenarios');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillCode]);

  const firstSentence = (text?: string): string => {
    if (!text) return '';
    const trimmed = text.trim();
    const match = trimmed.match(/^(.+?[.!?])(\s|$)/);
    return match ? match[1] : trimmed.length > 140 ? trimmed.slice(0, 140) + '…' : trimmed;
  };

  const handleSave = async (clear = false) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/lab-management/stations/${station.id}/scenario`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario_id: clear ? null : selectedId }),
        }
      );
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to save scenario');
        setSaving(false);
        return;
      }
      onSaved();
    } catch (e) {
      console.error('Error saving scenario:', e);
      setError('Failed to save scenario');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-lg sm:mx-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Select Scenario
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
              {skillName} &middot; Station {station.station_number} &middot;{' '}
              <span className="font-mono">{skillCode}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          ) : scenarios.length === 0 ? (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-12">
              No scenarios available for {skillCode}.
            </div>
          ) : (
            scenarios.map((sc) => {
              const inUse = siblingAssignments.get(sc.id);
              const isSelected = selectedId === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setSelectedId(sc.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {sc.title}
                        </span>
                        {inUse && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                            Already in use at Station {inUse.stationNumber}
                          </span>
                        )}
                      </div>
                      {firstSentence(sc.scenario_data?.dispatch) && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {firstSentence(sc.scenario_data?.dispatch)}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t dark:border-gray-700">
          <button
            onClick={() => handleSave(true)}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving || loading || !selectedId}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
