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
const skipPaths = ['clinical/affiliations', 'clinical/preceptor-eval/[token]', 'scenario-library/favorites'];

let missingCount = 0;

for (const dir of dirs) {
  const fullDir = path.join(ROOT, dir);
  const files = findFilesRecursive(fullDir, 'route.ts');
  for (const file of files) {
    const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
    if (skipPaths.some(s => relPath.includes(s))) continue;

    const content = fs.readFileSync(file, 'utf-8');

    // Find all handler functions
    const handlers = [];
    const regex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      handlers.push({ name: match[1], index: match.index });
    }

    for (let i = 0; i < handlers.length; i++) {
      const handler = handlers[i];
      const nextHandlerIdx = i + 1 < handlers.length ? handlers[i + 1].index : content.length;
      const handlerCode = content.substring(handler.index, nextHandlerIdx);

      if (!handlerCode.includes('requireAuth')) {
        console.log(relPath + ' - ' + handler.name + ' - MISSING requireAuth');
        missingCount++;
      }
    }
  }
}

console.log('\nTotal handlers missing requireAuth: ' + missingCount);
