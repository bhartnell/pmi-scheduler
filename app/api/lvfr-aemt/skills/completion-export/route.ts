import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canEditLVFR } from '@/lib/permissions';
import {
  renderCompletionSheetHTML,
  completionFilename,
  type CompletionSheetSkill,
  type CompletionRow,
} from '@/lib/reports/lvfr-skills/completionSheet';
import JSZip from 'jszip';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Headless-Chrome PDF rendering for a whole roster takes time; allow headroom.
export const maxDuration = 180;

/**
 * GET /api/lvfr-aemt/skills/completion-export?cohort_id=...  (instructor+)
 *
 * Side 2a — the ACLS pattern: ONE master completion sheet (the class's covered
 * skills) name-stamped into one PDF per student, bundled as a .zip of REAL,
 * pre-separated PDFs (no Adobe extraction). Every student's sheet is identical
 * except the name. NOT per-student scored.
 */
export async function GET(request: NextRequest) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    if (!canEditLVFR(auth.user.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const cohortId = request.nextUrl.searchParams.get('cohort_id');
    if (!cohortId) {
      return NextResponse.json({ success: false, error: 'cohort_id required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: cohort } = await supabase
      .from('cohorts').select('cohort_number, display_name').eq('id', cohortId).single();
    const cohortLabel = cohort?.display_name || (cohort?.cohort_number ? `Cohort ${cohort.cohort_number}` : 'LVFR AEMT');

    // Roster: active students in the cohort.
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .order('last_name')
      .order('first_name');

    if (!students || students.length === 0) {
      return NextResponse.json({ success: false, error: 'No active students in this cohort' }, { status: 404 });
    }

    // The 30 skills (ordered category, name).
    const { data: skills } = await supabase
      .from('lvfr_aemt_skills')
      .select('id, category, name, nremt_tested, evaluation_day')
      .order('category')
      .order('name');

    // Class-completion map for this cohort.
    const { data: rows } = await supabase
      .from('lvfr_aemt_skill_class_completion')
      .select('skill_id, completed, completed_date')
      .eq('cohort_id', cohortId);

    const completion: Record<string, CompletionRow> = {};
    for (const r of rows || []) {
      completion[r.skill_id] = { completed: r.completed, completed_date: r.completed_date };
    }

    const generatedDate = new Date().toISOString().slice(0, 10);
    const skillList = (skills || []) as CompletionSheetSkill[];

    // Build (filename, html) docs — one identical-but-name-stamped sheet per student.
    const docs = students.map(st => ({
      filename: completionFilename(st.last_name, st.first_name),
      html: renderCompletionSheetHTML({
        studentName: `${st.last_name}, ${st.first_name}`,
        cohortLabel,
        skills: skillList,
        completion,
        generatedDate,
      }),
    }));

    // Render each HTML → PDF and zip.
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const zip = new JSZip();
    for (const { filename, html } of docs) {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBytes = await page.pdf({
        format: 'letter',
        printBackground: true,
        margin: { top: '0.4in', bottom: '0.4in', left: '0.4in', right: '0.4in' },
      });
      await page.close();
      zip.file(filename, pdfBytes);
    }
    await browser.close();
    browser = null;

    const cohortSlug = (cohort?.cohort_number || 'LVFR').replace(/[^A-Za-z0-9]+/g, '');
    const zipFilename = `LVFR_Skills_Completion_${cohortSlug}.zip`;
    const zipArrayBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });

    return new Response(zipArrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': String(zipArrayBuffer.byteLength),
      },
    });
  } catch (error) {
    console.error('[lvfr-skills-completion-export] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate ZIP' }, { status: 500 });
  } finally {
    if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  }
}
