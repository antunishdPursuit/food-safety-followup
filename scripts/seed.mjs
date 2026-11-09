// Seeds a store with labeled data.
//   npm run seed:sample   load the sample fixture into .data-sample (run the app on it with npm run dev:sample)
import { dataDir } from '../lib/server/config.js';
import { seedSample } from '../lib/server/sample.js';

const [command] = process.argv.slice(2);

try {
  if (command === 'sample') {
    // The sample never goes into the live store unless FSF_DATA_DIR is set on purpose.
    const dir = process.env.FSF_DATA_DIR ? dataDir() : new URL('../.data-sample', import.meta.url).pathname;
    console.log(await seedSample({ dir }), `-> ${dir}`);
  } else {
    console.error('Unknown command. Use: sample');
    process.exit(2);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
