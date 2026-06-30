import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canEditLVFR } from '@/lib/permissions';
import { renderReferenceSheetsHTML, type ReferenceSheetSkill } from '@/lib/reports/lvfr-skills/referenceSheet';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const maxDuration = 120;

/**
 * GET /api/lvfr-aemt/skills/reference-export[?skill_id=...]  (instructor+)
 *
 * Side 2b — the BLANK skill reference / failure-doc sheets, one page per skill,
 * as a single printable PDF. Default = all skills; ?skill_id=... = just one.
 * Instructor prints these and brings paper (cadre may have no site access).
 */
export async function GET(request: NextRequest) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    if (!canEditLVFR(auth.user.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const skillId = request.nextUrl.searchParams.get('skill_id');
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('lvfr_aemt_skills')
      .select('id, category, name, description, nremt_tested, introduced_day, practice_days, evaluation_day, equipment_needed, safety_note')
      .order('category')
      .order('name');
    if (skillId) query = query.eq('id', skillId);

    const { data: skills } = await query;
    if (!skills || skills.length === 0) {
      return NextResponse.json({ success: false, error: 'No skills found' }, { status: 404 });
    }

    const html = renderReferenceSheetsHTML(skills as ReferenceSheetSkill[]);

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBytes = await page.pdf({
      format: 'letter',
      printBackground: true,
      margin: { top: '0.4in', bottom: '0.4in', left: '0.4in', right: '0.4in' },
    });
    await page.close();
    await browser.close();
    browser = null;

    const filename = skillId
      ? `LVFR_Skill_Reference_${String(skillId).replace(/[^A-Za-z0-9]+/g, '')}.pdf`
      : 'LVFR_Skill_Reference_Sheets.pdf';

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBytes.byteLength),
      },
    });
  } catch (error) {
    console.error('[lvfr-skills-reference-export] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate PDF' }, { status: 500 });
  } finally {
    if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  }
}
