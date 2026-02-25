'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

interface ExpiryCert {
  id: string;
  cert_name: string;
  expiration_date: string;
  issuing_body: string | null;
  days_remaining: number;
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatExpiryDate(dateString: string): string {
  return parseLocalDate(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getCertStyle(daysRemaining: number): {
  row: string;
  badge: string;
  label: string;
} {
  if (daysRemaining < 0) {
    return {
      row: 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10',
      badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
      label: `Expired ${Math.abs(daysRemaining)}d ago`,
    };
  }
  if (daysRemaining <= 30) {
    return {
      row: 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10',
      badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
      label: `${daysRemaining}d left`,
    };
  }
  if (daysRemaining <= 60) {
    return {
      row: 'border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-900/10',
      badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
      label: `${daysRemaining}d left`,
    };
  }
  // 61-90 days
  return {
    row: 'border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/10',
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    label: `${daysRemaining}d left`,
  };
}

export default function CertExpiryWidget() {
  const { data: session } = useSession();
  const [certifications, setCertifications] = useState<ExpiryCert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCerts = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/cert-expiry');
      if (res.ok) {
        const data = await res.json();
        setCertifications(data.certifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch cert expiry data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetchCerts();
  }, [session?.user?.email, fetchCerts]);

  const displayed = certifications.slice(0, 5);
  const totalCount = certifications.length;

  return (
    <WidgetCard
      title="Certification Alerts"
      icon={<Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      viewAllLink="/instructor/certifications"
      viewAllText="View All"
      loading={loading}
    >
      {certifications.length === 0 ? (
        <WidgetEmpty
          icon={<ShieldCheck className="w-10 h-10 mx-auto text-green-500 dark:text-green-400" />}
          message="All certifications current"
        />
      ) : (
        <div className="space-y-2">
          {totalCount > 5 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Showing 5 of {totalCount} expiring certifications
            </p>
          )}
          {displayed.map((cert) => {
            const style = getCertStyle(cert.days_remaining);
            return (
              <div
                key={cert.id}
                className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border ${style.row}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {cert.cert_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Expires {formatExpiryDate(cert.expiration_date)}
                    </p>
                  </div>
                </div>
                <span
                  className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap ${style.badge}`}
                >
                  {style.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
