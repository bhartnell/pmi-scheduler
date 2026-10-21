'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Home, ChevronRight, Users } from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';

interface Program { id: string; name: string; abbreviation: string }
interface Instructor { id: string; name: string; email: string; role: string; is_part_time: boolean | null }
interface RosterRow { program_id: string; user_id: string }

export default function ProgramRostersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [roster, setRoster] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const key = (programId: string, userId: string) => `${programId}:${userId}`;

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/program-rosters');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setPrograms(data.programs);
      setInstructors(data.instructors);
      setRoster(new Set((data.roster as RosterRow[]).map((r) => key(r.program_id, r.user_id))));
    } catch {
      toast.error('Could not load program rosters');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') load();
  }, [status, router, load]);

  const toggle = async (programId: string, userId: string) => {
    const k = key(programId, userId);
    const selected = !roster.has(k);
    setSaving(k);
    try {
      const res = await fetch('/api/admin/program-rosters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, userId, selected }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setRoster((prev) => {
        const next = new Set(prev);
        if (selected) next.add(k); else next.delete(k);
        return next;
      });
    } catch {
      toast.error('Could not save that change');
    } finally {
      setSaving(null);
    }
  };

  if (status === 'loading' || loading) return <PageLoader />;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!canAccessAdmin(role as never)) return <div className="p-8">Admin access required.</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/" className="hover:text-blue-600"><Home className="w-4 h-4" /></Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Default Rosters</span>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6" /> Default instructors per program
        </h1>
        <p className="mt-1 mb-6 text-sm text-gray-600 dark:text-gray-400">
          Everyone checked is pre-assigned to that program&apos;s labs. Any instructor can still sign up for any lab.
        </p>
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-6">
          {programs.map((p) => (
            <section key={p.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">{p.name}</h2>
              <ul className="space-y-1">
                {instructors.map((u) => {
                  const k = key(p.id, u.id);
                  return (
                    <li key={u.id}>
                      <label className="flex items-center gap-3 min-h-[44px] px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-5 h-5"
                          checked={roster.has(k)}
                          disabled={saving === k}
                          onChange={() => toggle(p.id, u.id)}
                        />
                        <span className="text-gray-900 dark:text-white">{u.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {u.is_part_time ? 'part-time' : u.role.replace('_', ' ')}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
