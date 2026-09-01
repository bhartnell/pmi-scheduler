'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

interface Token {
  id: string;
  token: string;
  evaluator_name: string;
  evaluator_role: string | null;
  email: string | null;
  agency: string | null;
  event_id: string | null;
  valid_from: string;
  valid_until: string;
  created_at: string;
  invited_at: string | null;
  invite_send_count: number;
  invite_last_error: string | null;
}

interface OsceEventOption {
  id: string;
  title: string;
  subtitle: string | null;
  start_date: string;
  end_date: string;
  status: 'draft' | 'open' | 'closed' | 'archived';
}

interface InviteRow {
  name: string;
  email: string;
  agency: string;
  role: string;
}

const emptyInviteRow = (): InviteRow => ({ name: '', email: '', agency: '', role: '' });

const roleLabels: Record<string, string> = {
  md: 'Medical Director',
  faculty: 'Faculty',
  agency: 'Agency Rep',
};

export default function OsceTokenManagement() {
  const [events, setEvents] = useState<OsceEventOption[]>([]);
  const [eventId, setEventId] = useState<string>('');
  const [eventsLoading, setEventsLoading] = useState(true);

  const [tokens, setTokens] = useState<Token[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [agency, setAgency] = useState('');
  const [role, setRole] = useState('');
  const [validHours, setValidHours] = useState(336);
  const [createError, setCreateError] = useState('');

  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: Token[]; skipped: number } | null>(null);

  const [inviteRows, setInviteRows] = useState<InviteRow[]>([emptyInviteRow(), emptyInviteRow(), emptyInviteRow()]);
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const [copied, setCopied] = useState<string | null>(null);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [sendResults, setSendResults] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [bulkSending, setBulkSending] = useState(false);
  const [confirmBulkSend, setConfirmBulkSend] = useState(false);

  // ── Fetch events ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/osce/events')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const opts: OsceEventOption[] = (data.events || []).filter((e: OsceEventOption) => e.status !== 'archived');
          setEvents(opts);
          if (opts.length > 0) setEventId(opts[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  // ── Fetch tokens for selected event ─────────────────────────────────────
  const fetchTokens = useCallback(async () => {
    if (!eventId) { setTokens([]); setTokensLoading(false); return; }
    setTokensLoading(true);
    try {
      const res = await fetch(`/api/osce/guest-tokens?event_id=${eventId}`);
      const data = await res.json();
      if (data.success) setTokens(data.tokens);
    } catch { /* ignore */ } finally { setTokensLoading(false); }
  }, [eventId]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const selectedEvent = useMemo(() => events.find(e => e.id === eventId) || null, [events, eventId]);

  // ── Single create ────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!name.trim() || !eventId) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/osce/guest-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          evaluator_name: name.trim(),
          email: email.trim() || undefined,
          agency: agency.trim() || undefined,
          evaluator_role: role || null,
          valid_hours: validHours,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTokens(prev => [data.token, ...prev]);
        setName(''); setEmail(''); setAgency(''); setRole('');
      } else {
        setCreateError(data.error || 'Failed to create token');
      }
    } catch {
      setCreateError('Request failed');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this token? The evaluator will lose access.')) return;
    try {
      const res = await fetch(`/api/osce/guest-tokens?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) setTokens(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ }
  }

  // ── Bulk from registered observers ──────────────────────────────────────
  async function handleBulkGenerate() {
    if (!eventId) return;
    if (!confirm('Generate tokens for all registered observers on this event who don\'t already have one?')) return;
    setBulkGenerating(true);
    setBulkResult(null);
    try {
      const res = await fetch('/api/osce/guest-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, bulk: true, valid_hours: 168 }),
      });
      const data = await res.json();
      if (data.success) {
        setBulkResult({ created: data.created || [], skipped: data.skipped || 0 });
        fetchTokens();
      } else {
        setCreateError(data.error || 'Bulk generation failed');
      }
    } catch {
      setCreateError('Bulk generation request failed');
    } finally {
      setBulkGenerating(false);
    }
  }

  // ── Invite-list batch (new external evaluator contacts) ────────────────
  function updateInviteRow(idx: number, field: keyof InviteRow, value: string) {
    setInviteRows(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }
  function addInviteRow() {
    setInviteRows(prev => [...prev, emptyInviteRow()]);
  }
  function removeInviteRow(idx: number) {
    setInviteRows(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleGenerateInviteList() {
    if (!eventId) return;
    const filled = inviteRows.filter(r => r.name.trim() && r.email.trim());
    if (filled.length === 0) {
      setInviteError('Add at least one evaluator with a name and email');
      return;
    }
    setInviteGenerating(true);
    setInviteError('');
    try {
      const res = await fetch('/api/osce/guest-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          invites: filled.map(r => ({ name: r.name.trim(), email: r.email.trim(), agency: r.agency.trim(), role: r.role })),
          valid_hours: 336,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteRows([emptyInviteRow(), emptyInviteRow(), emptyInviteRow()]);
        fetchTokens();
      } else {
        setInviteError(data.error || 'Failed to generate links');
      }
    } catch {
      setInviteError('Request failed');
    } finally {
      setInviteGenerating(false);
    }
  }

  // ── Send invite email(s) ────────────────────────────────────────────────
  async function sendInvites(tokenIds: string[]) {
    setSendingIds(prev => new Set([...prev, ...tokenIds]));
    try {
      const res = await fetch('/api/osce/guest-tokens/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_ids: tokenIds }),
      });
      const data = await res.json();
      if (data.success) {
        const newResults: Record<string, { success: boolean; error?: string }> = {};
        for (const r of data.results as Array<{ id: string; success: boolean; error?: string }>) {
          newResults[r.id] = { success: r.success, error: r.error };
        }
        setSendResults(prev => ({ ...prev, ...newResults }));
        fetchTokens();
      }
    } catch { /* ignore */ } finally {
      setSendingIds(prev => {
        const next = new Set(prev);
        tokenIds.forEach(id => next.delete(id));
        return next;
      });
    }
  }

  async function handleBulkSend() {
    const unsent = tokens.filter(t => t.email && !t.invited_at);
    if (unsent.length === 0) return;
    setBulkSending(true);
    setConfirmBulkSend(false);
    await sendInvites(unsent.map(t => t.id));
    setBulkSending(false);
  }

  function getLink(token: string) {
    return `${window.location.origin}/osce-scoring/enter?token=${token}`;
  }
  function copyLink(token: string) {
    navigator.clipboard.writeText(getLink(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  const isExpired = (t: Token) => new Date(t.valid_until) < new Date();
  const unsentWithEmail = tokens.filter(t => t.email && !t.invited_at);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Breadcrumbs className="mb-2" />
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OSCE Guest Tokens &amp; Invites</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Generate unique grading-access links for external evaluators and email them their invite.
        </p>
      </div>

      {/* Event selector */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">OSCE Event</label>
        {eventsLoading ? (
          <p className="text-sm text-gray-400">Loading events...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No OSCE events exist yet.{' '}
            <Link href="/admin/osce-events" className="text-blue-600 dark:text-blue-400 underline">Create one first</Link>.
          </p>
        ) : (
          <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3 items-end">
            <select
              value={eventId}
              onChange={e => setEventId(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[44px]"
            >
              {events.map(e => (
                <option key={e.id} value={e.id}>
                  {e.title} ({e.status}) — {e.start_date}
                </option>
              ))}
            </select>
            {selectedEvent && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tokens generated here link to <code>/osce-scoring/enter?token=...</code> for this event only.
                {selectedEvent.status === 'draft' && (
                  <span className="text-amber-600 dark:text-amber-400"> This event is still Draft — consider setting it Open before inviting.</span>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {eventId && (
        <>
          {/* Add evaluator contact list */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Add External Evaluator Contacts</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Add chiefs, agency admin/ops, and clinical leadership by name + email. Each row generates its own
              unique guest-token link, scoped to the selected event above.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="pb-2 pr-2">Name</th>
                    <th className="pb-2 pr-2">Email</th>
                    <th className="pb-2 pr-2">Agency</th>
                    <th className="pb-2 pr-2">Role</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {inviteRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="pr-2 pb-2">
                        <input type="text" value={row.name} onChange={e => updateInviteRow(idx, 'name', e.target.value)}
                          placeholder="Chief John Smith"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-h-[44px]" />
                      </td>
                      <td className="pr-2 pb-2">
                        <input type="email" value={row.email} onChange={e => updateInviteRow(idx, 'email', e.target.value)}
                          placeholder="chief@agency.gov"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-h-[44px]" />
                      </td>
                      <td className="pr-2 pb-2">
                        <input type="text" value={row.agency} onChange={e => updateInviteRow(idx, 'agency', e.target.value)}
                          placeholder="Clark County Fire"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-h-[44px]" />
                      </td>
                      <td className="pr-2 pb-2">
                        <select value={row.role} onChange={e => updateInviteRow(idx, 'role', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-h-[44px]">
                          <option value="">Role...</option>
                          <option value="md">Medical Director</option>
                          <option value="faculty">Faculty</option>
                          <option value="agency">Agency Rep</option>
                        </select>
                      </td>
                      <td className="pb-2">
                        <button onClick={() => removeInviteRow(idx)}
                          className="px-2 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm min-h-[44px]"
                          aria-label="Remove row">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button onClick={addInviteRow}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 min-h-[44px]">
                + Add Row
              </button>
              <button onClick={handleGenerateInviteList} disabled={inviteGenerating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium min-h-[44px]">
                {inviteGenerating ? 'Generating...' : 'Generate Links for This List'}
              </button>
            </div>
            {inviteError && <p className="text-red-500 text-sm mt-2">{inviteError}</p>}
          </div>

          {/* Single create (quick add) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Add One Evaluator</h2>
            <div className="grid grid-cols-6 max-lg:grid-cols-3 max-md:grid-cols-1 gap-3">
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Evaluator name"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[44px]" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[44px]" />
              <input type="text" value={agency} onChange={e => setAgency(e.target.value)} placeholder="Agency"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[44px]" />
              <select value={role} onChange={e => setRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[44px]">
                <option value="">Role (optional)</option>
                <option value="md">Medical Director</option>
                <option value="faculty">Faculty</option>
                <option value="agency">Agency Rep</option>
              </select>
              <select value={validHours} onChange={e => setValidHours(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[44px]">
                <option value={48}>Valid 48 hours</option>
                <option value={168}>Valid 1 week</option>
                <option value={336}>Valid 2 weeks</option>
                <option value={720}>Valid 30 days</option>
              </select>
              <button onClick={handleCreate} disabled={creating || !name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium min-h-[44px]">
                {creating ? 'Creating...' : 'Generate Link'}
              </button>
            </div>
            {createError && <p className="text-red-500 text-sm mt-2">{createError}</p>}
          </div>

          {/* Bulk from observers */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Bulk Generate From Registered Observers</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Create tokens for observers already registered on this event (via self-signup or the Observers tab) who don&apos;t already have one.
                </p>
              </div>
              <button onClick={handleBulkGenerate} disabled={bulkGenerating}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium whitespace-nowrap min-h-[44px]">
                {bulkGenerating ? 'Generating...' : 'Generate for Registered Observers'}
              </button>
            </div>
            {bulkResult && (
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                Created {bulkResult.created.length} token{bulkResult.created.length !== 1 ? 's' : ''}
                {bulkResult.skipped > 0 && ` (${bulkResult.skipped} already had tokens)`}
              </div>
            )}
          </div>

          {/* Token list */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">Tokens for This Event ({tokens.length})</h2>
              {unsentWithEmail.length > 0 && (
                confirmBulkSend ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                      This will send {unsentWithEmail.length} real invite email{unsentWithEmail.length !== 1 ? 's' : ''}. Confirm?
                    </span>
                    <button onClick={handleBulkSend} disabled={bulkSending}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                      {bulkSending ? 'Sending...' : 'Yes, Send All'}
                    </button>
                    <button onClick={() => setConfirmBulkSend(false)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmBulkSend(true)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 min-h-[44px]">
                    Send All Un-sent Invites ({unsentWithEmail.length})
                  </button>
                )
              )}
            </div>
            {tokensLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : tokens.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No tokens generated yet for this event</div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {tokens.map(t => {
                  const isSending = sendingIds.has(t.id);
                  const result = sendResults[t.id];
                  return (
                    <div key={t.id} className={`p-4 ${isExpired(t) ? 'opacity-50' : ''}`}>
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-white">{t.evaluator_name}</span>
                            {t.evaluator_role && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                                {roleLabels[t.evaluator_role] || t.evaluator_role}
                              </span>
                            )}
                            {t.agency && <span className="text-xs text-gray-400 dark:text-gray-500">{t.agency}</span>}
                            {isExpired(t) && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full">Expired</span>
                            )}
                            {t.invited_at ? (
                              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                                Invited {new Date(t.invited_at).toLocaleDateString()}
                                {t.invite_send_count > 1 ? ` (sent ${t.invite_send_count}×)` : ''}
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">Not sent</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t.email || <span className="text-amber-600 dark:text-amber-400">No email on file — can&apos;t send an invite</span>}
                            {' · '}Valid until {new Date(t.valid_until).toLocaleString()}
                          </p>
                          {(result?.error || t.invite_last_error) && !result?.success && (
                            <p className="text-xs text-red-500 mt-1">Last error: {result?.error || t.invite_last_error}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => copyLink(t.token)}
                            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium min-h-[44px]">
                            {copied === t.token ? 'Copied!' : 'Copy Link'}
                          </button>
                          <button onClick={() => sendInvites([t.id])} disabled={!t.email || isSending}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-medium min-h-[44px]">
                            {isSending ? 'Sending...' : t.invited_at ? 'Resend Invite' : 'Send Invite'}
                          </button>
                          <button onClick={() => handleRevoke(t.id)}
                            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium min-h-[44px]">
                            Revoke
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
