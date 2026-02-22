import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const reportType = searchParams.get('type') || 'hours_by_instructor';
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  if (!startDate || !endDate) {
    return NextResponse.json({ success: false, error: 'start_date and end_date required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    switch (reportType) {
      case 'hours_by_instructor': {
        // Get all confirmed signups within date range
        const { data: signups, error } = await supabase
          .from('shift_signups')
          .select(`
            id,
            shift_id,
            instructor_id,
            signup_start_time,
            signup_end_time,
            is_partial,
            status,
            instructor:lab_users!shift_signups_instructor_id_fkey(id, name, email),
            shift:open_shifts!shift_signups_shift_id_fkey(id, date, start_time, end_time, title, is_cancelled)
          `)
          .eq('status', 'confirmed')
          .gte('shift.date', startDate)
          .lte('shift.date', endDate);

        if (error) throw error;

        // Filter out cancelled shifts and calculate hours per instructor
        const instructorHours: Record<string, {
          instructor_id: string;
          instructor_name: string;
          instructor_email: string;
          days_worked: Set<string>;
          total_minutes: number;
          shifts: Array<{ date: string; title: string; hours: number }>;
        }> = {};

        for (const signup of signups || []) {
          const shift = signup.shift as any;
          const instructor = signup.instructor as any;

          if (!shift || !instructor || shift.is_cancelled) continue;

          const instructorId = instructor.id;
          if (!instructorHours[instructorId]) {
            instructorHours[instructorId] = {
              instructor_id: instructorId,
              instructor_name: instructor.name || instructor.email,
              instructor_email: instructor.email,
              days_worked: new Set(),
              total_minutes: 0,
              shifts: [],
            };
          }

          // Use signup times if partial, otherwise shift times
          const startTime = signup.is_partial && signup.signup_start_time
            ? signup.signup_start_time
            : shift.start_time;
          const endTime = signup.is_partial && signup.signup_end_time
            ? signup.signup_end_time
            : shift.end_time;

          // Calculate duration in minutes
          const [startH, startM] = startTime.split(':').map(Number);
          const [endH, endM] = endTime.split(':').map(Number);
          const minutes = (endH * 60 + endM) - (startH * 60 + startM);

          instructorHours[instructorId].days_worked.add(shift.date);
          instructorHours[instructorId].total_minutes += minutes;
          instructorHours[instructorId].shifts.push({
            date: shift.date,
            title: shift.title,
            hours: minutes / 60,
          });
        }

        // Convert to array and calculate totals
        const report = Object.values(instructorHours).map(data => ({
          instructor_id: data.instructor_id,
          instructor_name: data.instructor_name,
          instructor_email: data.instructor_email,
          days_worked: data.days_worked.size,
          total_hours: Math.round(data.total_minutes / 60 * 100) / 100,
          shifts: data.shifts.sort((a, b) => a.date.localeCompare(b.date)),
        })).sort((a, b) => b.total_hours - a.total_hours);

        return NextResponse.json({ success: true, report, reportType });
      }

      case 'shift_coverage': {
        // Get all shifts in date range with their signups
        const { data: shifts, error } = await supabase
          .from('open_shifts')
          .select(`
            id,
            title,
            date,
            start_time,
            end_time,
            location,
            department,
            min_instructors,
            max_instructors,
            is_filled,
            is_cancelled,
            signups:shift_signups(
              id,
              status,
              instructor:lab_users!shift_signups_instructor_id_fkey(name, email)
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date')
          .order('start_time');

        if (error) throw error;

        const report = (shifts || []).map(shift => {
          const confirmedCount = shift.signups?.filter((s: any) => s.status === 'confirmed').length || 0;
          const pendingCount = shift.signups?.filter((s: any) => s.status === 'pending').length || 0;

          let status = 'unfilled';
          if (shift.is_cancelled) {
            status = 'cancelled';
          } else if (confirmedCount >= shift.min_instructors) {
            status = 'filled';
          } else if (confirmedCount > 0 || pendingCount > 0) {
            status = 'partial';
          }

          return {
            id: shift.id,
            title: shift.title,
            date: shift.date,
            start_time: shift.start_time,
            end_time: shift.end_time,
            location: shift.location,
            department: shift.department,
            min_instructors: shift.min_instructors,
            max_instructors: shift.max_instructors,
            confirmed_count: confirmedCount,
            pending_count: pendingCount,
            status,
            instructors: shift.signups
              ?.filter((s: any) => s.status === 'confirmed')
              .map((s: any) => s.instructor?.name || s.instructor?.email) || [],
          };
        });

        // Summary stats
        const summary = {
          total: report.length,
          filled: report.filter(r => r.status === 'filled').length,
          partial: report.filter(r => r.status === 'partial').length,
          unfilled: report.filter(r => r.status === 'unfilled').length,
          cancelled: report.filter(r => r.status === 'cancelled').length,
        };

        return NextResponse.json({ success: true, report, summary, reportType });
      }

      case 'availability_summary': {
        // Get all availability in date range
        const { data: availability, error } = await supabase
          .from('instructor_availability')
          .select(`
            id,
            date,
            start_time,
            end_time,
            is_all_day,
            instructor:lab_users!instructor_availability_instructor_id_fkey(id, name, email)
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date');

        if (error) throw error;

        // Group by date
        const byDate: Record<string, {
          date: string;
          instructors: Array<{
            name: string;
            email: string;
            start_time: string | null;
            end_time: string | null;
            is_all_day: boolean;
          }>;
        }> = {};

        for (const avail of availability || []) {
          const instructor = avail.instructor as any;
          if (!instructor) continue;

          if (!byDate[avail.date]) {
            byDate[avail.date] = {
              date: avail.date,
              instructors: [],
            };
          }

          byDate[avail.date].instructors.push({
            name: instructor.name || instructor.email,
            email: instructor.email,
            start_time: avail.start_time,
            end_time: avail.end_time,
            is_all_day: avail.is_all_day,
          });
        }

        const report = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

        return NextResponse.json({ success: true, report, reportType });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid report type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
