'use client';

import { useState, useEffect } from 'react';
import { X, GripVertical, RotateCcw } from 'lucide-react';
import { WIDGET_DEFINITIONS, QUICK_LINK_DEFINITIONS } from './widgets';

interface CustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: string[];
  quickLinks: string[];
  onSave: (widgets: string[], quickLinks: string[]) => void;
  onReset: () => void;
}

export default function CustomizeModal({
  isOpen,
  onClose,
  widgets: initialWidgets,
  quickLinks: initialQuickLinks,
  onSave,
  onReset,
}: CustomizeModalProps) {
  const [widgets, setWidgets] = useState<string[]>(initialWidgets);
  const [quickLinks, setQuickLinks] = useState<string[]>(initialQuickLinks);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setWidgets(initialWidgets);
      setQuickLinks(initialQuickLinks);
    }
  }, [isOpen, initialWidgets, initialQuickLinks]);

  if (!isOpen) return null;

  const allWidgetIds = Object.keys(WIDGET_DEFINITIONS);
  const allQuickLinkIds = Object.keys(QUICK_LINK_DEFINITIONS);

  const toggleWidget = (widgetId: string) => {
    setWidgets(prev =>
      prev.includes(widgetId)
        ? prev.filter(id => id !== widgetId)
        : [...prev, widgetId]
    );
  };

  const toggleQuickLink = (linkId: string) => {
    setQuickLinks(prev =>
      prev.includes(linkId)
        ? prev.filter(id => id !== linkId)
        : [...prev, linkId]
    );
  };

  const handleDragStart = (widgetId: string) => {
    setDraggedWidget(widgetId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === targetId) return;

    const currentIndex = widgets.indexOf(draggedWidget);
    const targetIndex = widgets.indexOf(targetId);

    if (currentIndex === -1 || targetIndex === -1) return;

    const newWidgets = [...widgets];
    newWidgets.splice(currentIndex, 1);
    newWidgets.splice(targetIndex, 0, draggedWidget);
    setWidgets(newWidgets);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(widgets, quickLinks);
    setSaving(false);
    onClose();
  };

  const handleReset = async () => {
    setSaving(true);
    await onReset();
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Customize Your Dashboard
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Widgets Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              WIDGETS
              <span className="font-normal text-gray-500 dark:text-gray-400 ml-2">
                (drag to reorder)
              </span>
            </h3>
            <div className="space-y-2">
              {allWidgetIds.map(widgetId => {
                const widget = WIDGET_DEFINITIONS[widgetId as keyof typeof WIDGET_DEFINITIONS];
                const isEnabled = widgets.includes(widgetId);
                const order = widgets.indexOf(widgetId);

                return (
                  <div
                    key={widgetId}
                    draggable={isEnabled}
                    onDragStart={() => handleDragStart(widgetId)}
                    onDragOver={(e) => handleDragOver(e, widgetId)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isEnabled
                        ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'
                    } ${draggedWidget === widgetId ? 'opacity-50' : ''}`}
                  >
                    {isEnabled && (
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-grab flex-shrink-0" />
                    )}
                    <label className="flex items-center gap-3 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleWidget(widgetId)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {widget.name}
                          {isEnabled && order >= 0 && (
                            <span className="text-xs text-gray-400 ml-2">#{order + 1}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {widget.description}
                        </div>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Links Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              QUICK LINKS
              <span className="font-normal text-gray-500 dark:text-gray-400 ml-2">
                (pick your favorites)
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {allQuickLinkIds.map(linkId => {
                const link = QUICK_LINK_DEFINITIONS[linkId];
                const isEnabled = quickLinks.includes(linkId);

                return (
                  <label
                    key={linkId}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      isEnabled
                        ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleQuickLink(linkId)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className={`p-1 rounded ${link.color}`}>
                      <link.icon className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-gray-900 dark:text-white">{link.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
