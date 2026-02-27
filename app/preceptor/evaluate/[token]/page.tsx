'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, ClipboardCheck } from 'lucide-react';

interface TokenData {
  preceptor_email: string;
  preceptor_name: string | null;
  student_name: string | null;
  expires_at: string;
}

interface InternshipData {
  id: string;
  agency_name: string | null;
  current_phase: string;
  students: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

type PageState = 'loading' | 'invalid' | 'expired' | 'used' | 'form' | 'submitted';

interface FormValues {
  professionalism_rating: number | null;
  clinical_skills_rating: number | null;
  communication_rating: number | null;
  overall_rating: number | null;
  strengths: string;
  areas_for_improvement: string;
  comments: string;
  preceptor_signature: string;
  shift_date: string;
}

const RATING_LABELS: Record<number, string> = {
  1: '1 - Unsatisfactory',
  2: '2 - Below Expectations',
  3: '3 - Meets Expectations',
  4: '4 - Exceeds Expectations',
  5: '5 - Outstanding',
};

function RatingGroup({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: number | null;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-semibold text-gray-800">{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{description}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
              value === n
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name={label}
              value={n}
              checked={value === n}
              onChange={() => !disabled && onChange(n)}
              disabled={disabled}
              className="sr-only"
            />
            <span className="font-semibold">{n}</span>
            <span className="hidden sm:inline text-xs text-gray-500">
              {['Unsatisfactory', 'Below Expectations', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding'][n - 1]}
            </span>
          </label>
        ))}
      </div>
      {value !== null && (
        <div className="text-xs text-blue-600 font-medium">{RATING_LABELS[value]}</div>
      )}
    </div>
  );
}

export default function PreceptorEvaluatePage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [internship, setInternship] = useState<InternshipData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<FormValues>({
    professionalism_rating: null,
    clinical_skills_rating: null,
    communication_rating: null,
    overall_rating: null,
    strengths: '',
    areas_for_improvement: '',
    comments: '',
    preceptor_signature: '',
    shift_date: today,
  });

  useEffect(() => {
    if (!token) return;
    fetch(`/api/clinical/preceptor-eval/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          const errType = data.error;
          if (errType === 'used') {
            setPageState('used');
          } else if (errType === 'expired') {
            setPageState('expired');
          } else {
            setErrorMessage(data.message || 'This link is invalid.');
            setPageState('invalid');
          }
          return;
        }
        setTokenData(data.token);
        setInternship(data.internship);
        // Pre-fill preceptor signature if name is known
        if (data.token.preceptor_name) {
          setForm((f) => ({ ...f, preceptor_signature: data.token.preceptor_name || '' }));
        }
        setPageState('form');
      })
      .catch(() => {
        setErrorMessage('A network error occurred. Please try again.');
        setPageState('invalid');
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!form.professionalism_rating || !form.clinical_skills_rating || !form.communication_rating || !form.overall_rating) {
      setSubmitError('Please provide all four ratings before submitting.');
      return;
    }
    if (!form.preceptor_signature.trim()) {
      setSubmitError('Please enter your name as your signature.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/clinical/preceptor-eval/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setPageState('submitted');
      } else {
        setSubmitError(data.message || 'Failed to submit. Please try again.');
      }
    } catch {
      setSubmitError('A network error occurred. Please try again.');
    }
    setSubmitting(false);
  };

  const studentFullName =
    tokenData?.student_name ||
    (internship?.students
      ? `${internship.students.first_name} ${internship.students.last_name}`
      : 'Student');

  // ----- LOADING -----
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm">Loading evaluation form...</p>
        </div>
      </div>
    );
  }

  // ----- INVALID / EXPIRED / USED -----
  if (pageState === 'invalid' || pageState === 'expired' || pageState === 'used') {
    const config = {
      invalid: {
        title: 'Link Not Found',
        body: errorMessage || 'This evaluation link is invalid or does not exist.',
        color: 'text-red-600',
        bg: 'bg-red-50 border-red-200',
        icon: <AlertCircle className="w-12 h-12 text-red-500" />,
      },
      expired: {
        title: 'Link Expired',
        body: 'This evaluation link has expired. Please contact your program coordinator to request a new link.',
        color: 'text-amber-600',
        bg: 'bg-amber-50 border-amber-200',
        icon: <AlertCircle className="w-12 h-12 text-amber-500" />,
      },
      used: {
        title: 'Already Submitted',
        body: 'This evaluation has already been submitted. Thank you for your time.',
        color: 'text-green-600',
        bg: 'bg-green-50 border-green-200',
        icon: <CheckCircle2 className="w-12 h-12 text-green-500" />,
      },
    }[pageState];

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
          <ClipboardCheck className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">PMI EMS Scheduler</div>
            <div className="text-xs text-gray-500">Pima Medical Institute Paramedic Program</div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className={`max-w-md w-full rounded-xl border p-8 text-center space-y-4 ${config.bg}`}>
            <div className="flex justify-center">{config.icon}</div>
            <h1 className={`text-xl font-bold ${config.color}`}>{config.title}</h1>
            <p className="text-gray-600 text-sm leading-relaxed">{config.body}</p>
          </div>
        </main>
      </div>
    );
  }

  // ----- SUBMITTED -----
  if (pageState === 'submitted') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
          <ClipboardCheck className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">PMI EMS Scheduler</div>
            <div className="text-xs text-gray-500">Pima Medical Institute Paramedic Program</div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border border-green-200 bg-green-50 p-8 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="w-14 h-14 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-green-700">Thank You!</h1>
            <p className="text-gray-700 text-sm leading-relaxed">
              Your evaluation for <strong>{studentFullName}</strong> has been submitted successfully.
              The program coordinator has been notified.
            </p>
            <p className="text-gray-500 text-xs">You may close this window.</p>
          </div>
        </main>
      </div>
    );
  }

  // ----- FORM -----
  const expiresDate = tokenData?.expires_at
    ? new Date(tokenData.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <ClipboardCheck className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">PMI EMS Scheduler</div>
            <div className="text-xs text-gray-500">Pima Medical Institute Paramedic Program</div>
          </div>
        </div>
      </header>

      <main className="flex-1 py-6 px-4">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Title card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h1 className="text-xl font-bold text-gray-900">Preceptor Evaluation Form</h1>
            <p className="text-sm text-gray-500 mt-1">
              Please evaluate the student&apos;s performance during their clinical internship.
            </p>
            <div className="mt-3 space-y-1 text-sm text-gray-700">
              {studentFullName && (
                <div>
                  <span className="font-medium text-gray-500">Student:</span>{' '}
                  <span className="font-semibold">{studentFullName}</span>
                </div>
              )}
              {internship?.agency_name && (
                <div>
                  <span className="font-medium text-gray-500">Agency:</span>{' '}
                  <span>{internship.agency_name}</span>
                </div>
              )}
              {expiresDate && (
                <div>
                  <span className="font-medium text-gray-500">Link expires:</span>{' '}
                  <span className="text-amber-600">{expiresDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Section 1: Ratings */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-6">
              <div>
                <h2 className="text-base font-bold text-gray-900 mb-1">Performance Ratings</h2>
                <p className="text-xs text-gray-500">Rate the student on a scale of 1 (Unsatisfactory) to 5 (Outstanding) in each area.</p>
              </div>

              <RatingGroup
                label="Professional Behavior"
                description="Attitude, punctuality, appearance, teamwork, ethics, and accountability"
                value={form.professionalism_rating}
                onChange={(v) => setForm((f) => ({ ...f, professionalism_rating: v }))}
                disabled={submitting}
              />

              <RatingGroup
                label="Clinical Skills"
                description="Assessment ability, technical skills, patient care, and protocol adherence"
                value={form.clinical_skills_rating}
                onChange={(v) => setForm((f) => ({ ...f, clinical_skills_rating: v }))}
                disabled={submitting}
              />

              <RatingGroup
                label="Communication"
                description="Verbal and written communication, patient rapport, and team interaction"
                value={form.communication_rating}
                onChange={(v) => setForm((f) => ({ ...f, communication_rating: v }))}
                disabled={submitting}
              />

              <RatingGroup
                label="Overall Readiness"
                description="Overall readiness for independent practice as a paramedic"
                value={form.overall_rating}
                onChange={(v) => setForm((f) => ({ ...f, overall_rating: v }))}
                disabled={submitting}
              />
            </div>

            {/* Section 2: Comments */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <h2 className="text-base font-bold text-gray-900">Comments</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Strengths <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.strengths}
                  onChange={(e) => setForm((f) => ({ ...f, strengths: e.target.value }))}
                  rows={3}
                  disabled={submitting}
                  placeholder="What did the student do particularly well?"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Areas for Improvement <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.areas_for_improvement}
                  onChange={(e) => setForm((f) => ({ ...f, areas_for_improvement: e.target.value }))}
                  rows={3}
                  disabled={submitting}
                  placeholder="What areas would benefit from further development?"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Comments <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.comments}
                  onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
                  rows={3}
                  disabled={submitting}
                  placeholder="Any other feedback for the program or student..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
                />
              </div>
            </div>

            {/* Section 3: Signature */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <h2 className="text-base font-bold text-gray-900">Signature</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evaluation Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.shift_date}
                  onChange={(e) => setForm((f) => ({ ...f, shift_date: e.target.value }))}
                  max={today}
                  disabled={submitting}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name (Electronic Signature) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.preceptor_signature}
                  onChange={(e) => setForm((f) => ({ ...f, preceptor_signature: e.target.value }))}
                  disabled={submitting}
                  placeholder="Type your full name"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
                <p className="text-xs text-gray-400 mt-1">
                  By typing your name, you confirm this evaluation is accurate to the best of your knowledge.
                </p>
              </div>
            </div>

            {/* Error */}
            {submitError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Submit Evaluation
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-400 pb-4">
              This form is secure and your response will be sent directly to the program coordinator.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
