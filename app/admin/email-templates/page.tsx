'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Mail,
  Eye,
  Edit2,
  Send,
  RotateCcw,
  X,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateDef {
  key: string;
  name: string;
  category: string;
  description: string;
  variables: string[];
  default_subject: string;
  default_body: string;
  custom_subject: string | null;
  custom_body: string | null;
  is_customized: boolean;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string | null;
}

type Category = 'All' | 'Tasks' | 'Labs' | 'Scheduling' | 'Clinical' | 'System';

// ---------------------------------------------------------------------------
// Category badge colors
// ---------------------------------------------------------------------------
const CATEGORY_COLORS: Record<string, string> = {
  Tasks:      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Labs:       'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Scheduling: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Clinical:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  System:     'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const CATEGORIES: Category[] = ['All', 'Tasks', 'Labs', 'Scheduling', 'Clinical', 'System'];

// ---------------------------------------------------------------------------
// Helper – apply sample data to a template string for preview
// ---------------------------------------------------------------------------
const SAMPLE_VALUES: Record<string, string> = {
  '{{recipientName}}':    'Jane Instructor',
  '{{taskTitle}}':        'Review Student Assessments',
  '{{assignedBy}}':       'Admin User',
  '{{completedBy}}':      'Jane Instructor',
  '{{dueDate}}':          'March 1, 2026',
  '{{taskUrl}}':          'https://pmiparamedic.tools/tasks',
  '{{labDate}}':          'February 28, 2026',
  '{{cohortName}}':       'Cohort 24-A',
  '{{stationInfo}}':      'Station 1 – Airway Management',
  '{{labUrl}}':           'https://pmiparamedic.tools/lab-management/schedule',
  '{{shiftDate}}':        'February 28, 2026',
  '{{shiftDetails}}':     '0800–1600, Station 3',
  '{{signupUrl}}':        'https://pmiparamedic.tools/scheduling/shifts',
  '{{siteName}}':         'Banner University Medical Center',
  '{{daysSinceVisit}}':   '45',
  '{{visitUrl}}':         'https://pmiparamedic.tools/clinical/site-visits',
  '{{date}}':             new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  '{{notificationGroups}}': '<p style="color:#374151;font-size:14px;"><strong>Tasks (2):</strong> Review Student Assessments, Update Lab Schedule</p>',
};

function applySample(text: string): string {
  let result = text;
  for (const [v, val] of Object.entries(SAMPLE_VALUES)) {
    result = result.replaceAll(v, val);
  }
  return result;
}

// Full email wrapper for preview (mirrors lib/email-templates.ts wrapInEmailTemplate)
function buildPreviewHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#1e3a5f;padding:24px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">PMI Paramedic Tools</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:24px;border-top:1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#6b7280;font-size:12px;text-align:center;">
                    <p style="margin:0 0 8px 0;">Pima Medical Institute – Paramedic Program</p>
                    <p style="margin:0;">
                      <a href="#" style="color:#2563eb;text-decoration:none;">Manage email preferences</a>
                      &nbsp;|&nbsp;
                      <a href="#" style="color:#2563eb;text-decoration:none;">Open PMI Tools</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Preview Modal
// ---------------------------------------------------------------------------
function PreviewModal({
  template,
  onClose,
}: {
  template: TemplateDef;
  onClose: () => void;
}) {
  const body    = template.custom_body    ?? template.default_body;
  const subject = template.custom_subject ?? template.default_subject;
  const previewBody    = applySample(body);
  const previewSubject = applySample(subject);
  const fullHtml = buildPreviewHtml(previewBody);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Preview: {template.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Subject: <span className="font-medium text-gray-700 dark:text-gray-300">{previewSubject}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Email preview in iframe */}
        <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900 p-4">
          <iframe
            srcDoc={fullHtml}
            title="Email Preview"
            className="w-full rounded-lg shadow-lg"
            style={{ height: '600px', border: 'none' }}
            sandbox="allow-same-origin"
          />
        </div>

        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Modal
// ---------------------------------------------------------------------------
function EditModal({
  template,
  onClose,
  onSave,
  onReset,
}: {
  template: TemplateDef;
  onClose: () => void;
  onSave: (key: string, subject: string, body: string) => Promise<void>;
  onReset: (key: string) => Promise<void>;
}) {
  const [subject, setSubject] = useState(
    template.custom_subject ?? template.default_subject
  );
  const [body, setBody] = useState(
    template.custom_body ?? template.default_body
  );
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const previewHtml = buildPreviewHtml(applySample(body));

  const handleSave = async () => {
    setSaving(true);
    await onSave(template.key, subject, body);
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm('Reset to default template? Your customizations will be lost.')) return;
    setResetting(true);
    await onReset(template.key);
    setResetting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Edit: {template.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{template.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: editor */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email subject…"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Body HTML
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">
                    (inner content – header/footer added automatically)
                  </span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={18}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  placeholder="HTML email body…"
                />
              </div>

              <button
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? 'Hide' : 'Show'} Preview
              </button>

              {showPreview && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 dark:bg-gray-900 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    Preview (sample data applied)
                  </div>
                  <iframe
                    srcDoc={previewHtml}
                    title="Body Preview"
                    className="w-full"
                    style={{ height: '400px', border: 'none' }}
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </div>

            {/* Right: variable reference */}
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Available Variables
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Click to copy. These will be replaced with real data when the email is sent.
                </p>
                <div className="space-y-1.5">
                  {template.variables.map((v) => (
                    <button
                      key={v}
                      onClick={() => navigator.clipboard.writeText(v)}
                      className="w-full text-left px-2 py-1.5 rounded text-xs font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="Click to copy"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
                  Tips
                </h3>
                <ul className="text-xs text-amber-800 dark:text-amber-400 space-y-1 list-disc list-inside">
                  <li>Use inline styles – email clients ignore external CSS</li>
                  <li>Keep width under 600px for compatibility</li>
                  <li>Test before saving to confirm rendering</li>
                  <li>Variables are case-sensitive</li>
                </ul>
              </div>

              {template.is_customized && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Last edited by <strong>{template.updated_by}</strong>
                  {template.updated_at && (
                    <> on {new Date(template.updated_at).toLocaleDateString()}</>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {template.is_customized && (
              <button
                onClick={handleReset}
                disabled={resetting}
                className="inline-flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
              >
                {resetting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                Reset to Default
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function EmailTemplatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser]     = useState<{ email: string; role: string } | null>(null);
  const [loading, setLoading]             = useState(true);
  const [templates, setTemplates]         = useState<TemplateDef[]>([]);
  const [category, setCategory]           = useState<Category>('All');
  const [previewTemplate, setPreviewTemplate] = useState<TemplateDef | null>(null);
  const [editTemplate, setEditTemplate]   = useState<TemplateDef | null>(null);
  const [sendingTest, setSendingTest]     = useState<string | null>(null); // key of template being tested
  const [toast, setToast]                 = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) fetchCurrentUser();
  }, [session]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCurrentUser = async () => {
    try {
      const res  = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!canAccessAdmin(data.user.role)) {
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
        await fetchTemplates();
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
    setLoading(false);
  };

  const fetchTemplates = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/email-templates');
      const data = await res.json();
      if (data.success) setTemplates(data.templates);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  }, []);

  const handleSave = async (key: string, subject: string, body: string) => {
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_key: key, subject, body_html: body }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchTemplates();
      setEditTemplate(null);
      showToast('Template saved successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save template', 'error');
    }
  };

  const handleReset = async (key: string) => {
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_key: key }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchTemplates();
      setEditTemplate(null);
      showToast('Template reset to default', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reset template', 'error');
    }
  };

  const handleSendTest = async (template: TemplateDef) => {
    if (!currentUser?.email) return;
    setSendingTest(template.key);
    try {
      const res = await fetch('/api/admin/email-templates/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_key: template.key, to: currentUser.email }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast(`Test email sent to ${currentUser.email}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send test email', 'error');
    }
    setSendingTest(null);
  };

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const filtered = category === 'All'
    ? templates
    : templates.filter((t) => t.category === category);

  const countsByCategory: Record<string, number> = {};
  for (const t of templates) {
    countsByCategory[t.category] = (countsByCategory[t.category] || 0) + 1;
  }

  const customizedCount = templates.filter((t) => t.is_customized).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {toast.message}
        </div>
      )}

      {/* Modals */}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
      {editTemplate && (
        <EditModal
          template={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSave={handleSave}
          onReset={handleReset}
        />
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Email Templates</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Templates</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Customize notification email templates sent by the system
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{templates.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{customizedCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Customized</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-500 dark:text-gray-400">
              {templates.length - customizedCount}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Using Default</p>
          </div>
          <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            Test emails sent to: <strong className="text-gray-700 dark:text-gray-300">{currentUser.email}</strong>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const count = cat === 'All' ? templates.length : (countsByCategory[cat] || 0);
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  category === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {cat}
                <span
                  className={`ml-1.5 text-xs ${
                    category === cat ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Template list */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              No templates in this category.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                    Last Updated
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((template) => (
                  <tr
                    key={template.key}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    {/* Name + description */}
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {template.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {template.description}
                      </p>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          CATEGORY_COLORS[template.category] || ''
                        }`}
                      >
                        {template.category}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      {template.is_customized ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          Customized
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          Default
                        </span>
                      )}
                    </td>

                    {/* Last updated */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      {template.updated_at ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(template.updated_at).toLocaleDateString()}
                          {template.updated_by && (
                            <span className="block text-gray-400 dark:text-gray-500">
                              by {template.updated_by.split('@')[0]}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Preview */}
                        <button
                          onClick={() => setPreviewTemplate(template)}
                          title="Preview template"
                          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => setEditTemplate(template)}
                          title="Edit template"
                          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Send test */}
                        <button
                          onClick={() => handleSendTest(template)}
                          disabled={sendingTest === template.key}
                          title={`Send test to ${currentUser.email}`}
                          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50"
                        >
                          {sendingTest === template.key ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>

                        {/* Reset */}
                        {template.is_customized && (
                          <button
                            onClick={() => {
                              if (confirm(`Reset "${template.name}" to the default template? This cannot be undone.`)) {
                                handleReset(template.key);
                              }
                            }}
                            title="Reset to default"
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Info note */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">How customizations work</p>
            <p className="text-blue-800 dark:text-blue-200 mt-1">
              Customized templates are stored in the database and override the default code templates
              when emails are sent. Resetting a template removes the database entry and restores the
              built-in default. Test emails are always sent to your own address only.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
