const fs = require('fs');

const files = [
  'app/api/admin/broadcast/route.ts',
  'app/api/admin/bulk-operations/[id]/rollback/route.ts',
  'app/api/admin/bulk-operations/route.ts',
  'app/api/admin/certification-compliance/route.ts',
  'app/api/admin/certifications/import/route.ts',
  'app/api/admin/certifications/route.ts',
  'app/api/admin/certifications/verify/route.ts',
  'app/api/admin/config/route.ts',
  'app/api/admin/data-export/route.ts',
  'app/api/admin/document-requests/[id]/route.ts',
  'app/api/admin/document-requests/route.ts',
  'app/api/admin/email-templates/route.ts',
  'app/api/admin/email-templates/test/route.ts',
  'app/api/admin/equipment/checkout/route.ts',
  'app/api/admin/equipment/maintenance/[id]/route.ts',
  'app/api/admin/equipment/maintenance/route.ts',
  'app/api/admin/equipment/route.ts',
  'app/api/admin/guests/route.ts',
  'app/api/admin/incidents/[id]/route.ts',
  'app/api/admin/incidents/route.ts',
  'app/api/admin/lab-templates/apply/route.ts',
  'app/api/admin/lab-templates/import/route.ts',
  'app/api/admin/lab-templates/seed/route.ts',
  'app/api/admin/lab-templates/update-from-lab/route.ts',
  'app/api/admin/rubrics/[id]/route.ts',
  'app/api/admin/rubrics/route.ts',
  'app/api/admin/scenarios/audit/route.ts',
  'app/api/admin/scenarios/transform/route.ts',
  'app/api/admin/scheduled-exports/[id]/route.ts',
  'app/api/admin/scheduled-exports/route.ts',
  'app/api/admin/skill-drills/seed/route.ts',
  'app/api/admin/skill-sheets/counts/route.ts',
  'app/api/admin/skill-sheets/import/route.ts',
  'app/api/admin/skill-sheets/seed-aliases/route.ts',
  'app/api/admin/skill-sheets/seed-canonical/route.ts',
  'app/api/admin/system-alerts/route.ts',
  'app/api/admin/user-activity/log/route.ts',
  'app/api/admin/user-activity/route.ts',
  'app/api/admin/webhooks/[id]/logs/route.ts',
  'app/api/admin/webhooks/[id]/route.ts',
  'app/api/admin/webhooks/[id]/test/route.ts',
  'app/api/admin/webhooks/route.ts',
  'app/api/admin/scenarios/bulk-import/route.ts',
  'app/api/admin/scenarios/bulk-import/commit/route.ts',
];

let updated = 0;

for (const f of files) {
  if (!fs.existsSync(f)) { console.log('NOT FOUND: ' + f); continue; }
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes('requireAuth')) { console.log('SKIP: ' + f); continue; }

  // Add requireAuth import
  const importMatches = c.match(/^import\s.+$/gm);
  if (importMatches) {
    const last = importMatches[importMatches.length - 1];
    const idx = c.lastIndexOf(last) + last.length;
    c = c.slice(0, idx) + "\nimport { requireAuth } from '@/lib/api-auth';" + c.slice(idx);
  }

  // Replace auth block pattern A: session + supabase + currentUser + canAccessAdmin
  c = c.replace(
    /[ \t]*const session = await getServerSession\([^)]*\);?\n[ \t]*if \(!session[\s\S]*?\{ *\n?[ \t]*return NextResponse\.json\([^)]*\)[\s\S]*?\}\n\n?([ \t]*const supabase = getSupabaseAdmin\(\);?\n)?([ \t]*\n)*([ \t]*\/\/[^\n]*\n)*([ \t]*const \{ data: currentUser \} = await supabase[\s\S]*?\.single\(\);?\n)?([ \t]*\n)*([ \t]*if \(!currentUser[\s\S]*?\}\n)?/g,
    function(match) {
      let r = '    const auth = await requireAuth(\'admin\');\n    if (auth instanceof NextResponse) return auth;\n    const { user } = auth;\n\n';
      if (!match.includes('getSupabaseAdmin')) {
        r += '    const supabase = getSupabaseAdmin();\n';
      } else {
        r += '    const supabase = getSupabaseAdmin();\n';
      }
      return r;
    }
  );

  // Replace session.user refs
  c = c.replace(/session\.user\.email/g, 'user.email');
  c = c.replace(/session\.user\.name/g, 'user.name');
  c = c.replace(/session\.user/g, 'user');
  c = c.replace(/currentUser\.id/g, 'user.id');
  c = c.replace(/currentUser\.name/g, 'user.name');
  c = c.replace(/currentUser\.email/g, 'user.email');
  c = c.replace(/currentUser\.role/g, 'user.role');

  // Remove unused imports
  const body = c.replace(/^import\s.+$/gm, '');

  if (!body.includes('getServerSession')) {
    c = c.replace(/import\s*\{\s*getServerSession\s*\}\s*from\s*['"]next-auth['"]\s*;?\n/g, '');
  }
  if (!body.includes('authOptions')) {
    c = c.replace(/import\s*\{\s*authOptions\s*\}\s*from\s*['"][^'"]+['"]\s*;?\n/g, '');
  }
  if (!body.includes('canAccessAdmin')) {
    // Handle single import
    c = c.replace(/import\s*\{\s*canAccessAdmin\s*\}\s*from\s*['"][^'"]+['"]\s*;?\n/g, '');
    // Handle multi import: { canAccessAdmin, otherThing }
    c = c.replace(/canAccessAdmin,\s*/g, '');
    c = c.replace(/,\s*canAccessAdmin/g, '');
  }
  if (!body.includes('createClient')) {
    c = c.replace(/import\s*\{\s*createClient\s*\}\s*from\s*['"][^'"]+['"]\s*;?\n/g, '');
  }

  // Remove duplicate supabase inits within same function scope
  // Simple approach: remove second occurrence on same line pattern
  let lines = c.split('\n');
  let supabaseCount = 0;
  let inHandler = false;
  let newLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (/export\s+async\s+function/.test(lines[i])) {
      inHandler = true;
      supabaseCount = 0;
    }
    if (lines[i].trim() === 'const supabase = getSupabaseAdmin();') {
      supabaseCount++;
      if (supabaseCount > 1) continue; // skip duplicate
    }
    newLines.push(lines[i]);
  }
  c = newLines.join('\n');

  // Clean up triple+ newlines
  c = c.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(f, c, 'utf8');
  console.log('UPDATED: ' + f);
  updated++;
}

console.log('\nDone: ' + updated + ' files updated');
