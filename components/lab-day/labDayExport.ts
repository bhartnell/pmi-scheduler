import { formatCohortNumber } from '@/lib/format-cohort';
import { downloadICS, parseLocalDate } from '@/lib/ics-export';
import { openPrintWindow, printHeader, printFooter, escapeHtml } from '@/lib/print-utils';
import type { LabDay, Station, LabDayRole, Student } from './types';

export const formatDate = (dateString: string) => {
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

export const formatTime = (timeString: string | null) => {
  if (!timeString) return null;
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

export const getStationTitle = (station: Station) => {
  if (station.custom_title) return station.custom_title;
  if (station.scenario) return station.scenario.title;
  if (station.skill_name) return station.skill_name;
  return `Station ${station.station_number}`;
};

export function handleExportCalendar(labDay: LabDay, labDayRoles: LabDayRole[]) {
  const startDate = parseLocalDate(labDay.date, labDay.start_time, 8);
  const endDate = parseLocalDate(labDay.date, labDay.end_time, 17);
  const cohortName = `${labDay.cohort.program.abbreviation} Group ${formatCohortNumber(labDay.cohort.cohort_number)}`;
  const stationList = labDay.stations.map((s: Station) => getStationTitle(s)).join(', ');
  const titlePart = labDay.title || `Lab Day ${labDay.date}`;
  const descParts = [`Cohort: ${cohortName}`];
  if (stationList) descParts.push(`Stations: ${stationList}`);
  labDayRoles.forEach(r => { const name = r.instructor?.name || r.instructor?.email || 'TBD'; const roleLabel = r.role === 'lab_lead' ? 'Lab Lead' : r.role === 'roamer' ? 'Roamer' : 'Observer'; descParts.push(`${roleLabel}: ${name}`); });
  if (labDay.notes) descParts.push(`Notes: ${labDay.notes}`);
  downloadICS([{ uid: `labday-${labDay.id}@pmi-scheduler`, title: `Lab Day - ${titlePart}`, description: descParts.join('\n'), location: 'PMI Campus', startDate, endDate }], `lab-day-${labDay.date}.ics`);
}

export function handlePrint(labDay: LabDay, labDayRoles: LabDayRole[], cohortStudents: Student[]) {
  const cohortName = `${labDay.cohort.program.abbreviation} Group ${formatCohortNumber(labDay.cohort.cohort_number)}`;
  const dateStr = formatDate(labDay.date);
  const timeStr = labDay.start_time ? `${formatTime(labDay.start_time)}${labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}` : '';
  let html = printHeader(labDay.title || 'Lab Day Schedule', `${cohortName} — ${dateStr}${timeStr ? ` — ${timeStr}` : ''}`);
  if (labDay.week_number && labDay.day_number) html += `<div style="font-size: 13px; color: #444; margin-bottom: 12px;">Week ${labDay.week_number}, Day ${labDay.day_number} &bull; ${labDay.num_rotations} rotations &times; ${labDay.rotation_duration} min</div>`;
  else html += `<div style="font-size: 13px; color: #444; margin-bottom: 12px;">${labDay.num_rotations} rotations &times; ${labDay.rotation_duration} min</div>`;
  if (labDayRoles.length > 0) { const leads = labDayRoles.filter(r => r.role === 'lab_lead').map(r => r.instructor?.name || 'Unknown'); const roamers = labDayRoles.filter(r => r.role === 'roamer').map(r => r.instructor?.name || 'Unknown'); const observers = labDayRoles.filter(r => r.role === 'observer').map(r => r.instructor?.name || 'Unknown'); html += '<div class="section" style="font-size: 12px;">'; if (leads.length > 0) html += `<strong>Lab Lead${leads.length > 1 ? 's' : ''}:</strong> ${leads.map(n => escapeHtml(n)).join(', ')} &nbsp; `; if (roamers.length > 0) html += `<strong>Roamer${roamers.length > 1 ? 's' : ''}:</strong> ${roamers.map(n => escapeHtml(n)).join(', ')} &nbsp; `; if (observers.length > 0) html += `<strong>Observer${observers.length > 1 ? 's' : ''}:</strong> ${observers.map(n => escapeHtml(n)).join(', ')}`; html += '</div>'; }
  if (labDay.stations.length > 0) { html += '<h2>Stations</h2><table><thead><tr><th>#</th><th>Type</th><th>Station / Scenario</th><th>Instructor</th><th>Room</th></tr></thead><tbody>'; labDay.stations.forEach((s: Station) => { const t = s.custom_title || s.scenario?.title || s.skill_name || `Station ${s.station_number}`; html += `<tr><td>${s.station_number}</td><td style="text-transform:capitalize;font-size:11px;">${escapeHtml(s.station_type.replace('_',' '))}</td><td><strong>${escapeHtml(t)}</strong>${s.station_notes ? `<br/><span style="font-size:11px;color:#666;">${escapeHtml(s.station_notes)}</span>` : ''}</td><td>${s.instructor_name ? escapeHtml(s.instructor_name) : '<em style="color:#999;">TBD</em>'}</td><td>${escapeHtml(s.room || '')}</td></tr>`; }); html += '</tbody></table>'; }
  if (labDay.start_time && labDay.rotation_duration > 0 && labDay.num_rotations > 0) { html += '<h2>Rotation Schedule</h2><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;font-size:12px;">'; const sp = labDay.start_time.split(':'); const sm = parseInt(sp[0])*60+parseInt(sp[1]); for (let i=0;i<labDay.num_rotations;i++) { const rs=sm+(i*labDay.rotation_duration); const re=rs+labDay.rotation_duration; const ft=(m:number)=>{const h=Math.floor(m/60)%12||12;const mn=String(m%60).padStart(2,'0');const ap=Math.floor(m/60)>=12?'PM':'AM';return`${h}:${mn} ${ap}`}; html+=`<div style="border:1px solid #ddd;border-radius:4px;padding:4px 8px;"><strong>R${i+1}:</strong> ${ft(rs)} - ${ft(re)}</div>`; } html+='</div>'; }
  if (labDay.notes) html += `<h2>Notes</h2><p style="font-size:12px;">${escapeHtml(labDay.notes)}</p>`;
  if (cohortStudents.length > 0) { html += `<h2>Student Roster (${cohortStudents.length})</h2><div class="three-col" style="font-size:12px;">`; [...cohortStudents].sort((a,b) => a.last_name.localeCompare(b.last_name)).forEach((s,i) => html += `<div>${i+1}. ${escapeHtml(s.last_name)}, ${escapeHtml(s.first_name)}</div>`); html += '</div>'; }
  html += printFooter(); openPrintWindow(`Lab Day - ${cohortName} - ${labDay.date}`, html);
}

export function handlePrintRoster(labDay: LabDay, cohortStudents: Student[]) {
  const cohortName = `${labDay.cohort.program.abbreviation} Group ${formatCohortNumber(labDay.cohort.cohort_number)}`;
  let html = printHeader('Lab Day Roster', `${cohortName} — ${formatDate(labDay.date)}`);
  html += '<div class="two-col" style="margin-bottom: 12px; font-size: 12px;">';
  html += `<div><strong>Date:</strong> ${escapeHtml(formatDate(labDay.date))}<br/><strong>Cohort:</strong> ${escapeHtml(cohortName)}`; if (labDay.title) html += `<br/><strong>Lab:</strong> ${escapeHtml(labDay.title)}`; html += '</div><div>';
  if (labDay.start_time) html += `<strong>Time:</strong> ${formatTime(labDay.start_time)}${labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}<br/>`;
  if (labDay.week_number && labDay.day_number) html += `<strong>Week ${labDay.week_number}, Day ${labDay.day_number}</strong><br/>`;
  html += `<strong>Rotations:</strong> ${labDay.num_rotations} x ${labDay.rotation_duration} min</div></div>`;
  if (labDay.stations.length > 0) { html += '<h2>Stations & Instructors</h2><table><thead><tr><th>Stn</th><th>Station</th><th>Instructor</th><th>Room</th></tr></thead><tbody>'; labDay.stations.forEach((s: Station) => { const t = s.custom_title || s.scenario?.title || s.skill_name || `Station ${s.station_number}`; html += `<tr><td>${s.station_number}</td><td>${escapeHtml(t)}</td><td>${s.instructor_name ? escapeHtml(s.instructor_name) : '<em style="color:#999">TBD</em>'}</td><td>${escapeHtml(s.room || '')}</td></tr>`; }); html += '</tbody></table>'; }
  html += `<h2>Enrolled Students (${cohortStudents.length})</h2>`;
  if (cohortStudents.length > 0) { html += '<table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Agency</th></tr></thead><tbody>'; [...cohortStudents].sort((a,b) => a.last_name.localeCompare(b.last_name)).forEach((s,i) => html += `<tr><td>${i+1}</td><td><strong>${escapeHtml(s.last_name)}, ${escapeHtml(s.first_name)}</strong></td><td>${escapeHtml(s.email || '')}</td><td>${escapeHtml(s.agency || '')}</td></tr>`); html += '</tbody></table>'; }
  html += printFooter(); openPrintWindow(`Roster - ${cohortName} - ${labDay.date}`, html);
}

export async function handleDownloadPDF(labDay: LabDay) {
  const html2pdf = (await import('html2pdf.js')).default;
  const element = document.getElementById('lab-day-printable');
  if (!element) { alert('Could not find printable content'); return; }
  const printHidden = element.querySelectorAll('.print\\:hidden');
  const printBlock = element.querySelectorAll('.print\\:block');
  printHidden.forEach(el => (el as HTMLElement).style.display = 'none');
  printBlock.forEach(el => (el as HTMLElement).style.display = 'block');
  const cohortName = `${labDay.cohort.program.abbreviation}-G${formatCohortNumber(labDay.cohort.cohort_number)}`;
  const dateStr = labDay.date || new Date().toISOString().split('T')[0];
  try { await html2pdf().set({ margin: 0.5, filename: `lab-day-${cohortName}-${dateStr}.pdf`, image: { type: 'jpeg' as const, quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in' as const, format: 'letter', orientation: 'portrait' as const } }).from(element).save(); }
  finally { printHidden.forEach(el => (el as HTMLElement).style.display = ''); printBlock.forEach(el => (el as HTMLElement).style.display = ''); }
}

export async function handleCSVExport(labDayId: string, labDayDate: string, toast: { success: (msg: string) => void; error: (msg: string) => void }) {
  try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/roster?format=csv`); if (!res.ok) { toast.error('Failed to export'); return; } const blob = await res.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `labday-roster-${labDayDate}.csv`; link.click(); URL.revokeObjectURL(url); toast.success('CSV downloaded'); }
  catch { toast.error('Failed to export'); }
}
