'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Award, Home } from 'lucide-react';
import CertList from './CertList';

type Certification = {
  id: string;
  cert_name: string;
  cert_number: string | null;
  issuing_body: string | null;
  issue_date: string | null;
  expiration_date: string;
  card_image_url: string | null;
  ce_requirement_id: string | null;
};

type LabUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export default function MyCertificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [labUser, setLabUser] = useState<LabUser | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      // Get current user's lab_users record
      const usersRes = await fetch('/api/lab-management/users');
      const usersData = await usersRes.json();

      if (usersData.success && usersData.users) {
        const currentUser = usersData.users.find(
          (u: LabUser) => u.email.toLowerCase() === session?.user?.email?.toLowerCase()
        );

        if (currentUser) {
          setLabUser(currentUser);

          // Fetch certifications for this instructor
          const certsRes = await fetch(`/api/lab-management/certifications?instructorId=${currentUser.id}`);
          const certsData = await certsRes.json();

          if (certsData.success) {
            setCertifications(certsData.certifications || []);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading certifications...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (!labUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 text-center max-w-md">
          <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Not Found</h2>
          <p className="text-gray-600 mb-4">
            Your account hasn&apos;t been set up yet. Please contact an administrator.
          </p>
          <Link
            href="/lab-management"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Lab Management
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <span>My Certifications</span>
          </div>
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Certifications</h1>
              <p className="text-gray-600">Track your certifications and CE hours</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <CertList initialCerts={certifications} instructorId={labUser.id} />
      </main>
    </div>
  );
}
