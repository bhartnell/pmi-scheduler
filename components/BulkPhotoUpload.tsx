'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Check, AlertTriangle, ChevronDown, Loader2 } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface FileMatch {
  file: File;
  previewUrl: string;
  matchedStudentId: string | null;
  status: 'matched' | 'unmatched';
}

interface UploadResult {
  studentId: string;
  success: boolean;
  error?: string;
}

interface BulkPhotoUploadProps {
  students: Student[];
  onComplete: () => void;
  onClose: () => void;
}

// Normalize a name for comparison: lowercase, strip extension, replace separators with space
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')           // remove extension
    .replace(/[_\-]+/g, ' ')           // underscores/hyphens → space
    .replace(/\s+/g, ' ')              // collapse whitespace
    .trim();
}

// Try to match a filename to a student
// Strategies (in order):
//   1. "firstname_lastname" exact
//   2. "lastname_firstname" exact
//   3. Partial: filename contains both first and last name tokens
//   4. Partial: filename starts with first initial + last name ("jsmith")
function matchFileToStudent(filename: string, students: Student[]): string | null {
  const normalized = normalizeName(filename);

  // Build lookup maps
  for (const student of students) {
    const first = student.first_name.toLowerCase();
    const last = student.last_name.toLowerCase();

    // Strategy 1: "firstname lastname"
    if (normalized === `${first} ${last}`) return student.id;

    // Strategy 2: "lastname firstname"
    if (normalized === `${last} ${first}`) return student.id;
  }

  // Strategy 3: both name tokens present
  for (const student of students) {
    const first = student.first_name.toLowerCase();
    const last = student.last_name.toLowerCase();
    if (normalized.includes(first) && normalized.includes(last)) return student.id;
  }

  // Strategy 4: initial + last name (e.g. "jsmith")
  for (const student of students) {
    const initial = student.first_name[0]?.toLowerCase() || '';
    const last = student.last_name.toLowerCase();
    const compact = initial + last;
    if (normalized === compact || normalized.startsWith(compact)) return student.id;
  }

  return null;
}

export default function BulkPhotoUpload({ students, onComplete, onClose }: BulkPhotoUploadProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileMatches, setFileMatches] = useState<FileMatch[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);

  const handleFilesSelected = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      const matches: FileMatch[] = [];

      Array.from(files).forEach((file) => {
        if (!validTypes.includes(file.type)) return; // skip non-images silently

        const matchedStudentId = matchFileToStudent(file.name, students);
        matches.push({
          file,
          previewUrl: URL.createObjectURL(file),
          matchedStudentId,
          status: matchedStudentId ? 'matched' : 'unmatched',
        });
      });

      if (matches.length === 0) {
        toast.warning('No valid image files found. Use JPG, PNG, or WebP.');
        return;
      }

      setFileMatches(matches);
      setUploadResults(null);
    },
    [students, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      handleFilesSelected(e.dataTransfer.files);
    },
    [handleFilesSelected]
  );

  const handleManualMatch = (fileIndex: number, studentId: string) => {
    setFileMatches((prev) =>
      prev.map((fm, i) =>
        i === fileIndex
          ? {
              ...fm,
              matchedStudentId: studentId || null,
              status: studentId ? 'matched' : 'unmatched',
            }
          : fm
      )
    );
  };

  const handleConfirmUpload = async () => {
    const toUpload = fileMatches.filter((fm) => fm.matchedStudentId);
    if (toUpload.length === 0) {
      toast.warning('No matched photos to upload.');
      return;
    }

    setUploading(true);
    setUploadProgress({ done: 0, total: toUpload.length });
    const results: UploadResult[] = [];

    for (let i = 0; i < toUpload.length; i++) {
      const fm = toUpload[i];
      const formData = new FormData();
      formData.append('file', fm.file);

      try {
        const res = await fetch(`/api/lab-management/students/${fm.matchedStudentId}/photo`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        results.push({
          studentId: fm.matchedStudentId!,
          success: data.success,
          error: data.error,
        });
      } catch (err) {
        results.push({
          studentId: fm.matchedStudentId!,
          success: false,
          error: 'Network error',
        });
      }

      setUploadProgress({ done: i + 1, total: toUpload.length });
    }

    setUploading(false);
    setUploadResults(results);

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    if (failed === 0) {
      toast.success(`${succeeded} photo${succeeded !== 1 ? 's' : ''} uploaded successfully.`);
      onComplete();
      onClose();
    } else if (succeeded > 0) {
      toast.warning(`${succeeded} uploaded, ${failed} failed. See details below.`);
    } else {
      toast.error('All uploads failed. Check your connection and try again.');
    }
  };

  const matchedCount = fileMatches.filter((fm) => fm.matchedStudentId).length;
  const unmatchedCount = fileMatches.filter((fm) => !fm.matchedStudentId).length;

  // Build a map of studentId → student for dropdown labels
  const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));

  // Which student IDs are already matched (to optionally gray out in dropdowns)
  const usedStudentIds = new Set(fileMatches.map((fm) => fm.matchedStudentId).filter(Boolean));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Photo Upload</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Upload photos for multiple students at once
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Drop zone - only show when no files selected yet */}
          {fileMatches.length === 0 && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
            >
              <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                Drop photos here or click to browse
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                JPG, PNG, WebP up to 5 MB each
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                Name files like <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">john_smith.jpg</code> or{' '}
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">smith_john.jpg</code> for automatic matching
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          {/* Match preview table */}
          {fileMatches.length > 0 && !uploadResults && (
            <>
              {/* Summary bar */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full">
                  <Check className="w-4 h-4" />
                  {matchedCount} matched
                </span>
                {unmatchedCount > 0 && (
                  <span className="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-full">
                    <AlertTriangle className="w-4 h-4" />
                    {unmatchedCount} unmatched
                  </span>
                )}
                <button
                  onClick={() => {
                    // Revoke object URLs to avoid memory leak
                    fileMatches.forEach((fm) => URL.revokeObjectURL(fm.previewUrl));
                    setFileMatches([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="ml-auto text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs underline"
                >
                  Clear and re-select
                </button>
              </div>

              {/* Table */}
              <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[56px_1fr_1fr_80px] bg-gray-50 dark:bg-gray-900/50 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide px-4 py-2 gap-3">
                  <span>Photo</span>
                  <span>Filename</span>
                  <span>Matched Student</span>
                  <span>Status</span>
                </div>
                <div className="divide-y dark:divide-gray-700 max-h-80 overflow-y-auto">
                  {fileMatches.map((fm, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[56px_1fr_1fr_80px] items-center px-4 py-3 gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                        <img
                          src={fm.previewUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Filename */}
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300 truncate font-mono">
                          {fm.file.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {(fm.file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>

                      {/* Student dropdown */}
                      <div className="relative min-w-0">
                        <select
                          value={fm.matchedStudentId || ''}
                          onChange={(e) => handleManualMatch(index, e.target.value)}
                          className="w-full text-sm border dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 appearance-none pr-7 truncate"
                        >
                          <option value="">-- Unmatched --</option>
                          {students
                            .slice()
                            .sort((a, b) => a.last_name.localeCompare(b.last_name))
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.last_name}, {s.first_name}
                                {usedStudentIds.has(s.id) && s.id !== fm.matchedStudentId
                                  ? ' *'
                                  : ''}
                              </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      </div>

                      {/* Status badge */}
                      <div>
                        {fm.matchedStudentId ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" />
                            Matched
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            None
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {unmatchedCount > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {unmatchedCount} unmatched file{unmatchedCount !== 1 ? 's' : ''} will be skipped. Use the
                  dropdown above to assign them manually.
                </p>
              )}
            </>
          )}

          {/* Upload progress */}
          {uploading && uploadProgress && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Uploading {uploadProgress.done} of {uploadProgress.total}...
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Upload results summary */}
          {uploadResults && (
            <div className="space-y-3">
              {uploadResults.filter((r) => r.success).length > 0 && (
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-sm">
                  <Check className="w-5 h-5 flex-shrink-0" />
                  {uploadResults.filter((r) => r.success).length} photo
                  {uploadResults.filter((r) => r.success).length !== 1 ? 's' : ''} uploaded
                  successfully.
                </div>
              )}
              {uploadResults.filter((r) => !r.success).length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  <p className="font-medium mb-1">
                    {uploadResults.filter((r) => !r.success).length} upload
                    {uploadResults.filter((r) => !r.success).length !== 1 ? 's' : ''} failed:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {uploadResults
                      .filter((r) => !r.success)
                      .map((r) => {
                        const s = studentMap[r.studentId];
                        return (
                          <li key={r.studentId}>
                            {s ? `${s.first_name} ${s.last_name}` : r.studentId}: {r.error}
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            {uploadResults ? 'Close' : 'Cancel'}
          </button>

          {fileMatches.length > 0 && !uploadResults && (
            <button
              onClick={handleConfirmUpload}
              disabled={uploading || matchedCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload {matchedCount} Photo{matchedCount !== 1 ? 's' : ''}
                </>
              )}
            </button>
          )}

          {uploadResults && (
            <button
              onClick={() => {
                fileMatches.forEach((fm) => URL.revokeObjectURL(fm.previewUrl));
                setFileMatches([]);
                setUploadResults(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <Upload className="w-4 h-4" />
              Upload More
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
