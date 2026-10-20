'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, BookOpen } from 'lucide-react';

type CERequirement = {
  id: string;
  cert_type: string;
  display_name: string;
  issuing_body: string;
  cycle_years: number;
  total_hours_required: number;
  category_requirements: Record<string, number> | null;
  notes: string | null;
  source_url: string | null;
};

type CERecord = {
  id: string;
  instructor_id: string;
  certification_id: string;
  title: string;
  provider: string | null;
  hours: number;
  category: string | null;
  completion_date: string;
  certificate_image_url: string | null;
  notes: string | null;
};

type Props = {
  certificationId: string;
  certName: string;
  issueDate: string | null;
  expirationDate: string;
  ceRequirementId: string | null;
  instructorId: string;
  onClose: () => void;
  onRequirementLinked: (requirementId: string) => void;
};

// Parse date string as local date
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function CETracker({
  certificationId,
  certName,
  issueDate,
  expirationDate,
  ceRequirementId,
  instructorId,
  onClose,
  onRequirementLinked
}: Props) {
  const [requirements, setRequirements] = useState<CERequirement[]>([]);
  const [selectedRequirement, setSelectedRequirement] = useState<CERequirement | null>(null);
  const [ceRecords, setCERecords] = useState<CERecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [hours, setHours] = useState('');
  const [category, setCategory] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Load requirements and records
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // Load all CE requirements
      const reqRes = await fetch('/api/lab-management/ce-requirements');
      const reqData = await reqRes.json();

      if (reqData.success && reqData.requirements) {
        setRequirements(reqData.requirements);

        // If cert already has a requirement linked, select it
        if (ceRequirementId) {
          const linked = reqData.requirements.find((r: CERequirement) => r.id === ceRequirementId);
          if (linked) setSelectedRequirement(linked);
        }
      }

      // Load CE records for this certification
      const recordRes = await fetch(`/api/lab-management/ce-records?certificationId=${certificationId}`);
      const recordData = await recordRes.json();

      if (recordData.success && recordData.records) {
        setCERecords(recordData.records);
      }

      setLoading(false);
    };

    loadData();
  }, [certificationId, ceRequirementId]);

  // Link a requirement to this certification
  const linkRequirement = async (requirement: CERequirement) => {
    const res = await fetch(`/api/lab-management/certifications/${certificationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ce_requirement_id: requirement.id }),
    });

    const data = await res.json();
    if (data.success) {
      setSelectedRequirement(requirement);
      onRequirementLinked(requirement.id);
    }
  };

  // Calculate hours in current cycle
  const getHoursInCycle = (): { total: number; byCategory: Record<string, number> } => {
    const cycleStart = issueDate ? parseLocalDate(issueDate) : new Date(0);
    const cycleEnd = parseLocalDate(expirationDate);

    const byCategory: Record<string, number> = {};
    let total = 0;

    for (const record of ceRecords) {
      const recordDate = parseLocalDate(record.completion_date);
      if (recordDate >= cycleStart && recordDate <= cycleEnd) {
        total += Number(record.hours);
        const cat = record.category || 'general';
        byCategory[cat] = (byCategory[cat] || 0) + Number(record.hours);
      }
    }

    return { total, byCategory };
  };

  // Add CE record
  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const res = await fetch('/api/lab-management/ce-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        certification_id: certificationId,
        title,
        provider: provider || null,
        hours: parseFloat(hours),
        category: category || null,
        completion_date: completionDate,
        notes: notes || null
      }),
    });

    const data = await res.json();
    if (data.success && data.record) {
      setCERecords([data.record, ...ceRecords]);
      resetForm();
    }

    setSaving(false);
  };

  // Delete CE record
  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Delete this CE record?')) return;

    const res = await fetch(`/api/lab-management/ce-records/${id}`, {
      method: 'DELETE',
    });

    const data = await res.json();
    if (data.success) {
      setCERecords(ceRecords.filter(r => r.id !== id));
    }
  };

  const resetForm = () => {
    setTitle('');
    setProvider('');
    setHours('');
    setCategory('');
    setCompletionDate('');
    setNotes('');
    setShowAddForm(false);
  };

  const hoursData = getHoursInCycle();
  const progressPercent = selectedRequirement && selectedRequirement.total_hours_required > 0
    ? Math.min(100, (hoursData.total / selectedRequirement.total_hours_required) * 100)
    : 0;

  // Get category options based on selected requirement
  const getCategoryOptions = (): string[] => {
    if (!selectedRequirement?.category_requirements) return ['general'];
    return Object.keys(selectedRequirement.category_requirements);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <p className="text-gray-900 dark:text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">CE Tracker: {certName}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Requirement Selection */}
          {!selectedRequirement ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Select CE Requirement Type</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Link this certification to track CE hours toward renewal.
              </p>
              <div className="grid gap-2">
                {requirements.map(req => (
                  <button
                    key={req.id}
                    onClick={() => linkRequirement(req)}
                    className="text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 p-3 rounded-lg border border-gray-200 dark:border-gray-600 transition"
                  >
                    <div className="text-gray-900 dark:text-white font-medium">{req.display_name}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm">
                      {req.total_hours_required > 0
                        ? `${req.total_hours_required} hours / ${req.cycle_years} years`
                        : 'Renewal course only'
                      } &bull; {req.issuing_body}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Progress Section */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Progress</h3>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">
                    {selectedRequirement.display_name}
                  </span>
                </div>

                {selectedRequirement.total_hours_required > 0 ? (
                  <>
                    {/* Progress Bar */}
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden mb-2">
                      <div
                        className={`h-full transition-all ${
                          progressPercent >= 100 ? 'bg-green-500' :
                          progressPercent >= 75 ? 'bg-blue-500' :
                          progressPercent >= 50 ? 'bg-yellow-500' :
                          'bg-orange-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-900 dark:text-white font-medium">
                        {hoursData.total.toFixed(1)} / {selectedRequirement.total_hours_required} hours
                      </span>
                      <span className={progressPercent >= 100 ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}>
                        {progressPercent >= 100 ? 'Complete!' : `${(selectedRequirement.total_hours_required - hoursData.total).toFixed(1)} hours remaining`}
                      </span>
                    </div>

                    {/* Category Breakdown */}
                    {selectedRequirement.category_requirements && (
                      <div className="mt-4 space-y-2">
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">By Category:</h4>
                        {Object.entries(selectedRequirement.category_requirements).map(([cat, required]) => {
                          const completed = hoursData.byCategory[cat] || 0;
                          const catPercent = Math.min(100, (completed / Number(required)) * 100);
                          return (
                            <div key={cat} className="flex items-center gap-3">
                              <span className="text-gray-700 dark:text-gray-300 text-sm capitalize w-32">{cat.replace('_', ' ')}</span>
                              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div
                                  className={`h-full ${catPercent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                  style={{ width: `${catPercent}%` }}
                                />
                              </div>
                              <span className="text-gray-500 dark:text-gray-400 text-sm w-20 text-right">
                                {completed.toFixed(1)}/{required}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-blue-800 dark:text-blue-200 text-sm">
                      This certification requires a renewal course only - no CE hours needed.
                    </p>
                  </div>
                )}

                {selectedRequirement.notes && (
                  <p className="mt-3 text-gray-500 dark:text-gray-400 text-sm italic">{selectedRequirement.notes}</p>
                )}
              </div>

              {/* Add CE Button */}
              {!showAddForm && selectedRequirement.total_hours_required > 0 && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition"
                >
                  <Plus className="w-5 h-5" />
                  Add CE Hours
                </button>
              )}

              {/* Add CE Form */}
              {showAddForm && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add CE Record</h3>
                  <form onSubmit={handleAddRecord} className="space-y-4">
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">Course/Activity Title *</label>
                      <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                        placeholder="e.g., ACLS Renewal, Trauma Conference"
                        className="w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">Hours *</label>
                        <input
                          type="number"
                          step="0.25"
                          min="0.25"
                          value={hours}
                          onChange={e => setHours(e.target.value)}
                          required
                          placeholder="e.g., 4"
                          className="w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">Completion Date *</label>
                        <input
                          type="date"
                          value={completionDate}
                          onChange={e => setCompletionDate(e.target.value)}
                          required
                          className="w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">Category</label>
                        <select
                          value={category}
                          onChange={e => setCategory(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                        >
                          <option value="">Select category</option>
                          {getCategoryOptions().map(cat => (
                            <option key={cat} value={cat}>
                              {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">Provider</label>
                        <input
                          type="text"
                          value={provider}
                          onChange={e => setProvider(e.target.value)}
                          placeholder="e.g., AHA, PMI"
                          className="w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">Notes</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Optional notes"
                        className="w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Add Record'}
                      </button>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-3 px-6 rounded-lg transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* CE Records List */}
              {selectedRequirement.total_hours_required > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">CE Records</h3>
                  {ceRecords.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      No CE records yet. Add your first one above.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {ceRecords.map(record => (
                        <div
                          key={record.id}
                          className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 flex justify-between items-start border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 dark:text-white font-medium">{record.title}</span>
                              <span className="text-purple-600 dark:text-purple-400 text-sm font-semibold">{record.hours} hrs</span>
                            </div>
                            <div className="text-gray-500 dark:text-gray-400 text-sm">
                              {parseLocalDate(record.completion_date).toLocaleDateString()}
                              {record.provider && ` • ${record.provider}`}
                              {record.category && ` • ${record.category.replace('_', ' ')}`}
                            </div>
                            {record.notes && (
                              <div className="text-gray-400 dark:text-gray-500 text-sm mt-1">{record.notes}</div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteRecord(record.id)}
                            className="text-red-500 hover:text-red-600 dark:hover:text-red-400 ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
