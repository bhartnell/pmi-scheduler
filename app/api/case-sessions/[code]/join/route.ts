import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { broadcastSessionUpdate } from '@/lib/case-session-realtime';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface JoinedStudent {
  student_session_id: string;
  student_id: string | null;
  student_email: string | null;
  student_name: string;
  initials: string;
  joined_at: string;
}

/**
 * Generate initials from a name, deduplicating against existing initials.
 * If "JM" already exists, returns "JM2", "JM3", etc.
 */
function generateUniqueInitials(
  name: string,
  existingInitials: string[]
): string {
  const parts = name.trim().split(/\s+/);
  const firstInitial = (parts[0]?.[0] || '?').toUpperCase();
  const lastInitial = (parts.length > 1 ? parts[parts.length - 1][0] : '').toUpperCase();
  const baseInitials = `${firstInitial}${lastInitial}` || '??';

  if (!existingInitials.includes(baseInitials)) {
    return baseInitials;
  }

  // Find next available suffix
  let suffix = 2;
  while (existingInitials.includes(`${baseInitials}${suffix}`)) {
    suffix++;
  }
  return `${baseInitials}${suffix}`;
}

/**
 * Generate a unique student session ID (for tracking this student in this session).
 */
function generateStudentSessionId(): string {
  return `stu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// POST /api/case-sessions/[code]/join — Student joins a session
//
// Body: { student_name?, student_email? }
// If authenticated: auto-populate from students table
// If guest: require display name
//
// Returns: { student_session_id, initials, session_status }
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const supabase = getSupabaseAdmin();

    // Look up session
    const { data: sessionData, error: sessionError } = await supabase
      .from('case_sessions')
      .select('id, session_code, status, settings')
      .eq('session_code', code.toUpperCase())
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Only allow joining if session is 'waiting' or 'active'
    if (!['waiting', 'active'].includes(sessionData.status)) {
      return NextResponse.json(
        { error: `Cannot join session with status: ${sessionData.status}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    let studentName = body.student_name || '';
    let studentEmail = body.student_email || null;
    let studentId: string | null = null;

    // Check for authenticated user
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      // Try to find a student record
      const { data: student } = await supabase
        .from('students')
        .select('id, email, first_name, last_name')
        .ilike('email', session.user.email)
        .single();

      if (student) {
        studentId = student.id;
        studentEmail = student.email;
        studentName =
          `${student.first_name || ''} ${student.last_name || ''}`.trim() ||
          studentName;
      } else {
        // Authenticated but not in students table — use session email
        studentEmail = session.user.email;
        studentName = studentName || session.user.name || session.user.email.split('@')[0];
      }
    }

    // Guest must supply a display name
    if (!studentName) {
      return NextResponse.json(
        { error: 'student_name is required for guest users' },
        { status: 400 }
      );
    }

    // Get current joined students from settings
    const settings = (sessionData.settings || {}) as Record<string, unknown>;
    const joinedStudents: JoinedStudent[] = Array.isArray(settings.joined_students)
      ? (settings.joined_students as JoinedStudent[])
      : [];

    // Check if this student already joined (by email or student_id)
    const alreadyJoined = joinedStudents.find((s) => {
      if (studentId && s.student_id === studentId) return true;
      if (studentEmail && s.student_email === studentEmail) return true;
      return false;
    });

    if (alreadyJoined) {
      // Return existing join data (idempotent)
      return NextResponse.json({
        success: true,
        student_session_id: alreadyJoined.student_session_id,
        initials: alreadyJoined.initials,
        session_status: sessionData.status,
        already_joined: true,
      });
    }

    // Generate unique initials
    const existingInitials = joinedStudents.map((s) => s.initials);
    const initials = generateUniqueInitials(studentName, existingInitials);

    // Create student session entry
    const studentSessionId = generateStudentSessionId();
    const newStudent: JoinedStudent = {
      student_session_id: studentSessionId,
      student_id: studentId,
      student_email: studentEmail,
      student_name: studentName,
      initials,
      joined_at: new Date().toISOString(),
    };

    // Update settings with the new joined student
    const updatedStudents = [...joinedStudents, newStudent];
    const updatedSettings = { ...settings, joined_students: updatedStudents };

    const { error: updateError } = await supabase
      .from('case_sessions')
      .update({
        settings: updatedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionData.id);

    if (updateError) {
      console.error('Error updating session with joined student:', updateError);
      return NextResponse.json(
        { error: 'Failed to join session' },
        { status: 500 }
      );
    }

    // Broadcast student_joined event
    await broadcastSessionUpdate(sessionData.session_code, 'student_joined', {
      student_session_id: studentSessionId,
      initials,
      student_name: studentName,
      student_count: updatedStudents.length,
    });

    return NextResponse.json({
      success: true,
      student_session_id: studentSessionId,
      initials,
      session_status: sessionData.status,
      already_joined: false,
    });
  } catch (error) {
    console.error('Error joining session:', error);
    return NextResponse.json(
      { error: 'Failed to join session' },
      { status: 500 }
    );
  }
}
