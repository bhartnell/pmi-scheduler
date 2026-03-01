'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Plus,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  RefreshCw,
  Building2,
  Wrench,
  FlaskConical,
  Package,
  MapPin,
  Users,
  AlertCircle,
  ChevronDown,
  Settings,
  Calendar,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { hasMinRole } from '@/lib/permissions';
import type { CurrentUser } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookableResource {
  id: string;
  name: string;
  type: 'room' | 'equipment' | 'sim_lab' | 'other';
  description: string | null;
  location: string | null;
  capacity: number | null;
  is_active: boolean;
  requires_approval: boolean;
  created_at: string;
}

interface ResourceBooking {
  id: string;
  resource_id: string;
  booked_by: string;
  title: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes: string | null;
  approved_by: string | null;
  created_at: string;
  resource?: BookableResource;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RESOURCE_TYPE_CONFIG: Record<
  BookableResource['type'],
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  room: { label: 'Room', icon: Building2, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  equipment: { label: 'Equipment', icon: Wrench, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  sim_lab: { label: 'Sim Lab', icon: FlaskConical, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  other: { label: 'Other', icon: Package, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
};

const STATUS_CONFIG: Record<
  ResourceBooking['status'],
  { label: string; bg: string; text: string; icon: React.ElementType }
> = {
  pending: {
    label: 'Pending Approval',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-500 dark:text-gray-400',
    icon: XCircle,
  },
};

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am–9pm
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateHeader(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toLocalDatetimeValue(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getBookingPosition(booking: ResourceBooking, dayStart: Date): { top: number; height: number } | null {
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  const dayStartHour = 7; // matches HOURS array start
  const totalHours = 15; // 7am-9pm = 15 hours

  const startOfDay = new Date(dayStart);
  startOfDay.setHours(dayStartHour, 0, 0, 0);
  const endOfDay = new Date(dayStart);
  endOfDay.setHours(dayStartHour + totalHours, 0, 0, 0);

  // Check if booking overlaps with this day
  if (end <= startOfDay || start >= endOfDay) return null;

  const clampedStart = start < startOfDay ? startOfDay : start;
  const clampedEnd = end > endOfDay ? endOfDay : end;

  const startMinutes = (clampedStart.getTime() - startOfDay.getTime()) / 60000;
  const durationMinutes = (clampedEnd.getTime() - clampedStart.getTime()) / 60000;
  const totalMinutes = totalHours * 60;

  const top = (startMinutes / totalMinutes) * 100;
  const height = Math.max((durationMinutes / totalMinutes) * 100, 2);

  return { top, height };
}

// ─── Resource Form Modal ──────────────────────────────────────────────────────

interface ResourceFormProps {
  onClose: () => void;
  onSave: () => void;
  editResource?: BookableResource | null;
}

function ResourceFormModal({ onClose, onSave, editResource }: ResourceFormProps) {
  const toast = useToast();
  const [name, setName] = useState(editResource?.name || '');
  const [type, setType] = useState<BookableResource['type']>(editResource?.type || 'room');
  const [description, setDescription] = useState(editResource?.description || '');
  const [location, setLocation] = useState(editResource?.location || '');
  const [capacity, setCapacity] = useState(editResource?.capacity?.toString() || '');
  const [requiresApproval, setRequiresApproval] = useState(editResource?.requires_approval || false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !type) return;
    setSaving(true);
    try {
      const body = { name, type, description, location, capacity, requires_approval: requiresApproval };
      let res;
      if (editResource) {
        res = await fetch('/api/scheduling/resource-bookings/resources', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editResource.id, ...body }),
        });
      } else {
        res = await fetch('/api/scheduling/resource-bookings/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (data.success) {
        toast.success(editResource ? 'Resource updated' : 'Resource created');
        onSave();
        onClose();
      } else {
        toast.error(data.error || 'Failed to save resource');
      }
    } catch {
      toast.error('Failed to save resource');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editResource ? 'Edit Resource' : 'Add Resource'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="e.g., Sim Lab A, ALS Ambulance Bay"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={type}
                onChange={e => setType(e.target.value as BookableResource['type'])}
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none pr-8 focus:ring-2 focus:ring-blue-500"
              >
                <option value="room">Room</option>
                <option value="equipment">Equipment</option>
                <option value="sim_lab">Sim Lab</option>
                <option value="other">Other</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g., Building B, Room 201"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Capacity
            </label>
            <input
              type="number"
              value={capacity}
              onChange={e => setCapacity(e.target.value)}
              min="1"
              placeholder="Maximum occupancy"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="requires_approval"
              checked={requiresApproval}
              onChange={e => setRequiresApproval(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="requires_approval" className="text-sm text-gray-700 dark:text-gray-300">
              Requires admin approval for bookings
            </label>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !name || !type}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Saving...' : editResource ? 'Save Changes' : 'Add Resource'}
            </button>
            <button type="button" onClick={onClose} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Booking Form Modal ───────────────────────────────────────────────────────

interface BookingFormProps {
  resources: BookableResource[];
  selectedResourceId: string | null;
  onClose: () => void;
  onSave: () => void;
  defaultDate?: string;
}

function BookingFormModal({ resources, selectedResourceId, onClose, onSave, defaultDate }: BookingFormProps) {
  const toast = useToast();

  const defaultStart = defaultDate
    ? `${defaultDate}T09:00`
    : toLocalDatetimeValue(new Date(Date.now() + 3600000).toISOString());

  const defaultEnd = defaultDate
    ? `${defaultDate}T10:00`
    : toLocalDatetimeValue(new Date(Date.now() + 7200000).toISOString());

  const [resourceId, setResourceId] = useState(selectedResourceId || '');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedResource = resources.find(r => r.id === resourceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceId || !title || !startTime || !endTime) return;

    const startISO = new Date(startTime).toISOString();
    const endISO = new Date(endTime).toISOString();

    if (new Date(endISO) <= new Date(startISO)) {
      toast.error('End time must be after start time');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/scheduling/resource-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_id: resourceId,
          title,
          start_time: startISO,
          end_time: endISO,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          data.booking.status === 'pending'
            ? 'Booking submitted — pending approval'
            : 'Resource booked successfully'
        );
        onSave();
        onClose();
      } else {
        toast.error(data.error || 'Failed to create booking');
      }
    } catch {
      toast.error('Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const activeResources = resources.filter(r => r.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Book a Resource</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Resource <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={resourceId}
                onChange={e => setResourceId(e.target.value)}
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none pr-8 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a resource...</option>
                {activeResources.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.location ? ` — ${r.location}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            {selectedResource?.requires_approval && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                This resource requires approval — booking will be pending until reviewed.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Booking Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="e.g., ACLS Skills Practice, Cohort 12 Lab"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional details..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting || !resourceId || !title || !startTime || !endTime}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {submitting ? 'Booking...' : 'Book Resource'}
            </button>
            <button type="button" onClick={onClose} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Weekly Calendar View ─────────────────────────────────────────────────────

interface WeeklyCalendarProps {
  bookings: ResourceBooking[];
  weekStart: Date;
  onApprove: (booking: ResourceBooking) => void;
  onCancel: (booking: ResourceBooking) => void;
  currentUserEmail: string;
  isAdmin: boolean;
}

function WeeklyCalendar({ bookings, weekStart, onApprove, onCancel, currentUserEmail, isAdmin }: WeeklyCalendarProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Day headers */}
        <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700">
          <div className="py-2 pr-2 text-right text-xs text-gray-400 dark:text-gray-500 w-14">
            {/* time column header */}
          </div>
          {days.map((day, i) => {
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <div
                key={i}
                className={`py-2 px-1 text-center text-xs font-semibold border-l border-gray-200 dark:border-gray-700 ${
                  isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <div>{DAYS_OF_WEEK[day.getDay()]}</div>
                <div className={`text-base font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                  {day.getDate()}
                </div>
                <div className="text-gray-400 dark:text-gray-500 font-normal">{formatDateHeader(day)}</div>
              </div>
            );
          })}
        </div>

        {/* Time slots */}
        <div className="relative">
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-gray-100 dark:border-gray-700/50" style={{ height: '60px' }}>
              <div className="flex items-start justify-end pr-2 pt-0.5 text-xs text-gray-400 dark:text-gray-500 w-14 flex-shrink-0">
                {hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : `${hour}am`}
              </div>
              {days.map((_, di) => (
                <div
                  key={di}
                  className="border-l border-gray-100 dark:border-gray-700/50 relative"
                />
              ))}
            </div>
          ))}

          {/* Booking overlays */}
          {days.map((day, di) => {
            const dayBookings = bookings.filter(b => {
              const bStart = new Date(b.start_time);
              return bStart.toDateString() === day.toDateString();
            });

            return dayBookings.map(booking => {
              const pos = getBookingPosition(booking, day);
              if (!pos) return null;

              const statusCfg = STATUS_CONFIG[booking.status];
              const isOwn = booking.booked_by === currentUserEmail;
              const canAct = isAdmin || isOwn;

              const colStart = di + 2; // grid-cols-8: col 1 = time, cols 2-8 = days
              const totalHours = 15;

              const topPx = (pos.top / 100) * (totalHours * 60);
              const heightPx = Math.max((pos.height / 100) * (totalHours * 60), 20);

              return (
                <div
                  key={booking.id}
                  className="absolute group"
                  style={{
                    gridColumn: colStart,
                    top: `${topPx}px`,
                    height: `${heightPx}px`,
                    left: `calc(${(di + 1) / 8 * 100}% + 2px)`,
                    width: `calc(${1 / 8 * 100}% - 4px)`,
                  }}
                >
                  <div
                    className={`h-full rounded px-1.5 py-0.5 text-xs overflow-hidden border-l-2 cursor-default ${
                      booking.status === 'confirmed'
                        ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 dark:border-blue-400'
                        : booking.status === 'pending'
                        ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-500'
                        : 'bg-gray-100 dark:bg-gray-700 border-gray-400 line-through opacity-60'
                    }`}
                  >
                    <div className="font-semibold text-gray-900 dark:text-white truncate">{booking.title}</div>
                    <div className="text-gray-500 dark:text-gray-400 truncate">
                      {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                    </div>
                    <div className={`inline-flex items-center gap-0.5 mt-0.5 ${statusCfg.text}`}>
                      <statusCfg.icon className="w-3 h-3" />
                      <span>{statusCfg.label}</span>
                    </div>

                    {/* Action buttons - shown on hover if user can act */}
                    {canAct && booking.status !== 'cancelled' && (
                      <div className="hidden group-hover:flex items-center gap-1 mt-1 flex-wrap">
                        {isAdmin && booking.status === 'pending' && (
                          <button
                            onClick={() => onApprove(booking)}
                            className="px-1.5 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => onCancel(booking)}
                          className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function ResourceBookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [resources, setResources] = useState<BookableResource[]>([]);
  const [bookings, setBookings] = useState<ResourceBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));

  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [editingResource, setEditingResource] = useState<BookableResource | null>(null);
  const [showManageResources, setShowManageResources] = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) fetchCurrentUser();
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) setCurrentUser(data.user);
    } catch (err) {
      console.error('Error fetching user:', err);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = currentUser ? hasMinRole(currentUser.role, 'admin') : false;

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchResources = useCallback(async () => {
    try {
      const params = new URLSearchParams({ active_only: 'false' });
      if (typeFilter) params.set('type', typeFilter);
      const res = await fetch(`/api/scheduling/resource-bookings/resources?${params}`);
      const data = await res.json();
      if (data.success) setResources(data.resources);
    } catch (err) {
      console.error('Error fetching resources:', err);
    }
  }, [typeFilter]);

  const fetchBookings = useCallback(async () => {
    if (!selectedResourceId) {
      setBookings([]);
      return;
    }
    setBookingsLoading(true);
    try {
      const weekEnd = addDays(weekStart, 7);
      const params = new URLSearchParams({
        resource_id: selectedResourceId,
        date_from: weekStart.toISOString(),
        date_to: weekEnd.toISOString(),
      });
      const res = await fetch(`/api/scheduling/resource-bookings?${params}`);
      const data = await res.json();
      if (data.success) setBookings(data.bookings);
      else toast.error(data.error || 'Failed to load bookings');
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setBookingsLoading(false);
    }
  }, [selectedResourceId, weekStart, toast]);

  useEffect(() => { fetchResources(); }, [fetchResources]);
  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // ── Booking actions ────────────────────────────────────────────────────────

  const handleApprove = async (booking: ResourceBooking) => {
    if (!confirm(`Approve booking "${booking.title}"?`)) return;
    try {
      const res = await fetch(`/api/scheduling/resource-bookings/${booking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Booking approved');
        fetchBookings();
      } else {
        toast.error(data.error || 'Failed to approve booking');
      }
    } catch {
      toast.error('Failed to approve booking');
    }
  };

  const handleCancel = async (booking: ResourceBooking) => {
    if (!confirm(`Cancel booking "${booking.title}"?`)) return;
    try {
      const res = await fetch(`/api/scheduling/resource-bookings/${booking.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Booking cancelled');
        fetchBookings();
      } else {
        toast.error(data.error || 'Failed to cancel booking');
      }
    } catch {
      toast.error('Failed to cancel booking');
    }
  };

  // ── Week navigation ────────────────────────────────────────────────────────

  const prevWeek = () => setWeekStart(prev => addDays(prev, -7));
  const nextWeek = () => setWeekStart(prev => addDays(prev, 7));
  const goToToday = () => setWeekStart(getWeekStart(new Date()));

  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // ── Filtered resources ────────────────────────────────────────────────────

  const filteredResources = resources.filter(r => {
    if (typeFilter && r.type !== typeFilter) return false;
    return true;
  });

  const selectedResource = resources.find(r => r.id === selectedResourceId);

  const pendingBookings = bookings.filter(b => b.status === 'pending');

  // ── Render ────────────────────────────────────────────────────────────────

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
                <div className="hidden sm:block">
                  <div className="font-bold text-lg leading-tight dark:text-white">PMI Paramedic Tools</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Resource Bookings</div>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">{session.user?.email}</span>
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-gray-400" />
            <Link href="/scheduling" className="hover:text-blue-600 dark:hover:text-blue-400">Scheduling</Link>
            <ChevronRight className="w-3 h-3 text-gray-400" />
            <span className="text-gray-900 dark:text-white">Resource Bookings</span>
          </div>

          {/* Title row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Calendar className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Resource Bookings</h1>
              {isAdmin && pendingBookings.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500 text-white">
                  {pendingBookings.length} pending
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => setShowManageResources(!showManageResources)}
                  className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Manage Resources
                </button>
              )}
              <button
                onClick={() => setShowBookingForm(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Book Resource
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Manage Resources Panel (admin) */}
        {isAdmin && showManageResources && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-amber-200 dark:border-amber-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Manage Bookable Resources
              </h2>
              <button
                onClick={() => { setEditingResource(null); setShowResourceForm(true); }}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Resource
              </button>
            </div>
            {resources.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No resources created yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {resources.map(r => {
                  const typeCfg = RESOURCE_TYPE_CONFIG[r.type];
                  const TypeIcon = typeCfg.icon;
                  return (
                    <div
                      key={r.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        r.is_active
                          ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-750'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 opacity-60'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeCfg.bg}`}>
                        <TypeIcon className={`w-4 h-4 ${typeCfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{r.name}</span>
                          {!r.is_active && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded">Inactive</span>
                          )}
                          {r.requires_approval && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">Approval req.</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{typeCfg.label}</div>
                        {r.location && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {r.location}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { setEditingResource(r); setShowResourceForm(true); }}
                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex-shrink-0"
                        title="Edit resource"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Two-panel layout */}
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Left panel: Resource list */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm self-start">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Resources</h2>
              {/* Type filter */}
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none pr-7 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All types</option>
                  <option value="room">Rooms</option>
                  <option value="equipment">Equipment</option>
                  <option value="sim_lab">Sim Labs</option>
                  <option value="other">Other</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {filteredResources.length === 0 ? (
              <div className="p-6 text-center">
                <Package className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No resources found</p>
                {isAdmin && (
                  <button
                    onClick={() => { setEditingResource(null); setShowResourceForm(true); setShowManageResources(true); }}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Add a resource
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredResources.map(resource => {
                  const typeCfg = RESOURCE_TYPE_CONFIG[resource.type];
                  const TypeIcon = typeCfg.icon;
                  const isSelected = selectedResourceId === resource.id;
                  return (
                    <li key={resource.id}>
                      <button
                        onClick={() => setSelectedResourceId(isSelected ? null : resource.id)}
                        className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-750'
                        } ${!resource.is_active ? 'opacity-50' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeCfg.bg}`}>
                          <TypeIcon className={`w-4 h-4 ${typeCfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                              {resource.name}
                            </span>
                            {resource.requires_approval && (
                              <span className="text-xs px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded">Approval</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{typeCfg.label}</div>
                          {resource.location && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{resource.location}</span>
                            </div>
                          )}
                          {resource.capacity && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                              <Users className="w-3 h-3" />
                              <span>Cap. {resource.capacity}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Right panel: Calendar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            {!selectedResourceId ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Calendar className="w-14 h-14 text-gray-200 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">Select a resource to view its calendar</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Choose a room, sim lab, or equipment from the list on the left.
                </p>
              </div>
            ) : (
              <>
                {/* Calendar header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      {selectedResource?.name}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{weekLabel}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={prevWeek}
                      className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={goToToday}
                      className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Today
                    </button>
                    <button
                      onClick={nextWeek}
                      className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={fetchBookings}
                      disabled={bookingsLoading}
                      className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ml-1"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-4 h-4 ${bookingsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Calendar grid */}
                {bookingsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                  </div>
                ) : (
                  <WeeklyCalendar
                    bookings={bookings}
                    weekStart={weekStart}
                    onApprove={handleApprove}
                    onCancel={handleCancel}
                    currentUserEmail={currentUser.email}
                    isAdmin={isAdmin}
                  />
                )}

                {/* Booking list below calendar */}
                {bookings.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                      This Week&apos;s Bookings
                    </h3>
                    <div className="space-y-2">
                      {bookings.map(b => {
                        const statusCfg = STATUS_CONFIG[b.status];
                        const StatusIcon = statusCfg.icon;
                        const isOwn = b.booked_by === currentUser.email;
                        const canAct = isAdmin || isOwn;
                        return (
                          <div
                            key={b.id}
                            className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{b.title}</span>
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {statusCfg.label}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {formatDateTime(b.start_time)} – {formatTime(b.end_time)}
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500">{b.booked_by}</div>
                              {b.notes && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-0.5">{b.notes}</div>
                              )}
                            </div>
                            {canAct && b.status !== 'cancelled' && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {isAdmin && b.status === 'pending' && (
                                  <button
                                    onClick={() => handleApprove(b)}
                                    className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-lg"
                                    title="Approve booking"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleCancel(b)}
                                  className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg"
                                  title="Cancel booking"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {showBookingForm && (
        <BookingFormModal
          resources={resources}
          selectedResourceId={selectedResourceId}
          onClose={() => setShowBookingForm(false)}
          onSave={fetchBookings}
        />
      )}

      {showResourceForm && (
        <ResourceFormModal
          editResource={editingResource}
          onClose={() => { setShowResourceForm(false); setEditingResource(null); }}
          onSave={fetchResources}
        />
      )}
    </div>
  );
}
