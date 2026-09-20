const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');
const skipDir = path.join(__dirname, '..', 'src', 'app', '_api_skip');

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function removeDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const dirPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeDir(dirPath);
    } else {
      fs.unlinkSync(dirPath);
    }
  }
  fs.rmdirSync(dir);
}

if (!fs.existsSync(apiDir)) {
  console.error('src/app/api/ introuvable');
  process.exit(1);
}

console.log('[build:desktop] Copie temporaire src/app/api/ → src/app/_api_skip/');
copyDir(apiDir, skipDir);
console.log('[build:desktop] Suppression src/app/api/');
removeDir(apiDir);

try {
  console.log('[build:desktop] Lancement du build desktop...');
  execSync('npx next build', { stdio: 'inherit', env: { ...process.env, BUILD_TARGET: 'desktop' } });
} catch (e) {
  console.error('[build:desktop] Build échoué — restauration de src/app/api/');
} finally {
  console.log('[build:desktop] Restauration de src/app/api/');
  copyDir(skipDir, apiDir);
  removeDir(skipDir);
}
