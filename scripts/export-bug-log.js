#!/usr/bin/env node
// Regenerates BUG_LOG.md at the repo root from the Notion "🐞 Bug & Fix Log"
// data source (Agent Ops Hub). Notion is the working source of truth; this
// file is a generated snapshot so the fix history travels with the code.
//
// Usage: node scripts/export-bug-log.js
//
// Requires:
//   NOTION_API_KEY  - Notion internal integration token, set in .env.local.
//                     The integration must be shared with the "🐞 Bug & Fix
//                     Log" database in Notion (Agent Ops Hub) or every
//                     request below returns 404.
//
// Optional:
//   NOTION_BUG_LOG_DATA_SOURCE_ID - overrides the data source ID below.
//
// Do not hand-edit BUG_LOG.md — re-run this script instead. See the
// Known-Issue Check section of CLAUDE.md and the Documentation Update Rule.

const fs = require('fs');
const path = require('path');

// Load .env.local if present (same approach as scripts/run-migration.js —
// no dotenv dependency in this repo).
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
} catch {
  // .env.local not found, continue with existing env
}

const DATA_SOURCE_ID =
  process.env.NOTION_BUG_LOG_DATA_SOURCE_ID || 'b2376d9d-3c84-471f-aba7-df37bb9f835d';
const NOTION_VERSION = '2025-09-03';
const OUT_PATH = path.join(__dirname, '..', 'BUG_LOG.md');

// Rows whose Outcome is one of these get a stand-out marker — this is where
// most of the log's value is, per the Known-Issue Check rule in CLAUDE.md.
const STANDOUT_OUTCOMES = new Set(['Recurred', 'Partially held']);

function fail(message) {
  console.error(`[export-bug-log] ${message}`);
  process.exit(1);
}

function richTextToPlain(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((t) => t.plain_text || '').join('');
  return '';
}

function getProp(page, name) {
  return page.properties && page.properties[name];
}

function getSelect(page, name) {
  const prop = getProp(page, name);
  return prop && prop.select ? prop.select.name : '';
}

function getStatus(page, name) {
  const prop = getProp(page, name);
  return prop && prop.status ? prop.status.name : '';
}

function getTitle(page, name) {
  const prop = getProp(page, name);
  return prop && prop.title ? richTextToPlain(prop.title) : '';
}

function getRichText(page, name) {
  const prop = getProp(page, name);
  return prop && prop.rich_text ? richTextToPlain(prop.rich_text) : '';
}

function getDate(page, name) {
  const prop = getProp(page, name);
  return prop && prop.date ? prop.date.start || '' : '';
}

function getUrl(page, name) {
  const prop = getProp(page, name);
  return (prop && prop.url) || '';
}

function getUniqueId(page, name) {
  const prop = getProp(page, name);
  if (!prop || !prop.unique_id) return '';
  const { prefix, number } = prop.unique_id;
  return prefix ? `${prefix}-${number}` : String(number);
}

async function queryAllPages(apiKey) {
  const pages = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/data_sources/${DATA_SOURCE_ID}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Notion query failed (${res.status}): ${body}`);
    }
    const json = await res.json();
    pages.push(...json.results);
    cursor = json.has_more ? json.next_cursor : undefined;
  } while (cursor);
  return pages;
}

function normalizeRow(page) {
  return {
    bugId: getUniqueId(page, 'Bug ID') || page.id,
    bug: getTitle(page, 'Bug') || '(untitled)',
    area: getSelect(page, 'Area') || 'Unassigned',
    severity: getSelect(page, 'Severity'),
    fixType: getSelect(page, 'Fix Type'),
    outcome: getSelect(page, 'Outcome'),
    status: getStatus(page, 'Status'),
    firstReported: getDate(page, 'First Reported'),
    fixDeployed: getDate(page, 'Fix Deployed'),
    lastVerified: getDate(page, 'Last Verified'),
    verifyBy: getDate(page, 'Verify By'),
    evidence: getRichText(page, 'Evidence'),
    boardCard: getUrl(page, 'Board Card'),
    pageUrl: page.url,
  };
}

function mdEscape(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function truncate(value, max) {
  const s = String(value || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function renderRow(row) {
  const marker = STANDOUT_OUTCOMES.has(row.outcome) ? '⚠️ ' : '';
  const outcome = STANDOUT_OUTCOMES.has(row.outcome) ? `**${row.outcome}**` : row.outcome || '—';
  const link = row.boardCard || row.pageUrl;
  const title = `[${mdEscape(row.bug)}](${link})`;
  return [
    row.bugId,
    `${marker}${title}`,
    row.severity || '—',
    row.fixType || '—',
    outcome,
    row.firstReported || '—',
    row.fixDeployed || '—',
    row.verifyBy || '—',
    mdEscape(truncate(row.evidence, 200)) || '—',
  ];
}

function renderArea(area, rows) {
  const sorted = [...rows].sort((a, b) => (a.firstReported || '').localeCompare(b.firstReported || ''));
  const standoutCount = sorted.filter((r) => STANDOUT_OUTCOMES.has(r.outcome)).length;
  const flag = standoutCount > 0 ? ` — ⚠️ ${standoutCount} recurred/partially-held` : '';
  const lines = [];
  lines.push(`### ${area} (${sorted.length})${flag}`, '');
  lines.push('| Bug ID | Bug | Severity | Fix Type | Outcome | First Reported | Fix Deployed | Verify By | Evidence |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const row of sorted) {
    lines.push(`| ${renderRow(row).join(' | ')} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderDoc(rows) {
  const byArea = new Map();
  for (const row of rows) {
    if (!byArea.has(row.area)) byArea.set(row.area, []);
    byArea.get(row.area).push(row);
  }
  // Areas ordered by their earliest First Reported date, so the
  // longest-running problem areas surface first.
  const areas = [...byArea.entries()].sort((a, b) => {
    const aMin = a[1].reduce((m, r) => (r.firstReported && r.firstReported < m ? r.firstReported : m), '9999-99-99');
    const bMin = b[1].reduce((m, r) => (r.firstReported && r.firstReported < m ? r.firstReported : m), '9999-99-99');
    return aMin.localeCompare(bMin);
  });

  const totalStandout = rows.filter((r) => STANDOUT_OUTCOMES.has(r.outcome)).length;
  const generatedAt = new Date().toISOString();

  const lines = [];
  lines.push('# Bug & Fix Log');
  lines.push('');
  lines.push('Generated snapshot of the 🐞 Bug & Fix Log (Notion, Agent Ops Hub).');
  lines.push('**Notion is the working source of truth — do not hand-edit this file.**');
  lines.push('Regenerate with `node scripts/export-bug-log.js`.');
  lines.push('');
  lines.push(`Last generated: ${generatedAt} · ${rows.length} rows · ${totalStandout} recurred/partially-held`);
  lines.push('');
  lines.push('See the Known-Issue Check section of `CLAUDE.md`: query this log');
  lines.push('(or the live Notion database, if reachable) for the relevant Area');
  lines.push('before forming any hypothesis about a reported problem.');
  lines.push('');
  for (const [area, areaRows] of areas) {
    lines.push(renderArea(area, areaRows));
  }
  return lines.join('\n');
}

async function main() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    fail(
      'NOTION_API_KEY is not set. Add a Notion internal integration token to ' +
        '.env.local and share it with the "🐞 Bug & Fix Log" database in Notion ' +
        '(Agent Ops Hub), then re-run. BUG_LOG.md was left untouched.'
    );
  }

  let pages;
  try {
    pages = await queryAllPages(apiKey);
  } catch (err) {
    fail(`${err.message} — BUG_LOG.md was left untouched.`);
    return;
  }

  const rows = pages.map(normalizeRow);
  const doc = renderDoc(rows);

  // Write atomically so a mid-run failure can't leave a half-written file.
  const tmpPath = `${OUT_PATH}.tmp`;
  fs.writeFileSync(tmpPath, doc, 'utf8');
  fs.renameSync(tmpPath, OUT_PATH);
  console.log(`[export-bug-log] wrote ${OUT_PATH} (${rows.length} rows)`);
}

module.exports = { normalizeRow, renderDoc, OUT_PATH };

if (require.main === module) {
  main();
}
