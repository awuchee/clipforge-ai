#!/usr/bin/env node
/**
 * Starts the full VixClip stack locally as one product:
 *   - best-effort `docker compose up -d` for Postgres + Redis
 *   - waits (briefly) for Postgres/Redis ports to accept connections
 *   - runs frontend, backend API, and worker together via concurrently,
 *     with grouped, color-coded, per-service log prefixes
 *
 * Safe to run even if Docker / Postgres / Redis are not available locally —
 * it prints clear warnings and continues, since the user may be running
 * those services elsewhere (managed Postgres, Upstash Redis, etc.).
 */
const { spawnSync, spawn } = require('child_process');
const { existsSync, copyFileSync, readFileSync } = require('fs');
const { join } = require('path');
const net = require('net');

const root = join(__dirname, '..');

function ensureEnvFile(dir, exampleName, targetName) {
  const examplePath = join(root, dir, exampleName);
  const targetPath = join(root, dir, targetName);
  if (existsSync(targetPath)) return;
  if (!existsSync(examplePath)) return;
  copyFileSync(examplePath, targetPath);
  console.log(`[dev] Created ${dir}/${targetName} from ${exampleName}`);
}

function readEnvVar(envPath, key) {
  if (!existsSync(envPath)) return undefined;
  const line = readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith(`${key}=`));
  if (!line) return undefined;
  return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
}

function checkPort(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

async function waitForPort(name, host, port, attempts = 10, delayMs = 1000) {
  for (let i = 1; i <= attempts; i++) {
    if (await checkPort(host, port)) {
      console.log(`[dev] ${name} is reachable at ${host}:${port}`);
      return true;
    }
    if (i < attempts) await new Promise((r) => setTimeout(r, delayMs));
  }
  console.warn(
    `[dev] WARNING: ${name} is not reachable at ${host}:${port}. ` +
      `Start it (e.g. "docker compose up -d") or update your .env — continuing anyway.`,
  );
  return false;
}

async function main() {
  console.log('[dev] Bootstrapping environment files...');
  ensureEnvFile('backend', '.env.example', '.env');
  ensureEnvFile('frontend', '.env.local.example', '.env.local');

  console.log('[dev] Attempting to start Postgres + Redis via Docker Compose (best-effort)...');
  const compose = spawnSync('docker', ['compose', 'up', '-d', 'postgres', 'redis'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if (compose.status !== 0) {
    console.warn(
      '[dev] WARNING: "docker compose up -d" failed or Docker is not installed. ' +
        'Make sure Postgres and Redis are running and reachable via backend/.env, or install Docker.',
    );
  }

  const backendEnvPath = join(root, 'backend', '.env');
  const dbUrl = readEnvVar(backendEnvPath, 'DATABASE_URL');
  const redisUrl = readEnvVar(backendEnvPath, 'REDIS_URL');
  const redisHost = readEnvVar(backendEnvPath, 'REDIS_HOST') || '127.0.0.1';
  const redisPort = Number(readEnvVar(backendEnvPath, 'REDIS_PORT') || 6379);

  let pgHost = '127.0.0.1';
  let pgPort = 5432;
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl.replace(/^postgresql:/, 'postgres:'));
      pgHost = parsed.hostname || pgHost;
      pgPort = parsed.port ? Number(parsed.port) : pgPort;
    } catch {
      // keep defaults
    }
  }

  let rHost = redisHost;
  let rPort = redisPort;
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      rHost = parsed.hostname || rHost;
      rPort = parsed.port ? Number(parsed.port) : rPort;
    } catch {
      // keep defaults
    }
  }

  console.log('[dev] Checking infrastructure connectivity...');
  await waitForPort('Postgres', pgHost, pgPort);
  await waitForPort('Redis', rHost, rPort);

  console.log('[dev] Generating Prisma client...');
  spawnSync('npm', ['run', 'prisma:generate', '--workspace=backend'], { cwd: root, stdio: 'inherit', shell: true });

  console.log('[dev] Starting frontend, backend API, and worker together...\n');

  const concurrentlyBin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'concurrently.cmd' : 'concurrently');

  const args = [
    '--kill-others-on-fail',
    '--prefix-colors',
    'cyan,green,yellow',
    '--names',
    'WEB,API,WORKER',
    'npm:dev:web',
    'npm:dev:api',
    'npm:dev:worker',
  ];

  const child = spawn(concurrentlyBin, args, { cwd: root, stdio: 'inherit', shell: true });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main();
