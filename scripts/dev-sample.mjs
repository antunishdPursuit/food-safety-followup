// Starts the app on the labeled sample data, creating the sample store first when it is missing.
// Run: npm run dev:sample
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { seedSample } from '../lib/server/sample.js';
import { SAMPLE_DIR, nextDevCommand } from './sample.mjs';

const exists = await access(path.join(SAMPLE_DIR, 'db.json')).then(() => true, () => false);
if (!exists) console.log('Creating the sample store:', await seedSample({ dir: SAMPLE_DIR }));

const { command, args, env } = nextDevCommand(SAMPLE_DIR);
const child = spawn(command, args, { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
