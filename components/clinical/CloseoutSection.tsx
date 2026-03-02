'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Circle,
  FileText,
  Upload,
  Trash2,
  Download,
  Loader2,
  CheckSquare,
  AlertCircle,
  XCircle,
  Printer,
  ClipboardList,
  Pencil,
  Briefcase,
  Send,
} from 'lucide-react';
import CloseoutSurveyModal from './CloseoutSurveyModal';
import EmploymentVerificationModal from './EmploymentVerificationModal';
import PreceptorEvalModal from './PreceptorEvalModal';
import { parseDateSafe } from '@/lib/utils';

interface ChecklistItem {
  key: string;
  label: string;
  auto_checked: boolean;
  manual_override: boolean;
  details: string;
}

interface CloseoutDocument {
  id: string;
  internship_id: string;
  doc_type: string;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
}

interface CloseoutSurvey {
  id: string;
  internship_id: string;
  survey_type: 'hospital_preceptor' | 'field_preceptor';
  preceptor_name: string | null;
  agency_name: string | null;
  responses: Record<string, number | string | null>;
  submitted_by: string | null;
  submitted_at: string | null;
}

interface EmploymentVerification {
  id: string;
  internship_id: string;
  student_name: string | null;
  ssn_last4: string | null;
  program: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  company_name: string | null;
  job_title: string | null;
  company_address: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_fax: string | null;
  start_date: string | null;
  salary: string | null;
  employment_status: 'ft' | 'pt' | null;
  verifying_staff: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
}

interface CloseoutSectionProps {
  internshipId: string;
  canEdit: boolean;
  isAdmin: boolean;
  studentName?: string;
  studentEmail?: string;
  program?: string;
}

const SURVEY_CONFIGS: Array<{
  type: 'hospital_preceptor' | 'field_preceptor';
  label: string;
  description: string;
}> = [
  {
    type: 'hospital_preceptor',
    label: 'Hospital Preceptor Survey',
    description: 'Evaluate your hospital clinical preceptor (19 questions)',
  },
  {
    type: 'field_preceptor',
    label: 'Field Preceptor Survey',
    description: 'Evaluate your field internship preceptor (19 questions)',
  },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  completion_form: 'Completion Form',
  preceptor_eval: 'Preceptor Eval',
  field_docs: 'Field Docs',
  exam_results: 'Exam Results',
  other: 'Other',
};

const DOC_TYPE_COLORS: Record<string, string> = {
  completion_form: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  preceptor_eval: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  field_docs: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  exam_results: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export default function CloseoutSection({
  internshipId,
  canEdit,
  isAdmin,
  studentName = '',
  studentEmail = '',
  program = '',
}: CloseoutSectionProps) {
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [documents, setDocuments] = useState<CloseoutDocument[]>([]);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [completedBy, setCompletedBy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState('other');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Completion state
  const [completing, setCompleting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Summary generation state
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Survey state
  const [surveys, setSurveys] = useState<CloseoutSurvey[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(true);
  const [activeSurveyModal, setActiveSurveyModal] = useState<{
    type: 'hospital_preceptor' | 'field_preceptor';
    existing: CloseoutSurvey | null;
  } | null>(null);

  // Employment verification state
  const [employmentVerification, setEmploymentVerification] = useState<EmploymentVerification | null>(null);
  const [employmentLoading, setEmploymentLoading] = useState(true);
  const [showEmploymentModal, setShowEmploymentModal] = useState(false);
  const [employmentAutoGeneratePdf, setEmploymentAutoGeneratePdf] = useState(false);

  // Preceptor eval link state
  const [showPreceptorEvalModal, setShowPreceptorEvalModal] = useState(false);

  useEffect(() => {
    fetchCloseoutData();
    fetchSurveys();
    fetchEmploymentVerification();
  }, [internshipId]);

  const fetchCloseoutData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clinical/internships/${internshipId}/closeout`);
      const data = await res.json();
      if (data.success) {
        setChecklist(data.checklist || []);
        setDocuments(data.documents || []);
        setCompletedAt(data.completed_at || null);
        setCompletedBy(data.completed_by || null);
      }
    } catch (error) {
      console.error('Error fetching closeout data:', error);
    }
    setLoading(false);
  };

  const fetchSurveys = async () => {
    setSurveysLoading(true);
    try {
      const res = await fetch(`/api/clinical/internships/${internshipId}/closeout/surveys`);
      const data = await res.json();
      if (data.success) {
        setSurveys(data.surveys || []);
      }
    } catch (error) {
      console.error('Error fetching closeout surveys:', error);
    }
    setSurveysLoading(false);
  };

  const fetchEmploymentVerification = async () => {
    setEmploymentLoading(true);
    try {
      const res = await fetch(`/api/clinical/internships/${internshipId}/closeout/employment`);
      const data = await res.json();
      if (data.success) {
        setEmploymentVerification(data.verification || null);
      }
    } catch (error) {
      console.error('Error fetching employment verification:', error);
    }
    setEmploymentLoading(false);
  };

  const handleEmploymentSaved = (verification: EmploymentVerification) => {
    setEmploymentVerification(verification);
    setShowEmploymentModal(false);
    showToastMessage('Employment verification saved', 'success');
  };

  const handleSurveyComplete = (savedSurvey: CloseoutSurvey) => {
    setSurveys(prev => {
      const existing = prev.find(s => s.id === savedSurvey.id);
      if (existing) {
        return prev.map(s => (s.id === savedSurvey.id ? savedSurvey : s));
      }
      return [savedSurvey, ...prev];
    });
    setActiveSurveyModal(null);
    showToastMessage('Survey saved successfully', 'success');
  };

  const getSurveyForType = (type: 'hospital_preceptor' | 'field_preceptor'): CloseoutSurvey | null => {
    return surveys.find(s => s.survey_type === type) || null;
  };

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleManualOverride = (key: string, checked: boolean) => {
    setChecklist(prev =>
      prev.map(item => (item.key === key ? { ...item, manual_override: checked } : item))
    );
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', selectedDocType);

      const res = await fetch(`/api/clinical/internships/${internshipId}/closeout/documents`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        setDocuments(prev => [data.document, ...prev]);
        showToastMessage('Document uploaded successfully', 'success');
      } else {
        showToastMessage(data.error || 'Failed to upload document', 'error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToastMessage('Failed to upload document', 'error');
    }
    setUploading(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDeleteDocument = async (docId: string) => {
    setDeletingId(docId);
    try {
      const res = await fetch(
        `/api/clinical/internships/${internshipId}/closeout/documents?docId=${docId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
        showToastMessage('Document deleted', 'success');
      } else {
        showToastMessage(data.error || 'Failed to delete document', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToastMessage('Failed to delete document', 'error');
    }
    setDeletingId(null);
  };

  const handleMarkComplete = async () => {
    setCompleting(true);
    setShowCompleteConfirm(false);
    try {
      const res = await fetch(`/api/clinical/internships/${internshipId}/closeout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist }),
      });
      const data = await res.json();
      if (data.success) {
        setCompletedAt(data.internship.completed_at);
        setCompletedBy(data.internship.completed_by);
        showToastMessage('Internship marked as complete!', 'success');
      } else {
        showToastMessage(data.error || 'Failed to mark complete', 'error');
      }
    } catch (error) {
      console.error('Complete error:', error);
      showToastMessage('Failed to mark complete', 'error');
    }
    setCompleting(false);
  };

  const allChecked = checklist.every(item => item.auto_checked || item.manual_override);
  const pendingItems = checklist.filter(item => !item.auto_checked && !item.manual_override);

  const formatDate = (dateString: string) => {
    return parseDateSafe(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateLong = (dateString: string | null): string => {
    if (!dateString) return '';
    return parseDateSafe(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const renderSummaryHTML = (data: {
    student_name: string;
    student_email: string | null;
    program: string;
    cohort: string | null;
    agency: string | null;
    start_date: string | null;
    completion_date: string;
    total_shifts: number;
    total_hours: number;
    required_hours: number;
    preceptors: string[];
    primary_preceptor: string | null;
    checklist: Array<{ key: string; label: string; completed: boolean; date: string | null }>;
    hospital_survey_completed: boolean;
    field_survey_completed: boolean;
    employment_verified: boolean;
    completed_at: string;
    completed_by: string | null;
  }): string => {
    const checklistRows = data.checklist
      .map(item => `
        <tr>
          <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb;">
            <span style="color:${item.completed ? '#16a34a' : '#9ca3af'}; font-size:16px; margin-right:8px;">
              ${item.completed ? '&#10003;' : '&#9675;'}
            </span>
            ${item.label}
          </td>
          <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb; color:#6b7280; text-align:right; white-space:nowrap;">
            ${item.date ? formatDateLong(item.date) : (item.completed ? 'Completed' : 'Pending')}
          </td>
        </tr>
      `)
      .join('');

    const surveyRow = `
      <tr>
        <td style="padding:8px; background:#f9fafb;">
          <strong>Surveys:</strong>
          Hospital ${data.hospital_survey_completed ? '<span style="color:#16a34a;">&#10003;</span>' : '<span style="color:#9ca3af;">Pending</span>'}
          &nbsp;&nbsp;
          Field ${data.field_survey_completed ? '<span style="color:#16a34a;">&#10003;</span>' : '<span style="color:#9ca3af;">Pending</span>'}
        </td>
        <td style="padding:8px; background:#f9fafb; text-align:right;">
          <strong>Employment Verification:</strong>
          ${data.employment_verified ? '<span style="color:#16a34a;">&#10003; Verified</span>' : '<span style="color:#9ca3af;">Not recorded</span>'}
        </td>
      </tr>
    `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Internship Completion Summary - ${data.student_name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #111827;
      background: #fff;
      padding: 32px;
      max-width: 750px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #1d4ed8;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .header .logo-text {
      font-size: 22px;
      font-weight: 700;
      color: #1d4ed8;
      letter-spacing: 0.5px;
    }
    .header .sub-title {
      font-size: 14px;
      color: #6b7280;
      margin-top: 2px;
    }
    .header .doc-title {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin-top: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section {
      margin-bottom: 20px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .section-header {
      background: #f3f4f6;
      padding: 8px 12px;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
    }
    .info-cell {
      padding: 10px 14px;
      border-bottom: 1px solid #f3f4f6;
    }
    .info-cell:nth-child(odd) {
      border-right: 1px solid #f3f4f6;
    }
    .info-label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }
    .info-value {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
    }
    .info-value.empty {
      color: #9ca3af;
      font-style: italic;
      font-weight: 400;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #6b7280;
    }
    .completed-stamp {
      text-align: center;
      margin: 16px 0;
      padding: 12px;
      background: #f0fdf4;
      border: 2px solid #16a34a;
      border-radius: 8px;
    }
    .completed-stamp .stamp-text {
      font-size: 15px;
      font-weight: 700;
      color: #15803d;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .completed-stamp .stamp-date {
      font-size: 12px;
      color: #166534;
      margin-top: 2px;
    }
    .no-print {
      display: block;
    }
    .print-btn {
      display: block;
      margin: 0 auto 24px;
      padding: 10px 28px;
      background: #1d4ed8;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.3px;
    }
    .print-btn:hover { background: #1e40af; }
    @page { margin: 0.5in 0.75in; }
    @media print {
      body { padding: 0; max-width: 100%; color: #111827; background: #fff; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center; margin-bottom:20px;">
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="header">
    <div class="logo-text">PIMA MEDICAL INSTITUTE</div>
    <div class="sub-title">Paramedic Program</div>
    <div class="doc-title">Internship Completion Summary</div>
  </div>

  <div class="completed-stamp">
    <div class="stamp-text">Officially Completed</div>
    <div class="stamp-date">${formatDateLong(data.completed_at)}${data.completed_by ? ' &mdash; Verified by: ' + data.completed_by : ''}</div>
  </div>

  <!-- Student &amp; Program Info -->
  <div class="section">
    <div class="section-header">Student Information</div>
    <div class="info-grid">
      <div class="info-cell">
        <div class="info-label">Student Name</div>
        <div class="info-value">${data.student_name}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Program</div>
        <div class="info-value">${data.program}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Cohort</div>
        <div class="info-value ${!data.cohort ? 'empty' : ''}">${data.cohort || 'Not assigned'}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Agency</div>
        <div class="info-value ${!data.agency ? 'empty' : ''}">${data.agency || 'Not recorded'}</div>
      </div>
    </div>
  </div>

  <!-- Internship Timeline -->
  <div class="section">
    <div class="section-header">Internship Timeline</div>
    <div class="info-grid">
      <div class="info-cell">
        <div class="info-label">Start Date</div>
        <div class="info-value ${!data.start_date ? 'empty' : ''}">${data.start_date ? formatDateLong(data.start_date) : 'Not recorded'}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Completion Date</div>
        <div class="info-value">${formatDateLong(data.completion_date)}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Total Shifts</div>
        <div class="info-value">${data.total_shifts > 0 ? data.total_shifts : 'Not tracked'}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Total Hours</div>
        <div class="info-value">${data.total_hours > 0 ? data.total_hours + ' hrs (of ' + data.required_hours + ' required)' : 'Not tracked'}</div>
      </div>
      <div class="info-cell" style="grid-column: span 2;">
        <div class="info-label">Primary Preceptor</div>
        <div class="info-value ${!data.primary_preceptor ? 'empty' : ''}">${data.primary_preceptor || 'Not assigned'}</div>
      </div>
      ${data.preceptors.length > 1 ? `
      <div class="info-cell" style="grid-column: span 2;">
        <div class="info-label">All Preceptors</div>
        <div class="info-value">${data.preceptors.join(' &bull; ')}</div>
      </div>` : ''}
    </div>
  </div>

  <!-- Completion Checklist -->
  <div class="section">
    <div class="section-header">Completion Checklist</div>
    <table>
      <tbody>
        ${checklistRows}
      </tbody>
    </table>
  </div>

  <!-- Additional Status -->
  <div class="section">
    <div class="section-header">Additional Status</div>
    <table>
      <tbody>
        ${surveyRow}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div>Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</div>
    <div>PMI Paramedic Program &mdash; Internship Management System</div>
  </div>
</body>
</html>`;
  };

  const generateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const res = await fetch(`/api/clinical/internships/${internshipId}/closeout/summary`);
      const data = await res.json();
      if (!data.success) {
        showToastMessage(data.error || 'Failed to generate summary', 'error');
        return;
      }
      const html = renderSummaryHTML(data.summary);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      } else {
        showToastMessage('Popup was blocked. Please allow popups for this site.', 'error');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      showToastMessage('Failed to generate completion summary', 'error');
    }
    setGeneratingSummary(false);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Closeout Documents &amp; Completion</h3>
          </div>
        </div>
        <div className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Survey Modal */}
      {activeSurveyModal && (
        <CloseoutSurveyModal
          internship_id={internshipId}
          survey_type={activeSurveyModal.type}
          existing_survey={activeSurveyModal.existing as unknown as Parameters<typeof CloseoutSurveyModal>[0]['existing_survey']}
          onComplete={(survey) => handleSurveyComplete(survey as unknown as CloseoutSurvey)}
          onClose={() => setActiveSurveyModal(null)}
        />
      )}

      {/* Employment Verification Modal */}
      {showEmploymentModal && (
        <EmploymentVerificationModal
          internshipId={internshipId}
          existingVerification={employmentVerification}
          prefillData={{
            studentName,
            studentEmail,
            program,
          }}
          onClose={() => { setShowEmploymentModal(false); setEmploymentAutoGeneratePdf(false); }}
          onSaved={handleEmploymentSaved}
          autoGeneratePdf={employmentAutoGeneratePdf}
        />
      )}

      {/* Preceptor Eval Modal */}
      {showPreceptorEvalModal && (
        <PreceptorEvalModal
          internshipId={internshipId}
          studentName={studentName}
          onClose={() => setShowPreceptorEvalModal(false)}
        />
      )}

      {/* Section Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Closeout Documents &amp; Completion</h3>
          </div>
          {completedAt && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Completed
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Completed Banner */}
        {completedAt && (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <div className="font-semibold text-green-800 dark:text-green-300">Internship Officially Closed Out</div>
              <div className="text-sm text-green-700 dark:text-green-400">
                Completed {formatDateTime(completedAt)}
                {completedBy && <> by {completedBy}</>}
              </div>
            </div>
          </div>
        )}

        {/* Checklist */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Completion Checklist</h4>
          <div className="space-y-2">
            {checklist.map(item => {
              const isChecked = item.auto_checked || item.manual_override;
              return (
                <div
                  key={item.key}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                    isChecked
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-gray-50 dark:bg-gray-700/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isChecked ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-medium ${
                          isChecked
                            ? 'text-green-800 dark:text-green-300'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {item.label}
                        {item.auto_checked && (
                          <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">
                            (auto)
                          </span>
                        )}
                      </div>
                      {item.details && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.details}</div>
                      )}
                    </div>
                  </div>
                  {/* Manual override checkbox for non-auto items */}
                  {canEdit && !item.auto_checked && !completedAt && (
                    <label className="flex items-center gap-1.5 ml-3 flex-shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.manual_override}
                        onChange={e => handleManualOverride(item.key, e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Override</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Surveys Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Preceptor Evaluation Surveys</h4>
          </div>
          {surveysLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-400 dark:text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading surveys...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SURVEY_CONFIGS.map(config => {
                const existing = getSurveyForType(config.type);
                const isCompleted = !!existing;

                return (
                  <div
                    key={config.type}
                    className={`p-4 rounded-lg border ${
                      isCompleted
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                        : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {config.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {config.description}
                        </div>
                      </div>
                      <span
                        className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
                          isCompleted
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                            : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {isCompleted ? 'Completed' : 'Not Started'}
                      </span>
                    </div>

                    {isCompleted && existing.submitted_at && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Submitted {formatDate(existing.submitted_at)}
                        {existing.submitted_by && <> by {existing.submitted_by}</>}
                        {existing.preceptor_name && (
                          <> &bull; {existing.preceptor_name}</>
                        )}
                        {existing.agency_name && (
                          <> / {existing.agency_name}</>
                        )}
                      </div>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveSurveyModal({ type: config.type, existing: existing })
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          isCompleted
                            ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {isCompleted ? (
                          <>
                            <Pencil className="w-3.5 h-3.5" />
                            View / Edit
                          </>
                        ) : (
                          <>
                            <ClipboardList className="w-3.5 h-3.5" />
                            Fill Online
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Employment Verification Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Employment Verification</h4>
          </div>
          {employmentLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-400 dark:text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <div
              className={`p-4 rounded-lg border ${
                employmentVerification?.submitted_at
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                  : employmentVerification
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                  : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Employment Verification Release
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Record employer info for graduate employment tracking
                  </div>
                </div>
                <span
                  className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
                    employmentVerification?.submitted_at
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                      : employmentVerification
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                  }`}
                >
                  {employmentVerification?.submitted_at
                    ? 'Completed'
                    : employmentVerification
                    ? 'Draft'
                    : 'Not Started'}
                </span>
              </div>

              {employmentVerification?.submitted_at && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Submitted {formatDate(employmentVerification.submitted_at)}
                  {employmentVerification.submitted_by && <> by {employmentVerification.submitted_by}</>}
                  {employmentVerification.company_name && (
                    <> &bull; {employmentVerification.company_name}</>
                  )}
                  {employmentVerification.job_title && (
                    <> &mdash; {employmentVerification.job_title}</>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => { setEmploymentAutoGeneratePdf(false); setShowEmploymentModal(true); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      employmentVerification
                        ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {employmentVerification ? (
                      <>
                        <Pencil className="w-3.5 h-3.5" />
                        View / Edit
                      </>
                    ) : (
                      <>
                        <Briefcase className="w-3.5 h-3.5" />
                        Fill Online
                      </>
                    )}
                  </button>
                )}
                {employmentVerification && (
                  <button
                    type="button"
                    onClick={() => { setEmploymentAutoGeneratePdf(true); setShowEmploymentModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Generate PDF
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Preceptor Evaluation Request */}
        {canEdit && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Preceptor Evaluation Request</h4>
            </div>
            <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Request External Evaluation</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Send a secure, one-time evaluation link directly to the preceptor. No account required.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreceptorEvalModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Send Evaluation Request
              </button>
            </div>
          </div>
        )}

        {/* Downloadable Paper Forms */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Downloadable Paper Forms</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">For students who prefer paper forms. Fill out and upload completed copies above.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { label: 'Hospital Preceptor Survey', file: 'Hospital_Preceptors_and_Clinical_Site_Student_Survey.pdf' },
              { label: 'Field Preceptor Survey', file: 'Field_Preceptors_and_Capstone_Site_Student_Survey.pdf' },
              { label: 'Employment Verification Form', file: '24_Employment_Verification_Release.pdf' },
            ].map(form => (
              <a
                key={form.file}
                href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/closeout-documents/forms/${form.file}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-blue-600 dark:text-blue-400"
              >
                <Download className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{form.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Document Upload */}
        {canEdit && !completedAt && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Upload Documents</h4>
            <div className="flex gap-2 mb-3">
              <select
                value={selectedDocType}
                onChange={e => setSelectedDocType(e.target.value)}
                className="px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div
              className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer ${
                dragOver
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 dark:hover:border-emerald-500'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Uploading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-7 h-7 text-gray-400" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Click to upload</span>
                    {' '}or drag and drop
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">PDF, JPG, PNG up to 10MB</div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileInputChange}
                className="hidden"
                disabled={uploading}
              />
            </div>
          </div>
        )}

        {/* Documents List */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Uploaded Documents
            {documents.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                ({documents.length})
              </span>
            )}
          </h4>
          {documents.length === 0 ? (
            <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No documents uploaded yet
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
                >
                  <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {decodeURIComponent(doc.file_url.split('/').pop() || 'Document').replace(/^\d+_[^_]+_/, '')}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span
                        className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                          DOC_TYPE_COLORS[doc.doc_type] || DOC_TYPE_COLORS.other
                        }`}
                      >
                        {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(doc.uploaded_at)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        by {doc.uploaded_by}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {isAdmin && !completedAt && (
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={deletingId === doc.id}
                        className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === doc.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Generate Completion Summary Button (only when completed) */}
        {completedAt && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={generateSummary}
              disabled={generatingSummary}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {generatingSummary ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Printer className="w-5 h-5" />
              )}
              Generate Completion Summary
            </button>
          </div>
        )}

        {/* Mark Complete Button */}
        {isAdmin && !completedAt && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            {!allChecked && (
              <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
                      {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} still pending:
                    </div>
                    <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                      {pendingItems.map(item => (
                        <li key={item.key} className="flex items-center gap-1">
                          <XCircle className="w-3 h-3 flex-shrink-0" />
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {showCompleteConfirm ? (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-300 mb-3 font-medium">
                  Are you sure you want to mark this internship as officially complete? This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkComplete}
                    disabled={completing}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm Complete
                  </button>
                  <button
                    onClick={() => setShowCompleteConfirm(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCompleteConfirm(true)}
                disabled={!allChecked}
                title={
                  !allChecked
                    ? `${pendingItems.length} item(s) still pending`
                    : 'Mark internship as officially complete'
                }
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  allChecked
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                Mark Internship Complete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
