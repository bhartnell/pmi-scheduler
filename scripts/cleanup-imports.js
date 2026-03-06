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

    // Remove unused getServerSession import if not used in the code body
    // Check if getServerSession is used anywhere besides the import
    if (content.includes("import { getServerSession } from 'next-auth'")) {
      const withoutImport = content.replace(/import \{ getServerSession \} from 'next-auth';\r?\n/g, '');
      // Check if getServerSession is still used in the remaining code
      if (!withoutImport.includes('getServerSession')) {
        content = withoutImport;
      }
    }

    // Remove unused createClient import
    if (content.includes("import { createClient } from '@supabase/supabase-js'")) {
      const withoutImport = content.replace(/import \{ createClient \} from '@supabase\/supabase-js';\r?\n/g, '');
      if (!withoutImport.includes('createClient')) {
        content = withoutImport;
      }
    }

    // Remove unused authOptions import
    if (content.includes("import { authOptions } from")) {
      const withoutImport = content.replace(/import \{ authOptions \} from [^;]+;\r?\n/g, '');
      if (!withoutImport.includes('authOptions')) {
        content = withoutImport;
      }
    }

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf-8');
      console.log('CLEANED IMPORTS: ' + relPath);
      fixedCount++;
    }
  }
}

console.log('\nTotal files with imports cleaned: ' + fixedCount);
