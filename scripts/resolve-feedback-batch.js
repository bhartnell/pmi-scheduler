#!/usr/bin/env node
// Batch-resolve feedback reports directly in Supabase.
// Usage: node scripts/resolve-feedback-batch.js

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {}

const updates = [
  { id: '581b945f-49af-4588-b83e-43316ab69375', notes: 'Create poll button now routes to internal scheduler instead of external rallly.co' },
  { id: 'f2a00838-e9df-45b1-a540-a27b869b85fc', notes: 'Preceptor agency filter now also matches legacy records by agency_name' },
  { id: '938788ed-0ef0-4762-a585-2b01ed8bcfbc', notes: 'Legacy preceptor records now show fallback link in quick contact panel' },
  { id: '7ca51887-29eb-4998-95e4-b483fed11ed2', notes: 'Selected cohort now persists across tab switches via localStorage' },
];

async function main() {
  const connStr = process.env.SUPABASE_DB_URL;
  if (!connStr) {
    console.error('SUPABASE_DB_URL not found in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString: connStr });
  await client.connect();
  console.log('Connected to database');

  for (const { id, notes } of updates) {
    const result = await client.query(
      `UPDATE feedback_reports
       SET status = 'resolved',
           resolution_notes = $1,
           resolved_at = NOW(),
           resolved_by = 'claude-agent',
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, status, resolution_notes`,
      [notes, id]
    );

    if (result.rowCount > 0) {
      console.log(`Resolved: ${id} — ${notes}`);
    } else {
      console.warn(`NOT FOUND: ${id}`);
    }
  }

  await client.end();
  console.log('Done — all feedback resolved');
}

main().catch(err => { console.error(err); process.exit(1); });
