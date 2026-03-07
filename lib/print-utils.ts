/**
 * Shared print utilities for generating clean, professional print views.
 * Opens content in a new window for printing, avoiding CSS conflicts
 * with the main application.
 */

export function openPrintWindow(title: string, content: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; background: #fff; padding: 20px; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        h2 { font-size: 18px; margin: 16px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        h3 { font-size: 14px; margin: 12px 0 6px; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 16px; }
        .header-title { font-size: 20px; font-weight: bold; }
        .header-meta { font-size: 12px; color: #666; text-align: right; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
        .section { margin-bottom: 16px; page-break-inside: avoid; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin: 8px 0; }
        .stat-card { border: 1px solid #ddd; padding: 8px; border-radius: 4px; }
        .stat-label { font-size: 11px; color: #666; }
        .stat-value { font-size: 18px; font-weight: bold; }
        .checkbox { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #333; margin-right: 6px; vertical-align: middle; }
        .checkbox-checked { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #333; margin-right: 6px; vertical-align: middle; background: #333; position: relative; }
        .checkbox-checked::after { content: ''; position: absolute; left: 3px; top: 0px; width: 5px; height: 9px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .no-print { display: none !important; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
        .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 12px; }
        .label { font-weight: 600; font-size: 12px; color: #555; }
        .value { font-size: 12px; }
        ul { margin-left: 20px; }
        li { margin-bottom: 2px; font-size: 12px; }
        .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #999; display: flex; justify-content: space-between; }
        @media print {
          body { padding: 0; }
          .page-break { page-break-before: always; }
        }
      </style>
    </head>
    <body>${content}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
}

export function formatPrintDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function printHeader(title: string, subtitle?: string): string {
  const now = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return `<div class="header">
    <div>
      <div class="header-title">PMI Paramedic Program</div>
      <div style="font-size: 16px; margin-top: 4px;">${escapeHtml(title)}</div>
      ${subtitle ? `<div style="font-size: 12px; color: #666;">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <div class="header-meta">Printed: ${now}</div>
  </div>`;
}

export function printFooter(): string {
  const now = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `<div class="footer">
    <span>PMI EMS Scheduler</span>
    <span>Printed ${now}</span>
  </div>`;
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
