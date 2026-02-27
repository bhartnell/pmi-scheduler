import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Question definitions mirrored from the survey component
// Keys match the JSONB responses field (q1..q19)
const HOSPITAL_QUESTIONS = [
  { number: 1,  category: 'Professionalism', text: 'Demonstrates professional demeanor and appearance' },
  { number: 2,  category: 'Professionalism', text: 'Maintains patient confidentiality' },
  { number: 3,  category: 'Professionalism', text: 'Is punctual and reliable' },
  { number: 4,  category: 'Clinical Skills', text: 'Demonstrates competency in patient assessment' },
  { number: 5,  category: 'Clinical Skills', text: 'Performs skills with appropriate technique' },
  { number: 6,  category: 'Clinical Skills', text: 'Makes appropriate clinical decisions' },
  { number: 7,  category: 'Clinical Skills', text: 'Demonstrates knowledge of pharmacology' },
  { number: 8,  category: 'Communication', text: 'Communicates effectively with patients' },
  { number: 9,  category: 'Communication', text: 'Communicates effectively with staff and providers' },
  { number: 10, category: 'Communication', text: 'Provides accurate and thorough patient reports' },
  { number: 11, category: 'Attitude & Learning', text: 'Shows initiative and motivation to learn' },
  { number: 12, category: 'Attitude & Learning', text: 'Accepts feedback and corrects behavior appropriately' },
  { number: 13, category: 'Attitude & Learning', text: 'Works well as part of the team' },
  { number: 14, category: 'Patient Care', text: 'Shows compassion and empathy toward patients' },
  { number: 15, category: 'Patient Care', text: 'Maintains patient safety at all times' },
  { number: 16, category: 'Patient Care', text: 'Prioritizes patient comfort and dignity' },
  { number: 17, category: 'Overall', text: 'Overall clinical performance' },
  { number: 18, category: 'Overall', text: 'Readiness to function as an entry-level paramedic' },
  { number: 19, category: 'Overall', text: 'Would you accept this student again?' },
];

const FIELD_QUESTIONS = [
  { number: 1,  category: 'Professionalism', text: 'Demonstrates professional demeanor and appearance' },
  { number: 2,  category: 'Professionalism', text: 'Maintains patient confidentiality' },
  { number: 3,  category: 'Professionalism', text: 'Is punctual and reliable for shifts' },
  { number: 4,  category: 'Clinical Skills', text: 'Demonstrates competency in patient assessment' },
  { number: 5,  category: 'Clinical Skills', text: 'Performs ALS skills with appropriate technique' },
  { number: 6,  category: 'Clinical Skills', text: 'Makes appropriate field treatment decisions' },
  { number: 7,  category: 'Clinical Skills', text: 'Demonstrates airway management competency' },
  { number: 8,  category: 'Communication', text: 'Communicates effectively with patients and families' },
  { number: 9,  category: 'Communication', text: 'Communicates effectively with crew and dispatch' },
  { number: 10, category: 'Communication', text: 'Provides accurate and complete patient care reports' },
  { number: 11, category: 'Attitude & Learning', text: 'Shows initiative and motivation to learn' },
  { number: 12, category: 'Attitude & Learning', text: 'Accepts feedback and corrects behavior appropriately' },
  { number: 13, category: 'Attitude & Learning', text: 'Works well as part of the EMS crew' },
  { number: 14, category: 'Patient Care', text: 'Shows compassion and empathy toward patients' },
  { number: 15, category: 'Patient Care', text: 'Maintains scene and patient safety' },
  { number: 16, category: 'Patient Care', text: 'Prioritizes patient comfort and dignity' },
  { number: 17, category: 'Overall', text: 'Overall field performance' },
  { number: 18, category: 'Overall', text: 'Readiness to function as an entry-level paramedic' },
  { number: 19, category: 'Overall', text: 'Would you accept this student for future rotations?' },
];

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Require admin+ role
    const { data: requestingUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!requestingUser || !hasMinRole(requestingUser.role, 'admin')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const typeFilter = searchParams.get('type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const agencyFilter = searchParams.get('agency');
    const preceptorFilter = searchParams.get('preceptor');

    // Build query with filters
    let query = supabase
      .from('closeout_surveys')
      .select('id, internship_id, survey_type, preceptor_name, agency_name, responses, submitted_by, submitted_at')
      .order('submitted_at', { ascending: false });

    if (typeFilter && (typeFilter === 'hospital_preceptor' || typeFilter === 'field_preceptor')) {
      query = query.eq('survey_type', typeFilter);
    }
    if (startDate) {
      query = query.gte('submitted_at', startDate);
    }
    if (endDate) {
      // Include the full end date day
      query = query.lte('submitted_at', endDate + 'T23:59:59.999Z');
    }
    if (agencyFilter) {
      query = query.ilike('agency_name', `%${agencyFilter}%`);
    }
    if (preceptorFilter) {
      query = query.ilike('preceptor_name', `%${preceptorFilter}%`);
    }

    const { data: surveys, error: surveysError } = await query;
    if (surveysError) {
      console.error('Error fetching closeout surveys:', surveysError.message);
      return NextResponse.json({ success: false, error: 'Failed to fetch surveys' }, { status: 500 });
    }

    const surveyList = surveys || [];

    if (surveyList.length === 0) {
      return NextResponse.json({
        success: true,
        surveys: [],
        summary: {
          total_surveys: 0,
          by_type: { hospital_preceptor: 0, field_preceptor: 0 },
          question_averages: [],
          preceptor_averages: [],
          site_averages: [],
          low_rated: [],
        },
      });
    }

    // Count by type
    const byType = { hospital_preceptor: 0, field_preceptor: 0 };
    for (const s of surveyList) {
      if (s.survey_type === 'hospital_preceptor') byType.hospital_preceptor++;
      else if (s.survey_type === 'field_preceptor') byType.field_preceptor++;
    }

    // Aggregate question averages
    // Use hospital questions as base (they have same structure as field)
    const questionTotals: Record<number, { sum: number; count: number; naCount: number }> = {};
    for (let i = 1; i <= 19; i++) {
      questionTotals[i] = { sum: 0, count: 0, naCount: 0 };
    }

    for (const survey of surveyList) {
      const responses = survey.responses as Record<string, number | null> || {};
      for (let i = 1; i <= 19; i++) {
        const key = `q${i}`;
        const val = responses[key];
        if (val === null || val === undefined) {
          questionTotals[i].naCount++;
        } else {
          const num = Number(val);
          if (!isNaN(num)) {
            questionTotals[i].sum += num;
            questionTotals[i].count++;
          }
        }
      }
    }

    // Determine question text - use whichever type is dominant, or hospital if mixed
    const dominantType = byType.hospital_preceptor >= byType.field_preceptor ? 'hospital' : 'field';
    const questionDefs = dominantType === 'hospital' ? HOSPITAL_QUESTIONS : FIELD_QUESTIONS;

    const questionAverages = questionDefs.map((q) => {
      const totals = questionTotals[q.number];
      const avgScore = totals.count > 0 ? Math.round((totals.sum / totals.count) * 10) / 10 : null;
      return {
        question_number: q.number,
        question_text: q.text,
        category: q.category,
        avg_score: avgScore,
        response_count: totals.count,
        na_count: totals.naCount,
      };
    });

    // Preceptor averages
    const preceptorMap: Record<string, { agency: string; scores: number[]; surveyCount: number }> = {};
    for (const survey of surveyList) {
      const name = survey.preceptor_name || 'Unknown Preceptor';
      const agency = survey.agency_name || 'Unknown Agency';
      const responses = survey.responses as Record<string, number | null> || {};

      if (!preceptorMap[name]) {
        preceptorMap[name] = { agency, scores: [], surveyCount: 0 };
      }
      preceptorMap[name].surveyCount++;

      // Calculate average score for this survey
      const numericScores: number[] = [];
      for (let i = 1; i <= 19; i++) {
        const val = responses[`q${i}`];
        if (val !== null && val !== undefined) {
          const num = Number(val);
          if (!isNaN(num)) numericScores.push(num);
        }
      }
      if (numericScores.length > 0) {
        const surveyAvg = numericScores.reduce((a, b) => a + b, 0) / numericScores.length;
        preceptorMap[name].scores.push(surveyAvg);
      }
    }

    const preceptorAverages = Object.entries(preceptorMap)
      .map(([name, data]) => {
        const avgScore = data.scores.length > 0
          ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10
          : null;
        return {
          preceptor_name: name,
          agency: data.agency,
          avg_score: avgScore,
          survey_count: data.surveyCount,
          flagged: avgScore !== null && avgScore < 3.0,
        };
      })
      .sort((a, b) => {
        // Flagged first, then by avg score descending
        if (a.flagged && !b.flagged) return -1;
        if (!a.flagged && b.flagged) return 1;
        if (a.avg_score === null) return 1;
        if (b.avg_score === null) return -1;
        return b.avg_score - a.avg_score;
      });

    // Site averages
    const siteMap: Record<string, { scores: number[]; surveyCount: number }> = {};
    for (const survey of surveyList) {
      const agency = survey.agency_name || 'Unknown Agency';
      const responses = survey.responses as Record<string, number | null> || {};

      if (!siteMap[agency]) {
        siteMap[agency] = { scores: [], surveyCount: 0 };
      }
      siteMap[agency].surveyCount++;

      const numericScores: number[] = [];
      for (let i = 1; i <= 19; i++) {
        const val = responses[`q${i}`];
        if (val !== null && val !== undefined) {
          const num = Number(val);
          if (!isNaN(num)) numericScores.push(num);
        }
      }
      if (numericScores.length > 0) {
        const surveyAvg = numericScores.reduce((a, b) => a + b, 0) / numericScores.length;
        siteMap[agency].scores.push(surveyAvg);
      }
    }

    const siteAverages = Object.entries(siteMap)
      .map(([agency, data]) => {
        const avgScore = data.scores.length > 0
          ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10
          : null;
        return {
          agency_name: agency,
          avg_score: avgScore,
          survey_count: data.surveyCount,
        };
      })
      .sort((a, b) => {
        if (a.avg_score === null) return 1;
        if (b.avg_score === null) return -1;
        return b.avg_score - a.avg_score;
      });

    const lowRated = preceptorAverages.filter((p) => p.flagged);

    return NextResponse.json({
      success: true,
      surveys: surveyList,
      summary: {
        total_surveys: surveyList.length,
        by_type: byType,
        question_averages: questionAverages,
        preceptor_averages: preceptorAverages,
        site_averages: siteAverages,
        low_rated: lowRated,
      },
    });
  } catch (error) {
    console.error('Error generating closeout survey report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
