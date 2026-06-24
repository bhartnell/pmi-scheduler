'use client';

/**
 * Instructor AHA credentials — name (from profile), AHA instructor number, and a
 * saved signature (draw, upload, or auto script-font fallback). These autofill
 * the AHA Results Export forms' instructor sign-off line. Self-service: edits
 * only the current user's record via /api/profile/aha.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save, Upload, PenLine, Type } from 'lucide-react';
import { useToast } from '@/components/Toast';
import SignaturePad from '@/components/SignaturePad';

type SigKind = 'drawn' | 'uploaded' | 'auto';
interface AhaProfile {
  name: string;
  aha_instructor_number: string | null;
  signature_data: string | null;
  signature_kind: SigKind | null;
}

export default function AhaCredentialsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [ahaNumber, setAhaNumber] = useState('');
  const [kind, setKind] = useState<SigKind>('auto');
  const [sigData, setSigData] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profile/aha')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.profile) {
          const p = d.profile as AhaProfile;
          setName(p.name || '');
          setAhaNumber(p.aha_instructor_number || '');
          setKind(p.signature_kind || 'auto');
          setSigData(p.signature_data || null);
        }
      })
      .catch(() => toast.error('Failed to load credentials'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Pick an image file');
    if (file.size > 500_000) return toast.error('Image too large (max ~500KB)');
    const reader = new FileReader();
    reader.onload = () => { setSigData(String(reader.result)); setKind('uploaded'); };
    reader.readAsDataURL(file);
  }

  // Number and signature save INDEPENDENTLY — each PATCH carries only its own
  // field(s), so updating one never wipes the other (the API only writes keys
  // present in the body). This is why e.g. saving the number on desktop won't
  // erase a signature drawn on a phone.
  async function patch(payload: Record<string, unknown>, okMsg: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/profile/aha', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
      toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }
  const saveNumber = () => patch({ aha_instructor_number: ahaNumber.trim() || null }, 'AHA number saved');
  const saveSignature = () => patch(
    { signature_kind: kind, signature_data: kind === 'auto' ? null : sigData },
    'Signature saved',
  );

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const tab = (k: SigKind, label: string, Icon: typeof PenLine) => (
    <button type="button" onClick={() => setKind(k)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border ${
        kind === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
      }`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">AHA Instructor Credentials</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Stored once and reused to autofill your sign-off line (name, AHA number, signature) on the AHA Results Export forms.
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name (from your profile)</label>
            <input value={name} disabled
              className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">AHA Instructor Number</label>
            <div className="flex gap-2">
              <input value={ahaNumber} onChange={(e) => setAhaNumber(e.target.value)} placeholder="e.g. 12345678"
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />
              <button type="button" onClick={saveNumber} disabled={saving}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save number
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Saves independently — won’t affect your signature.</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Signature</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {tab('drawn', 'Draw', PenLine)}
            {tab('uploaded', 'Upload', Upload)}
            {tab('auto', 'Auto (script font)', Type)}
          </div>

          {kind === 'drawn' && (
            <SignaturePad onChange={setSigData} />
          )}
          {kind === 'uploaded' && (
            <div className="space-y-2">
              <input type="file" accept="image/*" onChange={onUpload} className="block text-sm" />
              {sigData && <img src={sigData} alt="signature" className="max-h-24 border border-gray-200 dark:border-gray-700 rounded bg-white p-1" />}
            </div>
          )}
          {kind === 'auto' && (
            <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-md p-4 bg-white dark:bg-gray-900">
              <span style={{ fontFamily: 'Brush Script MT, "Segoe Script", cursive', fontSize: '32px' }} className="text-gray-900 dark:text-gray-100">
                {name || 'Your Name'}
              </span>
              <p className="text-[11px] text-gray-400 mt-1">Fallback: your name rendered in a script font on the form.</p>
            </div>
          )}
          <div className="flex justify-end mt-3">
            <button type="button" onClick={saveSignature} disabled={saving}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-md text-sm font-medium">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
