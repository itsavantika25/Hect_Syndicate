import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputDir = path.join(root, 'public');
const staticEntries = ['index.html', 'login.html', 'css', 'js'];

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const entry of staticEntries) {
  const from = path.join(root, entry);
  const to = path.join(outputDir, entry);
  if (!fs.existsSync(from)) continue;
  fs.cpSync(from, to, { recursive: true });
}

console.log('Prepared Vercel static output in public/.');
