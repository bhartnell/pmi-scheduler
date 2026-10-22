'use client';

import { useState, useRef } from 'react';
import { GripVertical, X, Plus } from 'lucide-react';
import { WIDGET_DEFINITIONS } from './widgets';

interface DraggableWidgetGridProps {
  widgets: string[];
  editMode: boolean;
  onReorder: (newOrder: string[]) => void;
  onRemove: (widgetId: string) => void;
  onAdd: (widgetId: string) => void;
  renderWidget: (widgetId: string) => React.ReactNode;
  availableWidgets: string[];
}

export default function DraggableWidgetGrid({
  widgets,
  editMode,
  onReorder,
  onRemove,
  onAdd,
  renderWidget,
  availableWidgets,
}: DraggableWidgetGridProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget;
    // Use a transparent drag image so the widget itself stays visible
    const ghost = document.createElement('div');
    ghost.style.position = 'absolute';
    ghost.style.top = '-9999px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex === null || dragIndex === index) return;
    setDropIndex(index);
  };

  const handleDragLeave = () => {
    setDropIndex(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const newOrder = [...widgets];
    const [moved] = newOrder.splice(dragIndex, 1);
    newOrder.splice(index, 0, moved);
    onReorder(newOrder);
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <div>
      {/* Widget grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {widgets.map((widgetId, index) => {
          const isDragging = dragIndex === index;
          const isDropTarget = dropIndex === index && dragIndex !== null && dragIndex !== index;

          return (
            <div
              key={widgetId}
              draggable={editMode}
              onDragStart={editMode ? (e) => handleDragStart(e, index) : undefined}
              onDragOver={editMode ? (e) => handleDragOver(e, index) : undefined}
              onDragLeave={editMode ? handleDragLeave : undefined}
              onDrop={editMode ? (e) => handleDrop(e, index) : undefined}
              onDragEnd={editMode ? handleDragEnd : undefined}
              className={[
                'relative transition-all duration-200',
                editMode
                  ? 'cursor-grab active:cursor-grabbing rounded-xl border-2 border-dashed'
                  : '',
                editMode && isDragging
                  ? 'opacity-40 scale-95 border-blue-400 dark:border-blue-500'
                  : '',
                editMode && isDropTarget
                  ? 'border-blue-500 dark:border-blue-400 shadow-lg shadow-blue-200 dark:shadow-blue-900/50 scale-[1.02]'
                  : '',
                editMode && !isDragging && !isDropTarget
                  ? 'border-gray-300 dark:border-gray-600'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {/* Edit mode overlays */}
              {editMode && (
                <>
                  {/* Drag handle (top-left) */}
                  <div
                    className="absolute top-2 left-2 z-20 p-1 bg-white dark:bg-gray-700 rounded-md shadow-sm border border-gray-200 dark:border-gray-600 cursor-grab active:cursor-grabbing"
                    title="Drag to reorder"
                  >
                    <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-400" />
                  </div>

                  {/* Remove button (top-right) */}
                  <button
                    onClick={() => onRemove(widgetId)}
                    title="Remove widget"
                    aria-label={`Remove ${WIDGET_DEFINITIONS[widgetId as keyof typeof WIDGET_DEFINITIONS]?.name ?? widgetId} widget`}
                    className="absolute top-2 right-2 z-20 p-1 bg-white dark:bg-gray-700 rounded-md shadow-sm border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Widget content */}
              <div className={editMode ? 'pointer-events-none select-none' : ''}>
                {renderWidget(widgetId)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Widget panel — only shown in edit mode */}
      {editMode && availableWidgets.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wide">
            Add Widgets
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableWidgets.map((widgetId) => {
              const def = WIDGET_DEFINITIONS[widgetId as keyof typeof WIDGET_DEFINITIONS];
              if (!def) return null;
              return (
                <div
                  key={widgetId}
                  className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {def.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {def.description}
                    </p>
                  </div>
                  <button
                    onClick={() => onAdd(widgetId)}
                    title={`Add ${def.name}`}
                    aria-label={`Add ${def.name} widget`}
                    className="flex-shrink-0 p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state when all widgets removed in edit mode */}
      {editMode && widgets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 dark:text-gray-500">
          <p className="text-sm">No widgets on your dashboard.</p>
          <p className="text-xs mt-1">Use the &quot;Add Widgets&quot; panel below to add some.</p>
        </div>
      )}
    </div>
  );
}
