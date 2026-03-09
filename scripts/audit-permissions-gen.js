#!/usr/bin/env node
/**
 * Permission Audit Scanner & Report Generator
 * Scans all API route.ts files and writes docs/PERMISSION_AUDIT.md
 *
 * Auth patterns detected:
 * 1. getServerSession(authOptions) - proper session auth
 * 2. getServerSession() - bare session check (FLAGGED)
 * 3. requireAuth(minRole?) from @/lib/api-auth - wrapper that calls getServerSession(authOptions) internally
 * 4. hasMinRole(session, 'role') - role hierarchy check
 * 5. isSuperadmin(session) - superadmin-only check
 * 6. CRON_SECRET - cron job token verification
 * 7. Token-based routes ([token] in path)
 * 8. No auth at all - FLAGGED
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'app', 'api');
const OUTPUT_FILE = path.join(ROOT, 'docs', 'PERMISSION_AUDIT.md');

function walkDir(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        results = results.concat(walkDir(filePath));
      } else if (file === 'route.ts') {
        results.push(filePath);
      }
    }
  } catch (e) { /* skip */ }
  return results;
}

function getRelativePath(fp) {
  return fp.replace(ROOT + path.sep, '').replace(/\\/g, '/');
}

function getRoutePath(fp) {
  let route = fp.replace(API_DIR, '').replace(/\\/g, '/').replace('/route.ts', '') || '/';
  return '/api' + route;
}

function getHttpMethods(content) {
  const methods = new Set();
  // async function exports
  for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}`, 'm').test(content)) methods.add(m);
    if (new RegExp(`export\\s+const\\s+${m}`, 'm').test(content)) methods.add(m);
  }
  // NextAuth re-export pattern: export { handler as GET, handler as POST }
  const reExport = content.match(/export\s*\{([^}]+)\}/);
  if (reExport) {
    const inner = reExport[1];
    for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      if (inner.includes(m)) methods.add(m);
    }
  }
  return [...methods].sort();
}

function analyzeAuth(content, routePath) {
  // --- Detect auth method presence ---
  const hasSessionWithOptions = /getServerSession\s*\(\s*authOptions\s*\)/.test(content);
  const hasSessionBare = /getServerSession\s*\(\s*\)/.test(content);

  // requireAuth from @/lib/api-auth wraps getServerSession(authOptions)
  const hasRequireAuth = /requireAuth\s*\(/.test(content);
  // Check for requireAuth with role argument
  const requireAuthRoleMatch = content.match(/requireAuth\s*\(\s*['"](\w+)['"]\s*\)/);
  const requireAuthRole = requireAuthRoleMatch ? requireAuthRoleMatch[1] : null;

  // Any valid session check (including requireAuth)
  const hasProperSession = hasSessionWithOptions || hasRequireAuth;
  const hasAnySession = hasProperSession || hasSessionBare;

  // --- Detect role checks ---
  const hasIsSuperadmin = /isSuperadmin\s*\(/.test(content);
  const hasMinRoleCall = /hasMinRole\s*\(/.test(content);

  // Extract all hasMinRole role arguments
  const minRoleMatches = [...content.matchAll(/hasMinRole\s*\([^,]*,\s*['"](\w+)['"]\s*\)/g)];
  const minRoles = minRoleMatches.map(m => m[1]);

  // requireRole checks
  const requireRoleMatches = [...content.matchAll(/requireRole\s*\(\s*['"](\w+)['"]\s*\)/g)];
  const requireRoles = requireRoleMatches.map(m => m[1]);

  // Array.includes role checks: ['admin', 'superadmin'].includes(role)
  const includesMatches = [...content.matchAll(/\[([^\]]*)\]\.includes\s*\(\s*(?:role|userRole|session\.user\.role)/g)];
  const includesRoles = [];
  for (const m of includesMatches) {
    const roles = [...m[1].matchAll(/['"](\w+)['"]/g)].map(r => r[1]);
    includesRoles.push(...roles);
  }

  // Direct role comparisons
  const directRoleComparisons = [...content.matchAll(/(?:role|userRole)\s*(?:===?|!==?)\s*['"](\w+)['"]/g)];
  const directRoles = directRoleComparisons.map(m => m[1]);

  // session.user.role access
  const accessesRole = /session\.user\.role/.test(content) || /(?:const|let)\s+(?:role|userRole)\s*=/.test(content);

  // CRON_SECRET
  const hasCronSecret = /CRON_SECRET/.test(content);

  // --- Special route types ---

  // NextAuth handler
  if (routePath.includes('/auth/[...nextauth]')) {
    return {
      minimumRole: 'public',
      authPattern: 'NextAuth handler (framework)',
      severity: 'ok',
      category: 'framework',
    };
  }

  // Cron routes
  if (routePath.includes('/cron/')) {
    if (hasCronSecret) {
      return {
        minimumRole: 'public',
        authPattern: 'CRON_SECRET verification',
        severity: 'ok',
        category: 'cron',
      };
    } else {
      return {
        minimumRole: 'MISSING',
        authPattern: 'Cron route WITHOUT CRON_SECRET check',
        severity: 'critical',
        category: 'cron',
      };
    }
  }

  // Token-based public access
  if (/\[token\]/.test(routePath)) {
    return {
      minimumRole: 'public',
      authPattern: 'Token-based access (public link with secret token)',
      severity: 'ok',
      category: 'public_token',
    };
  }

  // Intentionally public endpoints
  if (routePath === '/api/config/public' || routePath === '/api/guest/login') {
    return {
      minimumRole: 'public',
      authPattern: 'Intentionally public endpoint',
      severity: 'ok',
      category: 'public',
    };
  }

  // --- Determine minimum role ---
  const roleHierarchy = ['superadmin', 'admin', 'lead_instructor', 'instructor', 'user'];

  function lowestRole(roles) {
    let lowest = -1;
    for (const r of roles) {
      const idx = roleHierarchy.indexOf(r);
      if (idx > lowest) lowest = idx;
    }
    return lowest >= 0 ? roleHierarchy[lowest] : null;
  }

  // Collect all detected roles
  const allDetectedRoles = [
    ...minRoles,
    ...requireRoles,
    ...includesRoles,
    ...directRoles,
    ...(requireAuthRole ? [requireAuthRole] : []),
  ];

  let minimumRole = null;
  let roleDetails = '';
  let hasRoleCheck = false;

  if (hasIsSuperadmin && allDetectedRoles.length === 0) {
    hasRoleCheck = true;
    minimumRole = 'superadmin';
    roleDetails = 'isSuperadmin()';
  } else if (allDetectedRoles.length > 0) {
    hasRoleCheck = true;
    minimumRole = lowestRole(allDetectedRoles);
    if (!minimumRole) minimumRole = allDetectedRoles[0]; // fallback
    const unique = [...new Set(allDetectedRoles)];
    roleDetails = unique.join(', ');
  } else if (hasIsSuperadmin) {
    hasRoleCheck = true;
    minimumRole = 'superadmin';
    roleDetails = 'isSuperadmin()';
  } else if (accessesRole && hasAnySession) {
    // Role is accessed but not through standard patterns - try to infer
    hasRoleCheck = true;
    if (/superadmin/.test(content) && /admin/.test(content) && /instructor/.test(content)) {
      minimumRole = 'instructor';
      roleDetails = 'role check (inferred: instructor+)';
    } else if (/superadmin/.test(content) && /admin/.test(content)) {
      minimumRole = 'admin';
      roleDetails = 'role check (inferred: admin+)';
    } else if (/superadmin/.test(content)) {
      minimumRole = 'superadmin';
      roleDetails = 'role check (inferred: superadmin)';
    } else if (/admin/.test(content)) {
      minimumRole = 'admin';
      roleDetails = 'role check (inferred: admin)';
    } else {
      minimumRole = 'user';
      roleDetails = 'role accessed but level unclear';
    }
  }

  // --- Build auth pattern description ---
  let authMethod = '';
  if (hasRequireAuth && hasSessionWithOptions) {
    authMethod = 'requireAuth + getServerSession(authOptions)';
  } else if (hasRequireAuth) {
    authMethod = 'requireAuth';
  } else if (hasSessionWithOptions) {
    authMethod = 'getServerSession(authOptions)';
  } else if (hasSessionBare) {
    authMethod = 'getServerSession() [BARE]';
  } else {
    authMethod = 'none';
  }

  let roleMethod = '';
  if (hasIsSuperadmin) roleMethod += 'isSuperadmin';
  if (hasMinRoleCall) roleMethod += (roleMethod ? ' + ' : '') + `hasMinRole(${minRoles.join(', ')})`;
  if (requireRoles.length) roleMethod += (roleMethod ? ' + ' : '') + `requireRole(${requireRoles.join(', ')})`;
  if (requireAuthRole) roleMethod += (roleMethod ? ' + ' : '') + `requireAuth('${requireAuthRole}')`;
  if (includesRoles.length) roleMethod += (roleMethod ? ' + ' : '') + `[${[...new Set(includesRoles)].join(', ')}].includes(role)`;
  if (directRoles.length && !roleMethod) roleMethod = `role check (${[...new Set(directRoles)].join(', ')})`;
  if (!roleMethod && accessesRole && hasRoleCheck) roleMethod = `role check (${roleDetails})`;

  let authPattern = authMethod;
  if (roleMethod) authPattern += ' + ' + roleMethod;

  // --- Determine severity ---
  let severity = 'ok';
  let category = 'authenticated';

  if (hasSessionBare && !hasRequireAuth && !hasSessionWithOptions) {
    severity = 'critical';
    if (!hasRoleCheck) {
      minimumRole = minimumRole || 'user';
      authPattern += ' -- MISSING authOptions';
    }
  }

  if (!hasAnySession) {
    severity = 'critical';
    minimumRole = 'MISSING';
    authPattern = 'NO AUTH FOUND';
    category = 'no_auth';
  } else if (hasProperSession && hasRoleCheck) {
    severity = 'ok';
    category = 'proper';
  } else if (hasProperSession && !hasRoleCheck) {
    severity = 'warning';
    minimumRole = 'user';
    category = 'session_only';
  }

  return { minimumRole, authPattern, severity, category, roleDetails };
}

// === MAIN ===
const routeFiles = walkDir(API_DIR).sort();

const results = routeFiles.map(fp => {
  const content = fs.readFileSync(fp, 'utf-8');
  const routePath = getRoutePath(fp);
  const methods = getHttpMethods(content);
  const auth = analyzeAuth(content, routePath);
  return { routePath, relativePath: getRelativePath(fp), methods, ...auth };
});

// === STATISTICS ===
const total = results.length;
const properAuth = results.filter(r => r.category === 'proper').length;
const sessionOnly = results.filter(r => r.category === 'session_only').length;
const bareSession = results.filter(r => r.authPattern && r.authPattern.includes('[BARE]')).length;
const noAuth = results.filter(r => r.minimumRole === 'MISSING').length;
const publicRoutes = results.filter(r => ['framework', 'cron', 'public_token', 'public'].includes(r.category)).length;

const criticals = results.filter(r => r.severity === 'critical');
const warnings = results.filter(r => r.severity === 'warning');

// Group by minimum role
const bySuperadmin = results.filter(r => r.minimumRole === 'superadmin');
const byAdmin = results.filter(r => r.minimumRole === 'admin');
const byLeadInstructor = results.filter(r => r.minimumRole === 'lead_instructor');
const byInstructor = results.filter(r => r.minimumRole === 'instructor');
const byUser = results.filter(r => r.minimumRole === 'user');
const byPublic = results.filter(r => r.minimumRole === 'public');
const byMissing = results.filter(r => r.minimumRole === 'MISSING');

// === GENERATE MARKDOWN ===
let md = '';

md += `# PMI EMS Scheduler -- Permission Audit\n\n`;
md += `> Auto-generated from codebase scan -- March 8, 2026\n\n`;

md += `## Summary\n\n`;
md += `| Metric | Count |\n`;
md += `|--------|-------|\n`;
md += `| Total API routes scanned | ${total} |\n`;
md += `| Routes with proper auth (getServerSession/requireAuth + role check) | ${properAuth} |\n`;
md += `| Routes with session-only auth (no role check) | ${sessionOnly} |\n`;
md += `| Routes with bare getServerSession() (no authOptions) | ${bareSession} |\n`;
md += `| Routes with NO auth | ${noAuth} |\n`;
md += `| Public/cron/token routes (intentionally unauthenticated) | ${publicRoutes} |\n`;
md += `\n`;

// === FINDINGS BY SEVERITY ===
md += `## Findings by Severity\n\n`;

// CRITICAL
md += `### CRITICAL: No Auth or Missing authOptions\n\n`;
if (criticals.length === 0) {
  md += `None found.\n\n`;
} else {
  md += `Found **${criticals.length}** route(s) with critical auth issues:\n\n`;
  md += `| Route | Methods | Issue | File |\n`;
  md += `|-------|---------|-------|------|\n`;
  for (const r of criticals.sort((a, b) => a.routePath.localeCompare(b.routePath))) {
    md += `| \`${r.routePath}\` | ${r.methods.join(', ')} | ${r.authPattern} | \`${r.relativePath}\` |\n`;
  }
  md += `\n`;
}

// WARNING
md += `### WARNING: Session-Only (No Role Check)\n\n`;
md += `These routes verify the user is logged in but do not check their role. Any authenticated user can access them.\n\n`;
if (warnings.length === 0) {
  md += `None found.\n\n`;
} else {
  md += `Found **${warnings.length}** route(s) with session auth but no role verification:\n\n`;
  md += `| Route | Methods | Auth Pattern | File |\n`;
  md += `|-------|---------|-------------|------|\n`;
  for (const r of warnings.sort((a, b) => a.routePath.localeCompare(b.routePath))) {
    md += `| \`${r.routePath}\` | ${r.methods.join(', ')} | ${r.authPattern} | \`${r.relativePath}\` |\n`;
  }
  md += `\n`;
}

// OK summary
md += `### Properly Secured Routes\n\n`;
md += `**${properAuth}** routes have proper session auth with role checks.\n\n`;

// === ROUTES BY MINIMUM ROLE ===
md += `## Routes by Minimum Role Required\n\n`;

function renderRoleTable(label, routes) {
  if (routes.length === 0) {
    md += `### ${label}\n\n`;
    md += `No routes in this category.\n\n`;
    return;
  }
  md += `### ${label} (${routes.length} routes)\n\n`;
  md += `| Route | Methods | Auth Pattern |\n`;
  md += `|-------|---------|-------------|\n`;
  for (const r of routes.sort((a, b) => a.routePath.localeCompare(b.routePath))) {
    md += `| \`${r.routePath}\` | ${r.methods.join(', ')} | ${r.authPattern} |\n`;
  }
  md += `\n`;
}

renderRoleTable('superadmin', bySuperadmin);
renderRoleTable('admin', byAdmin);
renderRoleTable('lead_instructor', byLeadInstructor);
renderRoleTable('instructor', byInstructor);
renderRoleTable('user (any authenticated)', byUser);
renderRoleTable('public / cron / framework', byPublic);

if (byMissing.length > 0) {
  renderRoleTable('MISSING (no auth detected)', byMissing);
}

// === FULL ROUTE INDEX ===
md += `## Full Route Index\n\n`;
md += `| # | Route | Methods | Min Role | Severity | Auth Pattern |\n`;
md += `|---|-------|---------|----------|----------|--------------|\n`;
let i = 1;
for (const r of results.sort((a, b) => a.routePath.localeCompare(b.routePath))) {
  const sev = r.severity === 'critical' ? 'CRITICAL' : r.severity === 'warning' ? 'WARNING' : 'OK';
  md += `| ${i++} | \`${r.routePath}\` | ${r.methods.join(', ')} | ${r.minimumRole || 'unknown'} | ${sev} | ${r.authPattern} |\n`;
}
md += `\n`;

// === METHODOLOGY ===
md += `## Methodology\n\n`;
md += `This audit was generated by scanning all \`route.ts\` files under \`app/api/\` for:\n\n`;
md += `- \`getServerSession(authOptions)\` -- NextAuth session verification with proper config\n`;
md += `- \`getServerSession()\` -- Bare session check (flagged as CRITICAL: missing authOptions)\n`;
md += `- \`requireAuth(minRole?)\` from \`@/lib/api-auth\` -- Wrapper that internally calls getServerSession(authOptions)\n`;
md += `- \`hasMinRole(session, 'role')\` -- Role hierarchy check from \`lib/permissions.ts\`\n`;
md += `- \`isSuperadmin(session)\` -- Superadmin-only check\n`;
md += `- \`requireRole('role')\` -- Role requirement pattern\n`;
md += `- \`['role1', 'role2'].includes(role)\` -- Array-based role checks\n`;
md += `- \`CRON_SECRET\` -- Cron job token verification\n`;
md += `- Direct role comparisons (e.g., \`role === 'admin'\`)\n\n`;
md += `### Role Hierarchy\n\n`;
md += `\`superadmin\` > \`admin\` > \`lead_instructor\` > \`instructor\` > \`user\` > \`guest\`\n\n`;

md += `---\n`;
md += `*Generated by \`scripts/audit-permissions-gen.js\` on March 8, 2026*\n`;

// Write output
const docsDir = path.join(ROOT, 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}
fs.writeFileSync(OUTPUT_FILE, md, 'utf-8');

// Print summary to stdout
process.stdout.write(`Permission Audit Complete!\n`);
process.stdout.write(`Total routes: ${total}\n`);
process.stdout.write(`Critical: ${criticals.length}\n`);
process.stdout.write(`Warnings: ${warnings.length}\n`);
process.stdout.write(`Proper auth: ${properAuth}\n`);
process.stdout.write(`Session only: ${sessionOnly}\n`);
process.stdout.write(`Public/cron: ${publicRoutes}\n`);
process.stdout.write(`By role: SA=${bySuperadmin.length} A=${byAdmin.length} LI=${byLeadInstructor.length} I=${byInstructor.length} U=${byUser.length} P=${byPublic.length} M=${byMissing.length}\n`);
process.stdout.write(`Written to: ${OUTPUT_FILE}\n`);
