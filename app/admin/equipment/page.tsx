'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  X,
  Loader2,
  LogOut,
  LogIn,
  Wrench,
  Filter,
  Info,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import HelpTooltip from '@/components/HelpTooltip';
import type { CurrentUser } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'Airway Management',
  'IV/IO Supplies',
  'Cardiac Monitoring',
  'Medication Administration',
  'Patient Assessment',
  'Immobilization',
  'Simulation Equipment',
  'Other',
] as const;

type Category = (typeof CATEGORIES)[number] | 'All';

const CONDITION_CONFIG: Record<
  string,
  { label: string; badge: string }
> = {
  new: {
    label: 'New',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  good: {
    label: 'Good',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  fair: {
    label: 'Fair',
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  poor: {
    label: 'Poor',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  },
  out_of_service: {
    label: 'Out of Service',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EquipmentItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  available_quantity: number;
  description: string | null;
  location: string | null;
  condition: string | null;
  last_maintenance: string | null;
  next_maintenance: string | null;
  low_stock_threshold?: number;
  created_at: string;
  updated_at: string;
  checked_out_quantity: number;
}

interface CheckoutRecord {
  id: string;
  equipment_id: string;
  lab_day_id: string | null;
  checked_out_by: string;
  checked_out_at: string;
  checked_in_at: string | null;
  checked_in_by: string | null;
  quantity: number;
  notes: string | null;
}

interface EquipmentFormData {
  name: string;
  category: string;
  quantity: string;
  available_quantity: string;
  description: string;
  location: string;
  condition: string;
  last_maintenance: string;
  next_maintenance: string;
}

interface CheckoutFormData {
  quantity: string;
  lab_day_id: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isMaintenanceDue(next_maintenance: string | null): boolean {
  if (!next_maintenance) return false;
  const due = new Date(next_maintenance);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return due <= thirtyDaysFromNow;
}

function isLowStock(item: EquipmentItem): boolean {
  return item.available_quantity < (item.low_stock_threshold ?? 1);
}

const EMPTY_EQUIPMENT_FORM: EquipmentFormData = {
  name: '',
  category: CATEGORIES[0],
  quantity: '1',
  available_quantity: '1',
  description: '',
  location: '',
  condition: 'good',
  last_maintenance: '',
  next_maintenance: '',
};

const EMPTY_CHECKOUT_FORM: CheckoutFormData = {
  quantity: '1',
  lab_day_id: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Equipment Modal
// ---------------------------------------------------------------------------

function EquipmentModal({
  isOpen,
  onClose,
  onSave,
  editItem,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EquipmentFormData) => void;
  editItem: EquipmentItem | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<EquipmentFormData>(EMPTY_EQUIPMENT_FORM);

  useEffect(() => {
    if (editItem) {
      setForm({
        name: editItem.name,
        category: editItem.category ?? '',
        quantity: String(editItem.quantity),
        available_quantity: String(editItem.available_quantity),
        description: editItem.description ?? '',
        location: editItem.location ?? '',
        condition: editItem.condition ?? 'good',
        last_maintenance: editItem.last_maintenance ?? '',
        next_maintenance: editItem.next_maintenance ?? '',
      });
    } else {
      setForm(EMPTY_EQUIPMENT_FORM);
    }
  }, [editItem, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {editItem ? 'Edit Equipment' : 'Add Equipment'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className={labelClass}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="e.g. Bag-Valve Mask (BVM)"
              className={inputClass}
            />
          </div>

          {/* Category + Condition */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
                className={inputClass}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Condition</label>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                className={inputClass}
              >
                <option value="">— Select —</option>
                <option value="new">New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
                <option value="out_of_service">Out of Service</option>
              </select>
            </div>
          </div>

          {/* Quantity + Available */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Total Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Available Quantity</label>
              <input
                type="number"
                min="0"
                value={form.available_quantity}
                onChange={(e) =>
                  setForm({ ...form, available_quantity: e.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className={labelClass}>Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Storage Room B"
              className={inputClass}
            />
          </div>

          {/* Maintenance dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Last Maintenance</label>
              <input
                type="date"
                value={form.last_maintenance}
                onChange={(e) =>
                  setForm({ ...form, last_maintenance: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Next Maintenance</label>
              <input
                type="date"
                value={form.next_maintenance}
                onChange={(e) =>
                  setForm({ ...form, next_maintenance: e.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              placeholder="Optional notes or description..."
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
              ) : editItem ? (
                'Save Changes'
              ) : (
                'Add Equipment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkout Modal
// ---------------------------------------------------------------------------

function CheckoutModal({
  isOpen,
  onClose,
  onCheckout,
  item,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: (data: CheckoutFormData) => void;
  item: EquipmentItem | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<CheckoutFormData>(EMPTY_CHECKOUT_FORM);

  useEffect(() => {
    if (isOpen) setForm(EMPTY_CHECKOUT_FORM);
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCheckout(form);
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <LogOut className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Check Out Equipment
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Item summary */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{item.name}</p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              Available: {item.available_quantity} of {item.quantity}
            </p>
          </div>

          {/* Quantity */}
          <div>
            <label className={labelClass}>
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max={item.available_quantity}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
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
              placeholder="Purpose, lab day, or any relevant details..."
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
              disabled={saving || item.available_quantity < 1}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check Out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Checkouts Panel
// ---------------------------------------------------------------------------

function ActiveCheckoutsPanel({
  checkouts,
  equipment,
  onCheckIn,
  checkingIn,
}: {
  checkouts: CheckoutRecord[];
  equipment: EquipmentItem[];
  onCheckIn: (checkoutId: string) => void;
  checkingIn: string | null;
}) {
  const equipmentMap = Object.fromEntries(equipment.map((e) => [e.id, e]));
  const activeCheckouts = checkouts.filter((c) => !c.checked_in_at);

  if (activeCheckouts.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <LogOut className="w-4 h-4 text-amber-500" />
        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
          Active Checkouts
        </h2>
        <div className="group relative inline-flex items-center">
          <Info className="h-4 w-4 text-gray-400 hover:text-blue-500 cursor-help" />
          <div className="invisible group-hover:visible absolute left-6 top-0 z-50 w-72 p-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg">
            <div className="absolute -left-1 top-2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
            Check out equipment to instructors for lab use. Items must be returned and condition noted.
          </div>
        </div>
        <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {activeCheckouts.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/50">
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2 hidden sm:table-cell">Checked Out By</th>
              <th className="px-4 py-2 hidden md:table-cell">Date</th>
              <th className="px-4 py-2 hidden lg:table-cell">Notes</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {activeCheckouts.map((checkout) => {
              const item = equipmentMap[checkout.equipment_id];
              return (
                <tr
                  key={checkout.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {item?.name ?? 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {checkout.quantity}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden sm:table-cell text-xs">
                    {checkout.checked_out_by}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden md:table-cell text-xs whitespace-nowrap">
                    {formatDate(checkout.checked_out_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell text-xs max-w-xs truncate">
                    {checkout.notes ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onCheckIn(checkout.id)}
                      disabled={checkingIn === checkout.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {checkingIn === checkout.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <LogIn className="w-3 h-3" />
                      )}
                      Check In
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Equipment Card
// ---------------------------------------------------------------------------

function EquipmentCard({
  item,
  onEdit,
  onDelete,
  onCheckout,
  deleteConfirmId,
  setDeleteConfirmId,
}: {
  item: EquipmentItem;
  onEdit: (item: EquipmentItem) => void;
  onDelete: (id: string) => void;
  onCheckout: (item: EquipmentItem) => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
}) {
  const conditionCfg = item.condition ? CONDITION_CONFIG[item.condition] : null;
  const lowStock = isLowStock(item);
  const maintenanceDue = isMaintenanceDue(item.next_maintenance);
  const isRetired = item.condition === 'out_of_service';

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow border transition-shadow hover:shadow-md ${
        lowStock && !isRetired
          ? 'border-amber-300 dark:border-amber-700'
          : maintenanceDue && !isRetired
          ? 'border-orange-300 dark:border-orange-700'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate">
              {item.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.category}</p>
          </div>
          {conditionCfg && (
            <span
              className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${conditionCfg.badge}`}
            >
              {conditionCfg.label}
            </span>
          )}
        </div>

        {/* Quantity bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">Availability</span>
            <span
              className={`font-semibold ${
                item.available_quantity === 0
                  ? 'text-red-600 dark:text-red-400'
                  : lowStock
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-green-600 dark:text-green-400'
              }`}
            >
              {item.available_quantity} / {item.quantity}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                item.available_quantity === 0
                  ? 'bg-red-500'
                  : lowStock
                  ? 'bg-amber-500'
                  : 'bg-green-500'
              }`}
              style={{
                width: item.quantity > 0
                  ? `${(item.available_quantity / item.quantity) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </div>

        {/* Meta info */}
        <div className="space-y-1 mb-3">
          {item.location && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Location:</span> {item.location}
            </p>
          )}
          {item.next_maintenance && (
            <p
              className={`text-xs font-medium ${
                maintenanceDue
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Wrench className="inline w-3 h-3 mr-1" />
              Maintenance due: {formatDate(item.next_maintenance)}
            </p>
          )}
        </div>

        {/* Alert badges */}
        <div className="flex flex-wrap gap-1 mb-3">
          {lowStock && !isRetired && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              <AlertTriangle className="w-3 h-3" />
              Low Stock
            </span>
          )}
          {maintenanceDue && !isRetired && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
              <Wrench className="w-3 h-3" />
              Maintenance Due
            </span>
          )}
          {item.checked_out_quantity > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              <LogOut className="w-3 h-3" />
              {item.checked_out_quantity} out
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            {deleteConfirmId === item.id ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onDelete(item.id)}
                  className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirmId(item.id)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="inline-flex items-center gap-1.5">
            <button
              onClick={() => onCheckout(item)}
              disabled={item.available_quantity < 1 || isRetired}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Check Out
            </button>
            <HelpTooltip text="Track which items are currently checked out to students or labs. Items must be checked back in before the quantity is restored." />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EquipmentInventoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [checkouts, setCheckouts] = useState<CheckoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<EquipmentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkoutItem, setCheckoutItem] = useState<EquipmentItem | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Auth
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  const fetchEquipment = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/equipment');
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFetchError(data.error || 'Failed to load equipment');
      } else {
        setEquipment(data.equipment ?? []);
      }
    } catch (error) {
      console.error('Error fetching equipment:', error);
      setFetchError('Failed to load equipment. Please try again.');
    }
  }, []);

  const fetchActiveCheckouts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/equipment/checkout');
      const data = await res.json();
      if (data.success) {
        setCheckouts(data.checkouts ?? []);
      }
    } catch (error) {
      console.error('Error fetching checkouts:', error);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.email) fetchCurrentUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!canAccessAdmin(data.user.role)) {
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
        await Promise.all([fetchEquipment(), fetchActiveCheckouts()]);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  // Filtered equipment
  const filteredEquipment = equipment.filter((item) => {
    const matchesCategory =
      activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch =
      search === '' ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.location ?? '').toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group by category for display
  const categoriesInView = Array.from(
    new Set(filteredEquipment.map((e) => e.category))
  ).sort();

  // Alerts summary
  const lowStockCount = equipment.filter(
    (e) => isLowStock(e) && e.condition !== 'out_of_service'
  ).length;
  const maintenanceDueCount = equipment.filter(
    (e) => isMaintenanceDue(e.next_maintenance) && e.condition !== 'out_of_service'
  ).length;

  // Create / Update
  const handleSave = async (formData: EquipmentFormData) => {
    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category || null,
        quantity: parseInt(formData.quantity, 10),
        available_quantity: parseInt(formData.available_quantity, 10),
        description: formData.description || null,
        location: formData.location || null,
        condition: formData.condition || null,
        last_maintenance: formData.last_maintenance || null,
        next_maintenance: formData.next_maintenance || null,
      };

      const res = await fetch('/api/admin/equipment', {
        method: editItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editItem ? { id: editItem.id, ...payload } : payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');

      toast.success(editItem ? 'Equipment updated' : 'Equipment added');
      setShowModal(false);
      setEditItem(null);
      await fetchEquipment();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save equipment');
    }
    setSaving(false);
  };

  // Delete
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/equipment?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete');

      toast.success('Equipment deleted');
      setDeleteConfirmId(null);
      await fetchEquipment();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete equipment');
    }
  };

  // Checkout
  const handleCheckout = async (formData: CheckoutFormData) => {
    if (!checkoutItem) return;
    setCheckingOut(true);
    try {
      const res = await fetch('/api/admin/equipment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment_id: checkoutItem.id,
          quantity: parseInt(formData.quantity, 10),
          lab_day_id: formData.lab_day_id || null,
          notes: formData.notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to check out');

      toast.success('Equipment checked out');
      setShowCheckoutModal(false);
      setCheckoutItem(null);
      // Refresh equipment so available_quantity updates
      await fetchEquipment();
      // Also add the new checkout to the local state for the active panel
      if (data.checkout) {
        setCheckouts((prev) => [...prev, data.checkout]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to check out equipment');
    }
    setCheckingOut(false);
  };

  // Check-in
  const handleCheckIn = async (checkoutId: string) => {
    setCheckingIn(checkoutId);
    try {
      const res = await fetch('/api/admin/equipment/checkout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkout_id: checkoutId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to check in');

      toast.success('Equipment checked in');
      // Mark as checked in locally
      setCheckouts((prev) =>
        prev.map((c) =>
          c.id === checkoutId
            ? { ...c, checked_in_at: new Date().toISOString(), checked_in_by: currentUser?.email ?? '' }
            : c
        )
      );
      // Refresh equipment for updated available_quantity
      await fetchEquipment();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to check in equipment');
    }
    setCheckingIn(null);
  };

  const openCreate = () => {
    setEditItem(null);
    setShowModal(true);
  };

  const openEdit = (item: EquipmentItem) => {
    setEditItem(item);
    setShowModal(true);
  };

  const openCheckout = (item: EquipmentItem) => {
    setCheckoutItem(item);
    setShowCheckoutModal(true);
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
            onClick={() => { setFetchError(null); fetchEquipment(); }}
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
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Equipment Inventory</span>
          </div>

          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    Equipment Inventory
                  </h1>
                  <div className="group relative inline-flex items-center">
                    <Info className="h-4 w-4 text-gray-400 hover:text-blue-500 cursor-help ml-2" />
                    <div className="invisible group-hover:visible absolute left-6 top-0 z-50 w-72 p-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg">
                      <div className="absolute -left-1 top-2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
                      Track lab equipment inventory, condition, and checkout status. Set low stock thresholds for automatic alerts.
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Track and manage lab equipment, availability, and checkouts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <ThemeToggle />
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Equipment
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Alert banners */}
        {(lowStockCount > 0 || maintenanceDueCount > 0) && (
          <div className="flex flex-col sm:flex-row gap-3">
            {lowStockCount > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex-1">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-semibold">{lowStockCount} item{lowStockCount !== 1 ? 's' : ''}</span>{' '}
                  low in stock (fewer than 2 available)
                </p>
              </div>
            )}
            {maintenanceDueCount > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex-1">
                <Wrench className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  <span className="font-semibold">{maintenanceDueCount} item{maintenanceDueCount !== 1 ? 's' : ''}</span>{' '}
                  have maintenance due within 30 days
                </p>
              </div>
            )}
          </div>
        )}

        {/* Active checkouts panel */}
        {checkouts.filter((c) => !c.checked_in_at).length > 0 && (
          <ActiveCheckoutsPanel
            checkouts={checkouts}
            equipment={equipment}
            onCheckIn={handleCheckIn}
            checkingIn={checkingIn}
          />
        )}

        {/* Search + category filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or location..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value as Category)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Equipment list */}
        {filteredEquipment.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <EmptyState
              icon={Package}
              title={equipment.length === 0 ? 'No equipment tracked' : 'No equipment matches filters'}
              message={equipment.length === 0 ? 'Add your first equipment item to start tracking inventory.' : 'Try adjusting your search or filter criteria.'}
              actionLabel={equipment.length === 0 ? 'Add Item' : undefined}
              onAction={equipment.length === 0 ? openCreate : undefined}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {categoriesInView.map((category) => {
              const categoryItems = filteredEquipment.filter(
                (e) => e.category === category
              );
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      {category}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      {categoryItems.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {categoryItems.map((item) => (
                      <EquipmentCard
                        key={item.id}
                        item={item}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        onCheckout={openCheckout}
                        deleteConfirmId={deleteConfirmId}
                        setDeleteConfirmId={setDeleteConfirmId}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary stats */}
        {equipment.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Items',
                value: equipment.length,
                color: 'text-blue-600 dark:text-blue-400',
              },
              {
                label: 'Total Units',
                value: equipment.reduce((s, e) => s + e.quantity, 0),
                color: 'text-gray-900 dark:text-white',
              },
              {
                label: 'Available',
                value: equipment.reduce((s, e) => s + e.available_quantity, 0),
                color: 'text-green-600 dark:text-green-400',
              },
              {
                label: 'Checked Out',
                value: equipment.reduce((s, e) => s + e.checked_out_quantity, 0),
                color: 'text-amber-600 dark:text-amber-400',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 text-center"
              >
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Equipment Add/Edit Modal */}
      <EquipmentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditItem(null);
        }}
        onSave={handleSave}
        editItem={editItem}
        saving={saving}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => {
          setShowCheckoutModal(false);
          setCheckoutItem(null);
        }}
        onCheckout={handleCheckout}
        item={checkoutItem}
        saving={checkingOut}
      />
    </div>
  );
}
