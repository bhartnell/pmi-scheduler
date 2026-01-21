import * as XLSX from 'xlsx';

export interface ExportColumn {
  key: string;
  label: string;
  getValue?: (row: any) => string | number | boolean;
}

export interface ExportConfig {
  title: string;
  subtitle?: string;
  filename: string;
  columns: ExportColumn[];
  data: any[];
}

/**
 * Export data to Excel (.xlsx)
 */
export function exportToExcel(config: ExportConfig) {
  const { title, subtitle, filename, columns, data } = config;

  // Prepare header rows
  const headerRows: string[][] = [
    [title],
    subtitle ? [subtitle] : [],
    [''], // Empty row
    columns.map(col => col.label),
  ].filter(row => row.length > 0);

  // Prepare data rows
  const dataRows = data.map(row =>
    columns.map(col => {
      if (col.getValue) {
        return col.getValue(row);
      }
      return row[col.key] ?? '';
    })
  );

  // Combine all rows
  const allRows = [...headerRows, ...dataRows];

  // Create workbook and worksheet
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Set column widths
  const colWidths = columns.map(col => ({ wch: Math.max(col.label.length, 15) }));
  ws['!cols'] = colWidths;

  // Merge title cell across all columns
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
  ];
  if (subtitle) {
    ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Roster');

  // Generate and download
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export data to PDF using html2pdf.js
 */
export async function exportToPDF(config: ExportConfig) {
  const { title, subtitle, filename, columns, data } = config;

  // Dynamically import html2pdf (client-side only)
  const html2pdf = (await import('html2pdf.js')).default;

  // Create HTML content
  const html = generatePrintHTML(config, true);

  // Create temporary container
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  // Generate PDF
  const opt = {
    margin: [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
    filename: `${filename}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' as const }
  };

  await html2pdf().set(opt).from(container.firstChild as HTMLElement).save();

  // Cleanup
  document.body.removeChild(container);
}

/**
 * Open print dialog with formatted content
 */
export function printRoster(config: ExportConfig) {
  const html = generatePrintHTML(config, false);

  // Open print window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * Generate formatted HTML for print/PDF
 */
function generatePrintHTML(config: ExportConfig, forPDF: boolean): string {
  const { title, subtitle, columns, data } = config;
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const tableRows = data.map(row => {
    const cells = columns.map(col => {
      let value: any;
      if (col.getValue) {
        value = col.getValue(row);
      } else {
        value = row[col.key] ?? '';
      }

      // Format boolean values
      if (typeof value === 'boolean') {
        value = value ? '✓' : '✗';
      }

      return `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${value}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const headerCells = columns.map(col =>
    `<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; font-weight: bold; text-align: center;">${col.label}</th>`
  ).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #1e3a5f;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #1e3a5f;
      margin-bottom: 5px;
    }
    .title {
      font-size: 20px;
      font-weight: bold;
      color: #333;
      margin: 10px 0 5px;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
    }
    .date {
      font-size: 12px;
      color: #888;
      margin-top: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      font-size: ${forPDF ? '11px' : '12px'};
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: center;
    }
    th {
      background: #f5f5f5;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background: #fafafa;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 10px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">PMI - Paramedic Institute</div>
    <div class="title">${title}</div>
    ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
    <div class="date">Generated: ${date}</div>
  </div>

  <table>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="footer">
    Total Students: ${data.length} | Generated from PMI Scheduler
  </div>
</body>
</html>`;
}
