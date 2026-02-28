'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
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
  Monitor,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ArrowLeft,
  Maximize2,
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
type PreviewWidth = 'desktop' | 'mobile';

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
// Variable reference – grouped by category
// ---------------------------------------------------------------------------
const VARIABLE_GROUPS: Array<{
  label: string;
  color: string;
  variables: Array<{ token: string; description: string }>;
}> = [
  {
    label: 'Recipient',
    color: 'text-blue-700 dark:text-blue-300',
    variables: [
      { token: '{{recipientName}}', description: 'Full name of the email recipient' },
    ],
  },
  {
    label: 'Student',
    color: 'text-cyan-700 dark:text-cyan-300',
    variables: [
      { token: '{{student_name}}', description: 'Student full name' },
      { token: '{{cohort_name}}',  description: 'Cohort identifier (e.g. Cohort 24-A)' },
      { token: '{{cohortName}}',   description: 'Cohort name (camelCase alias)' },
    ],
  },
  {
    label: 'Instructor',
    color: 'text-purple-700 dark:text-purple-300',
    variables: [
      { token: '{{instructor_name}}', description: 'Instructor full name' },
      { token: '{{assignedBy}}',      description: 'Who assigned the task' },
      { token: '{{completedBy}}',     description: 'Who completed the task' },
    ],
  },
  {
    label: 'Schedule',
    color: 'text-amber-700 dark:text-amber-300',
    variables: [
      { token: '{{date}}',         description: 'Current date (long format)' },
      { token: '{{labDate}}',      description: 'Lab day date' },
      { token: '{{shiftDate}}',    description: 'Shift date' },
      { token: '{{shiftDetails}}', description: 'Shift time and station info' },
      { token: '{{shift_time}}',   description: 'Shift time range' },
      { token: '{{lab_name}}',     description: 'Lab / cohort name' },
      { token: '{{stationInfo}}',  description: 'Station assignment details' },
      { token: '{{dueDate}}',      description: 'Task due date' },
    ],
  },
  {
    label: 'Clinical',
    color: 'text-red-700 dark:text-red-300',
    variables: [
      { token: '{{siteName}}',      description: 'Clinical site name' },
      { token: '{{site_name}}',     description: 'Clinical site name (snake_case alias)' },
      { token: '{{daysSinceVisit}}', description: 'Days since last site visit' },
    ],
  },
  {
    label: 'Tasks',
    color: 'text-green-700 dark:text-green-300',
    variables: [
      { token: '{{taskTitle}}', description: 'Title of the task' },
    ],
  },
  {
    label: 'Links',
    color: 'text-indigo-700 dark:text-indigo-300',
    variables: [
      { token: '{{taskUrl}}',    description: 'URL to view the task' },
      { token: '{{labUrl}}',     description: 'URL to lab management' },
      { token: '{{signupUrl}}',  description: 'URL to shift signup' },
      { token: '{{visitUrl}}',   description: 'URL to site visits' },
    ],
  },
  {
    label: 'Digest',
    color: 'text-gray-700 dark:text-gray-300',
    variables: [
      { token: '{{notificationGroups}}', description: 'Rendered HTML list of notification groups' },
    ],
  },
];

// All tokens flat, for sample data map
const DEFAULT_SAMPLE_VALUES: Record<string, string> = {
  '{{recipientName}}':      'Jane Instructor',
  '{{student_name}}':       'John Smith',
  '{{instructor_name}}':    'Dr. Jones',
  '{{cohort_name}}':        'Cohort 2026-A',
  '{{cohortName}}':         'Cohort 24-A',
  '{{taskTitle}}':          'Review Student Assessments',
  '{{assignedBy}}':         'Admin User',
  '{{completedBy}}':        'Jane Instructor',
  '{{dueDate}}':            'March 1, 2026',
  '{{taskUrl}}':            'https://pmiparamedic.tools/tasks',
  '{{labDate}}':            'February 28, 2026',
  '{{stationInfo}}':        'Station 1 – Airway Management',
  '{{labUrl}}':             'https://pmiparamedic.tools/lab-management/schedule',
  '{{lab_name}}':           'Cohort 24-A Lab',
  '{{shiftDate}}':          'February 28, 2026',
  '{{shiftDetails}}':       '0800–1600, Station 3',
  '{{shift_time}}':         '0800–1600',
  '{{signupUrl}}':          'https://pmiparamedic.tools/scheduling/shifts',
  '{{siteName}}':           'Banner University Medical Center',
  '{{site_name}}':          'Banner University Medical Center',
  '{{daysSinceVisit}}':     '45',
  '{{visitUrl}}':           'https://pmiparamedic.tools/clinical/site-visits',
  '{{date}}':               new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  '{{notificationGroups}}': '<p style="color:#374151;font-size:14px;"><strong>Tasks (2):</strong> Review Student Assessments, Update Lab Schedule</p>',
};

function applyValues(text: string, values: Record<string, string>): string {
  let result = text;
  for (const [token, val] of Object.entries(values)) {
    result = result.replaceAll(token, val);
  }
  return result;
}

// Full email wrapper for preview
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
// Preview Modal (quick read-only preview from the list)
// ---------------------------------------------------------------------------
function PreviewModal({
  template,
  onClose,
  onEdit,
}: {
  template: TemplateDef;
  onClose: () => void;
  onEdit: () => void;
}) {
  const body    = template.custom_body    ?? template.default_body;
  const subject = template.custom_subject ?? template.default_subject;
  const previewBody    = applyValues(body, DEFAULT_SAMPLE_VALUES);
  const previewSubject = applyValues(subject, DEFAULT_SAMPLE_VALUES);
  const fullHtml = buildPreviewHtml(previewBody);
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>('desktop');

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
          <div className="flex items-center gap-2">
            {/* Width toggle */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setPreviewWidth('desktop')}
                title="Desktop preview (600px)"
                className={`p-1.5 rounded ${previewWidth === 'desktop' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewWidth('mobile')}
                title="Mobile preview (320px)"
                className={`p-1.5 rounded ${previewWidth === 'mobile' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Email preview in iframe */}
        <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900 p-4 flex justify-center">
          <div
            className="transition-all duration-300 overflow-hidden"
            style={{ width: previewWidth === 'mobile' ? '320px' : '100%' }}
          >
            <iframe
              srcDoc={fullHtml}
              title="Email Preview"
              className="w-full rounded-lg shadow-lg"
              style={{ height: '560px', border: 'none' }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {previewWidth === 'mobile' ? 'Mobile view (320px)' : 'Desktop view (600px)'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Template
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variables Panel (collapsible, grouped)
// ---------------------------------------------------------------------------
function VariablesPanel({
  onInsert,
}: {
  onInsert: (token: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleToken = (token: string) => {
    onInsert(token);
    // Also copy to clipboard
    navigator.clipboard.writeText(token).catch(() => {});
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Panel header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          Variable Reference
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        )}
      </button>

      {open && (
        <div className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700 max-h-[420px] overflow-y-auto">
          <p className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
            Click a variable to insert it at the cursor position.
          </p>
          {VARIABLE_GROUPS.map((group) => (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <span className={`text-xs font-semibold uppercase tracking-wider ${group.color}`}>
                  {group.label}
                </span>
                {collapsedGroups[group.label] ? (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                )}
              </button>
              {!collapsedGroups[group.label] && (
                <div className="px-3 pb-2 space-y-1">
                  {group.variables.map(({ token, description }) => (
                    <button
                      key={token}
                      onClick={() => handleToken(token)}
                      title={description}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-colors group"
                    >
                      <span className="text-blue-700 dark:text-blue-300 truncate">{token}</span>
                      {copiedToken === token ? (
                        <Check className="w-3 h-3 text-green-500 flex-shrink-0 ml-1" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400 group-hover:text-blue-500 flex-shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sample Values Editor
// ---------------------------------------------------------------------------
function SampleValuesEditor({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (updated: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);

  // Only show the most common, editable ones (exclude HTML-heavy ones)
  const editableTokens = Object.keys(DEFAULT_SAMPLE_VALUES).filter(
    (t) => !t.includes('notificationGroups') && !t.includes('Url')
  );

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          Preview Sample Data
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Edit values used in preview</span>
          {open ? (
            <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="bg-white dark:bg-gray-800 p-4 space-y-2 max-h-64 overflow-y-auto">
          {editableTokens.map((token) => (
            <div key={token} className="flex items-center gap-2">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-300 w-40 flex-shrink-0 truncate" title={token}>
                {token}
              </span>
              <input
                type="text"
                value={values[token] ?? ''}
                onChange={(e) => onChange({ ...values, [token]: e.target.value })}
                className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}
          <button
            onClick={() => onChange({ ...DEFAULT_SAMPLE_VALUES })}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
          >
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template Editor (full-screen split-pane)
// ---------------------------------------------------------------------------
function TemplateEditor({
  template,
  currentUserEmail,
  onClose,
  onSave,
  onReset,
  onSendTest,
  sendingTest,
}: {
  template: TemplateDef;
  currentUserEmail: string;
  onClose: () => void;
  onSave: (key: string, subject: string, body: string) => Promise<void>;
  onReset: (key: string) => Promise<void>;
  onSendTest: () => Promise<void>;
  sendingTest: boolean;
}) {
  const [subject, setSubject] = useState(
    template.custom_subject ?? template.default_subject
  );
  const [body, setBody] = useState(
    template.custom_body ?? template.default_body
  );
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({ ...DEFAULT_SAMPLE_VALUES });
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>('desktop');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showVariables, setShowVariables] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Live preview HTML – recomputed whenever body or sample values change
  const previewHtml = buildPreviewHtml(applyValues(body, sampleValues));
  const previewSubject = applyValues(subject, sampleValues);

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
    // Restore editor to defaults
    setSubject(template.default_subject);
    setBody(template.default_body);
  };

  // Insert token at current cursor position in the textarea
  const insertAtCursor = (token: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? body.length;
    const end   = el.selectionEnd   ?? body.length;
    const newBody = body.slice(0, start) + token + body.slice(end);
    setBody(newBody);
    // Restore focus and move cursor to after inserted token
    requestAnimationFrame(() => {
      el.focus();
      const newPos = start + token.length;
      el.setSelectionRange(newPos, newPos);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">
      {/* Editor header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            title="Back to templates"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
              {template.name}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{template.description}</p>
          </div>
          {template.is_customized && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
              Customized
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Preview width toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setPreviewWidth('desktop')}
              title="Desktop preview (600px)"
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                previewWidth === 'desktop'
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </button>
            <button
              onClick={() => setPreviewWidth('mobile')}
              title="Mobile preview (320px)"
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                previewWidth === 'mobile'
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile
            </button>
          </div>

          {/* Variables panel toggle */}
          <button
            onClick={() => setShowVariables(!showVariables)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              showVariables
                ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Variables
          </button>

          {/* Send test */}
          <button
            onClick={onSendTest}
            disabled={sendingTest}
            title={`Send test to ${currentUserEmail}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {sendingTest ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Send Test
          </button>

          {/* Reset */}
          {template.is_customized && (
            <button
              onClick={handleReset}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {resetting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              Reset
            </button>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </div>

      {/* Editor body: three-column (editor | preview | vars) or two-column if vars hidden */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: editor */}
        <div className="flex flex-col w-1/2 min-w-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {/* Subject line */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Email subject…"
            />
            {subject && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Preview: <span className="text-gray-600 dark:text-gray-300">{previewSubject}</span>
              </p>
            )}
          </div>

          {/* Body textarea */}
          <div className="flex flex-col flex-1 min-h-0 px-4 py-3">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Body HTML
              <span className="ml-2 text-gray-400 dark:text-gray-500 font-normal normal-case">
                (inner content – header/footer added automatically)
              </span>
            </label>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="HTML email body…"
            />
          </div>

          {/* Sample data editor */}
          <div className="px-4 pb-4 flex-shrink-0">
            <SampleValuesEditor values={sampleValues} onChange={setSampleValues} />
          </div>

          {/* Tips */}
          <div className="px-4 pb-4 flex-shrink-0">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 mb-1">Tips</p>
              <ul className="text-xs text-amber-800 dark:text-amber-400 space-y-0.5 list-disc list-inside">
                <li>Use inline styles – email clients ignore external CSS</li>
                <li>Keep content width under 600px for compatibility</li>
                <li>Variables are case-sensitive – use exact casing</li>
                <li>Test before saving to confirm rendering</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Center: live preview */}
        <div className="flex flex-col flex-1 min-w-0 bg-gray-100 dark:bg-gray-950">
          {/* Preview toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Live Preview
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {previewWidth === 'desktop' ? 'Desktop (600px)' : 'Mobile (320px)'}
              {' '}&bull; Sample data applied
            </span>
          </div>

          {/* iframe */}
          <div className="flex-1 overflow-auto flex justify-center p-4">
            <div
              className="transition-all duration-300 overflow-hidden w-full"
              style={previewWidth === 'mobile' ? { maxWidth: '320px' } : { maxWidth: '100%' }}
            >
              <iframe
                key={previewWidth}
                srcDoc={previewHtml}
                title="Live Email Preview"
                className="w-full rounded-lg shadow-lg bg-white"
                style={{ height: '100%', minHeight: '600px', border: 'none' }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>

        {/* Right: variables panel (collapsible) */}
        {showVariables && (
          <div className="w-72 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto">
            <div className="p-3">
              <VariablesPanel onInsert={insertAtCursor} />
            </div>
          </div>
        )}
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
  const [sendingTest, setSendingTest]     = useState<string | null>(null);
  const [toast, setToast]                 = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) fetchCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Full-screen editor takes over when a template is being edited
  if (editTemplate) {
    return (
      <>
        {/* Toast over editor */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white ${
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
        <TemplateEditor
          template={editTemplate}
          currentUserEmail={currentUser.email}
          onClose={() => setEditTemplate(null)}
          onSave={handleSave}
          onReset={handleReset}
          onSendTest={() => handleSendTest(editTemplate)}
          sendingTest={sendingTest === editTemplate.key}
        />
      </>
    );
  }

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

      {/* Preview modal */}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onEdit={() => {
            setEditTemplate(previewTemplate);
            setPreviewTemplate(null);
          }}
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
            Test emails sent to:{' '}
            <strong className="text-gray-700 dark:text-gray-300">{currentUser.email}</strong>
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
                          title="Edit template (full editor)"
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
              built-in default. Click the{' '}
              <Edit2 className="w-3.5 h-3.5 inline-block mx-0.5 align-middle" />
              edit button to open the full split-pane editor with live preview, variable insertion,
              and responsive preview modes. Test emails are always sent to your own address only.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
