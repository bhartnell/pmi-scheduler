import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canEditLVFR } from '@/lib/permissions';
import { renderBlankChecklistHTML, type BlankChecklistSkill } from '@/lib/reports/lvfr-skills/blankChecklist';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const maxDuration = 60;

/**
 * GET /api/lvfr-aemt/skills/blank-checklist-export  (instructor+)
 *
 * The blank, print-friendly CLASS checklist: all skills grouped by category
 * with an empty checkbox + date line, one compact document (not one page
 * per skill). For printing/handing out and marking off by hand as the class
 * covers each skill — matches the class-level completion tracking model.
 */
export async function GET(_request: NextRequest) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    if (!canEditLVFR(auth.user.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data: skills, error } = await supabase
      .from('lvfr_aemt_skills')
      .select('id, category, name, nremt_tested')
      .order('category')
      .order('name');

    if (error || !skills || skills.length === 0) {
      return NextResponse.json({ success: false, error: 'No skills found' }, { status: 404 });
    }

    const html = renderBlankChecklistHTML(skills as BlankChecklistSkill[]);

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

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="LVFR_AEMT_Skills_Blank_Checklist.pdf"',
        'Content-Length': String(pdfBytes.byteLength),
      },
    });
  } catch (error) {
    console.error('[lvfr-skills-blank-checklist-export] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate PDF' }, { status: 500 });
  } finally {
    if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  }
}
