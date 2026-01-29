'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
}

interface StudentPickerProps {
  students: Student[];
  value: string;
  onChange: (studentId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function StudentPicker({
  students,
  value,
  onChange,
  placeholder = 'Select a student...',
  disabled = false,
  className = ''
}: StudentPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedStudent = students.find(s => s.id === value);

  // Filter students by search
  const filteredStudents = students.filter(s => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const handleSelect = (studentId: string) => {
    onChange(studentId);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-left flex items-center gap-3 ${
          disabled
            ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
            : 'bg-white dark:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500'
        }`}
      >
        {selectedStudent ? (
          <>
            {/* Selected student with photo */}
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-600">
              {selectedStudent.photo_url ? (
                <img
                  src={selectedStudent.photo_url}
                  alt={`${selectedStudent.first_name} ${selectedStudent.last_name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                  {getInitials(selectedStudent.first_name, selectedStudent.last_name)}
                </div>
              )}
            </div>
            <span className="flex-1 text-gray-900 dark:text-white truncate">
              {selectedStudent.first_name} {selectedStudent.last_name}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-600 flex-shrink-0" />
            <span className="flex-1 text-gray-500 dark:text-gray-400">{placeholder}</span>
          </>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg shadow-lg max-h-72 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students..."
                className="w-full pl-9 pr-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Student List */}
          <div className="max-h-56 overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                No students found
              </div>
            ) : (
              filteredStudents.map(student => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => handleSelect(student.id)}
                  className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    student.id === value ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                  }`}
                >
                  {/* Photo or Initials */}
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-600">
                    {student.photo_url ? (
                      <img
                        src={student.photo_url}
                        alt={`${student.first_name} ${student.last_name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                        {getInitials(student.first_name, student.last_name)}
                      </div>
                    )}
                  </div>
                  <span className="text-gray-900 dark:text-white text-sm">
                    {student.first_name} {student.last_name}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
