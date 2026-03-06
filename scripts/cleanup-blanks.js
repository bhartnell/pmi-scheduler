const fs = require('fs');
const path = require('path');

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

const ROOT = path.resolve(__dirname, '..');
const dirs = ['app/api/clinical', 'app/api/lab-management', 'app/api/seating', 'app/api/reports', 'app/api/skill-sheets/by-skill-name', 'app/api/stations/pool/favorites'];

let fixedCount = 0;

for (const dir of dirs) {
  const fullDir = path.join(ROOT, dir);
  const files = findFilesRecursive(fullDir, 'route.ts');
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(ROOT, file).split(path.sep).join('/');

    if (!content.includes('requireAuth')) continue;

    const original = content;

    // Fix pattern: requireAuth call with double blank lines around if-check
    // Handle both LF and CRLF
    content = content.replace(
      /const auth = await requireAuth\(([^)]*)\);\r?\n\r?\n\r?\n(\s*)if \(auth instanceof NextResponse\) return auth;\r?\n\r?\n\r?\n(\s*)const \{ (user(?:, session)?) \} = auth;/g,
      'const auth = await requireAuth($1);\n$2if (auth instanceof NextResponse) return auth;\n$3const { $4 } = auth;'
    );

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf-8');
      console.log('CLEANED: ' + relPath);
      fixedCount++;
    }
  }
}

console.log('\nTotal files cleaned: ' + fixedCount);
