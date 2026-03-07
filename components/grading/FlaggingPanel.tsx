'use client';

import { AlertTriangle } from 'lucide-react';

interface FlaggingPanelProps {
  issueLevel: 'none' | 'minor' | 'needs_followup';
  flagCategories: string[];
  onSetIssueLevel: (level: 'none' | 'minor' | 'needs_followup') => void;
  onSetFlagCategories: (categories: string[]) => void;
  triggerAutoSave: () => void;
}

export default function FlaggingPanel({
  issueLevel,
  flagCategories,
  onSetIssueLevel,
  onSetFlagCategories,
  triggerAutoSave,
}: FlaggingPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        Flag for Review
      </h2>

      {/* Issue Level */}
      <div className="space-y-2 mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Issue Level</label>
        <div className="space-y-2">
          <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-colors ${
            issueLevel === 'none' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
          }`}>
            <input
              type="radio"
              name="issueLevel"
              value="none"
              checked={issueLevel === 'none'}
              onChange={() => {
                onSetIssueLevel('none');
                onSetFlagCategories([]);
                triggerAutoSave();
              }}
              className="w-4 h-4 text-green-600"
            />
            <span className="text-gray-900 dark:text-white">No Issues</span>
          </label>
          <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-colors ${
            issueLevel === 'minor' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
          }`}>
            <input
              type="radio"
              name="issueLevel"
              value="minor"
              checked={issueLevel === 'minor'}
              onChange={() => {
                onSetIssueLevel('minor');
                triggerAutoSave();
              }}
              className="w-4 h-4 text-yellow-600"
            />
            <span className="text-gray-900 dark:text-white">Minor - Learning Opportunity</span>
          </label>
          <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-colors ${
            issueLevel === 'needs_followup' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
          }`}>
            <input
              type="radio"
              name="issueLevel"
              value="needs_followup"
              checked={issueLevel === 'needs_followup'}
              onChange={() => {
                onSetIssueLevel('needs_followup');
                triggerAutoSave();
              }}
              className="w-4 h-4 text-red-600"
            />
            <span className="text-gray-900 dark:text-white flex items-center gap-2">
              Needs Follow-up - Flag for Lead
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </span>
          </label>
        </div>
      </div>

      {/* Flag Categories (shown when minor or needs_followup) */}
      {issueLevel !== 'none' && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Flag Categories (select all that apply)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'affective', label: 'Affective/Attitude' },
              { value: 'skill_performance', label: 'Skill Performance' },
              { value: 'safety', label: 'Safety Concern' },
              { value: 'remediation', label: 'Needs Remediation' },
              { value: 'positive', label: 'Positive Recognition \u{1F31F}' }
            ].map(category => (
              <label
                key={category.value}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${
                  flagCategories.includes(category.value)
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={flagCategories.includes(category.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSetFlagCategories([...flagCategories, category.value]);
                    } else {
                      onSetFlagCategories(flagCategories.filter(c => c !== category.value));
                    }
                    triggerAutoSave();
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{category.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
