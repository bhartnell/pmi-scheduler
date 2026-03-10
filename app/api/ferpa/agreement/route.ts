import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import {
  hasAcceptedAgreement,
  recordAgreementAcceptance,
  getAgreementTemplate,
  type AgreementType,
} from '@/lib/ferpa';

const VALID_TYPES: AgreementType[] = [
  'student_data_use',
  'agency_data_sharing',
  'instructor_confidentiality',
];

// ---------------------------------------------------------------------------
// GET /api/ferpa/agreement?type=student_data_use
//
// Returns the current agreement text, version, and whether the user has accepted.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const type = request.nextUrl.searchParams.get('type') as AgreementType | null;
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: 'Invalid or missing agreement type. Valid types: ' + VALID_TYPES.join(', ') },
      { status: 400 }
    );
  }

  const [template, status] = await Promise.all([
    getAgreementTemplate(type),
    hasAcceptedAgreement(user.email, type),
  ]);

  if (!template) {
    return NextResponse.json(
      { error: 'Agreement template not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    agreementType: type,
    text: template.text,
    version: template.version,
    accepted: status.accepted,
    acceptedAt: status.acceptedAt || null,
  });
}

// ---------------------------------------------------------------------------
// POST /api/ferpa/agreement
//
// Record that the current user accepts the specified agreement.
// Body: { agreement_type: string, version: number }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = await request.json();
  const { agreement_type, version } = body;

  if (!agreement_type || !VALID_TYPES.includes(agreement_type)) {
    return NextResponse.json(
      { error: 'Invalid or missing agreement_type' },
      { status: 400 }
    );
  }

  if (!version || typeof version !== 'number') {
    return NextResponse.json(
      { error: 'Invalid or missing version' },
      { status: 400 }
    );
  }

  // Extract IP and user agent from request headers
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const result = await recordAgreementAcceptance({
    email: user.email,
    role: user.role,
    type: agreement_type,
    version,
    ipAddress,
    userAgent,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: 'Failed to record acceptance', details: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Agreement accepted',
    acceptedAt: new Date().toISOString(),
  });
}
