'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Wrench,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  DollarSign,
  Filter,
  ArrowRight,
  TriangleAlert,
  Info,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import type { CurrentUser } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EquipmentRef {
  id: string;
  name: string;
  category: string | null;
  location: string | null;
  condition: string | null;
}

interface MaintenanceRecord {
  id: string;
  equipment_item_id: string;
  maintenance_type: string;
  description: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  completed_by: string | null;
  next_due_date: string | null;
  cost: number | null;
  status: 'scheduled' | 'completed' | 'overdue' | 'cancelled';
  notes: string | null;
  created_at: string;
  equipment: EquipmentRef | null;
}

interface EquipmentOption {
  id: string;
  name: string;
  category: string | null;
  last_maintenance: string | null;
  next_maintenance: string | null;
  maintenance_interval_days: number | null;
}

interface MaintenanceFormData {
  equipment_item_id: string;
  maintenance_type: string;
  description: string;
  scheduled_date: string;
  completed_date: string;
  next_due_date: string;
  cost: string;
  status: string;
  notes: string;
  interval_days: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAINTENANCE_TYPES = [
  'Routine Inspection',
  'Calibration',
  'Battery Replacement',
  'Cleaning / Decontamination',
  'Repair',
  'Software Update',
  'Certification / Compliance Check',
  'Parts Replacement',
  'Other',
] as const;

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  scheduled: {
    label: 'Scheduled',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    icon: Clock,
  },
  completed: {
    label: 'Completed',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    icon: CheckCircle2,
  },
  overdue: {
    label: 'Overdue',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    icon: TriangleAlert,
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    icon: XCircle,
  },
};

const EMPTY_FORM: MaintenanceFormData = {
  equipment_item_id: '',
  maintenance_type: MAINTENANCE_TYPES[0],
  description: '',
  scheduled_date: '',
  completed_date: '',
  next_due_date: '',
  cost: '',
  status: 'scheduled',
  notes: '',
  interval_days: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function isOverdue(record: MaintenanceRecord): boolean {
  if (record.status !== 'scheduled') return false;
  if (!record.scheduled_date) return false;
  return new Date(record.scheduled_date) < new Date();
}

function computeNextDueDate(completedDate: string, intervalDays: string): string {
  const days = parseInt(intervalDays, 10);
  if (!completedDate || isNaN(days) || days < 1) return '';
  const d = new Date(completedDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Maintenance Modal
// ---------------------------------------------------------------------------

function MaintenanceModal({
  isOpen,
  onClose,
  onSave,
  editRecord,
  equipmentOptions,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MaintenanceFormData) => void;
  editRecord: MaintenanceRecord | null;
  equipmentOptions: EquipmentOption[];
  saving: boolean;
}) {
  const [form, setForm] = useState<MaintenanceFormData>(EMPTY_FORM);

  useEffect(() => {
    if (editRecord) {
      setForm({
        equipment_item_id: editRecord.equipment_item_id,
        maintenance_type: editRecord.maintenance_type,
        description: editRecord.description ?? '',
        scheduled_date: editRecord.scheduled_date ?? '',
        completed_date: editRecord.completed_date ?? '',
        next_due_date: editRecord.next_due_date ?? '',
        cost: editRecord.cost != null ? String(editRecord.cost) : '',
        status: editRecord.status,
        notes: editRecord.notes ?? '',
        interval_days: '',
      });
    } else {
      setForm({ ...EMPTY_FORM, scheduled_date: new Date().toISOString().split('T')[0] });
    }
  }, [editRecord, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const handleCompletedDateChange = (date: string) => {
    const next = computeNextDueDate(date, form.interval_days);
    setForm((prev) => ({ ...prev, completed_date: date, next_due_date: next || prev.next_due_date }));
  };

  const handleIntervalChange = (days: string) => {
    const next = computeNextDueDate(form.completed_date, days);
    setForm((prev) => ({ ...prev, interval_days: days, next_due_date: next || prev.next_due_date }));
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  const isCompleting = form.status === 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {editRecord ? 'Edit Maintenance Record' : 'Log Maintenance'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Equipment */}
          <div>
            <label className={labelClass}>
              Equipment <span className="text-red-500">*</span>
            </label>
            <select
              value={form.equipment_item_id}
              onChange={(e) => setForm({ ...form, equipment_item_id: e.target.value })}
              required
              className={inputClass}
            >
              <option value="">— Select Equipment —</option>
              {equipmentOptions.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}{eq.category ? ` (${eq.category})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={form.maintenance_type}
                onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })}
                required
                className={inputClass}
              >
                {MAINTENANCE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputClass}
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Scheduled Date</label>
              <input
                type="date"
                value={form.scheduled_date}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{isCompleting ? 'Completed Date' : 'Completed Date'}</label>
              <input
                type="date"
                value={form.completed_date}
                onChange={(e) => handleCompletedDateChange(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Interval + Next Due */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Repeat Interval (days)
                <span className="text-gray-400 font-normal ml-1">optional</span>
              </label>
              <input
                type="number"
                min="1"
                value={form.interval_days}
                onChange={(e) => handleIntervalChange(e.target.value)}
                placeholder="e.g. 90"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Next Due Date</label>
              <input
                type="date"
                value={form.next_due_date}
                onChange={(e) => setForm({ ...form, next_due_date: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className={labelClass}>Cost ($)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                placeholder="0.00"
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of work performed..."
              className={inputClass}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Additional details or observations..."
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editRecord ? (
                'Save Changes'
              ) : (
                'Log Maintenance'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Complete Maintenance Modal (quick complete)
// ---------------------------------------------------------------------------

function CompleteModal({
  isOpen,
  onClose,
  onComplete,
  record,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (completedDate: string, nextDueDate: string, cost: string, notes: string) => void;
  record: MaintenanceRecord | null;
  saving: boolean;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [completedDate, setCompletedDate] = useState(today);
  const [intervalDays, setIntervalDays] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCompletedDate(today);
      setIntervalDays('');
      setNextDueDate('');
      setCost('');
      setNotes('');
    }
  }, [isOpen, today]);

  if (!isOpen || !record) return null;

  const handleIntervalChange = (days: string) => {
    setIntervalDays(days);
    const next = computeNextDueDate(completedDate, days);
    if (next) setNextDueDate(next);
  };

  const handleCompletedDateChange = (date: string) => {
    setCompletedDate(date);
    if (intervalDays) {
      const next = computeNextDueDate(date, intervalDays);
      if (next) setNextDueDate(next);
    }
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            Complete Maintenance
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Summary */}
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm font-medium text-green-900 dark:text-green-100">
              {record.equipment?.name ?? 'Unknown'}
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
              {record.maintenance_type}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Completed Date</label>
              <input
                type="date"
                value={completedDate}
                onChange={(e) => handleCompletedDateChange(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Interval (days)</label>
              <input
                type="number"
                min="1"
                value={intervalDays}
                onChange={(e) => handleIntervalChange(e.target.value)}
                placeholder="e.g. 90"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Next Due Date</label>
            <input
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Cost ($)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="What was done?"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => onComplete(completedDate, nextDueDate, cost, notes)}
              disabled={saving || !completedDate}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark Complete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upcoming Calendar Section
// ---------------------------------------------------------------------------

function UpcomingSection({ records }: { records: MaintenanceRecord[] }) {
  const today = new Date();
  const upcoming = records
    .filter((r) => {
      if (r.status === 'completed' || r.status === 'cancelled') return false;
      const date = r.next_due_date ?? r.scheduled_date;
      if (!date) return false;
      const d = new Date(date);
      const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= -7 && diff <= 90;
    })
    .sort((a, b) => {
      const da = a.next_due_date ?? a.scheduled_date ?? '';
      const db = b.next_due_date ?? b.scheduled_date ?? '';
      return da.localeCompare(db);
    })
    .slice(0, 10);

  if (upcoming.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 text-center">
        <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming maintenance in the next 90 days</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
          Upcoming Maintenance (Next 90 Days)
        </h2>
        <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {upcoming.length}
        </span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {upcoming.map((record) => {
          const date = record.next_due_date ?? record.scheduled_date;
          const d = date ? new Date(date) : null;
          const daysUntil = d
            ? Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            : null;
          const isPast = daysUntil !== null && daysUntil < 0;
          const isSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 14;

          return (
            <div
              key={record.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center text-xs font-bold ${
                  isPast
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : isSoon
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}
              >
                {d ? (
                  <>
                    <span className="leading-none">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="text-base leading-none">{d.getDate()}</span>
                  </>
                ) : (
                  '?'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {record.equipment?.name ?? 'Unknown'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{record.maintenance_type}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {daysUntil !== null && (
                  <span
                    className={`text-xs font-medium ${
                      isPast
                        ? 'text-red-600 dark:text-red-400'
                        : isSoon
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {isPast
                      ? `${Math.abs(daysUntil)}d overdue`
                      : daysUntil === 0
                      ? 'Today'
                      : `in ${daysUntil}d`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MaintenanceLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);

  // UI state
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEquipment, setFilterEquipment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState<MaintenanceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [completeRecord, setCompleteRecord] = useState<MaintenanceRecord | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeSaving, setCompleteSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'upcoming'>('list');

  // Auth
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/equipment/maintenance');
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFetchError(data.error || 'Failed to load maintenance records');
      } else {
        setRecords(data.records ?? []);
        setOverdueCount(data.overdueCount ?? 0);
      }
    } catch {
      setFetchError('Failed to load maintenance records. Please try again.');
    }
  }, []);

  const fetchEquipmentOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/equipment');
      const data = await res.json();
      if (data.success) {
        setEquipmentOptions(data.equipment ?? []);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!canAccessAdmin(data.user.role)) {
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
        await Promise.all([fetchRecords(), fetchEquipmentOptions()]);
      }
    } catch {
      // Non-fatal
    }
    setLoading(false);
  }, [router, fetchRecords, fetchEquipmentOptions]);

  useEffect(() => {
    if (session?.user?.email) fetchCurrentUser();
  }, [session, fetchCurrentUser]);

  // Filtered records
  const filteredRecords = records.filter((r) => {
    const equipName = r.equipment?.name?.toLowerCase() ?? '';
    const matchesSearch =
      search === '' ||
      equipName.includes(search.toLowerCase()) ||
      r.maintenance_type.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === '' || r.status === filterStatus;
    const matchesEquipment = filterEquipment === '' || r.equipment_item_id === filterEquipment;
    return matchesSearch && matchesStatus && matchesEquipment;
  });

  // Stats
  const totalCost = records
    .filter((r) => r.status === 'completed' && r.cost != null)
    .reduce((sum, r) => sum + (r.cost ?? 0), 0);

  const completedCount = records.filter((r) => r.status === 'completed').length;
  const scheduledCount = records.filter((r) => r.status === 'scheduled').length;

  // Save handler
  const handleSave = async (formData: MaintenanceFormData) => {
    setSaving(true);
    try {
      const payload = {
        equipment_item_id: formData.equipment_item_id,
        maintenance_type: formData.maintenance_type,
        description: formData.description || null,
        scheduled_date: formData.scheduled_date || null,
        completed_date: formData.completed_date || null,
        next_due_date: formData.next_due_date || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        status: formData.status,
        notes: formData.notes || null,
      };

      let res: Response;
      if (editRecord) {
        res = await fetch(`/api/admin/equipment/maintenance/${editRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/admin/equipment/maintenance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');

      toast.success(editRecord ? 'Record updated' : 'Maintenance logged');
      setShowModal(false);
      setEditRecord(null);
      await fetchRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  };

  // Complete handler
  const handleComplete = async (completedDate: string, nextDueDate: string, cost: string, notes: string) => {
    if (!completeRecord) return;
    setCompleteSaving(true);
    try {
      const res = await fetch(`/api/admin/equipment/maintenance/${completeRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          completed_date: completedDate,
          next_due_date: nextDueDate || null,
          cost: cost ? parseFloat(cost) : null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to complete');

      toast.success('Maintenance marked as complete');
      setShowCompleteModal(false);
      setCompleteRecord(null);
      await fetchRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete');
    }
    setCompleteSaving(false);
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/equipment/maintenance/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete');

      toast.success('Record deleted');
      setDeleteConfirmId(null);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700 dark:text-gray-300 mb-4">{fetchError}</p>
          <button
            onClick={() => { setFetchError(null); fetchRecords(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">Admin</Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <Link href="/admin/equipment" className="hover:text-blue-600 dark:hover:text-blue-400">Equipment</Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Maintenance Log</span>
          </div>

          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex-shrink-0">
                <Wrench className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Equipment Maintenance
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Schedule, track, and log maintenance for all lab equipment
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <ThemeToggle />
              <Link
                href="/admin/equipment"
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                Back to Inventory
              </Link>
              <button
                onClick={() => { setEditRecord(null); setShowModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Log Maintenance
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <TriangleAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{overdueCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Overdue</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{scheduledCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Scheduled</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {totalCost > 0 ? formatCurrency(totalCost) : '$0'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Cost</p>
              </div>
            </div>
          </div>
        </div>

        {/* Overdue banner */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <TriangleAlert className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-200">
              <span className="font-semibold">{overdueCount} maintenance item{overdueCount !== 1 ? 's' : ''}</span>{' '}
              are past their scheduled date and need attention.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-1 w-fit">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            All Records
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Upcoming Calendar
          </button>
        </div>

        {activeTab === 'upcoming' ? (
          <UpcomingSection records={records} />
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by equipment name or type..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <select
                  value={filterEquipment}
                  onChange={(e) => setFilterEquipment(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm w-full sm:w-auto"
                >
                  <option value="">All Equipment</option>
                  {equipmentOptions.map((eq) => (
                    <option key={eq.id} value={eq.id}>{eq.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Records table */}
            {filteredRecords.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                <EmptyState
                  icon={Wrench}
                  title={records.length === 0 ? 'No maintenance records' : 'No records match filters'}
                  message={
                    records.length === 0
                      ? 'Start logging maintenance to keep equipment in top condition.'
                      : 'Try adjusting your search or filter criteria.'
                  }
                  actionLabel={records.length === 0 ? 'Log First Maintenance' : undefined}
                  onAction={records.length === 0 ? () => setShowModal(true) : undefined}
                />
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/50">
                        <th className="px-4 py-3">Equipment</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 hidden sm:table-cell">Scheduled</th>
                        <th className="px-4 py-3 hidden md:table-cell">Completed</th>
                        <th className="px-4 py-3 hidden lg:table-cell">Next Due</th>
                        <th className="px-4 py-3 hidden lg:table-cell">Cost</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredRecords.map((record) => {
                        const statusCfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.scheduled;
                        const StatusIcon = statusCfg.icon;
                        const actuallyOverdue = isOverdue(record);

                        return (
                          <tr
                            key={record.id}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                              actuallyOverdue ? 'bg-red-50/30 dark:bg-red-900/10' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {record.equipment?.name ?? 'Unknown'}
                              </p>
                              {record.equipment?.category && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {record.equipment.category}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                              {record.maintenance_type}
                              {record.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">
                                  {record.description}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  actuallyOverdue
                                    ? STATUS_CONFIG.overdue.badge
                                    : statusCfg.badge
                                }`}
                              >
                                <StatusIcon className="w-3 h-3" />
                                {actuallyOverdue ? 'Overdue' : statusCfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden sm:table-cell whitespace-nowrap">
                              {formatDate(record.scheduled_date)}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden md:table-cell whitespace-nowrap">
                              {record.completed_date ? formatDate(record.completed_date) : (
                                <span className="text-gray-400 dark:text-gray-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">
                              {record.next_due_date ? (
                                <span className={`text-xs font-medium ${
                                  new Date(record.next_due_date) <= new Date()
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-gray-600 dark:text-gray-300'
                                }`}>
                                  {formatDate(record.next_due_date)}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                              {formatCurrency(record.cost)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {record.status !== 'completed' && record.status !== 'cancelled' && (
                                  <button
                                    onClick={() => { setCompleteRecord(record); setShowCompleteModal(true); }}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                    title="Mark complete"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span className="hidden sm:inline">Complete</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => { setEditRecord(record); setShowModal(true); }}
                                  className="p-1.5 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {deleteConfirmId === record.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleDelete(record.id)}
                                      className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirmId(record.id)}
                                    className="p-1.5 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cron/automation notice */}
            <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <span className="font-medium">Automated Reminders:</span> To receive daily email alerts for
                overdue maintenance, set up a scheduled cron job that calls{' '}
                <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-800/50 rounded text-xs font-mono">
                  GET /api/admin/equipment/maintenance?status=scheduled
                </code>{' '}
                and sends notifications when{' '}
                <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-800/50 rounded text-xs font-mono">
                  scheduled_date &lt; today
                </code>.
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      <MaintenanceModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditRecord(null); }}
        onSave={handleSave}
        editRecord={editRecord}
        equipmentOptions={equipmentOptions}
        saving={saving}
      />

      <CompleteModal
        isOpen={showCompleteModal}
        onClose={() => { setShowCompleteModal(false); setCompleteRecord(null); }}
        onComplete={handleComplete}
        record={completeRecord}
        saving={completeSaving}
      />
    </div>
  );
}
