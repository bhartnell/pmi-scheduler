'use client';

import {
  DollarSign,
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  X,
  Plus,
  Loader2,
} from 'lucide-react';
import type { CostItem, Student } from './types';
import { COST_CATEGORIES, COST_CATEGORY_COLORS } from './types';

interface CostsSectionProps {
  costItems: CostItem[];
  costsCollapsed: boolean;
  costsLoading: boolean;
  addingCost: boolean;
  editingCostId: string | null;
  editCostForm: { category: string; description: string; amount: string };
  newCostCategory: string;
  newCostDescription: string;
  newCostAmount: string;
  cohortStudents: Student[];
  onToggleCollapse: () => void;
  onAddCostItem: () => void;
  onStartEditCost: (item: CostItem) => void;
  onSaveEditCost: (itemId: string) => void;
  onCancelEditCost: () => void;
  onDeleteCostItem: (itemId: string) => void;
  onEditCostFormChange: (form: { category: string; description: string; amount: string }) => void;
  onNewCostCategoryChange: (value: string) => void;
  onNewCostDescriptionChange: (value: string) => void;
  onNewCostAmountChange: (value: string) => void;
}

export default function CostsSection({
  costItems,
  costsCollapsed,
  costsLoading,
  addingCost,
  editingCostId,
  editCostForm,
  newCostCategory,
  newCostDescription,
  newCostAmount,
  cohortStudents,
  onToggleCollapse,
  onAddCostItem,
  onStartEditCost,
  onSaveEditCost,
  onCancelEditCost,
  onDeleteCostItem,
  onEditCostFormChange,
  onNewCostCategoryChange,
  onNewCostDescriptionChange,
  onNewCostAmountChange,
}: CostsSectionProps) {
  return (
    <div className="mt-6 print:hidden bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      {/* Costs Header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Lab Costs</h3>
          {costItems.length > 0 && (
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 shrink-0">
              Total: ${costItems.reduce((sum, i) => sum + i.amount, 0).toFixed(2)}
            </span>
          )}
          {costsCollapsed ? (
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
          )}
        </button>
      </div>

      {/* Costs Body */}
      {!costsCollapsed && (
        <div className="p-4">
          {costsLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <>
              {/* Summary row */}
              {costItems.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Total Cost: </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      ${costItems.reduce((sum, i) => sum + i.amount, 0).toFixed(2)}
                    </span>
                  </div>
                  {cohortStudents.length > 0 && (
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Per Student ({cohortStudents.length}): </span>
                      <span className="font-bold text-blue-700 dark:text-blue-400">
                        ${(costItems.reduce((sum, i) => sum + i.amount, 0) / cohortStudents.length).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Items: </span>
                    {costItems.length}
                  </div>
                </div>
              )}

              {/* Category breakdown badges */}
              {costItems.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {COST_CATEGORIES.map(cat => {
                    const catItems = costItems.filter(i => i.category === cat);
                    if (catItems.length === 0) return null;
                    const catTotal = catItems.reduce((sum, i) => sum + i.amount, 0);
                    return (
                      <span
                        key={cat}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${COST_CATEGORY_COLORS[cat]}`}
                      >
                        {cat}: ${catTotal.toFixed(2)}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Items table */}
              {costItems.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No cost items yet. Add items below to track lab expenses.
                </p>
              ) : (
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                        <th className="pb-2 pr-3">Category</th>
                        <th className="pb-2 pr-3">Description</th>
                        <th className="pb-2 pr-3 text-right">Amount</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {costItems.map(item => (
                        <tr key={item.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          {editingCostId === item.id ? (
                            <>
                              <td className="py-2 pr-3">
                                <select
                                  value={editCostForm.category}
                                  onChange={e => onEditCostFormChange({ ...editCostForm, category: e.target.value })}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                  {COST_CATEGORIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 pr-3">
                                <input
                                  type="text"
                                  value={editCostForm.description}
                                  onChange={e => onEditCostFormChange({ ...editCostForm, description: e.target.value })}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  placeholder="Description"
                                />
                              </td>
                              <td className="py-2 pr-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editCostForm.amount}
                                  onChange={e => onEditCostFormChange({ ...editCostForm, amount: e.target.value })}
                                  className="w-24 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right"
                                />
                              </td>
                              <td className="py-2">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => onSaveEditCost(item.id)}
                                    className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
                                    title="Save"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={onCancelEditCost}
                                    className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2 pr-3">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${COST_CATEGORY_COLORS[item.category] || COST_CATEGORY_COLORS['Other']}`}>
                                  {item.category}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-gray-800 dark:text-gray-200 max-w-[200px] truncate">
                                {item.description}
                              </td>
                              <td className="py-2 pr-3 text-right font-medium text-gray-900 dark:text-white font-mono">
                                ${item.amount.toFixed(2)}
                              </td>
                              <td className="py-2">
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => onStartEditCost(item)}
                                    className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onDeleteCostItem(item.id)}
                                    className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 rounded"
                                    title="Delete"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add item form */}
              <div className="flex flex-wrap gap-2">
                <select
                  value={newCostCategory}
                  onChange={e => onNewCostCategoryChange(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                >
                  {COST_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newCostDescription}
                  onChange={e => onNewCostDescriptionChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') onAddCostItem(); }}
                  placeholder="Description (e.g. Nitrile gloves box)"
                  className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                />
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400 pl-1">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newCostAmount}
                    onChange={e => onNewCostAmountChange(e.target.value)}
                    placeholder="Amount"
                    className="w-24 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                  />
                </div>
                <button
                  onClick={onAddCostItem}
                  disabled={addingCost || !newCostDescription.trim() || !newCostAmount}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingCost ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add Cost
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
