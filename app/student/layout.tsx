'use client';

/**
 * Student Portal Layout
 *
 * Provides a student-specific header and navigation.
 * Students cannot access instructor tools.
 */

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ParkAwareLink as Link } from '@/components/ModuleGuard';
import {
  GraduationCap,
  LogOut,
  User,
  LayoutDashboard,
  TrendingUp,
  Menu,
  X,
  ClipboardList,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { isStudent, hasMinRole } from '@/lib/permissions';
import ConsentGate from '@/components/ConsentGate';
import ViewingAsStudentBanner from '@/components/ViewingAsStudentBanner';
import { SA_STORAGE } from '@/lib/preinternship-storage';

// STUDENT VIEW 5: pages students no longer reach. The page files stay (archive,
// don't delete; bring-back: peer evals, skill sheets) but are unreachable.
const HIDDEN_STUDENT_PATHS = [
  '/student/completions',
  '/student/skill-sheets',
  '/student/skill-evaluations',
  '/student/available-labs',
  '/student/labs',
  '/student/peer-eval',
  '/student/profile',
];

interface StudentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<StudentUser | null>(null);
  const [viewingAsName, setViewingAsName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSelfAssessmentNav, setShowSelfAssessmentNav] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUser();
    }
  }, [session]);

  // Nav entry shows while a self-assessment window is open OR the student
  // already has a submission (so they can still open/review it after it
  // closes) — STUDENT VIEW 4/4 item (b).
  useEffect(() => {
    if (!user) return;
    SA_STORAGE.getMyStatus()
      .then((st) => setShowSelfAssessmentNav(st.open || !!st.response))
      .catch(() => setShowSelfAssessmentNav(false));
  }, [user]);

  useEffect(() => {
    if (pathname && HIDDEN_STUDENT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      router.replace('/student');
    }
  }, [pathname, router]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (isStudent(data.user.role)) {
          setUser(data.user);
          setLoading(false);
          return;
        }

        // Not a student — the only other way in is admin+ with an active
        // "View as a student" session (card STUDENT VIEW 3/4). Checked
        // server-side on every /api/student/* request regardless of what
        // this check finds; this only decides whether to show the portal.
        if (hasMinRole(data.user.role, 'admin')) {
          const viewAsRes = await fetch('/api/admin/view-as/current');
          const viewAs = await viewAsRes.json().catch(() => null);
          if (viewAs?.viewingAs && viewAs.student) {
            setUser({
              id: viewAs.student.id,
              name: `${viewAs.student.firstName} ${viewAs.student.lastName}`,
              email: data.user.email,
              role: 'student',
            });
            setViewingAsName(`${viewAs.student.firstName} ${viewAs.student.lastName}${viewAs.student.isTest ? ' (Test)' : ''}`);
            setLoading(false);
            return;
          }
        }

        // Non-students with no active view-as get redirected to main dashboard
        router.push('/');
        return;
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  if (!session || !user) return null;

  // STUDENT VIEW 5: Home, My Progress (cases, clinical hours, compliance docs),
  // and Self-Assessment only while its window is open or a submission exists.
  const navLinks = [
    { href: '/student', label: 'Home', icon: LayoutDashboard },
    { href: '/student/my-progress', label: 'My Progress', icon: TrendingUp },
    ...(showSelfAssessmentNav
      ? [{ href: '/student/self-assessment', label: 'Self-Assessment', icon: ClipboardList }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
      {viewingAsName && <ViewingAsStudentBanner studentName={viewingAsName} />}
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <Link href="/student" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <div className="font-bold text-lg text-gray-900 dark:text-white leading-tight">
                  PMI Student Portal
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Paramedic Program
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <link.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              ))}
            </nav>

            {/* User Actions */}
            <div className="flex items-center gap-3">
              <ThemeToggle />

              {/* User Menu */}
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-200 dark:border-gray-700">
                <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {user.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Student
                  </div>
                </div>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-600 dark:text-gray-300"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="space-y-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <link.icon className="w-5 h-5" />
                    <span className="font-medium">{link.label}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="px-3 text-sm text-gray-500 dark:text-gray-400">
                  Signed in as {user.email}
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content — gated by FERPA student data use agreement */}
      <main>
        <ConsentGate agreementType="student_data_use">
          {children}
        </ConsentGate>
      </main>
    </div>
  );
}
