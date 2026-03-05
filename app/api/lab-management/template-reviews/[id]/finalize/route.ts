import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { createBulkNotifications } from '@/lib/notifications';

// POST /api/lab-management/template-reviews/[id]/finalize
// Finalize the review: apply accepted/revised changes to templates
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Fetch review
    const { data: review, error: reviewError } = await supabase
      .from('template_reviews')
      .select('*')
      .eq('id', id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (review.status !== 'in_review') {
      return NextResponse.json({ error: 'Review must be in_review status to finalize' }, { status: 400 });
    }

    // Fetch all items
    const { data: items, error: itemsError } = await supabase
      .from('template_review_items')
      .select(`
        *,
        lab_day:lab_days(id, day_number, source_template_id)
      `)
      .eq('review_id', id);

    if (itemsError) throw itemsError;

    // Check for pending items
    const pendingItems = (items || []).filter((i: Record<string, unknown>) => i.disposition === 'pending');
    if (pendingItems.length > 0) {
      return NextResponse.json(
        { error: `Cannot finalize: ${pendingItems.length} item(s) still pending review` },
        { status: 400 }
      );
    }

    // Process items
    let acceptedCount = 0;
    let revisedCount = 0;
    let keptCount = 0;

    for (const item of items || []) {
      const labDay = item.lab_day as Record<string, unknown>;
      const templateId = item.template_id as string | null;
      const disposition = item.disposition as string;

      if (disposition === 'keep_original') {
        keptCount++;
        continue;
      }

      if (!templateId) continue;

      if (disposition === 'accept_changes') {
        // Fetch current lab stations and update the template
        const stationsData = await getLabStationsAsTemplateFormat(supabase, labDay.id as string);
        if (stationsData) {
          await updateTemplate(supabase, templateId, labDay.day_number as number, stationsData);
        }
        acceptedCount++;
      } else if (disposition === 'revised') {
        // Use revised_data to update the template
        const revisedData = item.revised_data as Record<string, unknown>[] | null;
        if (revisedData) {
          await updateTemplate(supabase, templateId, labDay.day_number as number, revisedData);
        }
        revisedCount++;
      }
    }

    // Mark review as completed
    const { error: updateError } = await supabase
      .from('template_reviews')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Notify all reviewers
    const allReviewers = new Set<string>([
      ...(review.reviewers as string[] || []),
      review.created_by as string,
    ]);

    if (allReviewers.size > 0) {
      const notifications = Array.from(allReviewers).map((email) => ({
        userEmail: email,
        title: 'Template review completed',
        message: `Review "${review.title}" finalized by ${user.name || user.email.split('@')[0]}: ${acceptedCount} accepted, ${revisedCount} revised, ${keptCount} kept`,
        type: 'general' as const,
        category: 'labs' as const,
        linkUrl: `/lab-management/templates/review/${id}`,
        referenceType: 'template_review',
        referenceId: id,
      }));
      await createBulkNotifications(notifications);
    }

    return NextResponse.json({
      success: true,
      summary: { accepted: acceptedCount, revised: revisedCount, kept: keptCount },
    });
  } catch (error) {
    console.error('Error finalizing template review:', error);
    return NextResponse.json({ success: false, error: 'Failed to finalize review' }, { status: 500 });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function getLabStationsAsTemplateFormat(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  labDayId: string
): Promise<Record<string, unknown>[] | null> {
  const { data: stations } = await supabase
    .from('lab_stations')
    .select(`
      station_number, station_type, custom_title, skill_name, room,
      station_notes, rotation_minutes, num_rotations,
      scenario:scenarios(id, title)
    `)
    .eq('lab_day_id', labDayId)
    .order('station_number', { ascending: true });

  if (!stations || stations.length === 0) return null;

  return stations.map((s: Record<string, unknown>) => {
    const scenario = s.scenario as Record<string, unknown> | null;
    return {
      station_number: s.station_number,
      sort_order: s.station_number,
      station_type: s.station_type,
      scenario_id: scenario?.id || null,
      station_name: s.custom_title || s.skill_name || (scenario?.title as string) || null,
      skill_name: s.skill_name || null,
      custom_title: s.custom_title || null,
      rotation_minutes: s.rotation_minutes || null,
      num_rotations: s.num_rotations || null,
      room: s.room || null,
      notes: s.station_notes || null,
    };
  });
}

async function updateTemplate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  templateId: string,
  dayNumber: number,
  stationsData: Record<string, unknown>[]
) {
  // Try lab_week_templates first
  const { data: weekTemplate } = await supabase
    .from('lab_week_templates')
    .select('id, days')
    .eq('id', templateId)
    .single();

  if (weekTemplate && weekTemplate.days) {
    const days = weekTemplate.days as Array<Record<string, unknown>>;
    const updatedDays = days.map((d) => {
      if (d.day_number === dayNumber) {
        return { ...d, stations: stationsData };
      }
      return d;
    });

    await supabase
      .from('lab_week_templates')
      .update({ days: updatedDays, updated_at: new Date().toISOString() })
      .eq('id', templateId);
    return;
  }

  // Try lab_day_templates
  const { data: dayTemplate } = await supabase
    .from('lab_day_templates')
    .select('id, template_data')
    .eq('id', templateId)
    .single();

  if (dayTemplate) {
    const td = (dayTemplate.template_data as Record<string, unknown>) || {};
    const updatedData = { ...td, stations: stationsData };

    await supabase
      .from('lab_day_templates')
      .update({ template_data: updatedData, updated_at: new Date().toISOString() })
      .eq('id', templateId);
  }
}
