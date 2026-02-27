'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  Save,
  CheckCircle2,
  Printer,
} from 'lucide-react';

interface EmploymentVerification {
  id: string;
  internship_id: string;
  student_name: string | null;
  last_four_ssn: string | null;
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
  employment_start_date: string | null;
  starting_salary: string | null;
  employment_type: 'full_time' | 'part_time' | null;
  verifying_staff_name: string | null;
  verifying_staff_title: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
}

interface EmploymentVerificationModalProps {
  internshipId: string;
  existingVerification: EmploymentVerification | null;
  prefillData: {
    studentName: string;
    studentEmail: string;
    program: string;
  };
  onClose: () => void;
  onSaved: (verification: EmploymentVerification) => void;
  autoGeneratePdf?: boolean;
}

type FormData = {
  student_name: string;
  last_four_ssn: string;
  program: string;
  phone: string;
  email: string;
  address: string;
  company_name: string;
  job_title: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  company_fax: string;
  employment_start_date: string;
  starting_salary: string;
  employment_type: '' | 'full_time' | 'part_time';
  verifying_staff_name: string;
  verifying_staff_title: string;
};

const EMPTY_FORM: FormData = {
  student_name: '',
  last_four_ssn: '',
  program: '',
  phone: '',
  email: '',
  address: '',
  company_name: '',
  job_title: '',
  company_address: '',
  company_email: '',
  company_phone: '',
  company_fax: '',
  employment_start_date: '',
  starting_salary: '',
  employment_type: '',
  verifying_staff_name: '',
  verifying_staff_title: '',
};

export default function EmploymentVerificationModal({
  internshipId,
  existingVerification,
  prefillData,
  onClose,
  onSaved,
  autoGeneratePdf = false,
}: EmploymentVerificationModalProps) {
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    if (existingVerification) {
      setFormData({
        student_name: existingVerification.student_name || '',
        last_four_ssn: existingVerification.last_four_ssn || '',
        program: existingVerification.program || '',
        phone: existingVerification.phone || '',
        email: existingVerification.email || '',
        address: existingVerification.address || '',
        company_name: existingVerification.company_name || '',
        job_title: existingVerification.job_title || '',
        company_address: existingVerification.company_address || '',
        company_email: existingVerification.company_email || '',
        company_phone: existingVerification.company_phone || '',
        company_fax: existingVerification.company_fax || '',
        employment_start_date: existingVerification.employment_start_date || '',
        starting_salary: existingVerification.starting_salary || '',
        employment_type: existingVerification.employment_type || '',
        verifying_staff_name: existingVerification.verifying_staff_name || '',
        verifying_staff_title: existingVerification.verifying_staff_title || '',
      });
    } else {
      setFormData({
        ...EMPTY_FORM,
        student_name: prefillData.studentName,
        program: prefillData.program,
        email: prefillData.studentEmail,
      });
    }
  }, [existingVerification, prefillData]);

  // Auto-generate PDF when modal opens in PDF mode - runs after formData is populated
  useEffect(() => {
    if (autoGeneratePdf && formData.student_name) {
      generatePDF();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGeneratePdf, formData.student_name]);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.student_name.trim()) {
      newErrors.student_name = 'Student name is required';
    }
    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Company name is required';
    }
    if (!formData.job_title.trim()) {
      newErrors.job_title = 'Job title is required';
    }
    if (!formData.employment_start_date) {
      newErrors.employment_start_date = 'Employment start date is required';
    }
    if (!formData.employment_type) {
      newErrors.employment_type = 'Employment type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (isDraft: boolean) => {
    if (!isDraft && !validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        ...formData,
        is_draft: isDraft,
        ...(existingVerification ? { verification_id: existingVerification.id } : {}),
      };

      const method = existingVerification ? 'PUT' : 'POST';
      const res = await fetch(
        `/api/clinical/internships/${internshipId}/closeout/employment`,
        {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (data.success) {
        onSaved(data.verification);
      } else {
        console.error('Save failed:', data.error);
      }
    } catch (err) {
      console.error('Error saving employment verification:', err);
    }
    setSaving(false);
  };

  const generatePDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const employmentTypeLabel =
      formData.employment_type === 'full_time'
        ? 'Full-Time'
        : formData.employment_type === 'part_time'
        ? 'Part-Time'
        : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Employment Verification - ${formData.student_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #000; }
          h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
          h2 { text-align: center; font-size: 16px; margin-top: 0; margin-bottom: 24px; }
          .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase;
            border-bottom: 2px solid #000; padding-bottom: 4px; margin: 20px 0 12px; }
          .field { display: flex; margin: 8px 0; align-items: flex-start; }
          .label { font-weight: bold; font-size: 12px; min-width: 200px; padding-top: 2px; }
          .value { font-size: 12px; border-bottom: 1px solid #555;
            flex: 1; min-height: 18px; padding-bottom: 2px; }
          .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .footer { margin-top: 40px; font-size: 11px; color: #555; text-align: center; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>PIMA MEDICAL INSTITUTE</h1>
        <h2>Employment Verification Release</h2>

        <div class="section-title">Student Information</div>
        <div class="field">
          <div class="label">Student Name:</div>
          <div class="value">${formData.student_name || ''}</div>
        </div>
        <div class="two-col">
          <div class="field">
            <div class="label">Last 4 SSN:</div>
            <div class="value">${formData.last_four_ssn ? 'XXX-XX-' + formData.last_four_ssn : ''}</div>
          </div>
          <div class="field">
            <div class="label">Program:</div>
            <div class="value">${formData.program || ''}</div>
          </div>
        </div>
        <div class="two-col">
          <div class="field">
            <div class="label">Phone:</div>
            <div class="value">${formData.phone || ''}</div>
          </div>
          <div class="field">
            <div class="label">Email:</div>
            <div class="value">${formData.email || ''}</div>
          </div>
        </div>
        <div class="field">
          <div class="label">Address:</div>
          <div class="value">${formData.address || ''}</div>
        </div>

        <div class="section-title">Employment Information</div>
        <div class="two-col">
          <div class="field">
            <div class="label">Company Name:</div>
            <div class="value">${formData.company_name || ''}</div>
          </div>
          <div class="field">
            <div class="label">Job Title:</div>
            <div class="value">${formData.job_title || ''}</div>
          </div>
        </div>
        <div class="field">
          <div class="label">Company Address:</div>
          <div class="value">${formData.company_address || ''}</div>
        </div>
        <div class="two-col">
          <div class="field">
            <div class="label">Company Email:</div>
            <div class="value">${formData.company_email || ''}</div>
          </div>
          <div class="field">
            <div class="label">Company Phone:</div>
            <div class="value">${formData.company_phone || ''}</div>
          </div>
        </div>
        <div class="two-col">
          <div class="field">
            <div class="label">Company Fax:</div>
            <div class="value">${formData.company_fax || ''}</div>
          </div>
          <div class="field">
            <div class="label">Employment Start Date:</div>
            <div class="value">${formData.employment_start_date ? new Date(formData.employment_start_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</div>
          </div>
        </div>
        <div class="two-col">
          <div class="field">
            <div class="label">Starting Salary:</div>
            <div class="value">${formData.starting_salary || ''}</div>
          </div>
          <div class="field">
            <div class="label">Employment Type:</div>
            <div class="value">${employmentTypeLabel}</div>
          </div>
        </div>

        <div class="section-title">Verification</div>
        <div class="two-col">
          <div class="field">
            <div class="label">Verifying Staff Member:</div>
            <div class="value">${formData.verifying_staff_name || ''}</div>
          </div>
          <div class="field">
            <div class="label">Title:</div>
            <div class="value">${formData.verifying_staff_title || ''}</div>
          </div>
        </div>

        <div class="footer">
          Pima Medical Institute &bull; Paramedic Program &bull; Employment Verification Release
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Employment Verification Release
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Section 1: Student Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
              Student Information
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Student Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.student_name}
                  onChange={e => handleChange('student_name', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    errors.student_name
                      ? 'border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Full name"
                />
                {errors.student_name && (
                  <p className="mt-1 text-xs text-red-500">{errors.student_name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last 4 of SSN
                  </label>
                  <input
                    type="password"
                    value={formData.last_four_ssn}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      handleChange('last_four_ssn', val);
                    }}
                    maxLength={4}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="****"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Program
                  </label>
                  <input
                    type="text"
                    value={formData.program}
                    onChange={e => handleChange('program', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Paramedic"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="(555) 000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="student@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={e => handleChange('address', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  placeholder="Street, City, State, ZIP"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Employment Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
              Employment Information
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={e => handleChange('company_name', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                      errors.company_name
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Employer name"
                  />
                  {errors.company_name && (
                    <p className="mt-1 text-xs text-red-500">{errors.company_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.job_title}
                    onChange={e => handleChange('job_title', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                      errors.job_title
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Position title"
                  />
                  {errors.job_title && (
                    <p className="mt-1 text-xs text-red-500">{errors.job_title}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company Address
                </label>
                <textarea
                  value={formData.company_address}
                  onChange={e => handleChange('company_address', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  placeholder="Street, City, State, ZIP"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Email
                  </label>
                  <input
                    type="email"
                    value={formData.company_email}
                    onChange={e => handleChange('company_email', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="hr@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.company_phone}
                    onChange={e => handleChange('company_phone', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="(555) 000-0000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Fax
                  </label>
                  <input
                    type="tel"
                    value={formData.company_fax}
                    onChange={e => handleChange('company_fax', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="(555) 000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Employment Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.employment_start_date}
                    onChange={e => handleChange('employment_start_date', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                      errors.employment_start_date
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.employment_start_date && (
                    <p className="mt-1 text-xs text-red-500">{errors.employment_start_date}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Starting Salary
                  </label>
                  <input
                    type="text"
                    value={formData.starting_salary}
                    onChange={e => handleChange('starting_salary', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., $55,000/yr or $28/hr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Employment Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="employment_type"
                        value="full_time"
                        checked={formData.employment_type === 'full_time'}
                        onChange={() => handleChange('employment_type', 'full_time')}
                        className="text-emerald-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Full-Time</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="employment_type"
                        value="part_time"
                        checked={formData.employment_type === 'part_time'}
                        onChange={() => handleChange('employment_type', 'part_time')}
                        className="text-emerald-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Part-Time</span>
                    </label>
                  </div>
                  {errors.employment_type && (
                    <p className="mt-1 text-xs text-red-500">{errors.employment_type}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Verifying Staff Member Name
                  </label>
                  <input
                    type="text"
                    value={formData.verifying_staff_name}
                    onChange={e => handleChange('verifying_staff_name', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Staff member name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Verifying Staff Member Title
                  </label>
                  <input
                    type="text"
                    value={formData.verifying_staff_title}
                    onChange={e => handleChange('verifying_staff_title', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Program Director"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 gap-3">
          <button
            onClick={generatePDF}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            Generate PDF
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
