/* eslint-disable */
const fs = require('fs');
const path = require('path');

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyRecursiveSync(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    ensureDirSync(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    ensureDirSync(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

const serverRoot = path.join(__dirname, '..');
const clientDist = path.resolve(serverRoot, '../client/dist');
const targetStatic = path.join(serverRoot, 'dist/static');

if (!fs.existsSync(clientDist)) {
  console.error(`[copy-static] client build not found at: ${clientDist}`);
  process.exit(1);
}

ensureDirSync(targetStatic);
copyRecursiveSync(clientDist, targetStatic);
console.log(`[copy-static] Copied ${clientDist} -> ${targetStatic}`);


