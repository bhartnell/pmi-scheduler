'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';

// Hub "Proctors" panel (instructor level and above only). The day's proctor list: add by
// searching existing accounts and students, or by typing an email for someone who has
// never signed in; remove with one tap (flag only, nothing is deleted).

interface Proctor { id: string; email: string; name: string | null; lab_user_id: string | null }
interface Person { lab_user_id: string | null; name: string; email: string; kind: string }

export default function ProctorsPanel({ labDayId, onChanged }: { labDayId: string; onChanged: () => void }) {
  const [proctors, setProctors] = useState<Proctor[]>([]);
  const [tableReady, setTableReady] = useState(true);
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/lab-management/nremt-hub/proctors?labDayId=${labDayId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setProctors(d.proctors || []);
          setTableReady(d.table_ready !== false);
        }
      })
      .catch(() => {});
  }, [labDayId]);

  useEffect(load, [load]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || term.includes('@') && /\S+@\S+\.\S+/.test(term)) {
      setPeople([]);
      return;
    }
    const h = setTimeout(() => {
      fetch(`/api/lab-management/nremt-hub/proctors?search=${encodeURIComponent(term)}`)
        .then((r) => r.json())
        .then((d) => setPeople(d.success ? d.people || [] : []))
        .catch(() => setPeople([]));
    }, 250);
    return () => clearTimeout(h);
  }, [q]);

  const add = async (p: { email: string; name?: string; labUserId?: string | null }) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/lab-management/nremt-hub/proctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labDayId, email: p.email, name: p.name, labUserId: p.labUserId }),
      });
      const d = await res.json();
      if (!d.success) setMsg(d.error || 'Could not add that person');
      else {
        setQ('');
        setPeople([]);
        load();
        onChanged();
      }
    } catch {
      setMsg('Could not add that person');
    }
    setBusy(false);
  };

  const remove = async (p: Proctor) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/lab-management/nremt-hub/proctors?id=${p.id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!d.success) setMsg(d.error || 'Could not remove that person');
      else {
        load();
        onChanged();
      }
    } catch {
      setMsg('Could not remove that person');
    }
    setBusy(false);
  };

  const typedEmail = /^\S+@\S+\.\S+$/.test(q.trim()) ? q.trim() : null;

  return (
    <details className="rounded-lg bg-white dark:bg-gray-800 shadow" open>
      <summary className="cursor-pointer min-h-[44px] flex items-center px-4 font-semibold text-gray-900 dark:text-white">
        Proctors ({proctors.length})
      </summary>
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
        {!tableReady && <p className="text-sm text-amber-700 dark:text-amber-300">The proctor list is not switched on yet.</p>}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          People here can open this day&apos;s stations and grade them, from the day before through the day itself, and nothing else.
        </p>
        <div className="flex flex-wrap gap-2">
          {proctors.length === 0 && <span className="text-sm text-gray-500 dark:text-gray-400">No proctors added yet.</span>}
          {proctors.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-700 pl-3 pr-1 min-h-[44px] text-sm text-gray-900 dark:text-white">
              {p.name || p.email}
              <button type="button" disabled={busy} onClick={() => remove(p)} aria-label={`Remove ${p.name || p.email}`} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                <X className="w-4 h-4" />
              </button>
            </span>
          ))}
        </div>
        <div className="max-w-xl space-y-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email, or type a full email to add someone new"
            className="w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-gray-900 dark:text-white"
          />
          {people.map((p) => (
            <button key={p.email} type="button" disabled={busy} onClick={() => add({ email: p.email, name: p.name, labUserId: p.lab_user_id })} className="w-full flex items-center justify-between gap-2 min-h-[44px] px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white">
              <span>{p.name} <span className="text-xs text-gray-500 dark:text-gray-400">{p.email} · {p.kind}</span></span>
              <UserPlus className="w-4 h-4 shrink-0" />
            </button>
          ))}
          {typedEmail && (
            <button type="button" disabled={busy} onClick={() => add({ email: typedEmail })} className="w-full flex items-center justify-between gap-2 min-h-[44px] px-3 rounded-lg border border-blue-300 dark:border-blue-700 text-left text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-700">
              <span>Add {typedEmail}</span>
              <UserPlus className="w-4 h-4 shrink-0" />
            </button>
          )}
          {msg && <p className="text-sm text-red-600 dark:text-red-400">{msg}</p>}
        </div>
      </div>
    </details>
  );
}
