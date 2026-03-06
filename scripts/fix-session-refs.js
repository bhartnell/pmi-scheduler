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

    // Check if file has requireAuth AND session.user.email but doesn't properly destructure session
    if (!content.includes('requireAuth')) continue;
    if (!content.includes('session.user.email')) continue;

    // Check if session is already properly destructured from auth
    if (content.includes('{ user, session } = auth')) continue;

    // Replace { user } = auth with { user, session } = auth
    const newContent = content.replace(/const \{ user \} = auth;/g, 'const { user, session } = auth;');

    if (newContent !== content) {
      fs.writeFileSync(file, newContent, 'utf-8');
      console.log('FIXED: ' + relPath);
      fixedCount++;
    }
  }
}

console.log('\nTotal files fixed: ' + fixedCount);
