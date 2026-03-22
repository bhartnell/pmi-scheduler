'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Settings,
  Building2,
  Bell,
  BellOff,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  Save,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { canEditClinical, canAccessClinical, type Role } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';

interface ClinicalSite {
  id: string;
  name: string;
  abbreviation: string;
  system: string | null;
  is_active: boolean;
  visit_monitoring_enabled: boolean;
  visit_alert_days: number;
  visit_urgent_days: number;
}

export default function SiteVisitSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [sites, setSites] = useState<ClinicalSite[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit state: track unsaved changes per site
  const [editedSites, setEditedSites] = useState<Record<string, Partial<ClinicalSite>>>({});

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      // Fetch all clinical sites (including inactive to show full list)
      const res = await fetch('/api/clinical/sites?activeOnly=false');
      const data = await res.json();
      if (data.success) {
        setSites(data.sites || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setErrorMessage('Failed to load clinical sites');
    }
    setLoading(false);
  };

  const getEditedValue = <K extends keyof ClinicalSite>(siteId: string, field: K): ClinicalSite[K] => {
    const edited = editedSites[siteId];
    if (edited && edited[field] !== undefined) {
      return edited[field] as ClinicalSite[K];
    }
    const site = sites.find(s => s.id === siteId);
    return site ? site[field] : (undefined as unknown as ClinicalSite[K]);
  };

  const setEditedField = (siteId: string, field: keyof ClinicalSite, value: unknown) => {
    setEditedSites(prev => ({
      ...prev,
      [siteId]: {
        ...prev[siteId],
        [field]: value,
      },
    }));
  };

  const hasChanges = (siteId: string): boolean => {
    const edited = editedSites[siteId];
    if (!edited) return false;
    const site = sites.find(s => s.id === siteId);
    if (!site) return false;

    for (const [key, value] of Object.entries(edited)) {
      if (site[key as keyof ClinicalSite] !== value) return true;
    }
    return false;
  };

  const handleSave = async (siteId: string) => {
    const edited = editedSites[siteId];
    if (!edited) return;

    // Validate alert_days < urgent_days
    const alertDays = (edited.visit_alert_days ?? sites.find(s => s.id === siteId)?.visit_alert_days) || 14;
    const urgentDays = (edited.visit_urgent_days ?? sites.find(s => s.id === siteId)?.visit_urgent_days) || 28;

    if (alertDays >= urgentDays) {
      setErrorMessage('Alert days must be less than urgent days');
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    if (alertDays < 1 || urgentDays < 1) {
      setErrorMessage('Thresholds must be at least 1 day');
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    setSaving(siteId);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/clinical/sites/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edited),
      });

      const data = await res.json();

      if (data.success) {
        // Update local state
        setSites(prev =>
          prev.map(s => (s.id === siteId ? { ...s, ...edited } : s))
        );
        // Clear edited state for this site
        setEditedSites(prev => {
          const next = { ...prev };
          delete next[siteId];
          return next;
        });
        setSuccessMessage(`${sites.find(s => s.id === siteId)?.name} settings saved`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrorMessage(data.error || 'Failed to save settings');
        setTimeout(() => setErrorMessage(null), 4000);
      }
    } catch (error) {
      console.error('Error saving site settings:', error);
      setErrorMessage('Failed to save settings');
      setTimeout(() => setErrorMessage(null), 4000);
    }

    setSaving(null);
  };

  const handleDiscard = (siteId: string) => {
    setEditedSites(prev => {
      const next = { ...prev };
      delete next[siteId];
      return next;
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const canEdit = userRole && canEditClinical(userRole);
  const activeSites = sites.filter(s => s.is_active);
  const inactiveSites = sites.filter(s => !s.is_active);
  const monitoredCount = sites.filter(s => s.visit_monitoring_enabled && s.is_active).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <Settings className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Site Visit Alert Settings</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Configure which sites are monitored and when alerts are sent
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Success / Error Messages */}
        {successMessage && (
          <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg flex items-center gap-2 text-green-800 dark:text-green-200">
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="w-5 h-5" />
            {errorMessage}
            <button onClick={() => setErrorMessage(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Summary Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
              <Bell className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Monitoring Summary
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {monitoredCount} of {activeSites.length} active sites are being monitored for visit reminders
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-400">
            <p>
              The daily cron job checks monitored sites and sends alerts when a site hasn&apos;t been visited within
              its configured thresholds. Each site can have its own warning and urgent alert timing.
            </p>
          </div>
        </div>

        {/* Active Sites */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              Active Clinical Sites ({activeSites.length})
            </h2>
          </div>

          {activeSites.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No active clinical sites found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {activeSites.map((site) => {
                const monitoringEnabled = getEditedValue(site.id, 'visit_monitoring_enabled');
                const alertDays = getEditedValue(site.id, 'visit_alert_days') ?? 14;
                const urgentDays = getEditedValue(site.id, 'visit_urgent_days') ?? 28;
                const changed = hasChanges(site.id);
                const isSaving = saving === site.id;

                return (
                  <div key={site.id} className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      {/* Site Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          monitoringEnabled
                            ? 'bg-teal-100 dark:bg-teal-900/30'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          {monitoringEnabled ? (
                            <Bell className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                          ) : (
                            <BellOff className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                              {site.name}
                            </h3>
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded font-mono flex-shrink-0">
                              {site.abbreviation}
                            </span>
                            {/* Monitoring status badge */}
                            {monitoringEnabled ? (
                              <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs rounded-full flex-shrink-0">
                                Monitored
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full flex-shrink-0">
                                Not monitored
                              </span>
                            )}
                          </div>
                          {site.system && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {site.system}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Save / Discard Buttons */}
                      {canEdit && changed && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleDiscard(site.id)}
                            disabled={isSaving}
                            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            Discard
                          </button>
                          <button
                            onClick={() => handleSave(site.id)}
                            disabled={isSaving}
                            className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {isSaving ? (
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            Save
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Configuration Controls */}
                    {canEdit && (
                      <div className="mt-4 flex flex-wrap items-center gap-6">
                        {/* Monitoring Toggle */}
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={monitoringEnabled}
                              onChange={(e) => setEditedField(site.id, 'visit_monitoring_enabled', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-checked:bg-teal-600 rounded-full transition-colors"></div>
                            <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Monitor site visits
                          </span>
                        </label>

                        {/* Alert Days */}
                        <div className={`flex items-center gap-2 ${!monitoringEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            Warning after
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={alertDays}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d+$/.test(val)) {
                                setEditedField(site.id, 'visit_alert_days', val === '' ? '' : parseInt(val));
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value);
                              if (!val || val < 1) setEditedField(site.id, 'visit_alert_days', 14);
                            }}
                            className="w-16 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">days</span>
                        </div>

                        {/* Urgent Days */}
                        <div className={`flex items-center gap-2 ${!monitoringEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                          <Clock className="w-4 h-4 text-red-500" />
                          <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            Urgent after
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={urgentDays}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d+$/.test(val)) {
                                setEditedField(site.id, 'visit_urgent_days', val === '' ? '' : parseInt(val));
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value);
                              if (!val || val < 1) setEditedField(site.id, 'visit_urgent_days', 28);
                            }}
                            className="w-16 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">days</span>
                        </div>
                      </div>
                    )}

                    {/* Read-only view for non-editors */}
                    {!canEdit && (
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          Warning: {alertDays} days
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-red-500" />
                          Urgent: {urgentDays} days
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Inactive Sites */}
        {inactiveSites.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden opacity-75">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Inactive Sites ({inactiveSites.length})
              </h2>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Inactive sites are never checked regardless of monitoring settings
              </p>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {inactiveSites.map((site) => (
                <div key={site.id} className="px-6 py-4 flex items-center gap-3">
                  <BellOff className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                  <span className="text-gray-500 dark:text-gray-400">{site.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                    {site.abbreviation}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-xs rounded-full">
                    Inactive
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
