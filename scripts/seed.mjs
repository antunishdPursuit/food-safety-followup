// Seeds a store with labeled data.
//   npm run seed:demo     add fictional demo checks to verified locations that have city citations
//   npm run seed:sample   load the sample fixture into .data-sample (run the app on it with npm run dev:sample)
import { dataDir } from '../lib/server/config.js';
import { seedDemoChecks } from '../lib/server/demo.js';
import { seedSample } from '../lib/server/sample.js';

const [command] = process.argv.slice(2);

try {
  if (command === 'demo') {
    const result = await seedDemoChecks({ dir: dataDir() });
    console.log(result.created ? `Added ${result.created} fictional demo checks at: ${result.locations.join(', ')}` : 'Nothing added. Run npm run data:match and npm run data:import first, so a verified location has city citations.');
  } else if (command === 'sample') {
    // The sample never goes into the live store unless FSF_DATA_DIR is set on purpose.
    const dir = process.env.FSF_DATA_DIR ? dataDir() : new URL('../.data-sample', import.meta.url).pathname;
    console.log(await seedSample({ dir }), `-> ${dir}`);
  } else {
    console.error('Unknown command. Use: demo or sample');
    process.exit(2);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
