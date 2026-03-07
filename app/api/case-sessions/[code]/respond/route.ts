import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { broadcastSessionUpdate } from '@/lib/case-session-realtime';
import type { CaseQuestion } from '@/types/case-studies';

// ---------------------------------------------------------------------------
// Scoring logic — mirrors app/api/cases/[id]/practice/respond/route.ts
// ---------------------------------------------------------------------------

function scoreResponse(
  question: CaseQuestion,
  response: unknown
): { isCorrect: boolean; pointsEarned: number } {
  const maxPoints = question.points || 10;

  switch (question.type) {
    case 'multiple_choice': {
      const studentAnswer =
        typeof response === 'object' && response !== null
          ? (response as Record<string, unknown>).value
          : response;
      const isCorrect =
        String(studentAnswer) === String(question.correct_answer);
      return { isCorrect, pointsEarned: isCorrect ? maxPoints : 0 };
    }

    case 'multi_select': {
      const correctAnswers = Array.isArray(question.correct_answer)
        ? question.correct_answer
        : [question.correct_answer];
      const studentAnswers: string[] = Array.isArray(response)
        ? response
        : typeof response === 'object' && response !== null
          ? Array.isArray((response as Record<string, unknown>).value)
            ? ((response as Record<string, unknown>).value as string[])
            : [String((response as Record<string, unknown>).value)]
          : [String(response)];

      const correctSet = new Set(correctAnswers.map(String));
      const studentSet = new Set(studentAnswers.map(String));

      let correctSelections = 0;
      for (const ans of studentSet) {
        if (correctSet.has(ans)) correctSelections++;
      }

      const wrongSelections = studentSet.size - correctSelections;
      const adjustedScore = Math.max(0, correctSelections - wrongSelections);
      const ratio = correctSet.size > 0 ? adjustedScore / correctSet.size : 0;
      const pointsEarned = Math.round(ratio * maxPoints);
      const isCorrect =
        correctSelections === correctSet.size && wrongSelections === 0;
      return { isCorrect, pointsEarned };
    }

    case 'ordered_list': {
      const correctOrder = Array.isArray(question.correct_answer)
        ? question.correct_answer
        : [];
      const studentOrder: string[] = Array.isArray(response)
        ? response
        : typeof response === 'object' && response !== null
          ? Array.isArray((response as Record<string, unknown>).value)
            ? ((response as Record<string, unknown>).value as string[])
            : []
          : [];

      if (correctOrder.length === 0) {
        return { isCorrect: true, pointsEarned: maxPoints };
      }

      let correctPositions = 0;
      for (let i = 0; i < correctOrder.length; i++) {
        if (
          i < studentOrder.length &&
          String(studentOrder[i]) === String(correctOrder[i])
        ) {
          correctPositions++;
        }
      }

      const ratio = correctPositions / correctOrder.length;
      const pointsEarned = Math.round(ratio * maxPoints);
      const isCorrect = correctPositions === correctOrder.length;
      return { isCorrect, pointsEarned };
    }

    case 'numeric': {
      const studentValue =
        typeof response === 'object' && response !== null
          ? Number((response as Record<string, unknown>).value)
          : Number(response);
      const correctValue = Number(question.correct_answer);
      const tolerance = question.tolerance || 0;

      if (isNaN(studentValue) || isNaN(correctValue)) {
        return { isCorrect: false, pointsEarned: 0 };
      }

      const isCorrect = Math.abs(studentValue - correctValue) <= tolerance;
      return { isCorrect, pointsEarned: isCorrect ? maxPoints : 0 };
    }

    case 'free_text': {
      return { isCorrect: true, pointsEarned: maxPoints };
    }

    default:
      return { isCorrect: false, pointsEarned: 0 };
  }
}

// ---------------------------------------------------------------------------
// Helper — identify a student from join data or session
// ---------------------------------------------------------------------------

interface JoinedStudent {
  student_session_id: string;
  student_id: string | null;
  student_email: string | null;
  student_name: string;
  initials: string;
  joined_at: string;
}

function findJoinedStudent(
  joinedStudents: JoinedStudent[],
  studentSessionId?: string,
  studentEmail?: string | null,
  studentId?: string | null
): JoinedStudent | undefined {
  if (studentSessionId) {
    const found = joinedStudents.find(
      (s) => s.student_session_id === studentSessionId
    );
    if (found) return found;
  }
  if (studentId) {
    const found = joinedStudents.find((s) => s.student_id === studentId);
    if (found) return found;
  }
  if (studentEmail) {
    const found = joinedStudents.find((s) => s.student_email === studentEmail);
    if (found) return found;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// POST /api/case-sessions/[code]/respond — Submit an answer
//
// Body: { phase_id, question_id, response, time_taken_seconds, student_session_id? }
//
// Requires student identification (authenticated user or student_session_id from join).
// Scores immediately, broadcasts response_count to instructor.
// Returns: { received: true } — NOT the correct answer.
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
      .select('id, case_id, session_code, status, settings')
      .eq('session_code', code.toUpperCase())
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (sessionData.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is not active' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      phase_id,
      question_id,
      response,
      time_taken_seconds,
      student_session_id,
    } = body;

    if (!phase_id || !question_id || response === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: phase_id, question_id, response' },
        { status: 400 }
      );
    }

    // Identify the student
    let studentId: string | null = null;
    let studentEmail: string | null = null;
    let studentName = '';
    let studentInitials = '';

    // Check for authenticated user
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      const { data: student } = await supabase
        .from('students')
        .select('id, email, first_name, last_name')
        .ilike('email', session.user.email)
        .single();

      if (student) {
        studentId = student.id;
        studentEmail = student.email;
        studentName =
          `${student.first_name || ''} ${student.last_name || ''}`.trim();
      } else {
        studentEmail = session.user.email;
        studentName = session.user.name || session.user.email.split('@')[0];
      }
    }

    // Find the student in joined_students list
    const settings = (sessionData.settings || {}) as Record<string, unknown>;
    const joinedStudents: JoinedStudent[] = Array.isArray(
      settings.joined_students
    )
      ? (settings.joined_students as JoinedStudent[])
      : [];

    const joinedStudent = findJoinedStudent(
      joinedStudents,
      student_session_id,
      studentEmail,
      studentId
    );

    if (!joinedStudent) {
      return NextResponse.json(
        { error: 'Student has not joined this session. Please join first.' },
        { status: 403 }
      );
    }

    // Use joined student data for consistency
    studentId = joinedStudent.student_id;
    studentEmail = joinedStudent.student_email;
    studentName = joinedStudent.student_name;
    studentInitials = joinedStudent.initials;

    // Fetch the case to find the question
    const { data: caseStudy, error: caseError } = await supabase
      .from('case_studies')
      .select('phases')
      .eq('id', sessionData.case_id)
      .single();

    if (caseError || !caseStudy) {
      return NextResponse.json(
        { error: 'Case study not found' },
        { status: 404 }
      );
    }

    // Find the question in the case phases
    const phases = (caseStudy.phases || []) as Array<{
      id: string;
      questions?: CaseQuestion[];
    }>;

    let question: CaseQuestion | null = null;
    for (const phase of phases) {
      if (phase.id === phase_id) {
        for (const q of phase.questions || []) {
          if (q.id === question_id) {
            question = q;
            break;
          }
        }
        break;
      }
    }

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found in case' },
        { status: 404 }
      );
    }

    // Check for duplicate submission
    const { data: existingResponse } = await supabase
      .from('case_responses')
      .select('id')
      .eq('session_id', sessionData.id)
      .eq('phase_id', phase_id)
      .eq('question_id', question_id)
      .eq('student_initials', studentInitials)
      .limit(1)
      .maybeSingle();

    if (existingResponse) {
      return NextResponse.json(
        { error: 'Response already submitted for this question' },
        { status: 409 }
      );
    }

    // Score the response
    const { isCorrect, pointsEarned } = scoreResponse(question, response);

    // Create case_responses record
    const { error: responseError } = await supabase
      .from('case_responses')
      .insert({
        session_id: sessionData.id,
        case_id: sessionData.case_id,
        student_id: studentId,
        student_email: studentEmail,
        student_name: studentName,
        student_initials: studentInitials,
        phase_id,
        question_id,
        response: typeof response === 'object' ? response : { value: response },
        is_correct: isCorrect,
        points_earned: pointsEarned,
        time_taken_seconds: time_taken_seconds || null,
        hints_used: 0,
        attempt_number: 1,
      });

    if (responseError) {
      console.error('Error saving response:', responseError);
      return NextResponse.json(
        { error: 'Failed to save response' },
        { status: 500 }
      );
    }

    // Get response count for this question to broadcast
    const { count: responseCount } = await supabase
      .from('case_responses')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionData.id)
      .eq('phase_id', phase_id)
      .eq('question_id', question_id);

    // Broadcast response_count to instructor channel
    await broadcastSessionUpdate(sessionData.session_code, 'response_count', {
      phase_id,
      question_id,
      count: responseCount || 0,
      student_count: joinedStudents.length,
    });

    // Return acknowledgment only — NOT the correct answer
    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error('Error submitting response:', error);
    return NextResponse.json(
      { error: 'Failed to submit response' },
      { status: 500 }
    );
  }
}
