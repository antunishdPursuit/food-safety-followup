// Builds the read-only static copy of the app from the current store.
//   1. writes public/snapshot/ (the list and one file per location),
//   2. runs `next build` in export mode, which writes the site to out/.
// Run: npm run build:snapshot   (set NEXT_PUBLIC_BASE_PATH=/repo-name when the site lives under a GitHub Pages path)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dataDir } from '../lib/server/config.js';
import { writeSnapshot } from '../lib/server/snapshot.js';

// Read .env when this Node version can (20.12 or newer); otherwise use the shell's environment.
try { process.loadEnvFile?.(); } catch { /* no .env file */ }

const outDir = fileURLToPath(new URL('../public/snapshot', import.meta.url));
const result = await writeSnapshot({ dir: dataDir(), outDir });
console.log(`Wrote ${result.locations} locations to public/snapshot.`);

const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, 'build'], { stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_SNAPSHOT: '1' } });
child.on('exit', (code) => process.exit(code ?? 1));
