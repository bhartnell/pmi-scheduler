#!/usr/bin/env node
/**
 * Task 41: RBAC Completion for Non-Admin Routes
 *
 * Migrates non-admin API routes from raw getServerSession checks
 * to the standardized requireAuth() pattern from lib/api-auth.ts.
 *
 * Run: node scripts/migrate-rbac-nonadmin.js
 */

const fs = require('fs');
const path = require('path');

/**
 * Recursively find all files matching a pattern in a directory.
 */
function findFilesRecursive(dir, filename) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFilesRecursive(fullPath, filename));
    } else if (entry.name === filename) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Configuration ──────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');

// Directories to scan (relative to ROOT)
const SCAN_DIRS = [
  'app/api/clinical',
  'app/api/lab-management',
  'app/api/seating',
  'app/api/reports',
  'app/api/skill-sheets/by-skill-name',
  'app/api/stations/pool/favorites',
];

// Routes to SKIP (leave as-is)
const SKIP_PATHS = [
  // affiliations has special program_director permission logic
  'app/api/clinical/affiliations/route.ts',
  // preceptor-eval/[token] is public (token-based auth, no session)
  'app/api/clinical/preceptor-eval/[token]/route.ts',
];

// Routes that need lead_instructor instead of instructor
const LEAD_INSTRUCTOR_PATHS = [
  'app/api/clinical/internships/[id]/preceptors/[assignmentId]/route.ts',
  'app/api/clinical/internships/[id]/preceptors/route.ts',
];

// ── Helpers ────────────────────────────────────────────────────

function shouldSkip(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  return SKIP_PATHS.some(skip => normalized.endsWith(skip));
}

function getRequiredRole(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (LEAD_INSTRUCTOR_PATHS.some(p => normalized.endsWith(p))) {
    return 'lead_instructor';
  }
  return 'instructor';
}

/**
 * Find all exported handler functions in the file content.
 * Returns array of handler names: GET, POST, PUT, PATCH, DELETE
 */
function findHandlers(content) {
  const handlers = [];
  // Match: export async function GET(
  // Match: export async function GET (
  // Also handle arrow function exports (unlikely but possible)
  const regex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    handlers.push(match[1]);
  }
  return handlers;
}

/**
 * Check if a handler function already uses `session.user.email` for data operations
 * (like setting created_by, user_email, etc.)
 * Returns true if session.user.email is used beyond just the auth check.
 */
function handlerUsesSessionEmail(handlerBody) {
  // Remove the auth check pattern to see if session.user.email is used elsewhere
  const withoutAuthCheck = handlerBody
    .replace(/const\s+session\s*=\s*await\s+getServerSession\([^)]*\);?\s*\n?\s*if\s*\(\s*!session\?\.user\?\.email\s*\)\s*\{[^}]+\}/g, '')
    .replace(/const\s+session\s*=\s*await\s+getServerSession\(\);?\s*\n?\s*if\s*\(\s*!session\?\.user\?\.email\s*\)\s*\{[^}]+\}/g, '');

  return /session\.user\.email/i.test(withoutAuthCheck) || /session\.user!\.email/i.test(withoutAuthCheck);
}

/**
 * Extract the body of a handler function from the full file content.
 */
function extractHandlerBody(content, handlerName) {
  // Find the start of the function
  const funcRegex = new RegExp(
    `export\\s+async\\s+function\\s+${handlerName}\\s*\\(`,
    'g'
  );
  const match = funcRegex.exec(content);
  if (!match) return null;

  const startIdx = match.index;

  // Find the opening brace of the function body
  let braceDepth = 0;
  let inBody = false;
  let bodyStart = -1;

  for (let i = startIdx; i < content.length; i++) {
    if (content[i] === '{' && !isInString(content, i)) {
      if (!inBody) {
        inBody = true;
        bodyStart = i;
      }
      braceDepth++;
    } else if (content[i] === '}' && !isInString(content, i)) {
      braceDepth--;
      if (braceDepth === 0 && inBody) {
        return content.substring(bodyStart, i + 1);
      }
    }
  }
  return null;
}

/**
 * Very rough check if position i is inside a string literal.
 * This is a simplification - good enough for our use case.
 */
function isInString(content, pos) {
  // Count unescaped quotes before this position
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  for (let i = 0; i < pos; i++) {
    const ch = content[i];
    const prev = i > 0 ? content[i - 1] : '';

    if (prev === '\\') continue;

    if (ch === "'" && !inDouble && !inTemplate) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && !inTemplate) inDouble = !inDouble;
    else if (ch === '`' && !inSingle && !inDouble) inTemplate = !inTemplate;
  }

  return inSingle || inDouble || inTemplate;
}

/**
 * Main migration logic for a single file.
 */
function migrateFile(filePath) {
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;

  // Already has requireAuth - skip
  if (content.includes('requireAuth')) {
    return { status: 'already_done', relPath };
  }

  // Should skip (affiliations, public routes)
  if (shouldSkip(relPath)) {
    return { status: 'skipped', relPath, reason: 'in skip list' };
  }

  const role = getRequiredRole(relPath);
  const handlers = findHandlers(content);

  if (handlers.length === 0) {
    return { status: 'skipped', relPath, reason: 'no handlers found' };
  }

  // Check if this is a stub/no-op file (like scenario-library/favorites)
  if (!content.includes('getServerSession') && !content.includes('getSupabaseAdmin') && !content.includes('supabase')) {
    // Stub route with no auth and no DB access - skip
    return { status: 'skipped', relPath, reason: 'stub route (no auth, no DB)' };
  }

  let changesMade = false;
  let needsImport = false;
  let sessionsReplaced = 0;
  let handlersWithSessionEmail = [];

  // Process each handler
  for (const handler of handlers) {
    const handlerBody = extractHandlerBody(content, handler);
    if (!handlerBody) continue;

    // Check if this specific handler uses session.user.email for data operations
    const usesSessionEmail = handlerUsesSessionEmail(handlerBody);
    if (usesSessionEmail) {
      handlersWithSessionEmail.push(handler);
    }

    // Pattern 1: Handler has getServerSession + check inside try block
    // try {
    //   ...getSupabaseAdmin()...
    //   const session = await getServerSession(...);
    //   if (!session?.user?.email) { return ... }
    //
    // OR:
    // try {
    //   const session = await getServerSession(...);
    //   if (!session?.user?.email) { return ... }
    //   ...getSupabaseAdmin()...

    // We need to replace the session check with requireAuth
    // and handle the case where session.user.email is used later

    // Pattern: session check right after function start or after try {
    const sessionCheckPatterns = [
      // Pattern with authOptions
      /(\s*)const\s+session\s*=\s*await\s+getServerSession\s*\(\s*authOptions\s*\)\s*;?\s*\n\s*if\s*\(\s*!session\?\.user\?\.email\s*\)\s*\{\s*\n\s*return\s+NextResponse\.json\s*\([^)]+\)\s*;?\s*\n\s*\}/g,
      // Pattern without authOptions
      /(\s*)const\s+session\s*=\s*await\s+getServerSession\s*\(\s*\)\s*;?\s*\n\s*if\s*\(\s*!session\?\.user\?\.email\s*\)\s*\{\s*\n\s*return\s+NextResponse\.json\s*\([^)]+\)\s*;?\s*\n\s*\}/g,
    ];

    for (const pattern of sessionCheckPatterns) {
      const beforeReplace = content;

      // For handlers that use session.user.email for data, we need to keep session reference available
      let replacement;
      if (usesSessionEmail) {
        replacement = `$1const auth = await requireAuth('${role}');\n$1if (auth instanceof NextResponse) return auth;\n$1const { user, session } = auth;`;
      } else {
        replacement = `$1const auth = await requireAuth('${role}');\n$1if (auth instanceof NextResponse) return auth;\n$1const { user } = auth;`;
      }

      content = content.replace(pattern, replacement);

      if (content !== beforeReplace) {
        changesMade = true;
        needsImport = true;
        sessionsReplaced++;
        break; // Only replace one pattern per handler
      }
    }
  }

  // Handle the case where there's a session + manual role check pattern
  // (like in reports/attendance which does its own hasMinRole check)
  if (!changesMade) {
    // Try a broader pattern for files that do session check + manual role check
    const broadSessionPatterns = [
      // Session check with manual role lookup after
      /(\s*)const\s+session\s*=\s*await\s+getServerSession\s*\([^)]*\)\s*;?\s*\n\s*if\s*\(\s*!session\?\.user\?\.email\s*\)\s*\{\s*\n\s*return\s+NextResponse\.json\s*\([^)]*\)[^}]*\}\s*\n\s*(?:\/\/[^\n]*\n\s*)?const\s*\{\s*data:\s*(?:requestingUser|callerUser|currentUser)\s*\}\s*=\s*await\s+supabase[^;]+;\s*\n\s*(?:\n\s*)?if\s*\(\s*!(?:requestingUser|callerUser|currentUser)\s*\|\|\s*!hasMinRole\s*\([^)]+\)\s*\)\s*\{\s*\n\s*return\s+NextResponse\.json\s*\([^)]*\)[^}]*\}/g,
    ];

    for (const pattern of broadSessionPatterns) {
      const beforeReplace = content;
      const replacement = `$1const auth = await requireAuth('${role}');\n$1if (auth instanceof NextResponse) return auth;\n$1const { user } = auth;`;
      content = content.replace(pattern, replacement);
      if (content !== beforeReplace) {
        changesMade = true;
        needsImport = true;
        sessionsReplaced++;
      }
    }
  }

  // For routes with NO auth at all (no getServerSession call)
  // These need auth added at the start of each handler
  if (!content.includes('getServerSession') && !changesMade && !content.includes('requireAuth')) {
    // Check if handlers lack any auth
    for (const handler of handlers) {
      const handlerBody = extractHandlerBody(content, handler);
      if (!handlerBody) continue;

      if (!handlerBody.includes('getServerSession') && !handlerBody.includes('requireAuth')) {
        // This handler has no auth - needs to be added
        // Find the try { or function body start

        // Find the handler function declaration
        const funcRegex = new RegExp(
          `(export\\s+async\\s+function\\s+${handler}\\s*\\([^)]*\\)\\s*\\{)`,
          'g'
        );

        // Check if there's a try block
        if (handlerBody.includes('try {')) {
          // Add after try {
          const tryPattern = new RegExp(
            `(export\\s+async\\s+function\\s+${handler}\\s*\\([^)]*\\)\\s*\\{\\s*\\n\\s*try\\s*\\{)`,
            'g'
          );
          const beforeReplace = content;
          content = content.replace(tryPattern, `$1\n    const auth = await requireAuth('${role}');\n    if (auth instanceof NextResponse) return auth;\n    const { user } = auth;\n`);
          if (content !== beforeReplace) {
            changesMade = true;
            needsImport = true;
          }
        } else {
          // Add at start of function body
          const beforeReplace = content;
          content = content.replace(funcRegex, `$1\n  const auth = await requireAuth('${role}');\n  if (auth instanceof NextResponse) return auth;\n  const { user } = auth;\n`);
          if (content !== beforeReplace) {
            changesMade = true;
            needsImport = true;
          }
        }
      }
    }
  }

  if (!changesMade) {
    return { status: 'no_changes', relPath, reason: 'patterns not matched' };
  }

  // Add the requireAuth import
  if (needsImport) {
    // Add import after the last existing import
    if (content.includes("from '@/lib/api-auth'")) {
      // Already imported somehow
    } else {
      // Add after the last import line
      const importLines = content.match(/^import\s+.*$/gm);
      if (importLines && importLines.length > 0) {
        const lastImport = importLines[importLines.length - 1];
        content = content.replace(
          lastImport,
          lastImport + "\nimport { requireAuth } from '@/lib/api-auth';"
        );
      } else {
        // No imports at all - add at top
        content = "import { requireAuth } from '@/lib/api-auth';\n" + content;
      }
    }
  }

  // Clean up unused imports
  // Check if getServerSession is still used anywhere
  if (!content.includes('getServerSession(') && !content.includes('getServerSession (')) {
    // Remove the import
    content = content.replace(/import\s*\{\s*getServerSession\s*\}\s*from\s*'next-auth'\s*;?\s*\n?/g, '');
  }

  // Check if authOptions is still used
  if (!content.includes('authOptions') ||
      (content.includes("import") && content.includes("authOptions") && !content.match(/authOptions[^'"]/))) {
    // Only remove if it's imported but not used in code
    const authOptionsUsedInCode = content.replace(/import[^;]+authOptions[^;]+;/g, '').includes('authOptions');
    if (!authOptionsUsedInCode) {
      content = content.replace(/import\s*\{\s*authOptions\s*\}\s*from\s*'@\/lib\/auth'\s*;?\s*\n?/g, '');
    }
  }

  // Check if createClient is still used
  if (!content.includes('createClient(')) {
    content = content.replace(/import\s*\{\s*createClient\s*\}\s*from\s*'@supabase\/supabase-js'\s*;?\s*\n?/g, '');
  }

  // Check if hasMinRole is still used in the code (not just in imports)
  const hasMinRoleUsedInCode = content.replace(/import[^;]+;/g, '').includes('hasMinRole');
  if (!hasMinRoleUsedInCode) {
    content = content.replace(/import\s*\{\s*hasMinRole\s*\}\s*from\s*'@\/lib\/permissions'\s*;?\s*\n?/g, '');
  }

  // Remove blank lines at the top (multiple consecutive newlines)
  content = content.replace(/^\n+/, '');
  // Fix multiple blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return {
      status: 'migrated',
      relPath,
      handlersFixed: handlers,
      sessionsReplaced,
      handlersWithSessionEmail,
      role,
    };
  }

  return { status: 'no_changes', relPath };
}

// ── Main ───────────────────────────────────────────────────────

function main() {
  console.log('=== Task 41: RBAC Migration for Non-Admin Routes ===\n');

  // Gather all route.ts files from the scan dirs
  const allFiles = [];

  for (const dir of SCAN_DIRS) {
    const fullDir = path.join(ROOT, dir);
    if (!fs.existsSync(fullDir)) {
      console.log(`  WARN: Directory not found: ${dir}`);
      continue;
    }

    // Find all route.ts files recursively
    const files = findFilesRecursive(fullDir, 'route.ts');
    for (const f of files) {
      if (!allFiles.includes(f)) {
        allFiles.push(f);
      }
    }
  }

  console.log(`Found ${allFiles.length} route files to process.\n`);

  const results = {
    migrated: [],
    already_done: [],
    skipped: [],
    no_changes: [],
    errors: [],
  };

  for (const filePath of allFiles) {
    try {
      const result = migrateFile(filePath);
      results[result.status] = results[result.status] || [];
      results[result.status].push(result);
    } catch (err) {
      results.errors.push({
        relPath: path.relative(ROOT, filePath).replace(/\\/g, '/'),
        error: err.message,
      });
    }
  }

  // Print results
  console.log('── Migrated ──');
  for (const r of results.migrated) {
    const emailNote = r.handlersWithSessionEmail.length > 0
      ? ` (session email used in: ${r.handlersWithSessionEmail.join(', ')})`
      : '';
    console.log(`  ✓ ${r.relPath} [${r.role}] handlers: ${r.handlersFixed.join(', ')}${emailNote}`);
  }
  console.log(`  Total: ${results.migrated.length}\n`);

  console.log('── Already Done ──');
  for (const r of results.already_done) {
    console.log(`  • ${r.relPath}`);
  }
  console.log(`  Total: ${results.already_done.length}\n`);

  console.log('── Skipped ──');
  for (const r of results.skipped) {
    console.log(`  ○ ${r.relPath} (${r.reason})`);
  }
  console.log(`  Total: ${results.skipped.length}\n`);

  console.log('── No Changes (need manual review) ──');
  for (const r of results.no_changes) {
    console.log(`  ! ${r.relPath}${r.reason ? ' (' + r.reason + ')' : ''}`);
  }
  console.log(`  Total: ${results.no_changes.length}\n`);

  if (results.errors.length > 0) {
    console.log('── Errors ──');
    for (const r of results.errors) {
      console.log(`  ✗ ${r.relPath}: ${r.error}`);
    }
    console.log(`  Total: ${results.errors.length}\n`);
  }

  console.log(`\nSummary: ${results.migrated.length} migrated, ${results.already_done.length} already done, ${results.skipped.length} skipped, ${results.no_changes.length} need review, ${results.errors.length} errors`);
}

main();
