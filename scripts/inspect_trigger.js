const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await c.connect();
  const { rows } = await c.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'student_skill_evaluations'
  `);
  console.log('Triggers:', JSON.stringify(rows, null, 2));

  const { rows: funcs } = await c.query(`
    SELECT p.proname, pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname ILIKE '%block%delete%' OR p.proname ILIKE '%evaluations%delete%' OR p.proname ILIKE '%protect%eval%'
    LIMIT 10
  `);
  for (const f of funcs) { console.log('---', f.proname, '---'); console.log(f.def); }
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
