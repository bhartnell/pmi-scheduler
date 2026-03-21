'use client';

import { useState, useEffect } from 'react';
import {
  ListChecks,
  ChevronDown,
  RefreshCw,
  CheckSquare,
  Square,
  X,
  Plus,
} from 'lucide-react';
import type { ChecklistItem } from './types';

interface ChecklistSectionProps {
  labDayId: string;
}

export default function ChecklistSection({ labDayId }: ChecklistSectionProps) {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistGenerating, setChecklistGenerating] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [addingChecklistItem, setAddingChecklistItem] = useState(false);

  useEffect(() => {
    fetchChecklistItems();
  }, [labDayId]);

  const fetchChecklistItems = async () => {
    setChecklistLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`); const data = await res.json(); if (data.success) setChecklistItems(data.items || []); }
    catch (error) { console.error('Error fetching checklist items:', error); }
    setChecklistLoading(false);
  };

  const handleAutoGenerateChecklist = async () => {
    setChecklistGenerating(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'auto-generate' }) }); const data = await res.json(); if (data.success) await fetchChecklistItems(); else alert('Failed: ' + (data.error || 'Unknown')); }
    catch (error) { console.error('Error:', error); alert('Failed to auto-generate checklist'); }
    setChecklistGenerating(false);
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim()) return; setAddingChecklistItem(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newChecklistItem.trim() }) }); const data = await res.json(); if (data.success) { setChecklistItems(prev => [...prev, data.item]); setNewChecklistItem(''); } else alert('Failed: ' + (data.error || 'Unknown')); }
    catch (error) { console.error('Error:', error); alert('Failed to add checklist item'); }
    setAddingChecklistItem(false);
  };

  const handleToggleChecklistItem = async (item: ChecklistItem) => {
    const newCompleted = !item.is_completed;
    setChecklistItems(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: newCompleted } : i));
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: item.id, is_completed: newCompleted }) }); const data = await res.json(); if (data.success) setChecklistItems(prev => prev.map(i => i.id === item.id ? data.item : i)); else setChecklistItems(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: item.is_completed } : i)); }
    catch { setChecklistItems(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: item.is_completed } : i)); }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    setChecklistItems(prev => prev.filter(i => i.id !== itemId));
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist?itemId=${itemId}`, { method: 'DELETE' }); const data = await res.json(); if (!data.success) await fetchChecklistItems(); }
    catch { await fetchChecklistItems(); }
  };

  return (
    <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow print:shadow-none print:border print:border-gray-300">
      {/* Checklist Header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <button
          onClick={() => setChecklistCollapsed(prev => !prev)}
          className="print-include flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <ListChecks className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Prep Checklist</h3>
          {checklistItems.length > 0 && (
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 shrink-0">
              {checklistItems.filter(i => i.is_completed).length}/{checklistItems.length} completed
            </span>
          )}
          {checklistItems.length > 0 && (
            <div className="ml-2 flex-1 max-w-xs bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((checklistItems.filter(i => i.is_completed).length / checklistItems.length) * 100)}%` }}
              />
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${checklistCollapsed ? '-rotate-90' : ''}`} />
        </button>
        <div className="flex items-center gap-2 ml-3 print:hidden">
          <button
            onClick={handleAutoGenerateChecklist}
            disabled={checklistGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate checklist items from stations"
          >
            {checklistGenerating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Auto-Generate
          </button>
        </div>
      </div>

      {/* Checklist Body */}
      {!checklistCollapsed && (
        <div className="p-4">
          {checklistLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <>
              {/* Items list */}
              {checklistItems.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No checklist items yet. Click &quot;Auto-Generate&quot; to create items from stations, or add items manually below.
                </p>
              ) : (
                <ul className="space-y-1 mb-4">
                  {checklistItems.map(item => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 group py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <button
                        onClick={() => handleToggleChecklistItem(item)}
                        className="shrink-0 text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors print:hidden"
                        aria-label={item.is_completed ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {item.is_completed ? (
                          <CheckSquare className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                      {/* Print-only checkbox */}
                      <span className="hidden print:inline-block w-4 h-4 border border-gray-500 rounded-sm shrink-0" />
                      <span className={`flex-1 text-sm ${item.is_completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                        {item.title}
                      </span>
                      {item.is_auto_generated && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 print:hidden shrink-0">auto</span>
                      )}
                      <button
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        className="shrink-0 p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded print:hidden"
                        aria-label="Delete item"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add item input */}
              <div className="flex gap-2 print:hidden">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={e => setNewChecklistItem(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddChecklistItem(); }}
                  placeholder="Add a checklist item..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                />
                <button
                  onClick={handleAddChecklistItem}
                  disabled={addingChecklistItem || !newChecklistItem.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
