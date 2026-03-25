const fs = require('fs');
const path = require('path');
const basePath = process.cwd();
const files = fs.readFileSync(path.join(basePath, 'any-files-list.txt'), 'utf8').trim().split(/\r?\n/).map(f => f.trim()).filter(Boolean);

let totalReplaced = 0;

for (const relFile of files) {
  const filePath = path.resolve(basePath, relFile);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  const origContent = content;
  let fileCount = 0;

  // 1. Remove : any from single-param callbacks: .method((x: any) =>
  content = content.replace(/\.(map|filter|forEach|find|findIndex|some|every|flatMap)\(\((\w+): any\)/g, (match, method, param) => {
    fileCount++;
    return `.${method}((${param})`;
  });

  // 2. Remove : any from two-param callbacks: .method((x: any, y: any) =>
  content = content.replace(/\.(map|filter|forEach|reduce|find|findIndex|some|every|sort|flatMap)\(\((\w+): any,\s*(\w+): any\)/g, (match, method, p1, p2) => {
    fileCount++;
    return `.${method}((${p1}, ${p2})`;
  });

  // 3. Handle (acc: number, x: any) - keep typed first param
  content = content.replace(/\.(reduce)\(\((\w+): (number|string|boolean),\s*(\w+): any\)/g, (match, method, p1, type, p2) => {
    fileCount++;
    return `.${method}((${p1}: ${type}, ${p2})`;
  });

  // 4. as any[] -> as unknown[]
  content = content.replace(/as any\[\]/g, () => {
    fileCount++;
    return 'as unknown[]';
  });

  if (content !== origContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalReplaced += fileCount;
    if (fileCount > 0) {
      console.log(`${relFile}: ${fileCount}`);
    }
  }
}

console.log(`\nTotal: ${totalReplaced}`);
