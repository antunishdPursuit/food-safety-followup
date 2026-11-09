// Clears the follow-ups and link decisions a rehearsal leaves behind, after saving a copy of the store.
// It deletes the manager's entries, so it does nothing without --yes. Run: npm run demo:reset -- --yes
import { dataDir } from '../lib/server/config.js';
import { resetManagerState } from '../lib/server/demo.js';
import { readDb } from '../lib/server/store.js';

// Read .env when this Node version can (20.12 or newer); otherwise use the shell's environment.
try { process.loadEnvFile?.(); } catch { /* no .env file */ }

const dir = dataDir();
try {
  if (!process.argv.includes('--yes')) {
    const db = await readDb(dir);
    console.log(`This would remove ${Object.keys(db.followUps).length} follow-ups and ${Object.keys(db.links).length} link decisions from ${dir}.`);
    console.log('A copy of the store is saved first. To go ahead, run: npm run demo:reset -- --yes');
    process.exit(1);
  }
  const result = await resetManagerState({ dir });
  console.log(result.backup
    ? `Removed ${result.followUps} follow-ups and ${result.decisions} link decisions. Backup: ${result.backup}`
    : 'Nothing to remove. No follow-ups or link decisions are saved.');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
