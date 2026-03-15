const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (t.length === 0 || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  // Update template: EMS 121 Lab → EMS 121 S1 Lab
  const res = await fetch(url + '/rest/v1/pmi_course_templates?course_code=eq.EMS 121&course_name=eq.Lab&program_type=eq.paramedic&semester_number=eq.1', {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ course_name: 'S1 Lab' }),
  });
  const data = await res.json();
  console.log('Updated templates:', data.length);

  // Also update existing blocks with the old label
  const blockRes = await fetch(url + '/rest/v1/pmi_schedule_blocks?course_name=eq.EMS 121 Lab', {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      course_name: 'EMS 121 S1 Lab',
      title: 'EMS 121 S1 Lab',
    }),
  });
  const blockData = await blockRes.json();
  console.log('Updated blocks:', blockData.length);
}

main().catch(console.error);
