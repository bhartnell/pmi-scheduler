'use client';

/**
 * TwoFactorPanel - TOTP-based 2FA setup/management panel for the Settings page.
 *
 * Flow:
 *   1. Idle: shows status + "Set Up 2FA" or "Disable 2FA" button
 *   2. Setup: calls POST /api/settings/2fa/setup -> shows QR code + manual entry
 *   3. Verify: user enters 6-digit code -> calls POST /api/settings/2fa/verify
 *   4. Backup codes: shown once after successful verification
 *   5. Disable: requires TOTP or backup code confirmation
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Copy,
  Download,
  Check,
  KeyRound,
  AlertTriangle,
  X,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/components/Toast';

// ---- Types ----

type PanelStep = 'idle' | 'setup' | 'verify' | 'backup_codes' | 'disable';

interface TwoFAStatus {
  is_enabled: boolean;
  required: boolean;
  backup_codes_remaining: number;
}

// ---- QR Code renderer (pure SVG, no external libs) ----

/**
 * Renders a minimal QR code-like display with the OTPAuth URI.
 * Since we cannot use external QR libraries, we display:
 *  - A clickable deep-link (opens authenticator apps on mobile)
 *  - The raw secret for manual entry
 *  - A copy button for the URI
 *
 * Note: For a production build a proper QR code library would be added.
 * The spec allows the deep-links QR endpoint if available.
 */
function QRCodeDisplay({ uri, secret }: { uri: string; secret: string }) {
  const toast = useToast();
  const [copiedUri, setCopiedUri] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const copyToClipboard = async (text: string, type: 'uri' | 'secret') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'uri') {
        setCopiedUri(true);
        setTimeout(() => setCopiedUri(false), 2000);
      } else {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      }
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  // Format secret in groups of 4 for readability
  const formattedSecret = secret.replace(/(.{4})/g, '$1 ').trim();

  return (
    <div className="space-y-4">
      {/* QR placeholder — open in authenticator app */}
      <div className="flex flex-col items-center gap-3 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <KeyRound className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="text-center">
          <p className="font-medium text-gray-900 dark:text-white text-sm">
            Add to Authenticator App
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
            Open your authenticator app (Google Authenticator, Authy, etc.) and scan
            the QR code or enter the key manually below.
          </p>
        </div>
        {/* Deep-link button — opens authenticator apps on mobile */}
        <a
          href={uri}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <KeyRound className="w-4 h-4" />
          Open in Authenticator App
        </a>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          On desktop: tap this link on your phone or enter the key below manually
        </p>
      </div>

      {/* Manual entry key */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Manual entry key
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono text-gray-900 dark:text-white break-all tracking-widest">
            {formattedSecret}
          </code>
          <button
            onClick={() => copyToClipboard(secret, 'secret')}
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
            title="Copy secret key"
          >
            {copiedSecret ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copiedSecret ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Select &quot;Time-based&quot; and &quot;SHA1&quot; if your app asks. The period is 30 seconds.
        </p>
      </div>

      {/* Copy URI button (advanced) */}
      <div>
        <button
          onClick={() => copyToClipboard(uri, 'uri')}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          {copiedUri ? (
            <Check className="w-3 h-3 text-green-600" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          {copiedUri ? 'Copied OTPAuth URI' : 'Copy OTPAuth URI'}
        </button>
      </div>
    </div>
  );
}

// ---- Backup codes display ----

function BackupCodesDisplay({ codes }: { codes: string[] }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Backup codes copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const downloadCodes = () => {
    const content = [
      'PMI EMS Scheduler - 2FA Backup Codes',
      '=====================================',
      'Store these codes in a safe place.',
      'Each code can only be used once.',
      '',
      ...codes,
      '',
      `Generated: ${new Date().toLocaleString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pmi-ems-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Save these backup codes now
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            These codes are shown only once. Each code can be used once to sign in if you lose access
            to your authenticator app. Store them somewhere safe.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
        {codes.map((code, i) => (
          <code
            key={i}
            className="text-sm font-mono text-gray-900 dark:text-white text-center py-1.5 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg"
          >
            {code}
          </code>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={copyAll}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copied ? 'Copied!' : 'Copy All'}
        </button>
        <button
          onClick={downloadCodes}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      </div>
    </div>
  );
}

// ---- Main panel ----

export default function TwoFactorPanel() {
  const toast = useToast();

  const [status, setStatus] = useState<TwoFAStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [step, setStep] = useState<PanelStep>('idle');
  const [setupSecret, setSetupSecret] = useState('');
  const [setupUri, setSetupUri] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // ---- Fetch status ----

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/settings/2fa/status');
      if (res.ok) {
        const data = await res.json() as TwoFAStatus & { success: boolean };
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to load 2FA status:', err);
    }
    setLoadingStatus(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ---- Setup ----

  const handleStartSetup = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/settings/2fa/setup', { method: 'POST' });
      const data = await res.json() as { success: boolean; secret?: string; uri?: string; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Setup failed');
      }
      setSetupSecret(data.secret ?? '');
      setSetupUri(data.uri ?? '');
      setStep('setup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    }
    setBusy(false);
  };

  // ---- Verify ----

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) {
      setError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/settings/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json() as { success: boolean; backup_codes?: string[]; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Verification failed');
      }
      setBackupCodes(data.backup_codes ?? []);
      setVerifyCode('');
      setStep('backup_codes');
      await fetchStatus();
      toast.success('Two-factor authentication enabled!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
    setBusy(false);
  };

  // ---- Disable ----

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disableCode.trim()) {
      setError('Please enter your authenticator code or a backup code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/settings/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to disable 2FA');
      }
      setDisableCode('');
      setStep('idle');
      await fetchStatus();
      toast.success('Two-factor authentication has been disabled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    }
    setBusy(false);
  };

  // ---- Cancel / reset ----

  const handleCancel = () => {
    setStep('idle');
    setError('');
    setVerifyCode('');
    setDisableCode('');
    setSetupSecret('');
    setSetupUri('');
  };

  // ---- Render ----

  if (loadingStatus) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const isEnabled = status?.is_enabled ?? false;
  const isRequired = status?.required ?? false;

  return (
    <div className="space-y-5">

      {/* ---- Status banner ---- */}
      <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
        isEnabled
          ? 'border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-600'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isEnabled
              ? 'bg-green-100 dark:bg-green-900/40'
              : 'bg-gray-100 dark:bg-gray-700'
          }`}>
            {isEnabled ? (
              <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <ShieldOff className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            )}
          </div>
          <div>
            <p className={`font-semibold text-sm ${
              isEnabled ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'
            }`}>
              {isEnabled ? '2FA is Active' : '2FA is Not Enabled'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isEnabled
                ? `Authenticator app verification is required at sign-in. ${
                    status?.backup_codes_remaining
                      ? `${status.backup_codes_remaining} backup code${status.backup_codes_remaining !== 1 ? 's' : ''} remaining.`
                      : 'No backup codes remaining — consider regenerating them.'
                  }`
                : isRequired
                ? 'Your role requires 2FA. Please set it up below.'
                : 'Add an extra layer of security to your account.'}
            </p>
            {isRequired && !isEnabled && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                Required for your role
              </p>
            )}
          </div>
        </div>

        {/* Action button — only shown in idle state */}
        {step === 'idle' && (
          isEnabled ? (
            <button
              onClick={() => { setStep('disable'); setError(''); }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
            >
              <ShieldOff className="w-4 h-4" />
              Disable
            </button>
          ) : (
            <button
              onClick={handleStartSetup}
              disabled={busy}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex-shrink-0"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              Set Up 2FA
            </button>
          )
        )}
      </div>

      {/* ---- Error message ---- */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-400 hover:text-red-600 dark:hover:text-red-200"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ---- Setup step ---- */}
      {step === 'setup' && (
        <div className="border dark:border-gray-700 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Step 1: Add to Authenticator App
            </h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Cancel setup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <QRCodeDisplay uri={setupUri} secret={setupSecret} />

          <div className="border-t dark:border-gray-700 pt-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Step 2: Enter the 6-digit code to verify
            </p>
            <form onSubmit={handleVerify} className="flex gap-3">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerifyCode(v);
                  if (error) setError('');
                }}
                placeholder="000000"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg font-mono tracking-widest text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="6-digit authenticator code"
                autoComplete="one-time-code"
              />
              <button
                type="submit"
                disabled={busy || verifyCode.length !== 6}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Verify &amp; Enable
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---- Backup codes step ---- */}
      {step === 'backup_codes' && backupCodes.length > 0 && (
        <div className="border dark:border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Your Backup Codes
            </h3>
            <button
              onClick={() => {
                setStep('idle');
                setBackupCodes([]);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Close backup codes"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <BackupCodesDisplay codes={backupCodes} />

          <div className="pt-2 border-t dark:border-gray-700">
            <button
              onClick={() => {
                setStep('idle');
                setBackupCodes([]);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              I&apos;ve saved my backup codes
            </button>
          </div>
        </div>
      )}

      {/* ---- Disable step ---- */}
      {step === 'disable' && (
        <div className="border-2 border-red-200 dark:border-red-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
              <ShieldOff className="w-4 h-4" />
              Disable Two-Factor Authentication
            </h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Cancel disable"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300">
              Disabling 2FA will remove the extra security from your account.
              Enter your current authenticator code or a backup code to confirm.
            </p>
          </div>

          <form onSubmit={handleDisable} className="space-y-3">
            <div>
              <label htmlFor="disable-code" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Authenticator code or backup code
              </label>
              <input
                id="disable-code"
                type="text"
                value={disableCode}
                onChange={(e) => {
                  setDisableCode(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter 6-digit code or XXXX-XXXX backup code"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-red-500 focus:border-transparent"
                autoComplete="one-time-code"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !disableCode.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                Disable 2FA
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---- Info footer ---- */}
      {step === 'idle' && (
        <div className="space-y-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
            <span>
              Two-factor authentication adds a second verification step when signing in, using a
              time-based one-time code from an authenticator app like Google Authenticator or Authy.
            </span>
          </div>
          {isEnabled && (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span>
                To regenerate backup codes, disable and re-enable 2FA.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
