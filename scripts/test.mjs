// Runs every tests/*.test.mjs with the live-lookup guard preloaded. Run: npm test
// It lists the files itself because Windows shells, and Node 20, do not expand `tests/*.test.mjs`.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = readdirSync(path.join(root, 'tests')).filter((name) => name.endsWith('.test.mjs')).sort().map((name) => path.join('tests', name));
const guard = pathToFileURL(path.join(root, 'tests', 'support', 'no-live-lookups.mjs')).href;

const result = spawnSync(process.execPath, ['--import', guard, '--test', ...files], { stdio: 'inherit', cwd: root });
process.exit(result.status ?? 1);
