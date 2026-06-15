#!/usr/bin/env node
/**
 * One-time local setup: creates .env files from their .env.example templates
 * (if missing) and generates the Prisma client.
 */
const { existsSync, copyFileSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const root = join(__dirname, '..');

function ensureEnvFile(dir, exampleName, targetName) {
  const examplePath = join(root, dir, exampleName);
  const targetPath = join(root, dir, targetName);

  if (existsSync(targetPath)) {
    console.log(`[setup] ${dir}/${targetName} already exists, skipping`);
    return;
  }

  if (!existsSync(examplePath)) {
    console.warn(`[setup] ${dir}/${exampleName} not found, skipping`);
    return;
  }

  copyFileSync(examplePath, targetPath);
  console.log(`[setup] Created ${dir}/${targetName} from ${exampleName}`);
}

console.log('[setup] Bootstrapping environment files...');
ensureEnvFile('backend', '.env.example', '.env');
ensureEnvFile('frontend', '.env.local.example', '.env.local');

console.log('[setup] Generating Prisma client...');
const result = spawnSync('npm', ['run', 'prisma:generate', '--workspace=backend'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  console.error('[setup] Prisma client generation failed. Fix backend/.env (DATABASE_URL) and re-run "npm run setup".');
  process.exit(result.status ?? 1);
}

console.log('[setup] Done. Edit backend/.env with real credentials, then run "npm run dev".');
