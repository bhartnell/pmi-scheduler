'use client';

import { useState, useEffect, type ReactNode } from 'react';
import ConsentModal from '@/components/ConsentModal';
import type { AgreementType } from '@/lib/ferpa';

interface ConsentGateProps {
  agreementType: AgreementType;
  children: ReactNode;
}

/**
 * Wrapper component that blocks page content until the user accepts the required agreement.
 * Caches acceptance in sessionStorage to avoid re-checking on every navigation.
 *
 * Usage:
 *   <ConsentGate agreementType="student_data_use">
 *     <MyProtectedPage />
 *   </ConsentGate>
 */
export default function ConsentGate({ agreementType, children }: ConsentGateProps) {
  const [status, setStatus] = useState<'loading' | 'needs_consent' | 'accepted'>('loading');
  const [agreementText, setAgreementText] = useState('');
  const [agreementVersion, setAgreementVersion] = useState(1);

  useEffect(() => {
    // Check sessionStorage cache first
    const cacheKey = `ferpa_consent_${agreementType}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached === 'accepted') {
      setStatus('accepted');
      return;
    }

    // Fetch agreement status from API
    async function checkConsent() {
      try {
        const res = await fetch(`/api/ferpa/agreement?type=${agreementType}`);
        if (!res.ok) {
          // If API fails, allow access (fail open for non-blocking)
          console.error('Failed to check consent status');
          setStatus('accepted');
          return;
        }

        const data = await res.json();

        if (data.accepted) {
          sessionStorage.setItem(cacheKey, 'accepted');
          setStatus('accepted');
        } else {
          setAgreementText(data.text);
          setAgreementVersion(data.version);
          setStatus('needs_consent');
        }
      } catch (error) {
        console.error('Error checking consent:', error);
        // Fail open — don't block access if the check itself fails
        setStatus('accepted');
      }
    }

    checkConsent();
  }, [agreementType]);

  const handleAccept = () => {
    const cacheKey = `ferpa_consent_${agreementType}`;
    sessionStorage.setItem(cacheKey, 'accepted');
    setStatus('accepted');
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (status === 'needs_consent') {
    return (
      <ConsentModal
        agreementType={agreementType}
        agreementText={agreementText}
        version={agreementVersion}
        onAccept={handleAccept}
      />
    );
  }

  return <>{children}</>;
}
