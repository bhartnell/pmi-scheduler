'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, Printer, FileSpreadsheet, FileText } from 'lucide-react';
import { exportToExcel, exportToPDF, printRoster, type ExportConfig } from '@/lib/export-utils';

interface ExportDropdownProps {
  config: ExportConfig;
  disabled?: boolean;
}

export default function ExportDropdown({ config, disabled = false }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (type: 'print' | 'pdf' | 'excel') => {
    if (config.data.length === 0) {
      alert('No data to export');
      return;
    }

    setExporting(type);
    try {
      switch (type) {
        case 'print':
          printRoster(config);
          break;
        case 'pdf':
          await exportToPDF(config);
          break;
        case 'excel':
          exportToExcel(config);
          break;
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    }
    setExporting(null);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || config.data.length === 0}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
          <button
            onClick={() => handleExport('print')}
            disabled={exporting !== null}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>{exporting === 'print' ? 'Preparing...' : 'Print'}</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>{exporting === 'pdf' ? 'Generating...' : 'Download PDF'}</span>
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={exporting !== null}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exporting === 'excel' ? 'Generating...' : 'Download Excel'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
